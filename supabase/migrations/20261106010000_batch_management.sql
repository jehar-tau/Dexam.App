-- D-066/F055: Sales create delivery batches; Sales and teachers place enrolled students into them.
-- Batches are the existing cohorts. Dates stay staff-only; students keep seeing the batch name.

create table public.batch_service_types (
  key text primary key check (key ~ '^[a-z][a-z_]{2,39}$'),
  label text not null check (length(btrim(label)) between 2 and 80),
  default_duration_days integer not null check (default_duration_days between 1 and 1500),
  position integer not null unique
);
-- Placeholder defaults pending the owner's durations (F055); they only pre-fill the end date.
insert into public.batch_service_types(key,label,default_duration_days,position) values
  ('end_to_end','End-to-end learning',365,1),
  ('crash_course','Crash course',45,2),
  ('portfolio','Portfolio',90,3),
  ('interview','Interview preparation',30,4);
alter table public.batch_service_types enable row level security;
revoke all on table public.batch_service_types from public, anon, authenticated;

alter table public.cohorts
  add column service_type text references public.batch_service_types(key) on delete restrict,
  add column created_by_person_id uuid references public.people(id) on delete restrict,
  add column revision bigint not null default 1 check (revision > 0);

-- Students may read their own batch row (name/status), never its dates. Staff read dates through
-- the batch RPCs below. Column grants apply to every authenticated reader, so no client path may
-- select cohort dates directly.
revoke select on table public.cohorts from authenticated;
grant select (id, offering_id, code, name, status, curriculum_version_id, service_type, created_at, updated_at)
  on table public.cohorts to authenticated;

insert into public.capabilities(key,description) values
  ('batch.manage','Create and edit delivery batches with their service type and dates.'),
  ('batch.assign','Place enrolled students into delivery batches of an offering.');
-- Owner-directed role defaults (D-066): Sales create and assign; teachers assign within their scope.
insert into public.role_capabilities(role_key,capability_key) values
  ('sales','batch.manage'),('sales','batch.assign'),('teacher','batch.assign'),
  ('elevated_admin','batch.manage'),('elevated_admin','batch.assign');

create table public.cohort_change_history (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  action text not null check (action in ('created','updated')),
  prior_values jsonb,
  new_values jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index cohort_change_history_cohort_idx on public.cohort_change_history(cohort_id, occurred_at);
create table public.cohort_assignment_history (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  from_cohort_id uuid references public.cohorts(id) on delete restrict,
  to_cohort_id uuid not null references public.cohorts(id) on delete restrict,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  occurred_at timestamptz not null default clock_timestamp()
);
create index cohort_assignment_history_enrollment_idx on public.cohort_assignment_history(enrollment_id, occurred_at);
alter table public.cohort_change_history enable row level security;
alter table public.cohort_assignment_history enable row level security;
revoke all on table public.cohort_change_history, public.cohort_assignment_history from public, anon, authenticated;

create function public.current_person_can_manage_batches()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_capability('batch.manage'),false)
$$;
create function public.current_person_can_assign_batches(p_offering_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_capability('batch.assign')
    or public.current_person_has_capability('batch.assign','offering',p_offering_id),false)
$$;

create function public.get_batch_workspace()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare can_manage boolean:=public.current_person_can_manage_batches(); visible uuid[];
begin
  select coalesce(array_agg(o.id),'{}') into visible from public.offerings o
    where o.status='active' and (can_manage or public.current_person_can_assign_batches(o.id));
  if not public.current_person_has_active_employee_membership() or (not can_manage and cardinality(visible)=0) then
    raise exception using errcode='42501',message='batch access denied'; end if;
  return jsonb_build_object(
    'canManage',can_manage,
    'serviceTypes',(select coalesce(jsonb_agg(jsonb_build_object('key',t.key,'label',t.label,'defaultDurationDays',t.default_duration_days) order by t.position),'[]'::jsonb)
      from public.batch_service_types t),
    'offerings',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'canAssign',public.current_person_can_assign_batches(o.id)) order by o.title),'[]'::jsonb)
      from public.offerings o where o.id=any(visible)),
    'batches',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'offeringId',c.offering_id,'code',c.code,'name',c.name,
        'serviceType',c.service_type,'status',c.status,'startsAt',c.starts_at,'endsAt',c.ends_at,'revision',c.revision,
        'studentCount',(select count(*) from public.enrollments e where e.cohort_id=c.id and e.status in ('approved','active')))
        order by c.starts_at nulls last,c.name),'[]'::jsonb)
      from public.cohorts c where c.offering_id=any(visible)));
