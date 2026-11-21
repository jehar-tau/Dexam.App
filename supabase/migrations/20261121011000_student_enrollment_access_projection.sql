-- Student workspace cards project this caller's actual coaching access window.
create function public.list_my_student_enrollment_access()
returns table(enrollment_id uuid, access_state text, archive_available boolean,
  offering_title text, cohort_name text, approved_at timestamptz, activated_at timestamptz)
language sql stable security definer set search_path='' set row_security=off
as $$
  select e.id, case
    when e.status<>'active' then e.status::text
    when e.ended_at is not null then 'ended'
    when w.state in ('suspended','revoked') then w.state
    when w.starts_at>statement_timestamp() then 'scheduled'
    when w.expires_at<=statement_timestamp() then 'expired'
    else 'active' end,
    public.current_person_can_read_work_archive(e.id),
    o.title,c.name,e.approved_at,e.activated_at
  from public.enrollments e
  join public.offerings o on o.id=e.offering_id
  left join public.cohorts c on c.id=e.cohort_id
  left join public.enrollment_access_windows w on w.enrollment_id=e.id
  where e.person_id=public.current_person_id() and public.current_person_has_active_student_membership()
  order by e.created_at desc,e.id
$$;
revoke all on function public.list_my_student_enrollment_access() from public,anon,authenticated,service_role;
grant execute on function public.list_my_student_enrollment_access() to authenticated;
