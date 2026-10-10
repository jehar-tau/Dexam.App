insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values (
  'assignment.distribute',
  'Release or close a published assignment for active enrolments within an authorized offering scope.',
  false,
  false
);

create type public.assignment_release_status as enum ('active', 'closed', 'withdrawn');
create type public.student_assignment_status as enum (
  'assigned',
  'in_progress',
  'submitted',
  'correction_requested',
  'review_completed',
  'closed',
  'voided'
);
create type public.submission_attempt_status as enum ('draft', 'submitted');
create type public.submission_file_status as enum ('pending', 'ready');

create table public.assignment_releases (
  id uuid primary key default gen_random_uuid(),
  assignment_version_id uuid not null references public.assignment_versions (id) on delete restrict,
  offering_id uuid not null references public.offerings (id) on delete restrict,
  cohort_id uuid,
  target_kind text not null,
  due_at timestamptz,
  status public.assignment_release_status not null default 'active',
  release_note text not null,
  request_key uuid not null,
  released_by_person_id uuid not null references public.people (id) on delete restrict,
  released_at timestamptz not null default now(),
  closed_by_person_id uuid references public.people (id) on delete restrict,
  closed_at timestamptz,
  close_reason text,
  withdrawn_by_person_id uuid references public.people (id) on delete restrict,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now(),
  constraint assignment_releases_cohort_matches_offering foreign key (cohort_id, offering_id)
    references public.cohorts (id, offering_id) on delete restrict,
  constraint assignment_releases_target_kind_valid check (
    (target_kind = 'cohort' and cohort_id is not null)
    or (target_kind = 'selected' and cohort_id is null)
  ),
  constraint assignment_releases_note_present check (
    length(btrim(release_note)) between 3 and 500
  ),
  constraint assignment_releases_close_reason_present check (
    close_reason is null or length(btrim(close_reason)) between 3 and 500
  ),
  constraint assignment_releases_withdrawal_reason_present check (
    withdrawal_reason is null or length(btrim(withdrawal_reason)) between 3 and 500
  ),
  constraint assignment_releases_lifecycle_consistent check (
    (
      status = 'active'
      and closed_by_person_id is null and closed_at is null and close_reason is null
      and withdrawn_by_person_id is null and withdrawn_at is null and withdrawal_reason is null
    )
    or (
      status = 'closed'
      and closed_by_person_id is not null and closed_at is not null and close_reason is not null
      and withdrawn_by_person_id is null and withdrawn_at is null and withdrawal_reason is null
    )
    or (
      status = 'withdrawn'
      and withdrawn_by_person_id is not null and withdrawn_at is not null and withdrawal_reason is not null
      and closed_by_person_id is null and closed_at is null and close_reason is null
    )
  ),
  constraint assignment_releases_actor_request_unique unique (released_by_person_id, request_key)
);

create table public.student_assignment_instances (
  id uuid primary key default gen_random_uuid(),
  assignment_release_id uuid not null references public.assignment_releases (id) on delete restrict,
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  status public.student_assignment_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_assignment_instances_release_enrollment_unique unique (
    assignment_release_id,
    enrollment_id
  )
);

create table public.student_assignment_transitions (
  id bigint generated always as identity primary key,
  assignment_instance_id uuid not null references public.student_assignment_instances (id) on delete restrict,
  from_status public.student_assignment_status,
  to_status public.student_assignment_status not null,
  actor_person_id uuid not null references public.people (id) on delete restrict,
  reason_code text not null,
  reason_detail text,
  occurred_at timestamptz not null default now(),
  constraint student_assignment_transitions_reason_format check (
    reason_code ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  constraint student_assignment_transitions_detail_length check (
    reason_detail is null or length(btrim(reason_detail)) between 3 and 500
  ),
  constraint student_assignment_transitions_actual_change check (
    from_status is null or from_status <> to_status
  )
);

create table public.submission_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_instance_id uuid not null references public.student_assignment_instances (id) on delete restrict,
  attempt_number integer not null,
  status public.submission_attempt_status not null default 'draft',
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  submitted_late boolean,
  constraint submission_attempts_number_positive check (attempt_number > 0),
  constraint submission_attempts_instance_number_unique unique (
    assignment_instance_id,
    attempt_number
  ),
  constraint submission_attempts_lifecycle_consistent check (
    (status = 'draft' and submitted_at is null and submitted_late is null)
    or (status = 'submitted' and submitted_at is not null and submitted_late is not null)
  )
);

