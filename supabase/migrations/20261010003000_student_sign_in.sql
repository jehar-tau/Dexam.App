create table public.auth_sign_in_attempt_buckets (
  scope text not null,
  bucket_hash text not null,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (scope, bucket_hash),
  constraint auth_sign_in_attempt_buckets_scope check (
    scope in ('student_member', 'student_network')
  ),
  constraint auth_sign_in_attempt_buckets_hash check (
    bucket_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint auth_sign_in_attempt_buckets_count check (attempt_count >= 0)
);

alter table public.auth_sign_in_attempt_buckets enable row level security;

revoke all on table public.auth_sign_in_attempt_buckets from public, anon, authenticated;
grant all on table public.auth_sign_in_attempt_buckets to service_role;

create or replace function public.current_person_has_active_student_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    exists (
      select 1
      from public.people p
      join public.memberships m on m.person_id = p.id
      where p.id = public.current_person_id()
        and p.status = 'active'
        and m.kind = 'student'
        and m.status = 'active'
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    ),
    false
  )
$$;

create or replace function public.consume_student_sign_in_attempt(
  p_member_hash text,
  p_network_hash text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  checked_at timestamptz := clock_timestamp();
  member_allowed boolean;
  network_allowed boolean;
begin
  if p_member_hash !~ '^[a-f0-9]{64}$'
    or p_network_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid sign-in bucket hash' using errcode = '22023';
  end if;

  insert into public.auth_sign_in_attempt_buckets as bucket (
    scope,
    bucket_hash,
    window_started_at,
    attempt_count,
    updated_at
  ) values (
    'student_member',
    p_member_hash,
    checked_at,
    1,
    checked_at
  )
  on conflict (scope, bucket_hash) do update
  set
    window_started_at = case
      when bucket.window_started_at <= checked_at - interval '15 minutes' then checked_at
      else bucket.window_started_at
    end,
    attempt_count = case
      when bucket.window_started_at <= checked_at - interval '15 minutes' then 1
      else bucket.attempt_count + 1
    end,
    blocked_until = case
      when bucket.blocked_until > checked_at then bucket.blocked_until
      when bucket.window_started_at <= checked_at - interval '15 minutes' then null
      when bucket.attempt_count + 1 > 10 then checked_at + interval '15 minutes'
      else null
    end,
    updated_at = checked_at
  returning blocked_until is null or blocked_until <= checked_at into member_allowed;

  insert into public.auth_sign_in_attempt_buckets as bucket (
    scope,
    bucket_hash,
    window_started_at,
    attempt_count,
    updated_at
  ) values (
    'student_network',
    p_network_hash,
    checked_at,
    1,
    checked_at
  )
  on conflict (scope, bucket_hash) do update
  set
    window_started_at = case
      when bucket.window_started_at <= checked_at - interval '15 minutes' then checked_at
      else bucket.window_started_at
    end,
    attempt_count = case
      when bucket.window_started_at <= checked_at - interval '15 minutes' then 1
      else bucket.attempt_count + 1
    end,
    blocked_until = case
      when bucket.blocked_until > checked_at then bucket.blocked_until
      when bucket.window_started_at <= checked_at - interval '15 minutes' then null
      when bucket.attempt_count + 1 > 60 then checked_at + interval '15 minutes'
      else null
    end,
    updated_at = checked_at
  returning blocked_until is null or blocked_until <= checked_at into network_allowed;

  return member_allowed and network_allowed;
end;
$$;

create or replace function public.clear_student_sign_in_member_attempts(p_member_hash text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_member_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid sign-in bucket hash' using errcode = '22023';
  end if;

  delete from public.auth_sign_in_attempt_buckets
  where scope = 'student_member'
    and bucket_hash = p_member_hash;
end;
$$;

revoke all on function public.current_person_has_active_student_membership() from public, anon;
grant execute on function public.current_person_has_active_student_membership() to authenticated;

revoke all on function public.consume_student_sign_in_attempt(text, text)
from public, anon, authenticated;
grant execute on function public.consume_student_sign_in_attempt(text, text) to service_role;

revoke all on function public.clear_student_sign_in_member_attempts(text)
from public, anon, authenticated;
grant execute on function public.clear_student_sign_in_member_attempts(text) to service_role;

comment on table public.auth_sign_in_attempt_buckets is
  'Short-lived student sign-in abuse counters keyed only by server-created HMAC hashes. Raw Member IDs and network addresses are never stored here.';
comment on function public.current_person_has_active_student_membership() is
  'Checks live person and student-membership state so suspension or membership removal overrides an existing access token.';
comment on function public.consume_student_sign_in_attempt(text, text) is
  'Service-only application throttle: ten Member-ID attempts or sixty network attempts per rolling fifteen-minute bucket.';
