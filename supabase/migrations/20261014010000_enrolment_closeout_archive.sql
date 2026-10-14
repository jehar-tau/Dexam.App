-- D-032 B: course closeout is not account suspension or new teaching authority.
create table public.enrollment_closeouts (
  enrollment_id uuid primary key references public.enrollments(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  outcome public.enrollment_status not null check(outcome in ('completed','withdrawn')),
  reason_code text not null check(reason_code in ('course_completed','student_withdrew')),
  ended_at timestamptz not null,
  check((outcome='completed' and reason_code='course_completed') or (outcome='withdrawn' and reason_code='student_withdrew'))
);
create index enrollment_closeouts_actor_idx on public.enrollment_closeouts(actor_person_id);
alter table public.enrollment_closeouts enable row level security;
revoke all on public.enrollment_closeouts from anon,authenticated;

create function public.current_person_can_close_enrollment(p_offering_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_employee_membership() and
  (public.current_person_has_capability('enrollment.operate') or public.current_person_has_capability('enrollment.operate','offering',p_offering_id)) $$;
revoke all on function public.current_person_can_close_enrollment(uuid) from public,anon;
grant execute on function public.current_person_can_close_enrollment(uuid) to authenticated;

create function public.list_enrollment_closeout_queue(p_search text default '')
returns table(enrollment_id uuid,member_id text,display_name text,offering_title text,cohort_name text,status text,ended_at timestamptz)
language sql stable security definer set search_path='' set row_security=off
as $$ select e.id,p.member_id,p.display_name,o.title,c.name,e.status::text,e.ended_at
  from public.enrollments e join public.people p on p.id=e.person_id join public.offerings o on o.id=e.offering_id
  left join public.cohorts c on c.id=e.cohort_id
  where public.current_person_can_close_enrollment(e.offering_id) and p.status='active'
    and (e.status='active' or exists(select 1 from public.enrollment_closeouts closed where closed.enrollment_id=e.id))
    and length(coalesce(p_search,''))<=120
    and (p_search='' or position(lower(p_search) in lower(coalesce(p.member_id,'')||' '||coalesce(p.display_name,'')))>0)
  order by e.created_at desc,e.id limit 100 $$;
revoke all on function public.list_enrollment_closeout_queue(text) from public,anon;
grant execute on function public.list_enrollment_closeout_queue(text) to authenticated;

create function public.close_enrollment(p_enrollment_id uuid,p_outcome text,p_reason_code text,p_confirmed boolean,p_request_key uuid)
returns timestamptz language plpgsql security definer set search_path='' set row_security=off
as $$ declare target public.enrollments; existing public.enrollment_closeouts; actor uuid:=public.current_person_id(); cutoff timestamptz;
begin
  select * into target from public.enrollments where id=p_enrollment_id for update;
  if not found or not public.current_person_can_close_enrollment(target.offering_id) then raise exception using errcode='42501',message='enrolment closeout denied'; end if;
  if p_confirmed is distinct from true or p_request_key is null or p_outcome is null or p_reason_code is null
    or not ((p_outcome='completed' and p_reason_code='course_completed') or (p_outcome='withdrawn' and p_reason_code='student_withdrew')) then
    raise exception using errcode='22023',message='deliberate closeout choice required'; end if;
  select * into existing from public.enrollment_closeouts where enrollment_id=target.id;
  if found then
    if existing.request_key=p_request_key and existing.actor_person_id=actor and existing.outcome::text=p_outcome and existing.reason_code=p_reason_code then return existing.ended_at; end if;
    raise exception using errcode='55000',message='enrolment already closed'; end if;
  if target.status<>'active' or target.ended_at is not null then raise exception using errcode='55000',message='active enrolment required'; end if;
  perform 1 from public.people where id=target.person_id and status='active' for update;
  if not found then raise exception using errcode='42501',message='student current state changed'; end if;
  cutoff:=clock_timestamp();
  update public.enrollments set status=p_outcome::public.enrollment_status,ended_at=cutoff,updated_at=cutoff where id=target.id;
  insert into public.enrollment_closeouts(enrollment_id,request_key,actor_person_id,outcome,reason_code,ended_at)
    values(target.id,p_request_key,actor,p_outcome::public.enrollment_status,p_reason_code,cutoff);
  update public.account_action_tokens set invalidated_at=cutoff where enrollment_id=target.id and kind='activation' and consumed_at is null and invalidated_at is null;
  insert into public.enrollment_transitions(enrollment_id,from_status,to_status,actor_person_id,reason_code,occurred_at)
    values(target.id,'active',p_outcome::public.enrollment_status,actor,p_reason_code,cutoff);
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(target.person_id,actor,'enrollment_closed','succeeded',p_reason_code,jsonb_build_object('enrollment_id',target.id,'request_key',p_request_key));
  return cutoff;
end $$;
revoke all on function public.close_enrollment(uuid,text,text,boolean,uuid) from public,anon;
grant execute on function public.close_enrollment(uuid,text,text,boolean,uuid) to authenticated;

-- Enrollment SHARE locks span each write transaction, serializing with closeout.
-- Do not widen any active-assignment access helper to provide the archive.
create function public.guard_closed_enrollment_submission_write()
returns trigger language plpgsql security definer set search_path='' set row_security=off
as $$ declare target_enrollment_id uuid; enrollment_state public.enrollment_status;
begin
  if tg_table_name='submission_files' then
    if tg_op='UPDATE' and auth.role()='service_role' and old.purged_at is null and new.purged_at is not null and new.original_file_name='[purged]'
      and (to_jsonb(new)-'purged_at'-'original_file_name')=(to_jsonb(old)-'purged_at'-'original_file_name') then return new; end if;
    select i.enrollment_id into target_enrollment_id from public.submission_attempts a join public.student_assignment_instances i on i.id=a.assignment_instance_id where a.id=new.submission_attempt_id;
  else
    select i.enrollment_id into target_enrollment_id from public.student_assignment_instances i where i.id=new.assignment_instance_id;
  end if;
  select e.status into enrollment_state from public.enrollments e where e.id=target_enrollment_id for share;
  if enrollment_state<>'active' and exists(select 1 from public.enrollment_closeouts closed where closed.enrollment_id=target_enrollment_id) then
    raise exception using errcode='42501',message='ended enrolment is read only'; end if;
  return new;
end $$;
revoke all on function public.guard_closed_enrollment_submission_write() from public,anon,authenticated;
create trigger submission_attempt_closeout_guard before insert or update on public.submission_attempts for each row execute function public.guard_closed_enrollment_submission_write();
create trigger submission_file_closeout_guard before insert or update on public.submission_files for each row execute function public.guard_closed_enrollment_submission_write();

create function public.current_person_can_read_work_archive(p_enrollment_id uuid)
returns boolean language sql volatile security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_student_membership() and exists(select 1 from public.enrollments e
  where e.id=p_enrollment_id and e.person_id=public.current_person_id() and e.status in ('completed','withdrawn')
    and e.ended_at is not null and e.ended_at<=clock_timestamp() and e.ended_at+interval '12 months'>clock_timestamp()) $$;
revoke all on function public.current_person_can_read_work_archive(uuid) from public,anon;
grant execute on function public.current_person_can_read_work_archive(uuid) to authenticated;

create function public.list_student_work_archive()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(item order by ended desc),'[]'::jsonb) from (
  select e.ended_at ended,jsonb_build_object('enrollmentId',e.id,'offeringTitle',o.title,'status',e.status,'endedAt',e.ended_at,'expiresAt',e.ended_at+interval '12 months',
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'assignmentTitle',v.title,'attemptNumber',a.attempt_number,'submittedAt',a.submitted_at,
      'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.original_file_name,'mimeType',f.mime_type,'byteSize',f.byte_size) order by f.position)
        from public.submission_files f where f.submission_attempt_id=a.id and f.status='ready' and f.purged_at is null),'[]'::jsonb),
      'feedback',coalesce((select jsonb_agg(jsonb_build_object('id',feedback.id,'text',feedback.written_text,'nextStep',feedback.correction_reason,'publishedAt',feedback.published_at,'aiAssisted',feedback.ai_assisted,
        'voiceIds',coalesce((select jsonb_agg(audio.id) from public.feedback_audio_files audio where audio.feedback_revision_id=feedback.id and audio.kind='voice_note' and audio.status='ready' and audio.purged_at is null),'[]'::jsonb)) order by feedback.published_at)
        from public.feedback_revisions feedback where feedback.submission_attempt_id=a.id and feedback.status='published'),'[]'::jsonb)) order by a.submitted_at desc,a.id)
      from public.student_assignment_instances i join public.submission_attempts a on a.assignment_instance_id=i.id
      join public.assignment_releases r on r.id=i.assignment_release_id join public.assignment_versions v on v.id=r.assignment_version_id
      where i.enrollment_id=e.id and a.status='submitted' and a.submitted_at is not null and a.submitted_at<=e.ended_at),'[]'::jsonb)) item
  from public.enrollments e join public.offerings o on o.id=e.offering_id where public.current_person_can_read_work_archive(e.id)
) archive $$;
revoke all on function public.list_student_work_archive() from public,anon;
grant execute on function public.list_student_work_archive() to authenticated;