end $$;

create function public.list_batch_students(p_offering_id uuid)
returns table(enrollment_id uuid, member_id text, display_name text, cohort_id uuid, movable boolean)
language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if not public.current_person_can_assign_batches(p_offering_id) then
    raise exception using errcode='42501',message='batch access denied'; end if;
  return query select e.id,p.member_id,p.display_name,e.cohort_id,e.curriculum_version_id is null
    from public.enrollments e join public.people p on p.id=e.person_id
    where e.offering_id=p_offering_id and e.status in ('approved','active') and e.ended_at is null and p.status='active'
    order by p.display_name,p.member_id;
end $$;

create function public.save_batch(p_request_key uuid, p_cohort_id uuid, p_expected_revision bigint, p_offering_id uuid,
  p_name text, p_service_type text, p_starts_at timestamptz, p_ends_at timestamptz, p_status public.cohort_status)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.cohort_change_history; target public.cohorts;
  request jsonb:=jsonb_build_object('cohort',p_cohort_id,'expectedRevision',p_expected_revision,'offering',p_offering_id,'name',p_name,
    'serviceType',p_service_type,'startsAt',p_starts_at,'endsAt',p_ends_at,'status',p_status);
begin
  if not public.current_person_can_manage_batches() then raise exception using errcode='42501',message='batch access denied'; end if;
  if p_request_key is null or p_name is null or length(btrim(p_name)) not between 2 and 160 or p_starts_at is null or p_ends_at is null
    or p_ends_at<=p_starts_at or not isfinite(p_starts_at) or not isfinite(p_ends_at) or p_status is null or p_status='planned'
    or not exists(select 1 from public.batch_service_types where key=p_service_type) then
    raise exception using errcode='22023',message='batch name, service type, start and a later end date are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-batch-save:'||p_request_key::text,0));
  select * into previous from public.cohort_change_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.new_values->'request' is distinct from request then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return previous.cohort_id;
  end if;
  if p_cohort_id is null then
    if p_expected_revision is not null or p_status<>'active'
      or not exists(select 1 from public.offerings where id=p_offering_id and status='active') then
      raise exception using errcode='22023',message='new batches open as active in an active offering'; end if;
    insert into public.cohorts(offering_id,code,name,status,starts_at,ends_at,service_type,created_by_person_id,curriculum_version_id)
      values(p_offering_id,'B'||to_char(p_starts_at at time zone 'Asia/Kolkata','YYMMDD')||'-'||upper(substr(md5(p_request_key::text),1,6)),
        btrim(p_name),'active',p_starts_at,p_ends_at,p_service_type,actor,
        (select cv.id from public.curriculum_versions cv where cv.offering_id=p_offering_id and cv.status='published'
          order by cv.version_number desc limit 1))
      returning * into target;
    insert into public.cohort_change_history(cohort_id,request_key,actor_person_id,action,new_values)
      values(target.id,p_request_key,actor,'created',jsonb_build_object('request',request,'code',target.code,'revision',target.revision));
  else
    select * into target from public.cohorts where id=p_cohort_id for update;
    if not found or target.offering_id is distinct from p_offering_id then
      raise exception using errcode='42501',message='batch unavailable'; end if;
    if target.revision is distinct from p_expected_revision then
      raise exception using errcode='40001',message='batch changed; refresh and review'; end if;
    update public.cohorts set name=btrim(p_name),service_type=p_service_type,starts_at=p_starts_at,ends_at=p_ends_at,status=p_status,
      revision=revision+1,updated_at=clock_timestamp() where id=target.id;
    insert into public.cohort_change_history(cohort_id,request_key,actor_person_id,action,prior_values,new_values)
      values(target.id,p_request_key,actor,'updated',
        jsonb_build_object('name',target.name,'serviceType',target.service_type,'startsAt',target.starts_at,'endsAt',target.ends_at,
          'status',target.status,'revision',target.revision),
        jsonb_build_object('request',request,'revision',target.revision+1));
  end if;
  if not public.current_person_can_manage_batches() then raise exception using errcode='42501',message='batch authority changed'; end if;
  return target.id;
