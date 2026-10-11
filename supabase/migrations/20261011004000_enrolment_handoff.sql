create type public.crm_enrolment_review_status as enum ('pending', 'returned', 'approved');
create type public.crm_student_resolution_mode as enum ('new', 'existing');

alter table public.crm_enrolment_review_requests
  drop constraint crm_enrolment_review_requests_enquiry_id_key,
  add column status public.crm_enrolment_review_status not null default 'pending',
  add column decision_reason text,
  add column resolved_by_person_id uuid references public.people (id) on delete restrict,
  add column resolved_at timestamptz,
  add column resolution_mode public.crm_student_resolution_mode,
  add column resolved_subject_person_id uuid references public.people (id) on delete restrict,
  add column enrollment_id uuid references public.enrollments (id) on delete restrict,
  add constraint crm_review_decision_reason_bounded check (
    decision_reason is null
    or (decision_reason = btrim(decision_reason) and length(decision_reason) between 3 and 500)
  ),
  add constraint crm_review_resolution_consistent check (
    (
      status = 'pending'
      and decision_reason is null
      and resolved_by_person_id is null
      and resolved_at is null
      and resolution_mode is null
      and resolved_subject_person_id is null
      and enrollment_id is null
    )
    or (
      status = 'returned'
      and decision_reason is not null
      and resolved_by_person_id is not null
      and resolved_at is not null
      and resolution_mode is null
      and resolved_subject_person_id is null
      and enrollment_id is null
    )
    or (
      status = 'approved'
      and decision_reason is not null
      and resolved_by_person_id is not null
      and resolved_at is not null
      and resolution_mode is not null
      and resolved_subject_person_id is not null
      and enrollment_id is not null
    )
  );

create unique index crm_review_one_pending_per_enquiry
  on public.crm_enrolment_review_requests (enquiry_id)
  where status = 'pending';
create index crm_review_pending_queue_idx
  on public.crm_enrolment_review_requests (requested_at, id)
  where status = 'pending';

create or replace function public.generate_dexam_member_id()
returns text
language plpgsql
volatile
security definer
set search_path = ''
set row_security = off
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  random_bytes bytea;
  candidate text;
  character_index integer;
  attempt integer;
