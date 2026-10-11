create type public.crm_privacy_case_kind as enum ('correction', 'erasure');
create type public.crm_privacy_case_status as enum (
  'under_review',
  'approval_required',
  'approved',
  'rejected',
  'completed',
  'partially_completed',
  'expired'
);
create type public.crm_privacy_requester_relationship as enum (
  'self',
  'parent_guardian',
  'authorized_representative'
);
create type public.crm_privacy_verification_method as enum (
  'existing_contact_callback',
  'member_account',
  'in_person',
  'authorized_representative'
);
create type public.crm_privacy_correction_field as enum (
  'subject_name',
  'contact_name',
  'contact_value',
  'interest_summary',
  'target_intake'
);
create type public.crm_privacy_lifecycle_state as enum (
  'active',
  'restricted',
  'minimization_due',
  'held',
  'minimized'
);
create type public.crm_privacy_hold_status as enum ('active', 'released');

insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values
  (
    'privacy.manage',
    'Record and investigate privacy requests, apply bounded corrections, and propose CRM erasure.',
    true,
    false
  ),
  (
    'privacy.erase_approve',
    'Approve irreversible CRM erasure proposed by a different privacy operator.',
    true,
    true
  );

alter table public.crm_enquiries
  add column privacy_state public.crm_privacy_lifecycle_state not null default 'active',
  add column privacy_policy_version text not null default 'D025-v1',
  add column retention_anchor_at timestamptz,
  add column minimization_due_at timestamptz,
  add column minimized_at timestamptz,
  add constraint crm_enquiries_privacy_policy_format check (
    privacy_policy_version ~ '^D[0-9]{3}-v[0-9]+$'
  ),
  add constraint crm_enquiries_privacy_lifecycle_consistent check (
    (
      privacy_state = 'active'
      and retention_anchor_at is null
      and minimization_due_at is null
      and minimized_at is null
    )
    or (
      privacy_state in ('restricted', 'minimization_due', 'held')
      and retention_anchor_at is not null
      and minimization_due_at is not null
      and minimization_due_at >= retention_anchor_at
      and minimized_at is null
    )
    or (
      privacy_state = 'minimized'
      and retention_anchor_at is not null
      and minimization_due_at is not null
      and minimized_at is not null
    )
  );

update public.crm_enquiries enquiry
set
  privacy_state = 'restricted',
  retention_anchor_at = coalesce(
    enquiry.closed_at,
    (
      select max(transition.occurred_at)
      from public.crm_enquiry_transitions transition
      where transition.enquiry_id = enquiry.id
        and transition.to_stage = 'converted'
    ),
    enquiry.updated_at
  ),
  minimization_due_at = coalesce(
    enquiry.closed_at,
    (
      select max(transition.occurred_at)
      from public.crm_enquiry_transitions transition
      where transition.enquiry_id = enquiry.id
        and transition.to_stage = 'converted'
    ),
    enquiry.updated_at
  ) + interval '1 year'
where enquiry.stage in ('closed', 'converted');

create index crm_enquiries_privacy_due_idx
  on public.crm_enquiries (minimization_due_at, id)
  where privacy_state in ('restricted', 'minimization_due');

create or replace function public.sync_crm_privacy_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.privacy_state = 'minimized' then
    return new;
  end if;

  if new.stage in ('closed', 'converted') then
    new.privacy_state := 'restricted';
    new.retention_anchor_at := case
      when new.stage = 'closed' then coalesce(new.closed_at, now())
      else now()
    end;
    new.minimization_due_at := new.retention_anchor_at + interval '1 year';
    new.minimized_at := null;
  else
    new.privacy_state := 'active';
    new.retention_anchor_at := null;
    new.minimization_due_at := null;
    new.minimized_at := null;
  end if;
  return new;
end;
$$;

create trigger crm_enquiries_privacy_lifecycle
before insert or update of stage on public.crm_enquiries
for each row execute function public.sync_crm_privacy_lifecycle();

create table public.crm_privacy_fingerprint_keys (
  singleton boolean primary key default true check (singleton),
  secret bytea not null,
  created_at timestamptz not null default now()
);

insert into public.crm_privacy_fingerprint_keys (secret)
values (extensions.gen_random_bytes(32));