create unique index submission_attempts_one_draft_per_instance
  on public.submission_attempts (assignment_instance_id)
  where status = 'draft';

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_attempt_id uuid not null references public.submission_attempts (id) on delete restrict,
  object_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  original_byte_size bigint not null,
  was_compressed boolean not null default false,
  pixel_width integer,
  pixel_height integer,
  position integer not null,
  status public.submission_file_status not null default 'pending',
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  purged_at timestamptz,
  constraint submission_files_name_present check (
    length(btrim(original_file_name)) between 1 and 180
  ),
  constraint submission_files_mime_allowed check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint submission_files_size_allowed check (byte_size between 1 and 10485760),
  constraint submission_files_original_size_allowed check (
    original_byte_size between 1 and 52428800
  ),
  constraint submission_files_compression_consistent check (
    not was_compressed or original_byte_size > byte_size
  ),
  constraint submission_files_dimensions_valid check (
    (pixel_width is null and pixel_height is null)
    or (
      mime_type <> 'application/pdf'
      and pixel_width between 1 and 3200
      and pixel_height between 1 and 3200
    )
  ),
  constraint submission_files_position_allowed check (position between 1 and 10),
  constraint submission_files_attempt_position_unique unique (submission_attempt_id, position),
  constraint submission_files_ready_consistent check (
    (status = 'pending' and ready_at is null)
    or (status = 'ready' and ready_at is not null)
  )
);

create index assignment_releases_version_idx
  on public.assignment_releases (assignment_version_id, released_at desc);
create index assignment_releases_offering_idx
  on public.assignment_releases (offering_id, status, released_at desc);
create index student_assignment_instances_enrollment_idx
  on public.student_assignment_instances (enrollment_id, assigned_at desc);
create index student_assignment_transitions_instance_idx
  on public.student_assignment_transitions (assignment_instance_id, occurred_at);
create index submission_attempts_instance_idx
  on public.submission_attempts (assignment_instance_id, attempt_number desc);
create index submission_files_attempt_idx
  on public.submission_files (submission_attempt_id, position);
create index submission_files_abandoned_idx
  on public.submission_files (created_at)
  where status = 'pending' and purged_at is null;

create or replace function public.current_person_can_distribute_assignments(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_capability('assignment.distribute')
    or public.current_person_has_capability('assignment.distribute', 'offering', p_offering_id),
    false
  )
$$;

create or replace function public.current_person_is_assignment_teacher(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_role('teacher')
    or public.current_person_has_role('teacher', 'offering', p_offering_id),
    false
  )
$$;

create or replace function public.current_person_can_access_assignment_instance(
  p_assignment_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_active_student_membership()
    and exists (
      select 1
      from public.student_assignment_instances i
      join public.assignment_releases r on r.id = i.assignment_release_id
      join public.enrollments e on e.id = i.enrollment_id
      join public.offerings o on o.id = e.offering_id
      where i.id = p_assignment_instance_id
        and e.person_id = public.current_person_id()
        and e.status = 'active'
        and e.offering_id = r.offering_id
        and o.status = 'active'
        and r.status <> 'withdrawn'
        and i.status <> 'voided'
    ),
    false
  )
$$;

create or replace function public.current_person_can_review_assignment_instance(
  p_assignment_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.student_assignment_instances i
    join public.assignment_releases r on r.id = i.assignment_release_id
    where i.id = p_assignment_instance_id
      and public.current_person_is_assignment_teacher(r.offering_id)
  ), false)
$$;

create or replace function public.current_person_can_manage_assignment_instance(
  p_assignment_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.student_assignment_instances i
    join public.assignment_releases r on r.id = i.assignment_release_id
    where i.id = p_assignment_instance_id
      and public.current_person_can_distribute_assignments(r.offering_id)
  ), false)
$$;

create or replace function public.current_person_can_access_assignment_release(
  p_assignment_release_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.student_assignment_instances i
    where i.assignment_release_id = p_assignment_release_id
      and public.current_person_can_access_assignment_instance(i.id)
  ), false)
$$;

create or replace function public.current_person_can_read_distributed_assignment_version(
  p_assignment_version_id uuid
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
      from public.assignment_releases r
      join public.student_assignment_instances i on i.assignment_release_id = r.id
      where r.assignment_version_id = p_assignment_version_id
        and public.current_person_can_access_assignment_instance(i.id)
    )
    or exists (
      select 1 from public.assignment_releases r
      where r.assignment_version_id = p_assignment_version_id
        and public.current_person_is_assignment_teacher(r.offering_id)
    ),
    false
  )
$$;

create or replace function public.current_person_can_read_distributed_assignment_definition(
  p_assignment_definition_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.assignment_versions v
    where v.assignment_definition_id = p_assignment_definition_id
      and public.current_person_can_read_distributed_assignment_version(v.id)
  ), false)
$$;