begin
  for attempt in 1..20 loop
    random_bytes := extensions.gen_random_bytes(12);
    candidate := 'DXM-';
    for character_index in 0..11 loop
      candidate := candidate || substr(
        alphabet,
        (get_byte(random_bytes, character_index) % length(alphabet)) + 1,
        1
      );
    end loop;
    if not exists (select 1 from public.people p where p.member_id = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception using errcode = '55000', message = 'a unique Member ID could not be generated';
end;
$$;

create or replace function public.list_enrolment_handoffs(
  p_limit integer default 25,
  p_search text default null
)
returns table (
  request_id uuid,
  enquiry_id uuid,
  subject_name text,
  contact_name text,
  contact_relationship public.crm_contact_relationship,
  contact_kind public.crm_contact_kind,
  contact_value text,
  interest_summary text,
  target_intake text,
  request_note text,
  sales_owner_name text,
  pending_identity_matches integer,
  requested_at timestamptz
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
  if p_limit not between 1 and 50 then
    raise exception using errcode = '22023', message = 'handoff queue limit must be between 1 and 50';
  end if;
  if search_term is not null and length(search_term) > 80 then
    raise exception using errcode = '22023', message = 'handoff search is too long';
  end if;
  if not public.current_person_has_capability('enrollment.operate') then
    raise exception using errcode = '42501', message = 'enrolment handoff access denied';
  end if;

  return query
  select
    review.id,
    enquiry.id,
    subject.display_name,
    contact.display_name,
    enquiry.contact_relationship,
    contact_point.kind,
    contact_point.display_value,
    enquiry.interest_summary,
    enquiry.target_intake,
    review.request_note,
    owner.display_name,
    (
      select count(*)::integer
      from public.crm_identity_candidates candidate
      where candidate.enquiry_id = enquiry.id and candidate.status = 'pending'
    ),
    review.requested_at
  from public.crm_enrolment_review_requests review
  join public.crm_enquiries enquiry on enquiry.id = review.enquiry_id
  join public.people subject on subject.id = enquiry.subject_person_id
  join public.people contact on contact.id = enquiry.primary_contact_person_id
  join public.crm_contact_points contact_point on contact_point.id = enquiry.primary_contact_point_id
  left join public.people owner on owner.id = enquiry.owner_person_id
  where review.status = 'pending'
    and enquiry.stage = 'enrolment_review_requested'
    and (
      search_term is null
      or position(lower(search_term) in lower(subject.display_name)) > 0
      or position(lower(search_term) in lower(contact.display_name)) > 0
      or position(lower(search_term) in lower(contact_point.normalized_value)) > 0
    )
  order by review.requested_at, review.id
  limit p_limit;
end;
$$;

create or replace function public.list_enrolment_identity_candidates(p_request_id uuid)
returns table (
  candidate_id uuid,
  new_person_name text,
  existing_person_id uuid,
  existing_display_name text,
  existing_member_id text,
  evidence_kind public.crm_contact_kind,
  contact_value text,
  account_claimed boolean
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_has_capability('enrollment.operate') then
    raise exception using errcode = '42501', message = 'identity candidate access denied';
  end if;
  if not exists (
    select 1
    from public.crm_enrolment_review_requests review
    where review.id = p_request_id and review.status = 'pending'
  ) then
    raise exception using errcode = 'P0002', message = 'pending enrolment handoff not found';
  end if;

  return query
  select
    candidate.id,
    new_person.display_name,
    existing_person.id,
    existing_person.display_name,
    existing_person.member_id,
    candidate.evidence_kind,
    contact_point.display_value,
    exists (
      select 1 from public.auth_identities identity
      where identity.person_id = existing_person.id and identity.kind = 'member_id'
    )
  from public.crm_identity_candidates candidate
  join public.crm_enrolment_review_requests review on review.enquiry_id = candidate.enquiry_id
  join public.people new_person on new_person.id = candidate.new_person_id
  join public.people existing_person on existing_person.id = candidate.possible_existing_person_id
  left join lateral (
    select point.display_value
    from public.crm_contact_points point
    where point.person_id = candidate.new_person_id
      and point.kind = candidate.evidence_kind
    order by point.created_at, point.id
    limit 1
  ) contact_point on true
  where review.id = p_request_id and candidate.status = 'pending'
  order by existing_person.display_name, candidate.id;
end;
$$;

create or replace function public.search_enrolment_students(
  p_limit integer default 20,
  p_search text default null
)
returns table (
  person_id uuid,
  member_id text,
  display_name text,
  account_claimed boolean,
  open_enrollment_count integer,
  open_offering_titles text[]
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
  if p_limit not between 1 and 25 then
    raise exception using errcode = '22023', message = 'student search limit must be between 1 and 25';
  end if;
  if search_term is null or length(search_term) < 2 or length(search_term) > 80 then
    raise exception using errcode = '22023', message = 'enter 2 to 80 characters to search students';
  end if;
  if not public.current_person_has_capability('enrollment.operate') then
    raise exception using errcode = '42501', message = 'student identity search denied';
  end if;

  return query
  select
    person.id,
    person.member_id,
    person.display_name,
    exists (
      select 1 from public.auth_identities identity
      where identity.person_id = person.id and identity.kind = 'member_id'
    ),
    count(enrollment.id) filter (
      where enrollment.status in ('requested', 'approved', 'active')
    )::integer,
    coalesce(
      array_agg(distinct offering.title order by offering.title) filter (
        where enrollment.status in ('requested', 'approved', 'active')
      ),
      '{}'::text[]
    )
  from public.people person
  join public.memberships membership
    on membership.person_id = person.id
    and membership.kind = 'student'
    and membership.status = 'active'
    and (membership.starts_at is null or membership.starts_at <= now())
    and (membership.ends_at is null or membership.ends_at > now())
  left join public.enrollments enrollment on enrollment.person_id = person.id
  left join public.offerings offering on offering.id = enrollment.offering_id
  where person.status = 'active'
    and person.member_id is not null
    and person.display_name is not null
    and (
      position(lower(search_term) in lower(person.member_id)) > 0
      or position(lower(search_term) in lower(person.display_name)) > 0
    )
  group by person.id, person.member_id, person.display_name
  order by
    case when lower(person.member_id) = lower(search_term) then 0 else 1 end,
    lower(person.display_name),
    person.id
  limit p_limit;
end;
$$;

create or replace function public.list_enrolment_handoff_choices()
returns table (
  offering_id uuid,
  offering_title text,
  cohort_id uuid,
  cohort_name text
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_has_capability('enrollment.operate') then
    raise exception using errcode = '42501', message = 'enrolment choice access denied';
  end if;

  return query
  select choice.offering_id, choice.offering_title, choice.cohort_id, choice.cohort_name
  from (
    select offering.id as offering_id, offering.title as offering_title,
      null::uuid as cohort_id, null::text as cohort_name
    from public.offerings offering
    where offering.status = 'active'
      and (offering.available_from is null or offering.available_from <= now())
      and (offering.available_until is null or offering.available_until > now())
    union all
    select offering.id, offering.title, cohort.id, cohort.name
    from public.offerings offering
    join public.cohorts cohort on cohort.offering_id = offering.id
    where offering.status = 'active'
      and (offering.available_from is null or offering.available_from <= now())
      and (offering.available_until is null or offering.available_until > now())
      and cohort.status = 'active'
      and (cohort.starts_at is null or cohort.starts_at <= now())
      and (cohort.ends_at is null or cohort.ends_at > now())
  ) choice
  order by choice.offering_title, choice.cohort_name nulls first;
end;
$$;

create or replace function public.return_crm_enrolment_review(
  p_request_id uuid,
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
  target_request public.crm_enrolment_review_requests%rowtype;
begin
  if not public.current_person_has_capability('enrollment.operate') then
    raise exception using errcode = '42501', message = 'enrolment handoff return denied';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'return reason is invalid';
  end if;

  select * into strict target_request
  from public.crm_enrolment_review_requests review
  where review.id = p_request_id
  for update;
  if target_request.status <> 'pending' then
    raise exception using errcode = '40001', message = 'enrolment handoff was already resolved';
  end if;
  if not exists (
    select 1 from public.crm_enquiries enquiry
    where enquiry.id = target_request.enquiry_id
      and enquiry.stage = 'enrolment_review_requested'
    for update
  ) then
    raise exception using errcode = '40001', message = 'enrolment handoff state changed';
  end if;

  update public.crm_enrolment_review_requests
  set status = 'returned',
      decision_reason = p_reason,
      resolved_by_person_id = actor_id,
      resolved_at = now()
  where id = p_request_id;
  update public.crm_enquiries
  set stage = 'qualified', updated_at = now()
  where id = target_request.enquiry_id;
  insert into public.crm_enquiry_transitions (
    enquiry_id, from_stage, to_stage, actor_person_id, reason_code, note
  ) values (
    target_request.enquiry_id, 'enrolment_review_requested', 'qualified', actor_id,
    'enrolment_review_returned', p_reason
  );
end;
$$;

create or replace function public.approve_crm_enrolment_review(
  p_request_id uuid,
  p_resolution_mode public.crm_student_resolution_mode,
  p_existing_person_id uuid,
  p_offering_id uuid,
  p_cohort_id uuid,
  p_reason text,
  p_candidate_ids uuid[] default '{}'::uuid[],
  p_candidate_decisions text[] default '{}'::text[]
)
returns table (
  person_id uuid,
  member_id text,
  enrollment_id uuid,
  enrollment_status public.enrollment_status,
  activation_required boolean
)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_request public.crm_enrolment_review_requests%rowtype;
  target_enquiry public.crm_enquiries%rowtype;
  target_person_id uuid;
  target_member_id text;
  created_enrollment_id uuid;
  created_enrollment_status public.enrollment_status;
  account_is_claimed boolean;
  pending_candidate_count integer;
  supplied_candidate_count integer := coalesce(array_length(p_candidate_ids, 1), 0);
begin
  if not public.current_person_has_capability('enrollment.operate') then
    raise exception using errcode = '42501', message = 'enrolment handoff approval denied';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'approval reason is invalid';
  end if;
  if p_resolution_mode = 'new' and p_existing_person_id is not null then
    raise exception using errcode = '22023', message = 'new-student resolution cannot select an existing student';
  end if;
  if p_resolution_mode = 'existing' and p_existing_person_id is null then
    raise exception using errcode = '22023', message = 'existing-student resolution requires a student';
  end if;
  if supplied_candidate_count <> coalesce(array_length(p_candidate_decisions, 1), 0) then
    raise exception using errcode = '22023', message = 'identity candidate decisions are incomplete';
  end if;
  if exists (
    select 1 from unnest(p_candidate_decisions) decision
    where decision not in ('resolved', 'distinct_people')
  ) then
    raise exception using errcode = '22023', message = 'identity candidate decision is invalid';
  end if;
  if supplied_candidate_count <> (
    select count(distinct candidate_id)::integer from unnest(p_candidate_ids) candidate_id
  ) then
    raise exception using errcode = '22023', message = 'identity candidate decisions contain duplicates';
  end if;

  select * into strict target_request
  from public.crm_enrolment_review_requests review
  where review.id = p_request_id
  for update;
  if target_request.status <> 'pending' then
    raise exception using errcode = '40001', message = 'enrolment handoff was already resolved';
  end if;

  select * into strict target_enquiry
  from public.crm_enquiries enquiry
  where enquiry.id = target_request.enquiry_id
  for update;
  if target_enquiry.stage <> 'enrolment_review_requested' then
    raise exception using errcode = '40001', message = 'enrolment handoff state changed';
  end if;

  select count(*)::integer into pending_candidate_count
  from public.crm_identity_candidates candidate
  where candidate.enquiry_id = target_enquiry.id and candidate.status = 'pending';
  if pending_candidate_count <> supplied_candidate_count or exists (
    select 1
    from unnest(p_candidate_ids) supplied_id
    where not exists (
      select 1 from public.crm_identity_candidates candidate
      where candidate.id = supplied_id
        and candidate.enquiry_id = target_enquiry.id
        and candidate.status = 'pending'
    )
  ) then
    raise exception using errcode = '40001', message = 'identity candidates changed; refresh the handoff';
  end if;

  if p_resolution_mode = 'new' and exists (
    select 1
    from unnest(p_candidate_ids, p_candidate_decisions) decision(candidate_id, disposition)
    join public.crm_identity_candidates candidate on candidate.id = decision.candidate_id
    where candidate.new_person_id = target_enquiry.subject_person_id
      and decision.disposition = 'resolved'
  ) then
    raise exception using errcode = '22023', message = 'a same-person subject match requires existing-student resolution';
  end if;
  if p_resolution_mode = 'existing' and exists (
    select 1
    from public.crm_identity_candidates candidate
    where candidate.enquiry_id = target_enquiry.id
      and candidate.status = 'pending'
      and candidate.new_person_id = target_enquiry.subject_person_id
      and candidate.possible_existing_person_id = p_existing_person_id
      and not exists (
        select 1
        from unnest(p_candidate_ids, p_candidate_decisions) decision(candidate_id, disposition)
        where decision.candidate_id = candidate.id and decision.disposition = 'resolved'
      )
  ) then
    raise exception using errcode = '22023', message = 'the selected subject match must be confirmed as the same person';
  end if;

  if not exists (
    select 1 from public.offerings offering
    where offering.id = p_offering_id
      and offering.status = 'active'
      and (offering.available_from is null or offering.available_from <= now())
      and (offering.available_until is null or offering.available_until > now())
  ) then
    raise exception using errcode = '55000', message = 'the selected offering is not currently available';
  end if;
  if p_cohort_id is not null and not exists (
    select 1 from public.cohorts cohort
    where cohort.id = p_cohort_id
      and cohort.offering_id = p_offering_id
      and cohort.status = 'active'
      and (cohort.starts_at is null or cohort.starts_at <= now())
      and (cohort.ends_at is null or cohort.ends_at > now())
  ) then
    raise exception using errcode = '55000', message = 'the selected cohort is not currently available';
  end if;

  if p_resolution_mode = 'new' then
    target_person_id := target_enquiry.subject_person_id;
    select person.member_id into target_member_id
    from public.people person
    where person.id = target_person_id and person.status = 'active'
    for update;
    if not found or target_member_id is not null then
      raise exception using errcode = '55000', message = 'the CRM subject can no longer be confirmed as a new student';
    end if;
    if exists (
      select 1 from public.memberships membership
      where membership.person_id = target_person_id
        and membership.kind = 'student'
        and membership.status in ('pending', 'active', 'suspended')
    ) or exists (
      select 1 from public.auth_identities identity where identity.person_id = target_person_id
    ) then
      raise exception using errcode = '55000', message = 'the CRM subject already has identity state requiring existing-student review';
    end if;
    target_member_id := public.generate_dexam_member_id();
    update public.people
    set member_id = target_member_id, updated_at = now()
    where id = target_person_id;
    insert into public.memberships (person_id, kind, status, starts_at)
    values (target_person_id, 'student', 'active', now());
    account_is_claimed := false;
  else
    target_person_id := p_existing_person_id;
    select person.member_id,
      exists (
        select 1 from public.auth_identities identity
        where identity.person_id = person.id and identity.kind = 'member_id'
      )
    into target_member_id, account_is_claimed
    from public.people person
    where person.id = target_person_id
      and person.status = 'active'
      and person.member_id is not null
      and exists (
        select 1 from public.memberships membership
        where membership.person_id = person.id
          and membership.kind = 'student'
          and membership.status = 'active'
          and (membership.starts_at is null or membership.starts_at <= now())
          and (membership.ends_at is null or membership.ends_at > now())
      )
    for update;
    if not found then
      raise exception using errcode = '55000', message = 'the selected existing student is not currently eligible';
    end if;
  end if;

  if exists (
    select 1 from public.enrollments enrollment
    where enrollment.person_id = target_person_id
      and enrollment.offering_id = p_offering_id
      and enrollment.cohort_id is not distinct from p_cohort_id
      and enrollment.status in ('requested', 'approved', 'active')
  ) then
    raise exception using errcode = '23505', message = 'the student already has an open enrolment for this offering and cohort';
  end if;

  created_enrollment_status := case when account_is_claimed then 'active' else 'approved' end;
  insert into public.enrollments (
    person_id, offering_id, cohort_id, status, source_type, source_reference,
    requested_by_person_id, approved_by_person_id, requested_at, approved_at, activated_at
  ) values (
    target_person_id, p_offering_id, p_cohort_id, created_enrollment_status,
    'crm_handoff', target_request.id::text, target_request.requested_by_person_id,
    actor_id, target_request.requested_at, now(), case when account_is_claimed then now() else null end
  ) returning id into created_enrollment_id;
  insert into public.enrollment_transitions (
    enrollment_id, to_status, actor_person_id, reason_code
  ) values (
    created_enrollment_id, created_enrollment_status, actor_id, 'crm_handoff_approved'
  );

  update public.crm_identity_candidates candidate
  set status = decision.disposition::public.crm_identity_candidate_status,
      resolved_by_person_id = actor_id,
      resolved_at = now()
  from unnest(p_candidate_ids, p_candidate_decisions) decision(candidate_id, disposition)
  where candidate.id = decision.candidate_id;

  update public.crm_enrolment_review_requests
  set status = 'approved',
      decision_reason = p_reason,
      resolved_by_person_id = actor_id,
      resolved_at = now(),
      resolution_mode = p_resolution_mode,
      resolved_subject_person_id = target_person_id,
      enrollment_id = created_enrollment_id
  where id = p_request_id;
  update public.crm_enquiries
  set stage = 'converted', updated_at = now()
  where id = target_enquiry.id;
  update public.crm_follow_ups
  set status = 'cancelled',
      disposition = 'Enrolment approved',
      completed_at = now()
  where enquiry_id = target_enquiry.id and status = 'open';
  insert into public.crm_enquiry_transitions (
    enquiry_id, from_stage, to_stage, actor_person_id, reason_code, note
  ) values (
    target_enquiry.id, 'enrolment_review_requested', 'converted', actor_id,
    'enrolment_approved', p_reason
  );

  return query select
    target_person_id,
    target_member_id,
    created_enrollment_id,
    created_enrollment_status,
    not account_is_claimed;
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
  if exists (
    select 1 from public.crm_enrolment_review_requests review
    where review.enquiry_id = p_enquiry_id and review.status = 'pending'
  ) then
    raise exception using errcode = '55000', message = 'an enrolment review is already pending';
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

drop function public.list_crm_enquiries(integer, text, text);
create function public.list_crm_enquiries(
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
  where (
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

create or replace function public.list_crm_assignment_queue(
  p_limit integer default 25,
  p_search text default null,
  p_queue text default 'unassigned'
)
returns table (
  id uuid,
  subject_name text,
  contact_relationship public.crm_contact_relationship,
  source text,
  interest_summary text,
  target_intake text,
  stage public.crm_enquiry_stage,
  current_owner_person_id uuid,
  current_owner_name text,
  owner_is_eligible boolean,
  follow_up_due_at timestamptz,
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
    raise exception using errcode = '22023', message = 'CRM assignment list limit must be between 1 and 100';
  end if;
  if search_term is not null and length(search_term) > 80 then
    raise exception using errcode = '22023', message = 'CRM assignment search is too long';
  end if;
  if p_queue not in ('unassigned', 'needs_reassignment') then
    raise exception using errcode = '22023', message = 'CRM assignment queue is invalid';
  end if;
  if not public.person_has_global_capability(public.current_person_id(), 'lead.assign') then
    raise exception using errcode = '42501', message = 'CRM assignment access denied';
  end if;

  return query
  select
    enquiry.id,
    subject.display_name,
    enquiry.contact_relationship,
    enquiry.source,
    enquiry.interest_summary,
    enquiry.target_intake,
    enquiry.stage,
    enquiry.owner_person_id,
    owner.display_name,
    case
      when enquiry.owner_person_id is null then false
      else public.person_has_global_capability(enquiry.owner_person_id, 'lead.manage_assigned')
    end,
    follow_up.due_at,
    enquiry.created_at
  from public.crm_enquiries enquiry
  join public.people subject on subject.id = enquiry.subject_person_id
  left join public.people owner on owner.id = enquiry.owner_person_id
  left join lateral (
    select item.due_at
    from public.crm_follow_ups item
    where item.enquiry_id = enquiry.id and item.status = 'open'
    limit 1
  ) follow_up on true
  where enquiry.stage not in ('closed', 'converted')
    and (
      (p_queue = 'unassigned' and enquiry.owner_person_id is null)
      or (
        p_queue = 'needs_reassignment'
        and enquiry.owner_person_id is not null
        and not public.person_has_global_capability(enquiry.owner_person_id, 'lead.manage_assigned')
      )
    )
    and (
      search_term is null
      or position(lower(search_term) in lower(subject.display_name)) > 0
      or position(lower(search_term) in lower(enquiry.interest_summary)) > 0
      or position(lower(search_term) in lower(coalesce(owner.display_name, ''))) > 0
    )
  order by
    case when follow_up.due_at < now() then 0 when follow_up.due_at is not null then 1 else 2 end,
    follow_up.due_at nulls last,
    enquiry.created_at,
    enquiry.id
  limit p_limit;
end;
$$;

revoke all on function public.generate_dexam_member_id() from public, anon, authenticated;
revoke all on function public.list_enrolment_handoffs(integer, text) from public, anon;
revoke all on function public.list_enrolment_identity_candidates(uuid) from public, anon;
revoke all on function public.search_enrolment_students(integer, text) from public, anon;
revoke all on function public.list_enrolment_handoff_choices() from public, anon;
revoke all on function public.return_crm_enrolment_review(uuid, text) from public, anon;
revoke all on function public.approve_crm_enrolment_review(
  uuid, public.crm_student_resolution_mode, uuid, uuid, uuid, text, uuid[], text[]
) from public, anon;
revoke all on function public.list_crm_enquiries(integer, text, text) from public, anon;

grant execute on function public.list_enrolment_handoffs(integer, text) to authenticated;
grant execute on function public.list_enrolment_identity_candidates(uuid) to authenticated;
grant execute on function public.search_enrolment_students(integer, text) to authenticated;
grant execute on function public.list_enrolment_handoff_choices() to authenticated;
grant execute on function public.return_crm_enrolment_review(uuid, text) to authenticated;
grant execute on function public.approve_crm_enrolment_review(
  uuid, public.crm_student_resolution_mode, uuid, uuid, uuid, text, uuid[], text[]
) to authenticated;
grant execute on function public.list_crm_enquiries(integer, text, text) to authenticated;

comment on function public.list_enrolment_handoffs(integer, text) is
  'Returns only explicit pending CRM review requests after checking current Enrolment Operator authority.';
comment on function public.search_enrolment_students(integer, text) is
  'Bounded identity-resolution lookup by Member ID or operational display name; no general people browse is exposed.';
comment on function public.approve_crm_enrolment_review(
  uuid, public.crm_student_resolution_mode, uuid, uuid, uuid, text, uuid[], text[]
) is
  'Atomically resolves identity evidence, creates or reuses the canonical student, approves the enrolment, and converts the CRM enquiry.';