create table public.crm_privacy_cases (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  kind public.crm_privacy_case_kind not null,
  status public.crm_privacy_case_status not null default 'under_review',
  requester_relationship public.crm_privacy_requester_relationship not null,
  verification_method public.crm_privacy_verification_method not null,
  request_summary text not null,
  proposal_reason text,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  verified_by_person_id uuid not null references public.people (id) on delete restrict,
  proposed_by_person_id uuid references public.people (id) on delete restrict,
  approved_by_person_id uuid references public.people (id) on delete restrict,
  rejected_by_person_id uuid references public.people (id) on delete restrict,
  approval_note text,
  rejection_reason text,
  completion_summary text,
  requested_at timestamptz not null default now(),
  verified_at timestamptz not null default now(),
  proposed_at timestamptz,
  approved_at timestamptz,
  rejected_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  updated_at timestamptz not null default now(),
  constraint crm_privacy_case_summary_bounded check (
    request_summary = btrim(request_summary)
    and length(request_summary) between 3 and 500
  ),
  constraint crm_privacy_case_proposal_bounded check (
    proposal_reason is null
    or (proposal_reason = btrim(proposal_reason) and length(proposal_reason) between 3 and 500)
  ),
  constraint crm_privacy_case_decision_bounded check (
    (approval_note is null or (approval_note = btrim(approval_note) and length(approval_note) between 3 and 500))
    and (rejection_reason is null or (rejection_reason = btrim(rejection_reason) and length(rejection_reason) between 3 and 500))
    and (completion_summary is null or (completion_summary = btrim(completion_summary) and length(completion_summary) between 3 and 500))
  ),
  constraint crm_privacy_case_expiry_order check (expires_at > requested_at),
  constraint crm_privacy_case_approval_distinct check (
    approved_by_person_id is null
    or proposed_by_person_id is null
    or approved_by_person_id <> proposed_by_person_id
  )
);

create index crm_privacy_cases_queue_idx
  on public.crm_privacy_cases (status, requested_at, id);
create index crm_privacy_cases_enquiry_idx
  on public.crm_privacy_cases (enquiry_id, requested_at desc);

create table public.crm_privacy_corrections (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.crm_privacy_cases (id) on delete restrict,
  field public.crm_privacy_correction_field not null,
  before_fingerprint text not null,
  after_fingerprint text not null,
  reason text not null,
  applied_by_person_id uuid not null references public.people (id) on delete restrict,
  applied_at timestamptz not null default now(),
  constraint crm_privacy_correction_fingerprints check (
    before_fingerprint ~ '^[0-9a-f]{64}$'
    and after_fingerprint ~ '^[0-9a-f]{64}$'
  ),
  constraint crm_privacy_correction_reason_bounded check (
    reason = btrim(reason) and length(reason) between 3 and 240
  )
);

create table public.crm_privacy_holds (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  status public.crm_privacy_hold_status not null default 'active',
  reason_code text not null,
  note text not null,
  placed_by_person_id uuid not null references public.people (id) on delete restrict,
  placed_at timestamptz not null default now(),
  review_by timestamptz not null,
  released_by_person_id uuid references public.people (id) on delete restrict,
  released_at timestamptz,
  release_reason text,
  constraint crm_privacy_hold_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint crm_privacy_hold_note_bounded check (
    note = btrim(note) and length(note) between 3 and 500
  ),
  constraint crm_privacy_hold_review_bounded check (
    review_by > placed_at and review_by <= placed_at + interval '90 days'
  ),
  constraint crm_privacy_hold_release_consistent check (
    (status = 'active' and released_by_person_id is null and released_at is null and release_reason is null)
    or (
      status = 'released'
      and released_by_person_id is not null
      and released_at is not null
      and release_reason is not null
      and length(btrim(release_reason)) between 3 and 240
    )
  )
);

create unique index crm_privacy_one_active_hold
  on public.crm_privacy_holds (enquiry_id)
  where status = 'active';
create index crm_privacy_holds_review_idx
  on public.crm_privacy_holds (review_by)
  where status = 'active';

create table public.crm_privacy_erasure_tombstones (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references public.crm_privacy_cases (id) on delete restrict,
  enquiry_id uuid not null unique references public.crm_enquiries (id) on delete restrict,
  subject_person_id uuid not null references public.people (id) on delete restrict,
  contact_person_id uuid not null references public.people (id) on delete restrict,
  policy_version text not null,
  executed_at timestamptz not null default now(),
  constraint crm_privacy_tombstone_policy_format check (policy_version ~ '^D[0-9]{3}-v[0-9]+$')
);

alter table public.crm_privacy_fingerprint_keys enable row level security;
alter table public.crm_privacy_cases enable row level security;
alter table public.crm_privacy_corrections enable row level security;
alter table public.crm_privacy_holds enable row level security;
alter table public.crm_privacy_erasure_tombstones enable row level security;

revoke all on table public.crm_privacy_fingerprint_keys from anon, authenticated;
revoke all on table public.crm_privacy_cases from anon, authenticated;
revoke all on table public.crm_privacy_corrections from anon, authenticated;
revoke all on table public.crm_privacy_holds from anon, authenticated;
revoke all on table public.crm_privacy_erasure_tombstones from anon, authenticated;

grant all on table public.crm_privacy_fingerprint_keys to service_role;
grant all on table public.crm_privacy_cases to service_role;
grant all on table public.crm_privacy_corrections to service_role;
grant all on table public.crm_privacy_holds to service_role;
grant all on table public.crm_privacy_erasure_tombstones to service_role;

