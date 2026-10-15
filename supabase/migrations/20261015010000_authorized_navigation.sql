-- D-040 B: presentation flags only. No role/capability grants and no record access changes.
create or replace function public.current_person_can_open_assignment_distribution()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(public.current_person_has_active_employee_membership() and
   (public.current_person_has_capability('assignment.distribute') or exists(
      select 1 from public.offerings o where public.current_person_can_distribute_assignments(o.id))),false)
$$;
create or replace function public.current_person_can_open_feedback_workspace()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(public.current_person_has_active_employee_membership() and exists(
   select 1 from public.offerings o where public.current_person_is_assignment_teacher(o.id)
     and (public.current_person_has_capability('feedback.review') or public.current_person_has_capability('feedback.review','offering',o.id))),false)
$$;
revoke all on function public.current_person_can_open_assignment_distribution(),public.current_person_can_open_feedback_workspace() from public,anon;
grant execute on function public.current_person_can_open_assignment_distribution(),public.current_person_can_open_feedback_workspace() to authenticated;

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
  'employees',employee and public.current_person_can_invite_employees(),
  'studentRecovery',employee and public.current_person_can_assist_student_recovery(),
  'staffRecovery',employee and public.current_person_can_manage_staff_security()
 );
end $$;
revoke all on function public.get_my_navigation_access() from public,anon;
grant execute on function public.get_my_navigation_access() to authenticated;