-- Only exact retained final files or published voice notes; no draft/reference paths.
create function public.get_student_archive_file(p_file_id uuid,p_kind text)
returns table(bucket text,object_path text,expires_at timestamptz)
language sql stable security definer set search_path='' set row_security=off
as $$ select 'student-submissions'::text,f.object_path,e.ended_at+interval '12 months'
  from public.submission_files f join public.submission_attempts a on a.id=f.submission_attempt_id
  join public.student_assignment_instances i on i.id=a.assignment_instance_id join public.enrollments e on e.id=i.enrollment_id
  where p_kind='submission' and f.id=p_file_id and f.status='ready' and f.purged_at is null and a.status='submitted' and a.submitted_at<=e.ended_at and public.current_person_can_read_work_archive(e.id)
  union all select 'teacher-feedback-audio'::text,audio.object_path,e.ended_at+interval '12 months'
  from public.feedback_audio_files audio join public.feedback_revisions feedback on feedback.id=audio.feedback_revision_id
  join public.submission_attempts a on a.id=feedback.submission_attempt_id join public.student_assignment_instances i on i.id=a.assignment_instance_id
  join public.enrollments e on e.id=i.enrollment_id
  where p_kind='voice' and audio.id=p_file_id and audio.kind='voice_note' and audio.status='ready' and audio.purged_at is null and feedback.status='published'
    and a.status='submitted' and a.submitted_at<=e.ended_at and public.current_person_can_read_work_archive(e.id) $$;
revoke all on function public.get_student_archive_file(uuid,text) from public,anon;
grant execute on function public.get_student_archive_file(uuid,text) to authenticated;
