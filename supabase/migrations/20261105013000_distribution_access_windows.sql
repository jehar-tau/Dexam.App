-- D-065: exact enrolment validity on distribution and legacy activation eligibility.
CREATE OR REPLACE FUNCTION public.distribute_assignment_version(p_assignment_version_id uuid, p_cohort_id uuid, p_enrollment_ids uuid[], p_due_at timestamp with time zone, p_release_note text, p_request_key uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
      and public.enrollment_has_current_access(e.id)
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
    where e.cohort_id = p_cohort_id and e.offering_id = target_offering_id and public.enrollment_has_current_access(e.id)
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
$function$
;
CREATE OR REPLACE FUNCTION public.enrollment_can_issue_activation(p_enrollment_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce(exists (
    select 1
    from public.enrollments e
    join public.people p on p.id = e.person_id
    join public.memberships m on m.person_id = e.person_id
    join public.offerings o on o.id = e.offering_id
    left join public.cohorts c on c.id = e.cohort_id
    where e.id = p_enrollment_id
      and public.enrollment_has_current_access(e.id)
      and e.approved_at is not null
      and e.activated_at is not null
      and p.status = 'active'
      and p.member_id is not null
      and not exists (
        select 1
        from public.auth_identities ai
        where ai.person_id = e.person_id
      )
      and m.kind = 'student'
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
      and o.status = 'active'
      and (o.available_from is null or o.available_from <= now())
      and (o.available_until is null or o.available_until > now())
      and (c.id is null or c.status = 'active')
  ), false)
$function$
;
CREATE OR REPLACE FUNCTION public.list_assignment_distribution_targets(p_offering_id uuid)
 RETURNS TABLE(enrollment_id uuid, member_id text, display_name text, cohort_id uuid, cohort_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
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
  where e.offering_id = p_offering_id and public.enrollment_has_current_access(e.id)
  order by c.name nulls last, p.display_name nulls last, p.member_id;
end;
$function$
;
