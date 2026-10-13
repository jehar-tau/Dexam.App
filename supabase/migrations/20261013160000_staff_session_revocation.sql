-- D-028: durable application invalidation precedes provider token cleanup.
create table public.auth_session_cutoffs (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  invalidated_before timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.auth_session_cutoffs enable row level security;
revoke all on public.auth_session_cutoffs from anon, authenticated;

create or replace function public.current_person_id()
returns uuid
language sql stable security definer
set search_path = '' set row_security = off
as $$
  select identity.person_id
  from public.auth_identities identity
  where identity.auth_user_id = (select auth.uid())
    and (
      not exists (select 1 from public.auth_session_cutoffs cutoff where cutoff.auth_user_id = identity.auth_user_id)
      or exists (
        select 1
        from auth.sessions session
        join public.auth_session_cutoffs cutoff on cutoff.auth_user_id = session.user_id
        where session.user_id = identity.auth_user_id
          and session.id = (select case
            when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            then (auth.jwt() ->> 'session_id')::uuid else null::uuid end)
          and session.created_at > cutoff.invalidated_before
          and (session.not_after is null or session.not_after > now())
      )
    )
  limit 1
$$;
revoke all on function public.current_person_id() from public, anon;
grant execute on function public.current_person_id() to authenticated;

create or replace function public.invalidate_my_staff_sessions()
returns void
language plpgsql security definer
set search_path = '' set row_security = off
as $$
declare
  actor uuid := public.current_person_id();
begin
  if actor is null or not public.current_person_has_active_employee_membership() then
    raise exception using errcode = '42501', message = 'staff session invalidation denied';
  end if;
  insert into public.auth_session_cutoffs (auth_user_id, invalidated_before)
  values (auth.uid(), clock_timestamp())
  on conflict (auth_user_id) do update
    set invalidated_before = greatest(public.auth_session_cutoffs.invalidated_before, excluded.invalidated_before),
        updated_at = clock_timestamp();
  insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code)
  values (actor, actor, 'staff_sessions_invalidated', 'succeeded', 'self_requested');
end
$$;
revoke all on function public.invalidate_my_staff_sessions() from public, anon;
grant execute on function public.invalidate_my_staff_sessions() to authenticated;

create or replace function public.current_person_requires_mfa()
returns boolean
language sql stable security definer
set search_path = '' set row_security = off
as $$
  select public.current_person_has_active_employee_membership() and (
    exists (
      select 1 from public.role_assignments ra
      join public.role_capabilities rc on rc.role_key = ra.role_key
      join public.capabilities capability on capability.key = rc.capability_key
      where ra.person_id = public.current_person_id() and capability.requires_mfa
        and ra.revoked_at is null and ra.starts_at <= now()
        and (ra.ends_at is null or ra.ends_at > now())
    )
    or exists (
      select 1 from public.capability_grants cg
      join public.capabilities capability on capability.key = cg.capability_key
      join public.role_assignments ra
        on ra.person_id = cg.person_id and ra.role_key = cg.required_role_key
        and ra.scope_type = cg.scope_type and ra.scope_id is not distinct from cg.scope_id
      where cg.person_id = public.current_person_id() and capability.requires_mfa
        and cg.revoked_at is null and cg.starts_at <= now()
        and (cg.ends_at is null or cg.ends_at > now())
        and ra.revoked_at is null and ra.starts_at <= now()
        and (ra.ends_at is null or ra.ends_at > now())
    )
  )
$$;
revoke all on function public.current_person_requires_mfa() from public, anon;
grant execute on function public.current_person_requires_mfa() to authenticated;