create or replace function public.list_assignment_distribution_targets(p_offering_id uuid)
returns table (
  enrollment_id uuid,
  member_id text,
  display_name text,
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
  if not public.current_person_can_distribute_assignments(p_offering_id) then
    raise exception using errcode = '42501', message = 'assignment distribution access denied';
  end if;

  return query
  select e.id, p.member_id, p.display_name, e.cohort_id, c.name
  from public.enrollments e
  join public.people p on p.id = e.person_id and p.status = 'active'
  join public.memberships m
    on m.person_id = e.person_id and m.kind = 'student' and m.status = 'active'
    and (m.starts_at is null or m.starts_at <= now())
    and (m.ends_at is null or m.ends_at > now())
  left join public.cohorts c on c.id = e.cohort_id
  where e.offering_id = p_offering_id and e.status = 'active'
  order by c.name nulls last, p.display_name nulls last, p.member_id;
end;
$$;

create or replace function public.enforce_assignment_release_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  version_status public.curriculum_status;
  version_offering_id uuid;
begin
  select v.status, d.offering_id into version_status, version_offering_id
  from public.assignment_versions v
  join public.assignment_definitions d on d.id = v.assignment_definition_id
  where v.id = new.assignment_version_id;

  if version_status is distinct from 'published'::public.curriculum_status
    or version_offering_id is distinct from new.offering_id
  then
    raise exception using errcode = '23514', message = 'only a published assignment from the same offering can be distributed';
  end if;

  return new;
end;
$$;

create trigger assignment_releases_integrity_guard
before insert or update of assignment_version_id, offering_id, cohort_id on public.assignment_releases
for each row execute function public.enforce_assignment_release_integrity();

create or replace function public.enforce_assignment_instance_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  release_offering_id uuid;
  release_cohort_id uuid;
  release_target_kind text;
  target_enrollment public.enrollments%rowtype;
begin
  select offering_id, cohort_id, target_kind
  into release_offering_id, release_cohort_id, release_target_kind
  from public.assignment_releases
  where id = new.assignment_release_id;

  select * into target_enrollment from public.enrollments where id = new.enrollment_id;

  if target_enrollment.id is null
    or target_enrollment.offering_id is distinct from release_offering_id
    or target_enrollment.status <> 'active'
    or (
      release_target_kind = 'cohort'
      and target_enrollment.cohort_id is distinct from release_cohort_id
    )
  then
    raise exception using errcode = '23514', message = 'assignment target must be an active enrolment in the release scope';
  end if;

  return new;
end;
$$;

create trigger student_assignment_instances_integrity_guard
before insert or update of assignment_release_id, enrollment_id on public.student_assignment_instances
for each row execute function public.enforce_assignment_instance_integrity();

create or replace function public.enforce_submitted_attempt_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'submitted' then
    raise exception using errcode = '55000', message = 'submitted attempts are immutable';
  end if;
  return new;
end;
$$;

create trigger submission_attempts_immutability_guard
before update or delete on public.submission_attempts
for each row execute function public.enforce_submitted_attempt_immutability();

create or replace function public.enforce_submission_file_draft()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_attempt_id uuid;
  target_status public.submission_attempt_status;
begin
  target_attempt_id := case when tg_op = 'DELETE' then old.submission_attempt_id else new.submission_attempt_id end;
  select status into target_status from public.submission_attempts where id = target_attempt_id;

  if target_status is distinct from 'draft'::public.submission_attempt_status then
    if tg_op = 'UPDATE'
      and old.purged_at is null
      and new.purged_at is not null
      and new.original_file_name = '[purged]'
      and row(
        new.id, new.submission_attempt_id, new.object_path, new.mime_type,
        new.byte_size, new.original_byte_size, new.was_compressed,
        new.pixel_width, new.pixel_height, new.position, new.status,
        new.created_at, new.ready_at
      ) is not distinct from row(
        old.id, old.submission_attempt_id, old.object_path, old.mime_type,
        old.byte_size, old.original_byte_size, old.was_compressed,
        old.pixel_width, old.pixel_height, old.position, old.status,
        old.created_at, old.ready_at
      )
    then
      return new;
    end if;
    raise exception using errcode = '55000', message = 'files on submitted attempts are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger submission_files_draft_guard
before insert or update or delete on public.submission_files
for each row execute function public.enforce_submission_file_draft();

create or replace function public.distribute_assignment_version(
  p_assignment_version_id uuid,
  p_cohort_id uuid,
  p_enrollment_ids uuid[],
  p_due_at timestamptz,
  p_release_note text,
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_offering_id uuid;
  target_version_status public.curriculum_status;
  existing_release_id uuid;
  new_release_id uuid;
  target_kind text;
  requested_count integer;
  eligible_count integer;
begin
  select r.id into existing_release_id
  from public.assignment_releases r
  where r.released_by_person_id = actor_id and r.request_key = p_request_key;
  if existing_release_id is not null then return existing_release_id; end if;

  select d.offering_id, v.status into target_offering_id, target_version_status
  from public.assignment_versions v
  join public.assignment_definitions d on d.id = v.assignment_definition_id
  where v.id = p_assignment_version_id;

  if target_version_status is distinct from 'published'::public.curriculum_status
    or not public.current_person_can_distribute_assignments(target_offering_id)
  then
    raise exception using errcode = '42501', message = 'assignment distribution access denied';
  end if;

  if length(btrim(coalesce(p_release_note, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'a release note between 3 and 500 characters is required';
  end if;
  if p_due_at is not null and p_due_at <= now() then
    raise exception using errcode = '22023', message = 'the due date must be in the future';
  end if;

  if p_cohort_id is not null and coalesce(cardinality(p_enrollment_ids), 0) = 0 then
    target_kind := 'cohort';
    if not exists (
      select 1 from public.cohorts c
      where c.id = p_cohort_id and c.offering_id = target_offering_id and c.status = 'active'
    ) then
      raise exception using errcode = '23514', message = 'the target cohort must be active and belong to the assignment offering';
    end if;
  elsif p_cohort_id is null and coalesce(cardinality(p_enrollment_ids), 0) > 0 then
    target_kind := 'selected';
    select count(distinct requested_id) into requested_count from unnest(p_enrollment_ids) requested_id;
    select count(*) into eligible_count
    from public.enrollments e
    join public.people p on p.id = e.person_id and p.status = 'active'
    where e.id = any(p_enrollment_ids)
      and e.offering_id = target_offering_id
      and e.status = 'active'
      and exists (
        select 1 from public.memberships m
        where m.person_id = e.person_id and m.kind = 'student' and m.status = 'active'
          and (m.starts_at is null or m.starts_at <= now())
          and (m.ends_at is null or m.ends_at > now())
      );
    if eligible_count <> requested_count then
      raise exception using errcode = '23514', message = 'every selected target must be an active student enrolment in the assignment offering';
    end if;
  else
    raise exception using errcode = '22023', message = 'choose either one cohort or one or more selected enrolments';
  end if;

  insert into public.assignment_releases (
    assignment_version_id, offering_id, cohort_id, target_kind, due_at,
    release_note, request_key, released_by_person_id
  ) values (
    p_assignment_version_id, target_offering_id, p_cohort_id, target_kind, p_due_at,
    btrim(p_release_note), p_request_key, actor_id
  ) returning id into new_release_id;

  if target_kind = 'cohort' then
    insert into public.student_assignment_instances (assignment_release_id, enrollment_id)
    select new_release_id, e.id
    from public.enrollments e
    join public.people p on p.id = e.person_id and p.status = 'active'
    where e.cohort_id = p_cohort_id and e.offering_id = target_offering_id and e.status = 'active'
      and exists (
        select 1 from public.memberships m
        where m.person_id = e.person_id and m.kind = 'student' and m.status = 'active'
          and (m.starts_at is null or m.starts_at <= now())
          and (m.ends_at is null or m.ends_at > now())
      );
  else
    insert into public.student_assignment_instances (assignment_release_id, enrollment_id)
    select new_release_id, e.id
    from public.enrollments e
    where e.id = any(p_enrollment_ids);
  end if;

  if not exists (
    select 1 from public.student_assignment_instances where assignment_release_id = new_release_id
  ) then
    raise exception using errcode = '23514', message = 'assignment distribution requires at least one eligible student';
  end if;

  insert into public.student_assignment_transitions (
    assignment_instance_id, from_status, to_status, actor_person_id, reason_code
  )
  select id, null, 'assigned', actor_id, 'assignment_distributed'
  from public.student_assignment_instances
  where assignment_release_id = new_release_id;

  insert into public.security_audit_events (
    subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata
  ) values (
    actor_id, actor_id, 'assignment_distributed', 'succeeded', 'academic_release',
    jsonb_build_object(
      'assignment_release_id', new_release_id,
      'assignment_version_id', p_assignment_version_id,
      'offering_id', target_offering_id,
      'target_kind', target_kind,
      'target_count', (select count(*) from public.student_assignment_instances where assignment_release_id = new_release_id)
    )
  );

  return new_release_id;
end;
$$;

create or replace function public.change_assignment_release_state(
  p_assignment_release_id uuid,
  p_action text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_release public.assignment_releases%rowtype;
  actor_id uuid := public.current_person_id();
begin
  select * into target_release from public.assignment_releases
  where id = p_assignment_release_id for update;

  if target_release.id is null
    or not public.current_person_can_distribute_assignments(target_release.offering_id)
  then
    raise exception using errcode = '42501', message = 'assignment distribution access denied';
  end if;
  if target_release.status <> 'active' then
    raise exception using errcode = '23514', message = 'only an active assignment release can change state';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'a reason between 3 and 500 characters is required';
  end if;

  if p_action = 'close' then
    update public.assignment_releases
    set status = 'closed', closed_by_person_id = actor_id,
        closed_at = now(), close_reason = btrim(p_reason)
    where id = target_release.id;
  elsif p_action = 'withdraw' then
    if exists (
      select 1 from public.student_assignment_instances i
      join public.submission_attempts a on a.assignment_instance_id = i.id
      where i.assignment_release_id = target_release.id and a.status = 'submitted'
    ) then
      raise exception using errcode = '23514', message = 'a release with submitted work cannot be withdrawn';
    end if;

    update public.assignment_releases
    set status = 'withdrawn', withdrawn_by_person_id = actor_id,
        withdrawn_at = now(), withdrawal_reason = btrim(p_reason)
    where id = target_release.id;

    insert into public.student_assignment_transitions (
      assignment_instance_id, from_status, to_status, actor_person_id, reason_code, reason_detail
    )
    select id, status, 'voided', actor_id, 'assignment_withdrawn', btrim(p_reason)
    from public.student_assignment_instances
    where assignment_release_id = target_release.id and status <> 'voided';

    update public.student_assignment_instances
    set status = 'voided', updated_at = now()
    where assignment_release_id = target_release.id and status <> 'voided';
  else
    raise exception using errcode = '22023', message = 'action must be close or withdraw';
  end if;
end;
$$;

create or replace function public.start_assignment_attempt(p_assignment_instance_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_instance public.student_assignment_instances%rowtype;
  release_status public.assignment_release_status;
  actor_id uuid := public.current_person_id();
  existing_draft_id uuid;
  new_attempt_id uuid;
  next_attempt_number integer;
begin
  select * into target_instance from public.student_assignment_instances
  where id = p_assignment_instance_id for update;
  select status into release_status from public.assignment_releases
  where id = target_instance.assignment_release_id;

  if target_instance.id is null
    or not public.current_person_can_access_assignment_instance(target_instance.id)
  then
    raise exception using errcode = '42501', message = 'assignment attempt access denied';
  end if;
  if release_status <> 'active' then
    raise exception using errcode = '23514', message = 'this assignment is not accepting submissions';
  end if;

  select id into existing_draft_id from public.submission_attempts
  where assignment_instance_id = target_instance.id and status = 'draft';
  if existing_draft_id is not null then return existing_draft_id; end if;

  if target_instance.status not in ('assigned', 'correction_requested') then
    raise exception using errcode = '23514', message = 'a new attempt is not currently authorized';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_attempt_number
  from public.submission_attempts where assignment_instance_id = target_instance.id;

  insert into public.submission_attempts (
    assignment_instance_id, attempt_number, created_by_person_id
  ) values (
    target_instance.id, next_attempt_number, actor_id
  ) returning id into new_attempt_id;

  insert into public.student_assignment_transitions (
    assignment_instance_id, from_status, to_status, actor_person_id, reason_code
  ) values (
    target_instance.id, target_instance.status, 'in_progress', actor_id,
    case when next_attempt_number = 1 then 'initial_attempt_started' else 'revision_attempt_started' end
  );

  update public.student_assignment_instances
  set status = 'in_progress', updated_at = now()
  where id = target_instance.id;

  return new_attempt_id;
end;
$$;

create or replace function public.reserve_submission_file(
  p_submission_attempt_id uuid,
  p_original_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_original_byte_size bigint,
  p_was_compressed boolean,
  p_pixel_width integer,
  p_pixel_height integer
)
returns table (file_id uuid, object_path text)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_attempt public.submission_attempts%rowtype;
  target_instance_id uuid;
  release_status public.assignment_release_status;
  extension text;
  next_position integer;
  existing_total bigint;
  new_file_id uuid := gen_random_uuid();
  new_object_path text;
begin
  select * into target_attempt from public.submission_attempts
  where id = p_submission_attempt_id for update;
  target_instance_id := target_attempt.assignment_instance_id;

  select r.status into release_status
  from public.student_assignment_instances i
  join public.assignment_releases r on r.id = i.assignment_release_id
  where i.id = target_instance_id;

  if target_attempt.id is null
    or target_attempt.status <> 'draft'
    or release_status <> 'active'
    or not public.current_person_can_access_assignment_instance(target_instance_id)
  then
    raise exception using errcode = '42501', message = 'submission file access denied';
  end if;

  if length(btrim(coalesce(p_original_file_name, ''))) not between 1 and 180
    or p_byte_size not between 1 and 10485760
    or p_original_byte_size not between 1 and 52428800
    or (p_was_compressed and p_original_byte_size <= p_byte_size)
  then
    raise exception using errcode = '22023', message = 'submission file metadata is invalid';
  end if;

  extension := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    else null
  end;
  if extension is null then
    raise exception using errcode = '22023', message = 'submission file type is not allowed';
  end if;
  if p_mime_type = 'application/pdf' and (p_pixel_width is not null or p_pixel_height is not null) then
    raise exception using errcode = '22023', message = 'PDF files cannot include image dimensions';
  end if;
  if p_mime_type <> 'application/pdf'
    and (p_pixel_width not between 1 and 3200 or p_pixel_height not between 1 and 3200)
  then
    raise exception using errcode = '22023', message = 'image dimensions are invalid';
  end if;

  select coalesce(max(position), 0) + 1, coalesce(sum(byte_size), 0)
  into next_position, existing_total
  from public.submission_files
  where submission_attempt_id = target_attempt.id and purged_at is null;

  if next_position > 10 or existing_total + p_byte_size > 52428800 then
    raise exception using errcode = '23514', message = 'submission file count or total size limit exceeded';
  end if;

  new_object_path := target_instance_id::text || '/' || target_attempt.id::text || '/' || new_file_id::text || '.' || extension;

  insert into public.submission_files (
    id, submission_attempt_id, object_path, original_file_name, mime_type,
    byte_size, original_byte_size, was_compressed, pixel_width, pixel_height, position
  ) values (
    new_file_id, target_attempt.id, new_object_path, btrim(p_original_file_name), p_mime_type,
    p_byte_size, p_original_byte_size, p_was_compressed, p_pixel_width, p_pixel_height, next_position
  );

  return query select new_file_id, new_object_path;
end;
$$;

create or replace function public.complete_submission_file_upload(p_submission_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_file public.submission_files%rowtype;
begin
  select * into target_file from public.submission_files
  where id = p_submission_file_id for update;

  if target_file.id is null or target_file.status <> 'pending' then
    raise exception using errcode = '23514', message = 'submission file is not pending';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'student-submissions'
      and o.name = target_file.object_path
      and o.archived_at is null
      and o.metadata ->> 'mimetype' = target_file.mime_type
      and (o.metadata ->> 'size')::bigint = target_file.byte_size
  ) then
    raise exception using errcode = '23514', message = 'verified private object is missing';
  end if;

  update public.submission_files
  set status = 'ready', ready_at = now()
  where id = target_file.id;
end;
$$;

create or replace function public.finalize_submission_attempt(p_submission_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_attempt public.submission_attempts%rowtype;
  target_instance public.student_assignment_instances%rowtype;
  target_release public.assignment_releases%rowtype;
  ready_count integer;
  total_bytes bigint;
  submitted_at_value timestamptz := now();
begin
  select * into target_attempt from public.submission_attempts
  where id = p_submission_attempt_id for update;
  select * into target_instance from public.student_assignment_instances
  where id = target_attempt.assignment_instance_id for update;
  select * into target_release from public.assignment_releases
  where id = target_instance.assignment_release_id;

  if target_attempt.id is null
    or target_attempt.status <> 'draft'
    or not public.current_person_can_access_assignment_instance(target_instance.id)
  then
    raise exception using errcode = '42501', message = 'submission finalization access denied';
  end if;
  if target_release.status <> 'active' then
    raise exception using errcode = '23514', message = 'this assignment is not accepting submissions';
  end if;

  select count(*), coalesce(sum(byte_size), 0)
  into ready_count, total_bytes
  from public.submission_files
  where submission_attempt_id = target_attempt.id and status = 'ready' and purged_at is null;

  if ready_count not between 1 and 10 or total_bytes > 52428800 then
    raise exception using errcode = '23514', message = 'one to ten verified files within 50 MB are required';
  end if;
  if exists (
    select 1 from public.submission_files
    where submission_attempt_id = target_attempt.id and status <> 'ready' and purged_at is null
  ) then
    raise exception using errcode = '23514', message = 'all submission files must finish uploading';
  end if;
  if exists (
    select 1
    from public.submission_files f
    left join storage.objects o
      on o.bucket_id = 'student-submissions' and o.name = f.object_path and o.archived_at is null
    where f.submission_attempt_id = target_attempt.id
      and f.status = 'ready' and f.purged_at is null
      and (
        o.id is null
        or o.metadata ->> 'mimetype' <> f.mime_type
        or (o.metadata ->> 'size')::bigint <> f.byte_size
      )
  ) then
    raise exception using errcode = '23514', message = 'a verified submission object is missing or changed';
  end if;

  update public.submission_attempts
  set status = 'submitted', submitted_at = submitted_at_value,
      submitted_late = target_release.due_at is not null and submitted_at_value > target_release.due_at
  where id = target_attempt.id;

  insert into public.student_assignment_transitions (
    assignment_instance_id, from_status, to_status, actor_person_id, reason_code
  ) values (
    target_instance.id, target_instance.status, 'submitted', public.current_person_id(),
    case
      when target_release.due_at is not null and submitted_at_value > target_release.due_at
        then 'attempt_submitted_late'
      else 'attempt_submitted'
    end
  );

  update public.student_assignment_instances
  set status = 'submitted', updated_at = submitted_at_value
  where id = target_instance.id;
end;
$$;

create or replace function public.request_assignment_correction(
  p_assignment_instance_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_instance public.student_assignment_instances%rowtype;
begin
  select * into target_instance from public.student_assignment_instances
  where id = p_assignment_instance_id for update;

  if target_instance.id is null
    or not public.current_person_can_review_assignment_instance(target_instance.id)
  then
    raise exception using errcode = '42501', message = 'assignment review access denied';
  end if;
  if target_instance.status not in ('submitted', 'review_completed') then
    raise exception using errcode = '23514', message = 'only submitted or completed work can be returned for correction';
  end if;
  if length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'a correction reason between 3 and 500 characters is required';
  end if;

  insert into public.student_assignment_transitions (
    assignment_instance_id, from_status, to_status, actor_person_id, reason_code, reason_detail
  ) values (
    target_instance.id, target_instance.status, 'correction_requested', public.current_person_id(),
    case when target_instance.status = 'review_completed' then 'completed_review_reopened' else 'correction_requested' end,
    btrim(p_reason)
  );

  update public.student_assignment_instances
  set status = 'correction_requested', updated_at = now()
  where id = target_instance.id;
end;
$$;

create or replace function public.list_submission_files_due_for_purge(p_limit integer default 100)
returns table (file_id uuid, object_path text)
language sql
security definer
set search_path = ''
set row_security = off
as $$
  select f.id, f.object_path
  from public.submission_files f
  join public.submission_attempts a on a.id = f.submission_attempt_id
  join public.student_assignment_instances i on i.id = a.assignment_instance_id
  join public.enrollments e on e.id = i.enrollment_id
  where f.purged_at is null
    and (
      (a.status = 'draft' and f.created_at <= now() - interval '30 days')
      or (e.ended_at is not null and e.ended_at <= now() - interval '12 months')
    )
  order by f.created_at
  limit greatest(1, least(coalesce(p_limit, 100), 500))
$$;

create or replace function public.complete_submission_file_purge(p_submission_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  attempt_status public.submission_attempt_status;
begin
  select a.status into attempt_status
  from public.submission_files f
  join public.submission_attempts a on a.id = f.submission_attempt_id
  where f.id = p_submission_file_id;

  if attempt_status is null then return; end if;
  if attempt_status = 'draft' then
    delete from public.submission_files where id = p_submission_file_id;
  else
    update public.submission_files
    set original_file_name = '[purged]', purged_at = now()
    where id = p_submission_file_id and purged_at is null;
  end if;
end;
$$;

alter table public.assignment_releases enable row level security;
alter table public.student_assignment_instances enable row level security;
alter table public.student_assignment_transitions enable row level security;
alter table public.submission_attempts enable row level security;
alter table public.submission_files enable row level security;

revoke all on table public.assignment_releases from anon, authenticated;
revoke all on table public.student_assignment_instances from anon, authenticated;
revoke all on table public.student_assignment_transitions from anon, authenticated;
revoke all on table public.submission_attempts from anon, authenticated;
revoke all on table public.submission_files from anon, authenticated;
revoke all on sequence public.student_assignment_transitions_id_seq from anon, authenticated;

grant select on table public.assignment_releases to authenticated;
grant select on table public.student_assignment_instances to authenticated;
grant select on table public.student_assignment_transitions to authenticated;
grant select on table public.submission_attempts to authenticated;
grant select on table public.submission_files to authenticated;
grant all on table public.assignment_releases to service_role;
grant all on table public.student_assignment_instances to service_role;
grant all on table public.student_assignment_transitions to service_role;
grant all on table public.submission_attempts to service_role;
grant all on table public.submission_files to service_role;
grant usage, select on sequence public.student_assignment_transitions_id_seq to service_role;

create policy assignment_releases_select_authorized
on public.assignment_releases for select to authenticated
using (
  (select public.current_person_can_distribute_assignments(offering_id))
  or (select public.current_person_is_assignment_teacher(offering_id))
  or (select public.current_person_can_access_assignment_release(id))
);

create policy student_assignment_instances_select_authorized
on public.student_assignment_instances for select to authenticated
using (
  (select public.current_person_can_access_assignment_instance(id))
  or (select public.current_person_can_review_assignment_instance(id))
  or (select public.current_person_can_manage_assignment_instance(id))
);

create policy student_assignment_transitions_select_authorized
on public.student_assignment_transitions for select to authenticated
using (
  (select public.current_person_can_access_assignment_instance(assignment_instance_id))
  or (select public.current_person_can_review_assignment_instance(assignment_instance_id))
);

create policy submission_attempts_select_authorized
on public.submission_attempts for select to authenticated
using (
  (select public.current_person_can_access_assignment_instance(assignment_instance_id))
  or (select public.current_person_can_review_assignment_instance(assignment_instance_id))
);

create policy submission_files_select_authorized
on public.submission_files for select to authenticated
using (
  exists (
    select 1 from public.submission_attempts a
    where a.id = submission_attempt_id
      and (
        public.current_person_can_access_assignment_instance(a.assignment_instance_id)
        or public.current_person_can_review_assignment_instance(a.assignment_instance_id)
      )
  )
);

create policy assignment_definitions_select_distributed
on public.assignment_definitions for select to authenticated
using (
  (select public.current_person_can_distribute_assignments(offering_id))
  or (select public.current_person_is_assignment_teacher(offering_id))
  or (select public.current_person_can_read_distributed_assignment_definition(id))
);

create policy assignment_versions_select_distributed
on public.assignment_versions for select to authenticated
using ((select public.current_person_can_read_distributed_assignment_version(id)));

create policy assignment_topic_links_select_distributed
on public.assignment_topic_links for select to authenticated
using ((select public.current_person_can_read_distributed_assignment_version(assignment_version_id)));

create policy assignment_materials_select_distributed
on public.assignment_materials for select to authenticated
using ((select public.current_person_can_read_distributed_assignment_version(assignment_version_id)));

create policy offerings_select_assignment_academic
on public.offerings for select to authenticated
using (
  (select public.current_person_can_distribute_assignments(id))
  or (select public.current_person_is_assignment_teacher(id))
);

create policy cohorts_select_assignment_academic
on public.cohorts for select to authenticated
using (
  (select public.current_person_can_distribute_assignments(offering_id))
  or (select public.current_person_is_assignment_teacher(offering_id))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-submissions',
  'student-submissions',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.current_person_can_read_submission_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  instance_id uuid;
  attempt_id uuid;
begin
  if p_object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$' then
    return false;
  end if;
  instance_id := split_part(p_object_name, '/', 1)::uuid;
  attempt_id := split_part(p_object_name, '/', 2)::uuid;
  return exists (
    select 1 from public.submission_attempts a
    where a.id = attempt_id and a.assignment_instance_id = instance_id
      and (
        public.current_person_can_access_assignment_instance(instance_id)
        or public.current_person_can_review_assignment_instance(instance_id)
      )
  );
exception when others then
  return false;
end;
$$;

create policy student_submission_objects_select_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'student-submissions'
  and (select public.current_person_can_read_submission_object(name))
);

create or replace function public.current_person_can_read_assignment_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  version_id uuid;
  offering_id uuid;
begin
  if p_object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$' then
    return false;
  end if;
  version_id := split_part(p_object_name, '/', 2)::uuid;
  offering_id := public.assignment_version_offering_id(version_id);
  return split_part(p_object_name, '/', 1) = offering_id::text
    and (
      public.current_person_can_manage_content(offering_id)
      or public.current_person_can_publish_content(offering_id)
      or public.current_person_can_distribute_assignments(offering_id)
      or public.current_person_is_assignment_teacher(offering_id)
      or public.current_person_can_read_distributed_assignment_version(version_id)
    );
exception when others then
  return false;
end;
$$;

revoke all on function public.current_person_can_distribute_assignments(uuid) from public, anon;
revoke all on function public.current_person_is_assignment_teacher(uuid) from public, anon;
revoke all on function public.current_person_can_access_assignment_instance(uuid) from public, anon;
revoke all on function public.current_person_can_review_assignment_instance(uuid) from public, anon;
revoke all on function public.current_person_can_manage_assignment_instance(uuid) from public, anon;
revoke all on function public.current_person_can_access_assignment_release(uuid) from public, anon;
revoke all on function public.current_person_can_read_distributed_assignment_version(uuid) from public, anon;
revoke all on function public.current_person_can_read_distributed_assignment_definition(uuid) from public, anon;
revoke all on function public.list_assignment_distribution_targets(uuid) from public, anon;
revoke all on function public.distribute_assignment_version(uuid, uuid, uuid[], timestamptz, text, uuid) from public, anon;
revoke all on function public.change_assignment_release_state(uuid, text, text) from public, anon;
revoke all on function public.start_assignment_attempt(uuid) from public, anon;
revoke all on function public.reserve_submission_file(uuid, text, text, bigint, bigint, boolean, integer, integer) from public, anon;
revoke all on function public.complete_submission_file_upload(uuid) from public, anon, authenticated;
revoke all on function public.finalize_submission_attempt(uuid) from public, anon;
revoke all on function public.request_assignment_correction(uuid, text) from public, anon;
revoke all on function public.current_person_can_read_submission_object(text) from public, anon;
revoke all on function public.list_submission_files_due_for_purge(integer) from public, anon, authenticated;
revoke all on function public.complete_submission_file_purge(uuid) from public, anon, authenticated;

grant execute on function public.current_person_can_distribute_assignments(uuid) to authenticated;
grant execute on function public.current_person_is_assignment_teacher(uuid) to authenticated;
grant execute on function public.current_person_can_access_assignment_instance(uuid) to authenticated;
grant execute on function public.current_person_can_review_assignment_instance(uuid) to authenticated;
grant execute on function public.current_person_can_manage_assignment_instance(uuid) to authenticated;
grant execute on function public.current_person_can_access_assignment_release(uuid) to authenticated;
grant execute on function public.current_person_can_read_distributed_assignment_version(uuid) to authenticated;
grant execute on function public.current_person_can_read_distributed_assignment_definition(uuid) to authenticated;
grant execute on function public.list_assignment_distribution_targets(uuid) to authenticated;
grant execute on function public.distribute_assignment_version(uuid, uuid, uuid[], timestamptz, text, uuid) to authenticated;
grant execute on function public.change_assignment_release_state(uuid, text, text) to authenticated;
grant execute on function public.start_assignment_attempt(uuid) to authenticated;
grant execute on function public.reserve_submission_file(uuid, text, text, bigint, bigint, boolean, integer, integer) to authenticated;
grant execute on function public.complete_submission_file_upload(uuid) to service_role;
grant execute on function public.finalize_submission_attempt(uuid) to authenticated;
grant execute on function public.request_assignment_correction(uuid, text) to authenticated;
grant execute on function public.current_person_can_read_submission_object(text) to authenticated;
grant execute on function public.list_submission_files_due_for_purge(integer) to service_role;
grant execute on function public.complete_submission_file_purge(uuid) to service_role;

revoke all on function public.enforce_assignment_release_integrity() from public, anon, authenticated;
revoke all on function public.enforce_assignment_instance_integrity() from public, anon, authenticated;
revoke all on function public.enforce_submitted_attempt_immutability() from public, anon, authenticated;
revoke all on function public.enforce_submission_file_draft() from public, anon, authenticated;

comment on table public.assignment_releases is
  'A deliberate, retry-safe release of one immutable published assignment version to a cohort snapshot or selected active enrolments.';
comment on table public.student_assignment_instances is
  'One private assignment record per targeted enrolment. No instance means the assignment was not given.';
comment on table public.submission_attempts is
  'Student attempts are immutable after finalization; a teacher-authorized correction creates a later numbered attempt.';
comment on table public.submission_files is
  'Private verified student files. Ten files, 10 MB each, and 50 MB total per attempt under D-018.';
comment on function public.list_submission_files_due_for_purge(integer) is
  'Service-only bounded cleanup queue for 30-day abandoned drafts and files 12 months beyond enrolment end.';
