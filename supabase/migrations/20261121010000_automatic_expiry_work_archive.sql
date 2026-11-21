-- F054 / D-065. A reviewed coaching window and an explicit closeout can both
-- exist. A later closeout does not start a second year of archive access.
create function public.current_student_work_archive_window(p_enrollment_id uuid)
returns table(cutoff timestamptz, expires_at timestamptz, archive_status text)
language sql volatile security definer set search_path='' set row_security=off
as $$
  select anchor.ended_at, anchor.ended_at + interval '12 months', anchor.status
  from public.enrollments e
  left join public.enrollment_access_windows w on w.enrollment_id=e.id
  cross join lateral (
    select candidate.ended_at, candidate.status
    from (values
      (case when e.status in ('completed','withdrawn') then e.ended_at end, e.status::text, 1),
      (case when w.state='active' then w.expires_at
        -- Suspension or revocation denies the automatic archive while the enrolment is open.
        -- On explicit closeout, retain any automatic deadline already reached before suspension.
        -- Later edits also bump updated_at; prefer the first audited transition out of active.
        when e.status in ('completed','withdrawn') and coalesce((
          select min(h.occurred_at) from public.admission_change_history h
          where h.enrollment_id=e.id and h.action in ('suspension','revocation')
            and h.prior_values->>'state'='active'
        ),w.updated_at)>=w.expires_at then w.expires_at end, 'expired', 2)
    ) candidate(ended_at, status, priority)
    where candidate.ended_at is not null
    order by candidate.ended_at, candidate.priority
    limit 1
  ) anchor
  where e.id=p_enrollment_id and e.person_id=public.current_person_id()
    and public.current_person_has_active_student_membership()
    and ((e.status='active' and e.ended_at is null)
      or (e.status in ('completed','withdrawn') and e.ended_at is not null))
    and anchor.ended_at<=clock_timestamp()
    and anchor.ended_at + interval '12 months'>clock_timestamp()
$$;
revoke all on function public.current_student_work_archive_window(uuid)
  from public,anon,authenticated,service_role;

create or replace function public.current_person_can_read_work_archive(p_enrollment_id uuid)
returns boolean language sql volatile security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.current_student_work_archive_window(p_enrollment_id)) $$;

create or replace function public.list_student_work_archive()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(item order by ended desc),'[]'::jsonb) from (
  select archive_window.cutoff ended,jsonb_build_object('enrollmentId',e.id,'offeringTitle',o.title,'status',archive_window.archive_status,'endedAt',archive_window.cutoff,'expiresAt',archive_window.expires_at,
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'assignmentTitle',v.title,'attemptNumber',coalesce(a.logical_attempt_number,a.attempt_number),'submittedAt',a.submitted_at,
      'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.original_file_name,'mimeType',f.mime_type,'byteSize',f.byte_size) order by f.position)
        from public.submission_files f where f.submission_attempt_id=a.id and f.status='ready' and f.purged_at is null),'[]'::jsonb),
      'feedback',coalesce((select jsonb_agg(jsonb_build_object('id',feedback.id,'text',feedback.written_text,'nextStep',feedback.correction_reason,'publishedAt',feedback.published_at,'aiAssisted',feedback.ai_assisted,
        'voiceIds',coalesce((select jsonb_agg(audio.id) from public.feedback_audio_files audio where audio.feedback_revision_id=feedback.id and audio.kind='voice_note' and audio.status='ready' and audio.purged_at is null),'[]'::jsonb)) order by feedback.published_at)
        from public.feedback_revisions feedback where feedback.submission_attempt_id=a.id and feedback.status='published'),'[]'::jsonb)) order by a.submitted_at desc,a.id)
      from public.student_assignment_instances i join public.submission_attempts a on a.assignment_instance_id=i.id
      join public.assignment_releases r on r.id=i.assignment_release_id join public.assignment_versions v on v.id=r.assignment_version_id
      where i.enrollment_id=e.id and a.status='submitted' and a.submitted_at is not null and a.submitted_at<=archive_window.cutoff
        and not exists(select 1 from public.submission_attempts newer where newer.assignment_instance_id=a.assignment_instance_id
          and coalesce(newer.logical_attempt_number,newer.attempt_number)=coalesce(a.logical_attempt_number,a.attempt_number)
          and newer.submission_version>a.submission_version and newer.status='submitted' and newer.submitted_at<=archive_window.cutoff)),'[]'::jsonb)) item
  from public.enrollments e join public.offerings o on o.id=e.offering_id
  cross join lateral public.current_student_work_archive_window(e.id) archive_window
  where e.person_id=public.current_person_id()
) archive $$;

create or replace function public.get_student_archive_file(p_file_id uuid,p_kind text)
returns table(bucket text,object_path text,expires_at timestamptz)
language sql stable security definer set search_path='' set row_security=off
as $$
  select file.bucket,file.object_path,archive_window.expires_at
  from (
    select 'student-submissions'::text bucket,f.object_path,f.submission_attempt_id
    from public.submission_files f
    where p_kind='submission' and f.id=p_file_id and f.status='ready' and f.purged_at is null
    union all
    select 'teacher-feedback-audio'::text,audio.object_path,feedback.submission_attempt_id
    from public.feedback_audio_files audio
    join public.feedback_revisions feedback on feedback.id=audio.feedback_revision_id
    where p_kind='voice' and audio.id=p_file_id and audio.kind='voice_note'
      and audio.status='ready' and audio.purged_at is null and feedback.status='published'
  ) file
  join public.submission_attempts a on a.id=file.submission_attempt_id
  join public.student_assignment_instances i on i.id=a.assignment_instance_id
  cross join lateral public.current_student_work_archive_window(i.enrollment_id) archive_window
  where a.status='submitted' and a.submitted_at<=archive_window.cutoff
    and (archive_window.archive_status<>'expired' or not exists (
      select 1 from public.submission_attempts newer
      where newer.assignment_instance_id=a.assignment_instance_id
        and coalesce(newer.logical_attempt_number,newer.attempt_number)=coalesce(a.logical_attempt_number,a.attempt_number)
        and newer.submission_version>a.submission_version and newer.status='submitted'
        and newer.submitted_at<=archive_window.cutoff
    ))
$$;

-- The separate checklist policy permits explicit closeout history only. Automatic
-- expiry opens finalized work, without also opening curriculum sections or topics.
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
  or (e.status in ('completed','withdrawn') and e.ended_at<=clock_timestamp()
      and e.ended_at+interval '12 months'>clock_timestamp()))
) eligible $$;
