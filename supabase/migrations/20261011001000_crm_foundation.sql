create type public.crm_contact_kind as enum ('phone', 'email');
create type public.crm_contact_relationship as enum ('self', 'guardian', 'other');
create type public.crm_enquiry_stage as enum (
  'new',
  'contact_in_progress',
  'engaged',
  'qualified',
  'enrolment_review_requested',
  'converted',
  'closed'
);
create type public.crm_activity_outcome as enum (
  'contact_attempted',
  'connected',
  'counselling_arranged',
  'no_response',
  'note_added'
);
create type public.crm_follow_up_status as enum ('open', 'completed', 'cancelled', 'replaced');
create type public.crm_identity_candidate_status as enum ('pending', 'distinct_people', 'resolved');

insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values (
  'lead.assign',
  'Assign and reassign CRM enquiries and view the unassigned operational queue.',
  false,
  false
);

insert into public.role_capabilities (role_key, capability_key)
values ('elevated_admin', 'lead.assign');

create table public.crm_contact_points (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  kind public.crm_contact_kind not null,
  normalized_value text not null,
  display_value text not null,
  is_verified boolean not null default false,
  source text not null default 'manual_enquiry',
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint crm_contact_points_value_bounded check (
    length(normalized_value) between 5 and 254
    and length(display_value) between 5 and 254
  ),
  constraint crm_contact_points_source_format check (source ~ '^[a-z][a-z0-9_]{2,49}$'),
  constraint crm_contact_points_kind_format check (
    (kind = 'email' and normalized_value ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
    or (kind = 'phone' and normalized_value ~ '^\+[1-9][0-9]{7,14}$')
  )
);

create index crm_contact_points_normalized_idx
  on public.crm_contact_points (kind, normalized_value);
create index crm_contact_points_person_idx on public.crm_contact_points (person_id);

create table public.crm_person_relationships (
  id uuid primary key default gen_random_uuid(),
  subject_person_id uuid not null references public.people (id) on delete restrict,
  related_person_id uuid not null references public.people (id) on delete restrict,
  relationship public.crm_contact_relationship not null,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint crm_person_relationships_distinct check (subject_person_id <> related_person_id),
  constraint crm_person_relationships_non_self check (relationship <> 'self'),
  constraint crm_person_relationships_unique unique (
    subject_person_id, related_person_id, relationship
  )
);

create table public.crm_enquiries (
  id uuid primary key default gen_random_uuid(),
  subject_person_id uuid not null references public.people (id) on delete restrict,
  primary_contact_person_id uuid not null references public.people (id) on delete restrict,
  primary_contact_point_id uuid not null references public.crm_contact_points (id) on delete restrict,
  contact_relationship public.crm_contact_relationship not null,
  source text not null default 'manual',
  interest_summary text not null,
  target_intake text,
  stage public.crm_enquiry_stage not null default 'new',
  owner_person_id uuid references public.people (id) on delete restrict,
  closed_reason text,
  closed_at timestamptz,
  request_key uuid not null unique,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint crm_enquiries_source_format check (source ~ '^[a-z][a-z0-9_]{2,49}$'),
  constraint crm_enquiries_interest_bounded check (
    interest_summary = btrim(interest_summary)
    and length(interest_summary) between 2 and 240
  ),
  constraint crm_enquiries_intake_bounded check (
    target_intake is null
    or (target_intake = btrim(target_intake) and length(target_intake) between 2 and 80)
  ),
  constraint crm_enquiries_closed_consistent check (
    (
      stage = 'closed'
      and closed_reason is not null
      and length(btrim(closed_reason)) between 3 and 240
      and closed_at is not null
    )
    or (stage <> 'closed' and closed_reason is null and closed_at is null)
  )
);

create index crm_enquiries_owner_stage_idx on public.crm_enquiries (owner_person_id, stage, updated_at desc);
create index crm_enquiries_subject_idx on public.crm_enquiries (subject_person_id);

create table public.crm_enquiry_ownership_history (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  from_owner_person_id uuid references public.people (id) on delete restrict,
  to_owner_person_id uuid not null references public.people (id) on delete restrict,
  assigned_by_person_id uuid not null references public.people (id) on delete restrict,
  reason text not null,
  assigned_at timestamptz not null default now(),
  constraint crm_ownership_owner_changed check (
    from_owner_person_id is null or from_owner_person_id <> to_owner_person_id
  ),
  constraint crm_ownership_reason_bounded check (
    reason = btrim(reason) and length(reason) between 3 and 240
  )
);

create index crm_ownership_enquiry_idx
  on public.crm_enquiry_ownership_history (enquiry_id, assigned_at desc);

create table public.crm_enquiry_transitions (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  from_stage public.crm_enquiry_stage,
  to_stage public.crm_enquiry_stage not null,
  actor_person_id uuid not null references public.people (id) on delete restrict,
  reason_code text not null,
  note text,
  occurred_at timestamptz not null default now(),
  constraint crm_transition_changes_stage check (from_stage is null or from_stage <> to_stage),
  constraint crm_transition_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint crm_transition_note_bounded check (
    note is null or (note = btrim(note) and length(note) between 3 and 500)
  )
);

create index crm_transitions_enquiry_idx
  on public.crm_enquiry_transitions (enquiry_id, occurred_at desc);

create table public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  outcome public.crm_activity_outcome not null,
  note text,
  actor_person_id uuid not null references public.people (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint crm_activities_note_bounded check (
    note is null or (note = btrim(note) and length(note) between 3 and 1000)
  )
);

create index crm_activities_enquiry_idx
  on public.crm_activities (enquiry_id, occurred_at desc);

create table public.crm_follow_ups (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  assigned_to_person_id uuid not null references public.people (id) on delete restrict,
  due_at timestamptz not null,
  status public.crm_follow_up_status not null default 'open',
  disposition text,
  replaced_by_follow_up_id uuid references public.crm_follow_ups (id) on delete restrict,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint crm_follow_ups_due_future check (due_at > created_at),
  constraint crm_follow_ups_due_bounded check (due_at <= created_at + interval '1 year'),
  constraint crm_follow_ups_completion_consistent check (
    (status = 'open' and completed_at is null and disposition is null and replaced_by_follow_up_id is null)
    or (
      status = 'replaced' and completed_at is not null and disposition is not null
      and replaced_by_follow_up_id is not null
    )
    or (
      status in ('completed', 'cancelled') and completed_at is not null
      and disposition is not null and replaced_by_follow_up_id is null
    )
  ),
  constraint crm_follow_ups_disposition_bounded check (
    disposition is null
    or (disposition = btrim(disposition) and length(disposition) between 3 and 240)
  )
);

create unique index crm_follow_ups_one_open_per_enquiry
  on public.crm_follow_ups (enquiry_id)
  where status = 'open';
create index crm_follow_ups_due_idx on public.crm_follow_ups (due_at) where status = 'open';

create table public.crm_identity_candidates (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.crm_enquiries (id) on delete restrict,
  new_person_id uuid not null references public.people (id) on delete restrict,
  possible_existing_person_id uuid not null references public.people (id) on delete restrict,
  evidence_kind public.crm_contact_kind not null,
  status public.crm_identity_candidate_status not null default 'pending',
  resolved_by_person_id uuid references public.people (id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint crm_identity_candidates_distinct check (new_person_id <> possible_existing_person_id),
  constraint crm_identity_candidates_unique unique (
    enquiry_id, new_person_id, possible_existing_person_id, evidence_kind
  ),
  constraint crm_identity_candidates_resolution_consistent check (
    (status = 'pending' and resolved_by_person_id is null and resolved_at is null)
    or (status <> 'pending' and resolved_by_person_id is not null and resolved_at is not null)
  )
);

create table public.crm_enrolment_review_requests (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null unique references public.crm_enquiries (id) on delete restrict,
  requested_by_person_id uuid not null references public.people (id) on delete restrict,
  request_note text not null,
  requested_at timestamptz not null default now(),
  constraint crm_review_request_note_bounded check (
    request_note = btrim(request_note) and length(request_note) between 3 and 500
  )
);

alter table public.crm_contact_points enable row level security;
alter table public.crm_person_relationships enable row level security;
alter table public.crm_enquiries enable row level security;
alter table public.crm_enquiry_ownership_history enable row level security;
alter table public.crm_enquiry_transitions enable row level security;
alter table public.crm_activities enable row level security;
alter table public.crm_follow_ups enable row level security;
alter table public.crm_identity_candidates enable row level security;
alter table public.crm_enrolment_review_requests enable row level security;

revoke all on table public.crm_contact_points from anon, authenticated;
revoke all on table public.crm_person_relationships from anon, authenticated;
revoke all on table public.crm_enquiries from anon, authenticated;
revoke all on table public.crm_enquiry_ownership_history from anon, authenticated;
revoke all on table public.crm_enquiry_transitions from anon, authenticated;
revoke all on table public.crm_activities from anon, authenticated;
revoke all on table public.crm_follow_ups from anon, authenticated;
revoke all on table public.crm_identity_candidates from anon, authenticated;
revoke all on table public.crm_enrolment_review_requests from anon, authenticated;

grant all on table public.crm_contact_points to service_role;
grant all on table public.crm_person_relationships to service_role;
grant all on table public.crm_enquiries to service_role;
grant all on table public.crm_enquiry_ownership_history to service_role;
grant all on table public.crm_enquiry_transitions to service_role;
grant all on table public.crm_activities to service_role;
grant all on table public.crm_follow_ups to service_role;
grant all on table public.crm_identity_candidates to service_role;
grant all on table public.crm_enrolment_review_requests to service_role;

create or replace function public.person_has_global_capability(
  p_person_id uuid,
  p_capability_key text
)
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
      where p.id = p_person_id
        and p.status = 'active'
        and m.kind = 'employee'
        and m.status = 'active'
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    )
    and (
      exists (
        select 1
        from public.role_assignments ra
        join public.role_capabilities rc on rc.role_key = ra.role_key
        where ra.person_id = p_person_id
          and rc.capability_key = p_capability_key
          and ra.scope_type = 'global'
          and ra.scope_id is null
          and ra.revoked_at is null
          and ra.starts_at <= now()
          and (ra.ends_at is null or ra.ends_at > now())
      )
      or exists (
        select 1
        from public.capability_grants cg
        join public.role_assignments ra
          on ra.person_id = cg.person_id
          and ra.role_key = cg.required_role_key
          and ra.scope_type = cg.scope_type
          and ra.scope_id is not distinct from cg.scope_id
          and ra.revoked_at is null
          and ra.starts_at <= now()
          and (ra.ends_at is null or ra.ends_at > now())
        where cg.person_id = p_person_id
          and cg.capability_key = p_capability_key
          and cg.scope_type = 'global'
          and cg.scope_id is null
          and cg.revoked_at is null
          and cg.starts_at <= now()
          and (cg.ends_at is null or cg.ends_at > now())
      )
    ),
    false
  )
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
    from public.crm_enquiries e
    where e.id = p_enquiry_id
      and e.owner_person_id = public.current_person_id()
      and public.person_has_global_capability(public.current_person_id(), 'lead.manage_assigned')
  ), false)