create or replace function public.fingerprint_crm_privacy_value(p_value text)
returns text
language sql
volatile
security definer
set search_path = ''
set row_security = off
as $$
  select encode(
    extensions.hmac(
      convert_to(coalesce(p_value, ''), 'UTF8'),
      (select secret from public.crm_privacy_fingerprint_keys where singleton),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function public.list_crm_privacy_cases(
  p_limit integer default 50,
  p_status text default 'open'
)
returns table (
  id uuid,
  enquiry_id uuid,
  kind public.crm_privacy_case_kind,
  status public.crm_privacy_case_status,
  subject_name text,
  masked_contact text,
  requester_relationship public.crm_privacy_requester_relationship,
  verification_method public.crm_privacy_verification_method,
  request_summary text,
  proposal_reason text,
  proposer_name text,
  approver_name text,
  requested_at timestamptz,
  expires_at timestamptz,
  privacy_state public.crm_privacy_lifecycle_state,
  minimization_due_at timestamptz,
  hold_id uuid,
  hold_review_by timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'privacy case limit must be between 1 and 100';
  end if;
  if p_status not in ('open', 'completed', 'all') then
    raise exception using errcode = '22023', message = 'privacy case queue is invalid';
  end if;
  if not public.current_person_has_capability('privacy.manage') then
    raise exception using errcode = '42501', message = 'privacy operations access denied';
  end if;

  return query
  select
    privacy_case.id,
    enquiry.id,
    privacy_case.kind,
    privacy_case.status,
    subject.display_name,
    case contact_point.kind
      when 'email' then left(contact_point.display_value, 1) || '***@' || split_part(contact_point.normalized_value, '@', 2)
      else '•••• ' || right(contact_point.normalized_value, 4)
    end,
    privacy_case.requester_relationship,
    privacy_case.verification_method,
    privacy_case.request_summary,
    privacy_case.proposal_reason,
    proposer.display_name,
    approver.display_name,
    privacy_case.requested_at,
    privacy_case.expires_at,
    enquiry.privacy_state,
    enquiry.minimization_due_at,
    active_hold.id,
    active_hold.review_by
  from public.crm_privacy_cases privacy_case
  join public.crm_enquiries enquiry on enquiry.id = privacy_case.enquiry_id
  join public.people subject on subject.id = enquiry.subject_person_id
  join public.crm_contact_points contact_point on contact_point.id = enquiry.primary_contact_point_id
  left join public.people proposer on proposer.id = privacy_case.proposed_by_person_id
  left join public.people approver on approver.id = privacy_case.approved_by_person_id
  left join lateral (
    select hold.id, hold.review_by
    from public.crm_privacy_holds hold
    where hold.enquiry_id = enquiry.id
      and hold.status = 'active'
    limit 1
  ) active_hold on true
  where
    p_status = 'all'
    or (p_status = 'completed' and privacy_case.status in ('completed', 'partially_completed', 'rejected', 'expired'))
    or (p_status = 'open' and privacy_case.status in ('under_review', 'approval_required', 'approved'))
  order by privacy_case.requested_at, privacy_case.id
  limit p_limit;
end;
$$;

create or replace function public.create_crm_privacy_case(
  p_enquiry_id uuid,
  p_kind public.crm_privacy_case_kind,
  p_requester_relationship public.crm_privacy_requester_relationship,
  p_verification_method public.crm_privacy_verification_method,
  p_request_summary text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  privacy_case_id uuid;
begin
  if not public.current_person_has_capability('privacy.manage') then
    raise exception using errcode = '42501', message = 'privacy case creation denied';
  end if;
  if p_request_summary is null or btrim(p_request_summary) <> p_request_summary
     or length(p_request_summary) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'privacy request summary is invalid';
  end if;
  perform 1 from public.crm_enquiries enquiry
  where enquiry.id = p_enquiry_id and enquiry.privacy_state <> 'minimized'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CRM enquiry is unavailable';
  end if;

  insert into public.crm_privacy_cases (
    enquiry_id, kind, requester_relationship, verification_method, request_summary,
    created_by_person_id, verified_by_person_id
  ) values (
    p_enquiry_id, p_kind, p_requester_relationship, p_verification_method,
    p_request_summary, actor_id, actor_id
  ) returning id into privacy_case_id;
  return privacy_case_id;
end;
$$;

create or replace function public.apply_crm_privacy_correction(
  p_case_id uuid,
  p_field public.crm_privacy_correction_field,
  p_new_value text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_case public.crm_privacy_cases%rowtype;
  target_enquiry public.crm_enquiries%rowtype;
  target_contact public.crm_contact_points%rowtype;
  old_value text;
  corrected_normalized_value text;
begin
  if not public.current_person_has_capability('privacy.manage') then
    raise exception using errcode = '42501', message = 'privacy correction denied';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 240 then
    raise exception using errcode = '22023', message = 'correction reason is invalid';
  end if;
  if p_new_value is null or btrim(p_new_value) <> p_new_value then
    raise exception using errcode = '22023', message = 'corrected value is invalid';
  end if;

  select * into strict target_case
  from public.crm_privacy_cases privacy_case
  where privacy_case.id = p_case_id
  for update;
  if target_case.kind <> 'correction' or target_case.status <> 'under_review' then
    raise exception using errcode = '55000', message = 'privacy correction is no longer editable';
  end if;
  if target_case.expires_at <= now() then
    update public.crm_privacy_cases set status = 'expired', updated_at = now() where id = p_case_id;
    raise exception using errcode = '55000', message = 'privacy case expired';
  end if;

  select * into strict target_enquiry
  from public.crm_enquiries enquiry
  where enquiry.id = target_case.enquiry_id
  for update;
  select * into strict target_contact
  from public.crm_contact_points contact_point
  where contact_point.id = target_enquiry.primary_contact_point_id
  for update;

  case p_field
    when 'subject_name' then
      if length(p_new_value) not between 2 and 120 then
        raise exception using errcode = '22023', message = 'corrected name is invalid';
      end if;
      if exists (
        select 1 from public.people person
        where person.id = target_enquiry.subject_person_id
          and (
            person.member_id is not null
            or exists (select 1 from public.memberships membership where membership.person_id = person.id)
            or exists (select 1 from public.auth_identities identity where identity.person_id = person.id)
          )
      ) then
        raise exception using errcode = '55000', message = 'canonical identity correction requires a separate elevated workflow';
      end if;
      select display_name into old_value from public.people where id = target_enquiry.subject_person_id;
      update public.people set display_name = p_new_value, updated_at = now()
      where id = target_enquiry.subject_person_id;
    when 'contact_name' then
      if length(p_new_value) not between 2 and 120 then
        raise exception using errcode = '22023', message = 'corrected name is invalid';
      end if;
      if exists (
        select 1 from public.people person
        where person.id = target_enquiry.primary_contact_person_id
          and (
            person.member_id is not null
            or exists (select 1 from public.memberships membership where membership.person_id = person.id)
            or exists (select 1 from public.auth_identities identity where identity.person_id = person.id)
          )
      ) then
        raise exception using errcode = '55000', message = 'canonical identity correction requires a separate elevated workflow';
      end if;
      select display_name into old_value from public.people where id = target_enquiry.primary_contact_person_id;
      update public.people set display_name = p_new_value, updated_at = now()
      where id = target_enquiry.primary_contact_person_id;
    when 'contact_value' then
      old_value := target_contact.normalized_value;
      corrected_normalized_value := public.normalize_crm_contact_value(target_contact.kind, p_new_value);
      update public.crm_contact_points
      set normalized_value = corrected_normalized_value, display_value = p_new_value, is_verified = false
      where id = target_contact.id;
    when 'interest_summary' then
      if length(p_new_value) not between 2 and 240 then
        raise exception using errcode = '22023', message = 'corrected interest is invalid';
      end if;
      old_value := target_enquiry.interest_summary;
      update public.crm_enquiries set interest_summary = p_new_value, updated_at = now()
      where id = target_enquiry.id;
    when 'target_intake' then
      if length(p_new_value) not between 2 and 80 then
        raise exception using errcode = '22023', message = 'corrected intake is invalid';
      end if;
      old_value := coalesce(target_enquiry.target_intake, '');
      update public.crm_enquiries set target_intake = p_new_value, updated_at = now()
      where id = target_enquiry.id;
  end case;

  insert into public.crm_privacy_corrections (
    case_id, field, before_fingerprint, after_fingerprint, reason, applied_by_person_id
  ) values (
    p_case_id, p_field, public.fingerprint_crm_privacy_value(old_value),
    public.fingerprint_crm_privacy_value(p_new_value), p_reason, actor_id
  );

  update public.crm_privacy_cases
  set status = 'completed', completed_at = now(), updated_at = now(),
      completion_summary = 'Verified correction applied; readable prior value was not retained.'
  where id = p_case_id;

  if target_enquiry.stage in ('closed', 'converted') then
    update public.crm_enquiries
    set privacy_state = 'restricted', retention_anchor_at = now(),
        minimization_due_at = now() + interval '1 year'
    where id = target_enquiry.id;
  end if;
end;
$$;

create or replace function public.preview_crm_erasure(p_case_id uuid)
returns table (category text, record_count integer, planned_action text, protected_record boolean)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_case public.crm_privacy_cases%rowtype;
  target_enquiry public.crm_enquiries%rowtype;
begin
  if not public.current_person_has_capability('privacy.manage')
     and not public.current_person_has_capability('privacy.erase_approve') then
    raise exception using errcode = '42501', message = 'privacy erasure preview denied';
  end if;
  select * into strict target_case from public.crm_privacy_cases where id = p_case_id;
  if target_case.kind <> 'erasure' then
    raise exception using errcode = '22023', message = 'privacy case is not an erasure request';
  end if;
  select * into strict target_enquiry from public.crm_enquiries where id = target_case.enquiry_id;

  return query
  select 'Identity and contact'::text, 1,
    'Remove CRM contact values and anonymize prospect-only names.'::text,
    exists (
      select 1 from public.memberships membership
      where membership.person_id in (target_enquiry.subject_person_id, target_enquiry.primary_contact_person_id)
    )
  union all
  select 'CRM free text',
    (select count(*)::integer from public.crm_activities activity where activity.enquiry_id = target_enquiry.id and activity.note is not null)
      + (case when target_enquiry.interest_summary is not null then 1 else 0 end)
      + (case when target_enquiry.target_intake is not null then 1 else 0 end),
    'Erase notes and replace required text with a non-personal marker.', false
  union all
  select 'Follow-ups and alerts',
    (select count(*)::integer from public.crm_follow_ups follow_up where follow_up.enquiry_id = target_enquiry.id)
      + (select count(*)::integer from public.notifications notification where notification.crm_enquiry_id = target_enquiry.id),
    'Close open work and expire related CRM notifications.', false
  union all
  select 'Enrolment handoff',
    (select count(*)::integer from public.crm_enrolment_review_requests review where review.enquiry_id = target_enquiry.id),
    'Minimize CRM notes; preserve canonical student and enrolment records.',
    exists (select 1 from public.crm_enrolment_review_requests review where review.enquiry_id = target_enquiry.id and review.enrollment_id is not null);
end;
$$;

create or replace function public.propose_crm_erasure(p_case_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_case public.crm_privacy_cases%rowtype;
begin
  if not public.current_person_has_capability('privacy.manage') then
    raise exception using errcode = '42501', message = 'privacy erasure proposal denied';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'erasure proposal reason is invalid';
  end if;
  select * into strict target_case from public.crm_privacy_cases where id = p_case_id for update;
  if target_case.kind <> 'erasure' or target_case.status <> 'under_review' then
    raise exception using errcode = '55000', message = 'privacy erasure is no longer proposal-ready';
  end if;
  if target_case.expires_at <= now() then
    update public.crm_privacy_cases set status = 'expired', updated_at = now() where id = p_case_id;
    raise exception using errcode = '55000', message = 'privacy case expired';
  end if;
  update public.crm_privacy_cases
  set status = 'approval_required', proposal_reason = p_reason,
      proposed_by_person_id = actor_id, proposed_at = now(), updated_at = now()
  where id = p_case_id;
end;
$$;

create or replace function public.decide_crm_erasure(
  p_case_id uuid,
  p_approve boolean,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_case public.crm_privacy_cases%rowtype;
begin
  if not public.current_person_has_capability('privacy.erase_approve')
     or not public.current_person_has_role('elevated_admin') then
    raise exception using errcode = '42501', message = 'privacy erasure approval denied';
  end if;
  if p_note is null or btrim(p_note) <> p_note or length(p_note) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'erasure decision note is invalid';
  end if;
  select * into strict target_case from public.crm_privacy_cases where id = p_case_id for update;
  if target_case.kind <> 'erasure' or target_case.status <> 'approval_required' then
    raise exception using errcode = '55000', message = 'privacy erasure is not awaiting approval';
  end if;
  if target_case.proposed_by_person_id = actor_id then
    raise exception using errcode = '42501', message = 'erasure proposer cannot approve their own request';
  end if;
  if target_case.expires_at <= now() then
    update public.crm_privacy_cases set status = 'expired', updated_at = now() where id = p_case_id;
    raise exception using errcode = '55000', message = 'privacy case expired';
  end if;

  if p_approve then
    update public.crm_privacy_cases
    set status = 'approved', approved_by_person_id = actor_id,
        approval_note = p_note, approved_at = now(), updated_at = now()
    where id = p_case_id;
  else
    update public.crm_privacy_cases
    set status = 'rejected', rejected_by_person_id = actor_id,
        rejection_reason = p_note, rejected_at = now(), updated_at = now()
    where id = p_case_id;
  end if;
end;
$$;

create or replace function public.place_crm_privacy_hold(
  p_enquiry_id uuid,
  p_reason_code text,
  p_note text,
  p_review_by timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  hold_id uuid;
begin
  if not public.current_person_has_capability('privacy.manage') then
    raise exception using errcode = '42501', message = 'privacy hold denied';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{2,79}$'
     or p_note is null or btrim(p_note) <> p_note or length(p_note) not between 3 and 500
     or p_review_by <= now() or p_review_by > now() + interval '90 days' then
    raise exception using errcode = '22023', message = 'privacy hold details are invalid';
  end if;
  perform 1 from public.crm_enquiries where id = p_enquiry_id and privacy_state <> 'minimized' for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CRM enquiry is unavailable';
  end if;
  insert into public.crm_privacy_holds (
    enquiry_id, reason_code, note, placed_by_person_id, review_by
  ) values (p_enquiry_id, p_reason_code, p_note, actor_id, p_review_by)
  returning id into hold_id;
  update public.crm_enquiries
  set privacy_state = 'held', retention_anchor_at = coalesce(retention_anchor_at, now()),
      minimization_due_at = coalesce(minimization_due_at, now() + interval '1 year')
  where id = p_enquiry_id;
  return hold_id;
end;
$$;

create or replace function public.release_crm_privacy_hold(p_hold_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_hold public.crm_privacy_holds%rowtype;
begin
  if not public.current_person_has_capability('privacy.manage') then
    raise exception using errcode = '42501', message = 'privacy hold release denied';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 240 then
    raise exception using errcode = '22023', message = 'privacy hold release reason is invalid';
  end if;
  select * into strict target_hold from public.crm_privacy_holds where id = p_hold_id for update;
  if target_hold.status <> 'active' then
    raise exception using errcode = '55000', message = 'privacy hold is no longer active';
  end if;
  update public.crm_privacy_holds
  set status = 'released', released_by_person_id = actor_id,
      released_at = now(), release_reason = p_reason
  where id = p_hold_id;
  update public.crm_enquiries
  set privacy_state = case when minimization_due_at <= now() then 'minimization_due'::public.crm_privacy_lifecycle_state else 'restricted'::public.crm_privacy_lifecycle_state end
  where id = target_hold.enquiry_id and privacy_state = 'held';
end;
$$;

create or replace function public.execute_approved_crm_erasure(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_case public.crm_privacy_cases%rowtype;
  target_enquiry public.crm_enquiries%rowtype;
  anonymized_contact text;
  anonymized_contact_point_id uuid;
  subject_is_protected boolean;
  contact_is_protected boolean;
begin
  select * into strict target_case from public.crm_privacy_cases where id = p_case_id for update;
  if target_case.status = 'completed'
     and exists (select 1 from public.crm_privacy_erasure_tombstones where case_id = p_case_id) then
    return;
  end if;
  if target_case.kind <> 'erasure' or target_case.status <> 'approved' then
    raise exception using errcode = '55000', message = 'privacy erasure is not approved';
  end if;
  if target_case.expires_at <= now() then
    update public.crm_privacy_cases set status = 'expired', updated_at = now() where id = p_case_id;
    raise exception using errcode = '55000', message = 'privacy case expired';
  end if;
  if not public.person_has_global_capability(target_case.proposed_by_person_id, 'privacy.manage')
     or not public.person_has_global_capability(target_case.approved_by_person_id, 'privacy.erase_approve') then
    raise exception using errcode = '42501', message = 'privacy authority changed before execution';
  end if;

  select * into strict target_enquiry from public.crm_enquiries
  where id = target_case.enquiry_id for update;
  if exists (
    select 1 from public.crm_privacy_holds hold
    where hold.enquiry_id = target_enquiry.id
      and hold.status = 'active'
      and hold.review_by > now()
  ) then
    raise exception using errcode = '55000', message = 'an active privacy hold prevents erasure';
  end if;

  subject_is_protected := exists (
    select 1 from public.memberships where person_id = target_enquiry.subject_person_id
  ) or exists (
    select 1 from public.auth_identities where person_id = target_enquiry.subject_person_id
  ) or exists (
    select 1 from public.people where id = target_enquiry.subject_person_id and member_id is not null
  );
  contact_is_protected := exists (
    select 1 from public.memberships where person_id = target_enquiry.primary_contact_person_id
  ) or exists (
    select 1 from public.auth_identities where person_id = target_enquiry.primary_contact_person_id
  ) or exists (
    select 1 from public.people where id = target_enquiry.primary_contact_person_id and member_id is not null
  );

  if not subject_is_protected and not exists (
    select 1 from public.crm_enquiries other
    where other.id <> target_enquiry.id
      and other.subject_person_id = target_enquiry.subject_person_id
      and other.privacy_state <> 'minimized'
  ) then
    update public.people set display_name = 'Erased CRM person', status = 'archived', updated_at = now()
    where id = target_enquiry.subject_person_id;
  end if;
  if target_enquiry.primary_contact_person_id <> target_enquiry.subject_person_id
     and not contact_is_protected and not exists (
       select 1 from public.crm_enquiries other
       where other.id <> target_enquiry.id
         and other.primary_contact_person_id = target_enquiry.primary_contact_person_id
         and other.privacy_state <> 'minimized'
     ) then
    update public.people set display_name = 'Erased CRM contact', status = 'archived', updated_at = now()
    where id = target_enquiry.primary_contact_person_id;
  end if;

  anonymized_contact := 'erased+' || replace(target_enquiry.primary_contact_point_id::text, '-', '') || '@example.invalid';
  if exists (
    select 1 from public.crm_enquiries other
    where other.id <> target_enquiry.id
      and other.primary_contact_point_id = target_enquiry.primary_contact_point_id
      and other.privacy_state <> 'minimized'
  ) then
    insert into public.crm_contact_points (
      person_id, kind, normalized_value, display_value, is_verified, source, created_by_person_id
    ) values (
      target_enquiry.primary_contact_person_id, 'email', anonymized_contact, anonymized_contact,
      false, 'privacy_erasure', target_case.approved_by_person_id
    ) returning id into anonymized_contact_point_id;
    update public.crm_enquiries
    set primary_contact_point_id = anonymized_contact_point_id
    where id = target_enquiry.id;
  else
    update public.crm_contact_points
    set kind = 'email', normalized_value = anonymized_contact,
        display_value = anonymized_contact, is_verified = false, source = 'privacy_erasure'
    where id = target_enquiry.primary_contact_point_id;
  end if;

  if target_enquiry.primary_contact_person_id <> target_enquiry.subject_person_id
     and not exists (
       select 1 from public.crm_enquiries other
       where other.id <> target_enquiry.id
         and other.privacy_state <> 'minimized'
         and other.subject_person_id = target_enquiry.subject_person_id
         and other.primary_contact_person_id = target_enquiry.primary_contact_person_id
     ) then
    delete from public.crm_person_relationships relationship
    where relationship.subject_person_id = target_enquiry.subject_person_id
      and relationship.related_person_id = target_enquiry.primary_contact_person_id;
  end if;

  update public.crm_activities set note = null where enquiry_id = target_enquiry.id;
  update public.crm_enquiry_transitions set note = null where enquiry_id = target_enquiry.id;
  update public.crm_enquiry_ownership_history
  set reason = 'Privacy minimized' where enquiry_id = target_enquiry.id;
  update public.crm_follow_ups
  set status = case when status = 'open' then 'cancelled'::public.crm_follow_up_status else status end,
      disposition = 'Privacy minimized',
      completed_at = coalesce(completed_at, now()),
      replaced_by_follow_up_id = case when status = 'open' then null else replaced_by_follow_up_id end
  where enquiry_id = target_enquiry.id;
  update public.crm_enrolment_review_requests
  set request_note = 'Privacy minimized',
      decision_reason = case when decision_reason is null then null else 'Privacy minimized' end
  where enquiry_id = target_enquiry.id;
  delete from public.crm_identity_candidates where enquiry_id = target_enquiry.id;
  update public.notifications
  set expires_at = greatest(created_at + interval '1 second', least(expires_at, now())),
      read_at = coalesce(read_at, now())
  where crm_enquiry_id = target_enquiry.id;

  update public.crm_enquiries
  set interest_summary = 'Erased CRM record', target_intake = null,
      closed_reason = case when stage = 'closed' then 'Privacy minimized' else null end,
      privacy_state = 'minimized', minimized_at = now(), updated_at = now()
  where id = target_enquiry.id;

  insert into public.crm_privacy_erasure_tombstones (
    case_id, enquiry_id, subject_person_id, contact_person_id, policy_version
  ) values (
    target_case.id, target_enquiry.id, target_enquiry.subject_person_id,
    target_enquiry.primary_contact_person_id, target_enquiry.privacy_policy_version
  );
  update public.crm_privacy_cases
  set status = 'completed', completed_at = now(), updated_at = now(),
      completion_summary = 'Approved CRM personal data was minimized; protected student and academic records were not changed.'
  where id = target_case.id;
end;
$$;

create or replace function public.list_crm_records_due_for_minimization(p_limit integer default 100)
returns table (enquiry_id uuid, minimization_due_at timestamptz, privacy_policy_version text)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_limit not between 1 and 500 then
    raise exception using errcode = '22023', message = 'minimization queue limit must be between 1 and 500';
  end if;
  return query
  select enquiry.id, enquiry.minimization_due_at, enquiry.privacy_policy_version
  from public.crm_enquiries enquiry
  where enquiry.privacy_state in ('restricted', 'minimization_due')
    and enquiry.minimization_due_at <= now()
    and not exists (
      select 1 from public.crm_privacy_holds hold
      where hold.enquiry_id = enquiry.id
        and hold.status = 'active'
        and hold.review_by > now()
    )
  order by enquiry.minimization_due_at, enquiry.id
  limit p_limit;
end;
$$;

create or replace function public.current_person_can_manage_crm_enquiry(p_enquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.crm_enquiries enquiry
    where enquiry.id = p_enquiry_id
      and enquiry.owner_person_id = public.current_person_id()
      and enquiry.privacy_state <> 'minimized'
      and public.person_has_global_capability(public.current_person_id(), 'lead.manage_assigned')
  ), false)
$$;

create or replace function public.list_crm_enquiries(
  p_limit integer default 25,
  p_search text default null,
  p_queue text default 'active'
)
returns table (
  id uuid,
  subject_name text,
  contact_name text,
  contact_relationship public.crm_contact_relationship,
  contact_kind public.crm_contact_kind,
  contact_value text,
  source text,
  interest_summary text,
  target_intake text,
  stage public.crm_enquiry_stage,
  owner_name text,
  follow_up_id uuid,
  follow_up_due_at timestamptz,
  last_activity_at timestamptz,
  last_activity_outcome public.crm_activity_outcome,
  possible_identity_match boolean,
  review_requested_at timestamptz,
  review_status public.crm_enrolment_review_status,
  review_decision_reason text,
  review_resolved_at timestamptz,
  closed_reason text,
  closed_at timestamptz,
  archive_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  search_term text := nullif(btrim(p_search), '');
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'CRM list limit must be between 1 and 100';
  end if;
  if search_term is not null and length(search_term) > 80 then
    raise exception using errcode = '22023', message = 'CRM search is too long';
  end if;
  if p_queue not in ('active', 'recently_dead', 'dead_archive') then
    raise exception using errcode = '22023', message = 'CRM queue is invalid';
  end if;
  if not (
    public.person_has_global_capability(public.current_person_id(), 'lead.manage_assigned')
    or public.person_has_global_capability(public.current_person_id(), 'lead.assign')
  ) then
    raise exception using errcode = '42501', message = 'CRM access denied';
  end if;

  return query
  select
    enquiry.id,
    subject.display_name,
    contact.display_name,
    enquiry.contact_relationship,
    contact_point.kind,
    contact_point.display_value,
    enquiry.source,
    enquiry.interest_summary,
    enquiry.target_intake,
    enquiry.stage,
    owner.display_name,
    follow_up.id,
    follow_up.due_at,
    activity.occurred_at,
    activity.outcome,
    exists (
      select 1 from public.crm_identity_candidates candidate
      where candidate.enquiry_id = enquiry.id and candidate.status = 'pending'
    ),
    review.requested_at,
    review.status,
    review.decision_reason,
    review.resolved_at,
    enquiry.closed_reason,
    enquiry.closed_at,
    enquiry.closed_at + interval '7 days',
    enquiry.created_at
  from public.crm_enquiries enquiry
  join public.people subject on subject.id = enquiry.subject_person_id
  join public.people contact on contact.id = enquiry.primary_contact_person_id
  join public.crm_contact_points contact_point on contact_point.id = enquiry.primary_contact_point_id
  left join public.people owner on owner.id = enquiry.owner_person_id
  left join lateral (
    select item.id, item.due_at
    from public.crm_follow_ups item
    where item.enquiry_id = enquiry.id and item.status = 'open'
    limit 1
  ) follow_up on true
  left join lateral (
    select item.occurred_at, item.outcome
    from public.crm_activities item
    where item.enquiry_id = enquiry.id
    order by item.occurred_at desc, item.id desc
    limit 1
  ) activity on true
  left join lateral (
    select item.requested_at, item.status, item.decision_reason, item.resolved_at
    from public.crm_enrolment_review_requests item
    where item.enquiry_id = enquiry.id
    order by item.requested_at desc, item.id desc
    limit 1
  ) review on true
  where enquiry.privacy_state <> 'minimized'
    and (
      public.person_has_global_capability(public.current_person_id(), 'lead.assign')
      or enquiry.owner_person_id = public.current_person_id()
    )
    and (
      (p_queue = 'active' and enquiry.stage not in ('closed', 'converted'))
      or (
        p_queue = 'recently_dead'
        and enquiry.stage = 'closed'
        and enquiry.closed_at > now() - interval '7 days'
      )
      or (
        p_queue = 'dead_archive'
        and enquiry.stage = 'closed'
        and enquiry.closed_at <= now() - interval '7 days'
      )
    )
    and (
      search_term is null
      or position(lower(search_term) in lower(subject.display_name)) > 0
      or position(lower(search_term) in lower(contact.display_name)) > 0
      or position(lower(search_term) in lower(contact_point.normalized_value)) > 0
    )
  order by
    case when enquiry.stage = 'closed' then enquiry.closed_at end desc nulls last,
    case when follow_up.due_at < now() then 0 when follow_up.due_at is not null then 1 else 2 end,
    follow_up.due_at nulls last,
    enquiry.created_at desc,
    enquiry.id
  limit p_limit;
end;
$$;

revoke all on function public.fingerprint_crm_privacy_value(text) from public, anon, authenticated;
revoke all on function public.list_crm_privacy_cases(integer, text) from public, anon;
revoke all on function public.create_crm_privacy_case(uuid, public.crm_privacy_case_kind, public.crm_privacy_requester_relationship, public.crm_privacy_verification_method, text) from public, anon;
revoke all on function public.apply_crm_privacy_correction(uuid, public.crm_privacy_correction_field, text, text) from public, anon;
revoke all on function public.preview_crm_erasure(uuid) from public, anon;
revoke all on function public.propose_crm_erasure(uuid, text) from public, anon;
revoke all on function public.decide_crm_erasure(uuid, boolean, text) from public, anon;
revoke all on function public.place_crm_privacy_hold(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.release_crm_privacy_hold(uuid, text) from public, anon;
revoke all on function public.execute_approved_crm_erasure(uuid) from public, anon, authenticated;
revoke all on function public.list_crm_records_due_for_minimization(integer) from public, anon, authenticated;

grant execute on function public.list_crm_privacy_cases(integer, text) to authenticated;
grant execute on function public.create_crm_privacy_case(uuid, public.crm_privacy_case_kind, public.crm_privacy_requester_relationship, public.crm_privacy_verification_method, text) to authenticated;
grant execute on function public.apply_crm_privacy_correction(uuid, public.crm_privacy_correction_field, text, text) to authenticated;
grant execute on function public.preview_crm_erasure(uuid) to authenticated;
grant execute on function public.propose_crm_erasure(uuid, text) to authenticated;
grant execute on function public.decide_crm_erasure(uuid, boolean, text) to authenticated;
grant execute on function public.place_crm_privacy_hold(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.release_crm_privacy_hold(uuid, text) to authenticated;
grant execute on function public.execute_approved_crm_erasure(uuid) to service_role;
grant execute on function public.list_crm_records_due_for_minimization(integer) to service_role;

comment on table public.crm_privacy_cases is
  'Verified, staff-recorded CRM correction and erasure requests. Identity documents and raw prior values are prohibited.';
comment on table public.crm_privacy_erasure_tombstones is
  'Non-content evidence used to reapply approved erasure after a backup restoration.';
comment on function public.execute_approved_crm_erasure(uuid) is
  'Service-only, idempotent execution of a distinctly proposed and approved CRM erasure.';