end $$;

create function public.assign_student_batch(p_request_key uuid, p_enrollment_id uuid, p_expected_cohort_id uuid, p_cohort_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.cohort_assignment_history; target public.enrollments;
  current_curriculum uuid; next_curriculum uuid;
begin
  -- Authority before the idempotent replay path, like save_batch.
  if actor is null or not public.current_person_has_active_employee_membership() then
    raise exception using errcode='42501',message='batch access denied'; end if;
  if p_request_key is null or p_enrollment_id is null or p_cohort_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='choose a batch and give a reason'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-batch-assign:'||p_request_key::text,0));
  select * into previous from public.cohort_assignment_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.enrollment_id<>p_enrollment_id or previous.to_cohort_id<>p_cohort_id
      or previous.from_cohort_id is distinct from p_expected_cohort_id or previous.reason<>btrim(p_reason) then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return previous.to_cohort_id;
  end if;
  select * into target from public.enrollments where id=p_enrollment_id for update;
  if not found or not public.current_person_can_assign_batches(target.offering_id) then
    raise exception using errcode='42501',message='batch access denied'; end if;
  if target.status not in ('approved','active') or target.ended_at is not null then
    raise exception using errcode='55000',message='only current enrolments can change batch'; end if;
  if target.cohort_id is distinct from p_expected_cohort_id then
    raise exception using errcode='40001',message='student batch changed; refresh and review'; end if;
  if target.cohort_id is not distinct from p_cohort_id then
    raise exception using errcode='22023',message='choose a different batch'; end if;
  if target.curriculum_version_id is not null then
    raise exception using errcode='22023',message='this enrolment has its own pinned curriculum; an admin must migrate it'; end if;
  select curriculum_version_id into current_curriculum from public.cohorts where id=target.cohort_id;
  select curriculum_version_id into next_curriculum from public.cohorts
    where id=p_cohort_id and offering_id=target.offering_id and status='active' for share;
  if not found then raise exception using errcode='22023',message='batch unavailable for this course'; end if;
  if current_curriculum is not null and next_curriculum is distinct from current_curriculum then
    raise exception using errcode='22023',message='batch must keep the student''s curriculum; curriculum migration is separate'; end if;
  begin
    update public.enrollments set cohort_id=p_cohort_id,updated_at=clock_timestamp() where id=target.id;
  exception when unique_violation then
    raise exception using errcode='23505',message='student already has an open enrolment in that batch';
  end;
  -- Stale admissions editors must refresh. Dates, state and their last editor are unchanged.
  update public.enrollment_access_windows set revision=revision+1 where enrollment_id=target.id;
  insert into public.cohort_assignment_history(enrollment_id,request_key,actor_person_id,from_cohort_id,to_cohort_id,reason)
    values(target.id,p_request_key,actor,target.cohort_id,p_cohort_id,btrim(p_reason));
  if not public.current_person_can_assign_batches(target.offering_id) then
    raise exception using errcode='42501',message='batch authority changed'; end if;
  return p_cohort_id;
end $$;

revoke all on function public.current_person_can_manage_batches(), public.current_person_can_assign_batches(uuid),
  public.get_batch_workspace(), public.list_batch_students(uuid),
  public.save_batch(uuid,uuid,bigint,uuid,text,text,timestamptz,timestamptz,public.cohort_status),
  public.assign_student_batch(uuid,uuid,uuid,uuid,text) from public, anon;
grant execute on function public.current_person_can_manage_batches(), public.current_person_can_assign_batches(uuid),
  public.get_batch_workspace(), public.list_batch_students(uuid),
  public.save_batch(uuid,uuid,bigint,uuid,text,text,timestamptz,timestamptz,public.cohort_status),
  public.assign_student_batch(uuid,uuid,uuid,uuid,text) to authenticated;

-- Navigation flag only; record access stays with the RPCs above.
create or replace function public.get_my_navigation_access()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare
 student boolean := public.current_person_has_active_student_membership();
 employee boolean := public.current_person_has_active_employee_membership();
begin
 return jsonb_build_object(
  'student',coalesce(student,false),'employee',coalesce(employee,false),
  'crm',employee and public.current_person_has_capability('lead.manage_assigned'),
  'crmAssignments',employee and public.current_person_has_capability('lead.assign'),
  'privacy',employee and public.current_person_has_capability('privacy.manage'),
  'enrolments',employee and public.current_person_has_capability('enrollment.operate'),
  'content',employee and public.current_person_can_open_content_workspace(),
  'distribution',employee and public.current_person_can_open_assignment_distribution(),
  'reviews',employee and public.current_person_can_open_feedback_workspace(),
  'closeout',employee and exists(select 1 from public.offerings o where public.current_person_can_close_enrollment(o.id)),
  'classes',employee and exists(select 1 from public.offerings o where o.status='active' and public.current_person_can_schedule_classes(o.id)),
  'curriculumImpact',employee and exists(select 1 from public.offerings o where o.status='active' and public.can_preview_curriculum_upgrade(o.id)),
  'batches',employee and public.current_person_can_manage_batches(),
  -- Teacher-portal placement link: teachers only. Sales place students from their own Batches page.
  'batchAssign',employee and exists(select 1 from public.offerings o where o.status='active'
    and public.current_person_is_assignment_teacher(o.id) and public.current_person_can_assign_batches(o.id)),
  'employees',employee and public.current_person_can_invite_employees(),
  'studentRecovery',employee and public.current_person_can_assist_student_recovery(),
  'staffRecovery',employee and public.current_person_can_manage_staff_security()
 );
end $$;

-- Teachers review batch-wise: same rows and checks as before, plus the student's batch name.
drop function public.list_feedback_review_queue();
create function public.list_feedback_review_queue()
returns table(assignment_instance_id uuid,submission_attempt_id uuid,member_id text,display_name text,
  assignment_title text,assignment_group text,submitted_at timestamptz,submission_file_count bigint,
  feedback_revision_id uuid,feedback_status public.feedback_revision_status,written_text text,
  source_kind public.feedback_source_kind,voice_equivalent_confirmed boolean,ai_assisted boolean,published_at timestamptz,
  attempt_number integer,submission_version integer,previous_feedback_text text,batch_name text)
language sql stable security definer set search_path='' set row_security=off as $$
  select i.id,a.id,p.member_id,p.display_name,v.title,v.group_name,a.submitted_at,
    (select count(*) from public.submission_files sf where sf.submission_attempt_id=a.id and sf.purged_at is null),
    f.id,f.status,f.written_text,f.source_kind,f.voice_equivalent_confirmed,f.ai_assisted,f.published_at,
    coalesce(a.logical_attempt_number,a.attempt_number),a.submission_version,
    (select prior.written_text from public.feedback_revisions prior where prior.submission_attempt_id=a.replaces_attempt_id and prior.status='draft' order by prior.revision_number desc limit 1),
    c.name
  from public.submission_attempts a
  join public.student_assignment_instances i on i.id=a.assignment_instance_id
  join public.assignment_releases r on r.id=i.assignment_release_id
  join public.assignment_versions v on v.id=r.assignment_version_id
  join public.enrollments e on e.id=i.enrollment_id
  join public.people p on p.id=e.person_id
  left join public.cohorts c on c.id=e.cohort_id
  left join lateral(select fr.* from public.feedback_revisions fr where fr.submission_attempt_id=a.id order by fr.revision_number desc limit 1) f on true
  where a.status='submitted' and a.superseded_by_attempt_id is null
    and i.status not in ('closed','voided')
    and not exists(select 1 from public.feedback_revisions done where done.submission_attempt_id=a.id and done.status='published')
    and public.current_person_can_review_feedback_instance(i.id)
  order by a.submitted_at,p.member_id,a.attempt_number
$$;
revoke all on function public.list_feedback_review_queue() from public,anon;
grant execute on function public.list_feedback_review_queue() to authenticated;