$$;

create or replace function public.current_person_can_view_crm_enquiry(p_enquiry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_can_manage_crm_enquiry(p_enquiry_id)
    or public.person_has_global_capability(public.current_person_id(), 'lead.assign'),
    false
  )
$$;

create or replace function public.normalize_crm_contact_value(
  p_kind public.crm_contact_kind,
  p_value text
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  normalized text;
begin
  if p_kind = 'email' then
    normalized := lower(btrim(p_value));
    if normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      raise exception using errcode = '22023', message = 'enter a valid email address';
    end if;
  else
    normalized := regexp_replace(btrim(p_value), '[[:space:]()-]', '', 'g');
    if normalized !~ '^\+[1-9][0-9]{7,14}$' then
      raise exception using errcode = '22023', message = 'enter a phone number with country code';
    end if;
  end if;
  return normalized;
end;
$$;

create or replace function public.create_crm_enquiry(
  p_subject_name text,
  p_contact_name text,
  p_contact_relationship public.crm_contact_relationship,
  p_contact_kind public.crm_contact_kind,
  p_contact_value text,
  p_interest_summary text,
  p_target_intake text,
  p_source text,
  p_request_key uuid
)
returns table (enquiry_id uuid, possible_identity_match boolean)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  subject_id uuid;
  contact_person_id uuid;
  contact_point_id uuid;
  created_enquiry_id uuid;
  normalized_contact text;
  existing_enquiry public.crm_enquiries%rowtype;
begin
  if not public.person_has_global_capability(actor_id, 'lead.manage_assigned') then
    raise exception using errcode = '42501', message = 'CRM access denied';
  end if;
  if p_request_key is null then
    raise exception using errcode = '22023', message = 'request key is required';
  end if;

  select * into existing_enquiry
  from public.crm_enquiries e
  where e.request_key = p_request_key;
  if found then
    if existing_enquiry.created_by_person_id <> actor_id then
      raise exception using errcode = '42501', message = 'request key access denied';
    end if;
    return query select existing_enquiry.id, exists (
      select 1 from public.crm_identity_candidates c where c.enquiry_id = existing_enquiry.id
    );
    return;
  end if;

  if p_subject_name is null or btrim(p_subject_name) <> p_subject_name
     or length(p_subject_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'prospect name is invalid';
  end if;
  if p_contact_name is null or btrim(p_contact_name) <> p_contact_name
     or length(p_contact_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'contact name is invalid';
  end if;
  if p_contact_relationship = 'self' and p_contact_name <> p_subject_name then
    raise exception using errcode = '22023', message = 'self contact name must match prospect name';
  end if;
  if p_interest_summary is null or btrim(p_interest_summary) <> p_interest_summary
     or length(p_interest_summary) not between 2 and 240 then
    raise exception using errcode = '22023', message = 'interest summary is invalid';
  end if;
  if p_source is null or p_source !~ '^[a-z][a-z0-9_]{2,49}$' then
    raise exception using errcode = '22023', message = 'enquiry source is invalid';
  end if;

  normalized_contact := public.normalize_crm_contact_value(p_contact_kind, p_contact_value);

  insert into public.people (display_name) values (p_subject_name) returning id into subject_id;
  if p_contact_relationship = 'self' then
    contact_person_id := subject_id;
  else
    insert into public.people (display_name) values (p_contact_name) returning id into contact_person_id;
    insert into public.crm_person_relationships (
      subject_person_id, related_person_id, relationship, created_by_person_id
    ) values (subject_id, contact_person_id, p_contact_relationship, actor_id);
  end if;

  insert into public.crm_contact_points (
    person_id, kind, normalized_value, display_value, created_by_person_id
  ) values (
    contact_person_id, p_contact_kind, normalized_contact, btrim(p_contact_value), actor_id
  ) returning id into contact_point_id;

  insert into public.crm_enquiries (
    subject_person_id, primary_contact_person_id, primary_contact_point_id,
    contact_relationship, source, interest_summary, target_intake, owner_person_id,
    request_key, created_by_person_id
  ) values (
    subject_id, contact_person_id, contact_point_id, p_contact_relationship, p_source,
    p_interest_summary, nullif(btrim(p_target_intake), ''), actor_id, p_request_key, actor_id
  ) returning id into created_enquiry_id;

  insert into public.crm_enquiry_ownership_history (
    enquiry_id, to_owner_person_id, assigned_by_person_id, reason
  ) values (created_enquiry_id, actor_id, actor_id, 'Created and assigned to intake owner');

  insert into public.crm_enquiry_transitions (
    enquiry_id, to_stage, actor_person_id, reason_code
  ) values (created_enquiry_id, 'new', actor_id, 'enquiry_created');

  insert into public.crm_identity_candidates (
    enquiry_id, new_person_id, possible_existing_person_id, evidence_kind
  )
  select created_enquiry_id, contact_person_id, cp.person_id, p_contact_kind
  from public.crm_contact_points cp
  where cp.kind = p_contact_kind
    and cp.normalized_value = normalized_contact
    and cp.person_id <> contact_person_id
  on conflict do nothing;

  return query select created_enquiry_id, exists (
    select 1 from public.crm_identity_candidates c where c.enquiry_id = created_enquiry_id
  );
end;
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
    e.id,
    subject.display_name,
    contact.display_name,
    e.contact_relationship,
    cp.kind,
    cp.display_value,
    e.source,
    e.interest_summary,
    e.target_intake,
    e.stage,
    owner.display_name,
    fu.id,
    fu.due_at,
    activity.occurred_at,
    activity.outcome,
    exists (select 1 from public.crm_identity_candidates ic where ic.enquiry_id = e.id and ic.status = 'pending'),
    review.requested_at,
    e.closed_reason,
    e.closed_at,
    e.closed_at + interval '7 days',
    e.created_at
  from public.crm_enquiries e
  join public.people subject on subject.id = e.subject_person_id
  join public.people contact on contact.id = e.primary_contact_person_id
  join public.crm_contact_points cp on cp.id = e.primary_contact_point_id
  left join public.people owner on owner.id = e.owner_person_id
  left join lateral (
    select f.id, f.due_at
    from public.crm_follow_ups f
    where f.enquiry_id = e.id and f.status = 'open'
    limit 1
  ) fu on true
  left join lateral (
    select a.occurred_at, a.outcome
    from public.crm_activities a
    where a.enquiry_id = e.id
    order by a.occurred_at desc, a.id desc
    limit 1
  ) activity on true
  left join public.crm_enrolment_review_requests review on review.enquiry_id = e.id
  where (
    public.person_has_global_capability(public.current_person_id(), 'lead.assign')
    or e.owner_person_id = public.current_person_id()
  )
    and (
      (p_queue = 'active' and e.stage <> 'closed')
      or (
        p_queue = 'recently_dead'
        and e.stage = 'closed'
        and e.closed_at > now() - interval '7 days'
      )
      or (
        p_queue = 'dead_archive'
        and e.stage = 'closed'
        and e.closed_at <= now() - interval '7 days'
      )
    )
    and (
      search_term is null
      or position(lower(search_term) in lower(subject.display_name)) > 0
      or position(lower(search_term) in lower(contact.display_name)) > 0
      or position(lower(search_term) in lower(cp.normalized_value)) > 0
    )
  order by
    case when e.stage = 'closed' then e.closed_at end desc nulls last,
    case when fu.due_at < now() then 0 when fu.due_at is not null then 1 else 2 end,
    fu.due_at nulls last,
    e.created_at desc,
    e.id
  limit p_limit;
end;
$$;

create or replace function public.record_crm_activity(
  p_enquiry_id uuid,
  p_outcome public.crm_activity_outcome,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  activity_id uuid;
begin
  if not public.current_person_can_manage_crm_enquiry(p_enquiry_id) then
    raise exception using errcode = '42501', message = 'CRM enquiry access denied';
  end if;
  if exists (
    select 1 from public.crm_enquiries e where e.id = p_enquiry_id and e.stage = 'closed'
  ) then
    raise exception using errcode = '55000', message = 'CRM enquiry is closed';
  end if;
  if p_note is not null and (btrim(p_note) <> p_note or length(p_note) not between 3 and 1000) then
    raise exception using errcode = '22023', message = 'activity note is invalid';
  end if;
  insert into public.crm_activities (enquiry_id, outcome, note, actor_person_id)
  values (p_enquiry_id, p_outcome, p_note, public.current_person_id())
  returning id into activity_id;
  update public.crm_enquiries set updated_at = now() where id = p_enquiry_id;
  return activity_id;
end;
$$;

create or replace function public.schedule_crm_follow_up(
  p_enquiry_id uuid,
  p_due_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  old_follow_up_id uuid;
  new_follow_up_id uuid;
  owner_id uuid;
  enquiry_stage public.crm_enquiry_stage;
begin
  if not public.current_person_can_manage_crm_enquiry(p_enquiry_id) then
    raise exception using errcode = '42501', message = 'CRM enquiry access denied';
  end if;
  if p_due_at < now() + interval '5 minutes' or p_due_at > now() + interval '1 year' then
    raise exception using errcode = '22023', message = 'follow-up time is outside the allowed range';
  end if;
  select e.owner_person_id, e.stage into strict owner_id, enquiry_stage
  from public.crm_enquiries e where e.id = p_enquiry_id for update;
  if enquiry_stage = 'closed' then
    raise exception using errcode = '55000', message = 'CRM enquiry is closed';
  end if;
  select f.id into old_follow_up_id
  from public.crm_follow_ups f
  where f.enquiry_id = p_enquiry_id and f.status = 'open'
  for update;
  if old_follow_up_id is not null then
    update public.crm_follow_ups
    set status = 'cancelled', disposition = 'Replaced by a rescheduled follow-up', completed_at = now()
    where id = old_follow_up_id;
  end if;
  insert into public.crm_follow_ups (
    enquiry_id, assigned_to_person_id, due_at, created_by_person_id
  ) values (p_enquiry_id, owner_id, p_due_at, public.current_person_id())
  returning id into new_follow_up_id;
  if old_follow_up_id is not null then
    update public.crm_follow_ups
    set status = 'replaced', replaced_by_follow_up_id = new_follow_up_id
    where id = old_follow_up_id;
  end if;
  update public.crm_enquiries set updated_at = now() where id = p_enquiry_id;
  return new_follow_up_id;
end;
$$;

create or replace function public.complete_crm_follow_up(
  p_follow_up_id uuid,
  p_disposition text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target public.crm_follow_ups%rowtype;
begin
  select * into strict target from public.crm_follow_ups where id = p_follow_up_id for update;
  if not public.current_person_can_manage_crm_enquiry(target.enquiry_id) then
    raise exception using errcode = '42501', message = 'CRM follow-up access denied';
  end if;
  if target.status <> 'open' then
    raise exception using errcode = '55000', message = 'follow-up is no longer open';
  end if;
  if p_disposition is null or btrim(p_disposition) <> p_disposition
     or length(p_disposition) not between 3 and 240 then
    raise exception using errcode = '22023', message = 'follow-up disposition is invalid';
  end if;
  update public.crm_follow_ups
  set status = 'completed', disposition = p_disposition, completed_at = now()
  where id = p_follow_up_id;
  update public.crm_enquiries set updated_at = now() where id = target.enquiry_id;
end;
$$;

create or replace function public.update_crm_enquiry_stage(
  p_enquiry_id uuid,
  p_to_stage public.crm_enquiry_stage,
  p_reason_code text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_stage public.crm_enquiry_stage;
  transition_allowed boolean;
begin
  if not public.current_person_can_manage_crm_enquiry(p_enquiry_id) then
    raise exception using errcode = '42501', message = 'CRM enquiry access denied';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{2,79}$' then
    raise exception using errcode = '22023', message = 'transition reason is invalid';
  end if;
  if p_note is not null and (btrim(p_note) <> p_note or length(p_note) not between 3 and 500) then
    raise exception using errcode = '22023', message = 'transition note is invalid';
  end if;
  if p_to_stage = 'closed'
     and (p_note is null or length(p_note) not between 3 and 240) then
    raise exception using errcode = '22023', message = 'dead enquiry reason is invalid';
  end if;
  select stage into strict current_stage from public.crm_enquiries where id = p_enquiry_id for update;
  transition_allowed := case
    when current_stage = 'new' then p_to_stage in ('contact_in_progress', 'closed')
    when current_stage = 'contact_in_progress' then p_to_stage in ('engaged', 'closed')
    when current_stage = 'engaged' then p_to_stage in ('contact_in_progress', 'qualified', 'closed')
    when current_stage = 'qualified' then p_to_stage in ('engaged', 'closed')
    when current_stage = 'closed' then p_to_stage = 'contact_in_progress'
    else false
  end;
  if not transition_allowed then
    raise exception using errcode = '55000', message = 'CRM stage transition is not allowed';
  end if;
  update public.crm_enquiries
  set stage = p_to_stage,
      closed_reason = case when p_to_stage = 'closed' then p_note else null end,
      closed_at = case when p_to_stage = 'closed' then now() else null end,
      updated_at = now()
  where id = p_enquiry_id;
  if p_to_stage = 'closed' then
    update public.crm_follow_ups
    set status = 'cancelled',
        disposition = 'Enquiry moved to dead enquiries',
        completed_at = now()
    where enquiry_id = p_enquiry_id and status = 'open';
  end if;
  insert into public.crm_enquiry_transitions (
    enquiry_id, from_stage, to_stage, actor_person_id, reason_code, note
  ) values (
    p_enquiry_id, current_stage, p_to_stage, public.current_person_id(), p_reason_code, p_note
  );
end;
$$;

create or replace function public.request_crm_enrolment_review(
  p_enquiry_id uuid,
  p_request_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  current_stage public.crm_enquiry_stage;
  request_id uuid;
begin
  if not public.current_person_can_manage_crm_enquiry(p_enquiry_id)
     or not public.person_has_global_capability(public.current_person_id(), 'enrollment.request_review') then
    raise exception using errcode = '42501', message = 'enrolment review request denied';
  end if;
  if p_request_note is null or btrim(p_request_note) <> p_request_note
     or length(p_request_note) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'review request note is invalid';
  end if;
  select stage into strict current_stage from public.crm_enquiries where id = p_enquiry_id for update;
  if current_stage <> 'qualified' then
    raise exception using errcode = '55000', message = 'only a qualified enquiry can request enrolment review';
  end if;
  insert into public.crm_enrolment_review_requests (
    enquiry_id, requested_by_person_id, request_note
  ) values (p_enquiry_id, public.current_person_id(), p_request_note)
  returning id into request_id;
  update public.crm_enquiries
  set stage = 'enrolment_review_requested', updated_at = now()
  where id = p_enquiry_id;
  insert into public.crm_enquiry_transitions (
    enquiry_id, from_stage, to_stage, actor_person_id, reason_code, note
  ) values (
    p_enquiry_id, current_stage, 'enrolment_review_requested', public.current_person_id(),
    'enrolment_review_requested', p_request_note
  );
  return request_id;
end;
$$;

create or replace function public.assign_crm_enquiry(
  p_enquiry_id uuid,
  p_owner_person_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  prior_owner_id uuid;
  old_follow_up public.crm_follow_ups%rowtype;
  new_follow_up_id uuid;
begin
  if not public.person_has_global_capability(public.current_person_id(), 'lead.assign') then
    raise exception using errcode = '42501', message = 'CRM assignment denied';
  end if;
  if not public.person_has_global_capability(p_owner_person_id, 'lead.manage_assigned') then
    raise exception using errcode = '22023', message = 'target owner is not an active Sales owner';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 240 then
    raise exception using errcode = '22023', message = 'assignment reason is invalid';
  end if;
  select owner_person_id into strict prior_owner_id
  from public.crm_enquiries where id = p_enquiry_id for update;
  if prior_owner_id is not distinct from p_owner_person_id then return; end if;

  select * into old_follow_up
  from public.crm_follow_ups
  where enquiry_id = p_enquiry_id and status = 'open'
  for update;
  if found then
    update public.crm_follow_ups
    set status = 'cancelled', disposition = 'Replaced after enquiry reassignment', completed_at = now()
    where id = old_follow_up.id;
  end if;

  update public.crm_enquiries
  set owner_person_id = p_owner_person_id, updated_at = now()
  where id = p_enquiry_id;
  insert into public.crm_enquiry_ownership_history (
    enquiry_id, from_owner_person_id, to_owner_person_id, assigned_by_person_id, reason
  ) values (
    p_enquiry_id, prior_owner_id, p_owner_person_id, public.current_person_id(), p_reason
  );

  if old_follow_up.id is not null then
    insert into public.crm_follow_ups (
      enquiry_id, assigned_to_person_id, due_at, created_by_person_id
    ) values (
      p_enquiry_id, p_owner_person_id, greatest(old_follow_up.due_at, now() + interval '5 minutes'),
      public.current_person_id()
    ) returning id into new_follow_up_id;
    update public.crm_follow_ups
    set status = 'replaced', replaced_by_follow_up_id = new_follow_up_id
    where id = old_follow_up.id;
  end if;
end;
$$;

revoke all on function public.person_has_global_capability(uuid, text) from public, anon, authenticated;
revoke all on function public.current_person_can_manage_crm_enquiry(uuid) from public, anon;
revoke all on function public.current_person_can_view_crm_enquiry(uuid) from public, anon;
revoke all on function public.normalize_crm_contact_value(public.crm_contact_kind, text) from public, anon;
revoke all on function public.create_crm_enquiry(text, text, public.crm_contact_relationship, public.crm_contact_kind, text, text, text, text, uuid) from public, anon;
revoke all on function public.list_crm_enquiries(integer, text, text) from public, anon;
revoke all on function public.record_crm_activity(uuid, public.crm_activity_outcome, text) from public, anon;
revoke all on function public.schedule_crm_follow_up(uuid, timestamptz) from public, anon;
revoke all on function public.complete_crm_follow_up(uuid, text) from public, anon;
revoke all on function public.update_crm_enquiry_stage(uuid, public.crm_enquiry_stage, text, text) from public, anon;
revoke all on function public.request_crm_enrolment_review(uuid, text) from public, anon;
revoke all on function public.assign_crm_enquiry(uuid, uuid, text) from public, anon;

grant execute on function public.current_person_can_manage_crm_enquiry(uuid) to authenticated;
grant execute on function public.current_person_can_view_crm_enquiry(uuid) to authenticated;
grant execute on function public.create_crm_enquiry(text, text, public.crm_contact_relationship, public.crm_contact_kind, text, text, text, text, uuid) to authenticated;
grant execute on function public.list_crm_enquiries(integer, text, text) to authenticated;
grant execute on function public.record_crm_activity(uuid, public.crm_activity_outcome, text) to authenticated;
grant execute on function public.schedule_crm_follow_up(uuid, timestamptz) to authenticated;
grant execute on function public.complete_crm_follow_up(uuid, text) to authenticated;
grant execute on function public.update_crm_enquiry_stage(uuid, public.crm_enquiry_stage, text, text) to authenticated;
grant execute on function public.request_crm_enrolment_review(uuid, text) to authenticated;
grant execute on function public.assign_crm_enquiry(uuid, uuid, text) to authenticated;

comment on table public.crm_enquiries is
  'A bounded expression of interest. It is separate from identity, membership, enrolment, consent, and account access.';
comment on table public.crm_identity_candidates is
  'Minimal duplicate-review evidence. Ordinary Sales users receive only a boolean warning, never the matched person record.';
comment on function public.create_crm_enquiry(text, text, public.crm_contact_relationship, public.crm_contact_kind, text, text, text, text, uuid) is
  'Trusted manual CRM intake. Creates non-authenticated prospect people only and grants no membership, login, enrolment, or entitlement.';
