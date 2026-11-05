-- D-065: validity belongs to the exact enrolment, not the person's student role.
-- Legacy rows without a reviewed access window retain existing rules; no data migration.
create or replace function public.current_person_can_read_curriculum(p_curriculum_version_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_student_membership() and exists(
 select 1 from public.curriculum_versions cv join public.offerings o on o.id=cv.offering_id
 join public.enrollments e on e.person_id=public.current_person_id() and e.offering_id=cv.offering_id
 left join public.cohorts c on c.id=e.cohort_id
 where cv.id=p_curriculum_version_id and cv.status='published' and o.status='active'
 and public.enrollment_has_current_access(e.id)
 and ((e.cohort_id is null and e.curriculum_version_id=cv.id)
  or (e.cohort_id is not null and c.status='active' and c.curriculum_version_id=cv.id))
) $$;

create or replace function public.current_person_can_access_assignment_instance(p_assignment_instance_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(public.current_person_has_active_student_membership() and exists(
 select 1 from public.student_assignment_instances i
 join public.assignment_releases r on r.id=i.assignment_release_id
 join public.enrollments e on e.id=i.enrollment_id join public.offerings o on o.id=e.offering_id
 where i.id=p_assignment_instance_id and e.person_id=public.current_person_id()
 and public.enrollment_has_current_access(e.id) and e.offering_id=r.offering_id
 and o.status='active' and r.status<>'withdrawn' and i.status<>'voided'
),false) $$;

create or replace function public.current_person_can_edit_topic_checklist(p_enrollment_id uuid,p_topic_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_student_membership() and exists(
 select 1 from public.enrollments e join public.offerings o on o.id=e.offering_id
 left join public.cohorts c on c.id=e.cohort_id
 join public.curriculum_sections s on s.curriculum_version_id=coalesce(e.curriculum_version_id,c.curriculum_version_id)
 join public.curriculum_versions v on v.id=s.curriculum_version_id and v.offering_id=e.offering_id
 join public.curriculum_topics t on t.section_id=s.id
 where e.id=p_enrollment_id and e.person_id=public.current_person_id()
 and public.enrollment_has_current_access(e.id) and o.status='active'
 and (e.cohort_id is null or c.status='active') and v.status='published' and t.id=p_topic_id
) $$;

create or replace function public.list_student_topic_checklist()
returns jsonb language sql volatile security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(item order by title,enrollment),'[]'::jsonb) from (
 select o.title title,e.id enrollment,jsonb_build_object(
 'enrollmentId',e.id,'offeringTitle',o.title,'readOnly',not public.enrollment_has_current_access(e.id),
 'expiresAt',case when e.status<>'active' then e.ended_at+interval '12 months' else null end,
 'topics',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'sectionTitle',s.title,'markedAt',m.marked_at) order by s.position,t.position)
  from public.curriculum_sections s join public.curriculum_topics t on t.section_id=s.id
  left join public.student_topic_marks m on m.enrollment_id=e.id and m.topic_id=t.id
  where s.curriculum_version_id=v.id),'[]'::jsonb)) item
 from public.enrollments e join public.offerings o on o.id=e.offering_id
 left join public.cohorts c on c.id=e.cohort_id
 join public.curriculum_versions v on v.id=coalesce(e.curriculum_version_id,c.curriculum_version_id) and v.offering_id=e.offering_id
 where public.current_person_has_active_student_membership() and e.person_id=public.current_person_id()
 and ((public.enrollment_has_current_access(e.id) and o.status='active'
  and (e.cohort_id is null or c.status='active') and v.status='published')
  or public.current_person_can_read_work_archive(e.id))
) eligible $$;

create or replace function public.current_person_can_read_class(p_session_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_student_membership() and exists(
 select 1 from public.class_sessions s join public.offerings o on o.id=s.offering_id
 join public.enrollments e on e.offering_id=s.offering_id and e.person_id=public.current_person_id()
 left join public.cohorts c on c.id=e.cohort_id
 where s.id=p_session_id and s.retention_until>clock_timestamp() and o.status='active'
 and public.enrollment_has_current_access(e.id) and (e.cohort_id is null or c.status='active')
 and (s.cohort_id is null or s.cohort_id=e.cohort_id)
) $$;

-- Existing grants remain unchanged by CREATE OR REPLACE. Archive and its physical
-- retention are untouched: automatic-expiry archive anchoring awaits the owner.
