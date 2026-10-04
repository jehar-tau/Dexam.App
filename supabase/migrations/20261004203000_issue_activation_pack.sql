alter table public.account_action_tokens
  add column enrollment_id uuid references public.enrollments (id) on delete restrict;

create index account_action_tokens_enrollment_idx
  on public.account_action_tokens (enrollment_id, created_at desc)
  where enrollment_id is not null;

create or replace function public.issue_student_activation_pack(
  p_enrollment_id uuid,
  p_link_token_hash text,
  p_backup_code_hash text,
  p_expires_at timestamptz,
  p_reason_code text
)
returns table (
  token_id uuid,
  person_id uuid,
  member_id text,
  expires_at timestamptz,
  is_reissue boolean
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_enrollment public.enrollments%rowtype;
  target_member_id text;
  actor_person_id uuid;
  created_token_id uuid;
  reissuing boolean;
begin
  actor_person_id := public.current_person_id();

  if actor_person_id is null
    or not public.current_person_has_capability('enrollment.operate') then
    raise exception 'activation pack issuance is not authorized' using errcode = '42501';
  end if;

  if p_link_token_hash !~ '^[a-f0-9]{64}$'
    or p_backup_code_hash !~ '^[a-f0-9]{64}$'
    or p_link_token_hash = p_backup_code_hash then
    raise exception 'invalid activation credential hashes' using errcode = '22023';
  end if;

  if p_expires_at <= now()
    or p_expires_at > now() + interval '48 hours' then
    raise exception 'invalid activation expiry' using errcode = '22023';
  end if;

  if p_reason_code !~ '^[a-z][a-z0-9_]{2,79}$' then
    raise exception 'invalid reason code' using errcode = '22023';
  end if;

  select e.*
  into target_enrollment
  from public.enrollments e
  where e.id = p_enrollment_id
  for update;

  if target_enrollment.id is null or target_enrollment.status not in ('approved', 'active') then
    raise exception 'enrollment is not eligible for activation' using errcode = 'P0001';
  end if;

  reissuing := target_enrollment.status = 'active';

  if reissuing and p_reason_code = 'initial_activation_pack' then
    raise exception 'a reissue reason is required' using errcode = '22023';
  end if;

  select p.member_id
  into target_member_id
  from public.people p
  join public.memberships m on m.person_id = p.id
  join public.offerings o on o.id = target_enrollment.offering_id
  left join public.cohorts c on c.id = target_enrollment.cohort_id
  where p.id = target_enrollment.person_id
    and p.status = 'active'
    and p.member_id is not null
    and m.kind = 'student'
    and m.status = 'active'
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
    and o.status = 'active'
    and (o.available_from is null or o.available_from <= now())
    and (o.available_until is null or o.available_until > now())
    and (c.id is null or c.status = 'active')
    and not exists (
      select 1
      from public.auth_identities ai
      where ai.person_id = p.id
    );

  if target_member_id is null then
    raise exception 'student is not eligible for activation' using errcode = 'P0001';
  end if;

  update public.account_action_tokens aat
  set invalidated_at = now()
  where aat.person_id = target_enrollment.person_id
    and aat.kind = 'activation'
    and aat.consumed_at is null
    and aat.invalidated_at is null;

  if not reissuing then
    update public.enrollments
    set status = 'active', activated_at = now(), updated_at = now()
    where id = target_enrollment.id;

    insert into public.enrollment_transitions (
      enrollment_id,
      from_status,
      to_status,
      actor_person_id,
      reason_code
    ) values (
      target_enrollment.id,
      'approved',
      'active',
      actor_person_id,
      'activation_pack_issued'
    );
  end if;

  insert into public.account_action_tokens (
    person_id,
    enrollment_id,
    kind,
    link_token_hash,
    backup_code_hash,
    expires_at,
    created_by_person_id
  ) values (
    target_enrollment.person_id,
    target_enrollment.id,
    'activation',
    p_link_token_hash,
    p_backup_code_hash,
    p_expires_at,
    actor_person_id
  )
  returning id into created_token_id;

  insert into public.security_audit_events (
    subject_person_id,
    actor_person_id,
    event_type,
    outcome,
    reason_code,
    metadata
  ) values (
    target_enrollment.person_id,
    actor_person_id,
    case when reissuing then 'activation_pack_reissued' else 'activation_pack_issued' end,
    'succeeded',
    p_reason_code,
    jsonb_build_object(
      'enrollment_id', target_enrollment.id,
      'token_id', created_token_id,
      'expires_at', p_expires_at
    )
  );

  return query
  select
    created_token_id,
    target_enrollment.person_id,
    target_member_id,
    p_expires_at,
    reissuing;
end;
$$;

revoke all on function public.issue_student_activation_pack(uuid, text, text, timestamptz, text)
from public, anon;
grant execute on function public.issue_student_activation_pack(uuid, text, text, timestamptz, text)
to authenticated;

comment on function public.issue_student_activation_pack(uuid, text, text, timestamptz, text) is
  'Atomically activates an approved enrolment or reissues its unused activation pack after current Enrolment Operator authorization and eligibility checks. Accepts hashes only; raw credentials remain in the trusted Edge Function response.';
