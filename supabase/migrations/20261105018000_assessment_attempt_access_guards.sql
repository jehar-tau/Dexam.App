-- D-065: reuse existing scoring/timer implementations with exact-attempt access checks.
CREATE OR REPLACE FUNCTION public.begin_assessment_attempt(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current exact-attempt access changed while waiting';
  end if;
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.status = 'open' then
    update public.assessment_attempts
      set status = 'in_progress',
          started_at = now(),
          deadline = now() + make_interval(mins => duration_minutes)
      where id = p_attempt_id
      returning * into v_attempt;
  end if;
  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'status', v_attempt.status,
    'startedAt', v_attempt.started_at,
    'deadline', v_attempt.deadline
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.begin_live_part_b(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
  v_event public.live_events;
  v_b_start timestamptz;
  v_b_end timestamptz;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id() and kind = 'live'
    for update;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current exact-attempt access changed while waiting';
  end if;
  select * into v_event from public.live_events where 'live-' || key = v_attempt.paper_id;
  if v_attempt.id is null or v_event.id is null then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  v_b_start := v_event.part_a_starts_at + make_interval(mins => v_event.part_a_minutes + v_event.break_minutes);
  v_b_end := v_b_start + make_interval(mins => v_event.part_b_minutes);
  if now() < v_b_start then
    raise exception 'Part B starts after the break.' using errcode = 'DX006';
  end if;
  if v_attempt.part_b_status = 'none' then
    if now() >= v_b_end then
      raise exception 'Part B has ended.' using errcode = 'DX007';
    end if;
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
    select v_attempt.id, question_id, position, max_marks from public.live_event_tasks where event_id = v_event.id;
    if not found then
      raise exception 'This event has no Part B.' using errcode = 'P0002';
    end if;
    update public.assessment_attempts
      set part_b_status = 'drawing', part_b_started_at = now(), part_b_deadline = v_b_end,
          part_b_max = (select sum(max_marks) from public.live_event_tasks where event_id = v_event.id)
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.begin_part_b(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
  v_count integer;
  v_total numeric;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current exact-attempt access changed while waiting';
  end if;
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.kind = 'live' then
    return public.begin_live_part_b(v_attempt.id);
  end if;
  if not (v_attempt.kind in ('paper', 'drawing') or (v_attempt.kind = 'mock' and v_attempt.exam in ('uceed', 'ceed')))
    or v_attempt.status <> 'submitted' then
    raise exception 'Part B starts after Part A is submitted.' using errcode = '22023';
  end if;
  if v_attempt.part_b_status = 'none' and v_attempt.kind = 'mock' then
    perform public.assessment_pin_mock_part_b(v_attempt.id);
  end if;
  if v_attempt.part_b_status = 'none' then
    select count(*) into v_count from public.assessment_attempt_tasks where attempt_id = v_attempt.id;
    if v_count = 0 then
      insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
      select v_attempt.id, q.id,
        (row_number() over (order by nullif(substring(p.question_no from '[0-9]+'), '')::integer nulls last, p.question_no) - 1)::smallint,
        1
      from public.assessment_question_provenance p
      join public.assessment_questions q on q.id = p.question_id
      where p.paper_id = v_attempt.paper_id and q.publication_state = 'ready' and q.response_mode = 'upload';
      get diagnostics v_count = row_count;
      if v_count = 0 then
        raise exception 'This paper has no Part B tasks ready yet.' using errcode = 'P0002';
      end if;
      v_total := public.assessment_part_b_total(v_attempt.exam, v_count);
      update public.assessment_attempt_tasks t
        set max_marks = coalesce(q.task_marks, round(v_total / v_count, 2))
        from public.assessment_questions q
        where t.attempt_id = v_attempt.id and q.id = t.question_id;
    end if;
    update public.assessment_attempts
      set part_b_status = 'drawing',
          part_b_started_at = now(),
          part_b_deadline = now() + make_interval(mins => coalesce(
            v_attempt.drawing_minutes,
            public.assessment_part_b_minutes(v_attempt.exam, v_count)
          )),
          part_b_max = (select sum(max_marks) from public.assessment_attempt_tasks where attempt_id = v_attempt.id)
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.current_person_can_start_drawing_mock(p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select public.assessment_drawing_blueprint(p_key) is not null and (
    public.current_person_has_current_coaching_access()
    or (
      public.current_person_has_active_candidate_membership()
      and not exists (
        select 1 from public.assessment_attempts a
        where a.person_id = public.current_person_id() and a.kind = 'drawing' and a.paper_id = 'mock-' || p_key
      )
    )
    or exists (
      select 1 from public.assessment_entitlements e
      where e.person_id = public.current_person_id() and e.paper_id = 'mock-' || p_key
        and (e.expires_at is null or e.expires_at > now())
    )
  )
$function$
;

CREATE OR REPLACE FUNCTION public.current_person_can_start_mock(p_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select public.assessment_blueprint(p_key) is not null and (
    public.current_person_has_current_coaching_access()
    or (
      public.current_person_has_active_candidate_membership()
      and not exists (
        select 1 from public.assessment_attempts a
        where a.person_id = public.current_person_id() and a.kind = 'mock' and a.paper_id = 'mock-' || p_key
      )
    )
    or exists (
      select 1 from public.assessment_entitlements e
      where e.person_id = public.current_person_id() and e.paper_id = 'mock-' || p_key
        and (e.expires_at is null or e.expires_at > now())
    )
  )
$function$
;

CREATE OR REPLACE FUNCTION public.get_assessment_attempt(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id)
    or not exists (
      select 1 from public.assessment_attempts
      where id = p_attempt_id and person_id = public.current_person_id() and status <> 'submitted'
    ) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  return public.assessment_attempt_payload(p_attempt_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_assessment_attempt_result(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id();
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Result not found.' using errcode = '42501';
  end if;
  if v_attempt.status <> 'submitted' then
    raise exception 'The result is released after submission.' using errcode = '42501';
  end if;
  -- Live answers stay hidden until Part A ends for everyone.
  if v_attempt.kind = 'live' and exists (
    select 1 from public.live_events e
    where 'live-' || e.key = v_attempt.paper_id
      and now() < e.part_a_starts_at + make_interval(mins => e.part_a_minutes)
  ) then
    raise exception 'Live results are released after Part A ends.' using errcode = 'DX006';
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'kind', v_attempt.kind,
    'title', v_attempt.title,
    'paperId', v_attempt.paper_id,
    'exam', v_attempt.exam,
    'startedAt', v_attempt.started_at,
    'submittedAt', v_attempt.submitted_at,
    'submitReason', v_attempt.submit_reason,
    'late', v_attempt.submitted_late,
    'durationMinutes', v_attempt.duration_minutes,
    'objectiveCount', v_attempt.objective_count,
    'marking', v_attempt.marking,
    'score', v_attempt.score,
    'maxScore', v_attempt.max_score,
    'questions', coalesce((
      select jsonb_agg(
        public.assessment_question_payload(aq.question_id) || jsonb_build_object(
          'response', aq.response,
          'outcome', aq.outcome,
          'marks', aq.marks,
          'key', k.answer,
          'explanation', case when k.explanation_status = 'verified' then k.explanation end,
          'topic', t.slug,
          'topicName', t.name
        )
        order by aq.position
      )
      from public.assessment_attempt_questions aq
      join public.assessment_questions q on q.id = aq.question_id
      left join public.assessment_question_keys k on k.question_id = q.id
      left join public.assessment_topics t on t.id = q.topic_id
      where aq.attempt_id = v_attempt.id
    ), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_part_b(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
  v_owner boolean;
  v_evaluator boolean := public.current_person_can_evaluate_part_b();
  v_status text;
  v_available integer;
  v_pinned integer;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  v_owner := public.current_person_can_access_assessment_attempt(p_attempt_id);
  if v_attempt.id is null or not (coalesce(v_owner, false) or v_evaluator) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  v_status := public.assessment_part_b_effective_status(v_attempt);
  select count(*) into v_available
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = v_attempt.paper_id and q.publication_state = 'ready' and q.response_mode = 'upload';
  select count(*) into v_pinned from public.assessment_attempt_tasks where attempt_id = v_attempt.id;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'paperId', v_attempt.paper_id,
    'exam', v_attempt.exam,
    'kind', v_attempt.kind,
    'title', v_attempt.title,
    'partAStatus', v_attempt.status,
    'status', v_status,
    'minutes', case
      when v_attempt.kind = 'drawing' then v_attempt.drawing_minutes
      when v_attempt.kind = 'mock' then public.assessment_part_b_minutes(v_attempt.exam, v_pinned)
      when v_attempt.kind = 'paper' then public.assessment_part_b_minutes(v_attempt.exam, v_available)
    end,
    'available', case
      when v_attempt.kind = 'drawing' then greatest(v_available, v_pinned)
      when v_attempt.kind = 'mock' and v_attempt.exam in ('uceed', 'ceed') then greatest(v_pinned, least(
        public.assessment_mock_part_b_size(v_attempt.exam),
        (select count(*) from public.assessment_mock_part_b_pool(v_attempt.exam))
      ))
      when v_attempt.kind = 'paper' then v_available
      when v_attempt.kind = 'live' then (
        select count(*) from public.live_event_tasks t
        join public.live_events e on e.id = t.event_id
        where 'live-' || e.key = v_attempt.paper_id
      )
      else 0
    end,
    'startedAt', v_attempt.part_b_started_at,
    'drawingDeadline', v_attempt.part_b_deadline,
    'uploadDeadline', case
      when v_attempt.upload_deadline is not null then v_attempt.upload_deadline
      when v_attempt.part_b_deadline is not null then v_attempt.part_b_deadline + interval '10 minutes'
    end,
    'submittedAt', v_attempt.part_b_submitted_at,
    'score', case when v_status = 'evaluated' or v_evaluator then v_attempt.part_b_score end,
    'maxScore', v_attempt.part_b_max,
    'reference', 'CAND-' || upper(left(replace(v_attempt.person_id::text, '-', ''), 8)),
    -- Tasks are shown once drawing begins (a pinned mock keeps them hidden until then).
    'tasks', case when v_status = 'none' and v_attempt.kind = 'drawing' and not v_evaluator then '[]'::jsonb else coalesce((
      select jsonb_agg(
        public.assessment_question_payload(task.question_id) || jsonb_build_object(
          'maxMarks', task.max_marks,
          'marks', case when v_status = 'evaluated' or v_evaluator then task.marks end,
          'feedback', case when v_status = 'evaluated' or v_evaluator then task.feedback end,
          'uploads', coalesce((
            select jsonb_agg(jsonb_build_object(
              'path', upload.storage_path, 'mimeType', upload.mime_type, 'bytes', upload.byte_size
            ) order by upload.uploaded_at)
            from public.assessment_part_b_uploads upload
            where upload.attempt_id = task.attempt_id and upload.question_id = task.question_id
          ), '[]'::jsonb)
        )
        order by task.position
      )
      from public.assessment_attempt_tasks task
      where task.attempt_id = v_attempt.id
    ), '[]'::jsonb) end
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_test_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_person uuid := public.current_person_id();
  v_profile public.candidate_profiles;
  v_kind text;
begin
  if public.current_person_has_active_student_membership() and public.current_person_can_take_tests() then
    v_kind := 'student';
  elsif public.current_person_has_active_candidate_membership() then
    v_kind := 'candidate';
  else
    return jsonb_build_object('kind', null);
  end if;
  select * into v_profile from public.candidate_profiles where person_id = v_person;
  return jsonb_build_object(
    'kind', v_kind,
    'coachingActive', public.current_person_has_current_coaching_access(),
    'displayName', (select display_name from public.people where id = v_person),
    'profile', case when v_profile.person_id is null then null else jsonb_build_object(
      'level', v_profile.level, 'exams', to_jsonb(v_profile.exams), 'examYear', v_profile.exam_year
    ) end,
    'freeSlots', case when v_kind = 'student' then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object(
        'slot', slot,
        'paperId', (select e.paper_id from public.assessment_entitlements e where e.person_id = v_person and e.free_slot = slot)
      ) order by ordinality)
      from unnest(public.assessment_level_slots(v_profile.level)) with ordinality as item(slot, ordinality)
    ), '[]'::jsonb) end,
    'entitledPapers', coalesce((
      select jsonb_agg(e.paper_id order by e.granted_at)
      from public.assessment_entitlements e
      where e.person_id = v_person and (e.expires_at is null or e.expires_at > now())
    ), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.register_part_b_upload(p_attempt_id uuid, p_question_id uuid, p_storage_path text, p_mime_type text, p_byte_size integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id();
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if public.assessment_part_b_effective_status(v_attempt) not in ('drawing', 'uploading') then
    raise exception 'The upload window has closed.' using errcode = 'DX002';
  end if;
  if p_storage_path is null
    or split_part(p_storage_path, '/', 1) <> p_attempt_id::text
    or split_part(p_storage_path, '/', 2) <> p_question_id::text
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'assessment-part-b' and name = p_storage_path
    ) then
    raise exception 'Upload not found.' using errcode = '22023';
  end if;
  insert into public.assessment_part_b_uploads (attempt_id, question_id, storage_path, mime_type, byte_size)
  values (p_attempt_id, p_question_id, p_storage_path, p_mime_type, p_byte_size)
  on conflict (storage_path) do nothing;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.start_part_b_upload(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current exact-attempt access changed while waiting';
  end if;
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.part_b_status = 'drawing' then
    update public.assessment_attempts
      set part_b_status = 'uploading',
          upload_deadline = least(now(), part_b_deadline) + interval '10 minutes'
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_assessment_attempt(p_attempt_id uuid, p_responses jsonb, p_reason text DEFAULT 'candidate'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
  v_entry record;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current exact-attempt access changed while waiting';
  end if;
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.status = 'submitted' then
    return jsonb_build_object('attemptId', v_attempt.id, 'score', v_attempt.score, 'maxScore', v_attempt.max_score);
  end if;
  if v_attempt.status = 'open' then
    raise exception 'The attempt has not started.' using errcode = '22023';
  end if;
  if p_reason not in ('candidate', 'time') then
    raise exception 'Invalid reason.' using errcode = '22023';
  end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'object' then
    raise exception 'Invalid responses.' using errcode = '22023';
  end if;

  for v_entry in select key, value from jsonb_each(p_responses) loop
    if v_entry.key !~ '^[0-9a-f-]{36}$'
      or not exists (
        select 1 from public.assessment_attempt_questions
        where attempt_id = p_attempt_id and question_id = v_entry.key::uuid
      ) then
      raise exception 'A response does not belong to this attempt.' using errcode = '22023';
    end if;
    if not (
      (jsonb_typeof(v_entry.value) = 'string' and char_length(v_entry.value #>> '{}') <= 32)
      or (
        jsonb_typeof(v_entry.value) = 'array'
        and jsonb_array_length(v_entry.value) <= 6
        and not exists (
          select 1 from jsonb_array_elements(v_entry.value) item
          where jsonb_typeof(item) <> 'string' or (item #>> '{}') !~ '^[A-F]$'
        )
      )
    ) then
      raise exception 'Invalid response.' using errcode = '22023';
    end if;
  end loop;

  update public.assessment_attempt_questions aq
    set response = p_responses -> aq.question_id::text,
        outcome = scored.outcome,
        marks = scored.marks
    from public.assessment_questions q
    left join public.assessment_question_keys k on k.question_id = q.id,
    lateral public.assessment_score_response(
      q.question_type,
      k.answer,
      p_responses -> q.id::text,
      v_attempt.marking -> q.question_type
    ) scored
    where aq.attempt_id = p_attempt_id and q.id = aq.question_id;

  update public.assessment_attempts a
    set status = 'submitted',
        submitted_at = now(),
        submit_reason = p_reason,
        submitted_late = now() > a.deadline + interval '2 minutes',
        score = totals.score,
        max_score = totals.max_score
    from (
      select
        coalesce(sum(aq.marks), 0) as score,
        coalesce(sum(case when aq.outcome = 'dropped' then 0
          else (v_attempt.marking -> q.question_type ->> 'correct')::numeric end), 0) as max_score
      from public.assessment_attempt_questions aq
      join public.assessment_questions q on q.id = aq.question_id
      where aq.attempt_id = p_attempt_id
    ) totals
    where a.id = p_attempt_id
    returning * into v_attempt;

  return jsonb_build_object('attemptId', v_attempt.id, 'score', v_attempt.score, 'maxScore', v_attempt.max_score);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_part_b(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current access to this attempt is required';
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception using errcode='42501',message='current exact-attempt access changed while waiting';
  end if;
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(p_attempt_id) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.part_b_status in ('drawing', 'uploading') then
    update public.assessment_attempts
      set part_b_status = 'submitted', part_b_submitted_at = now()
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$function$
;

-- Paper assembly is internal to authorized attempt opening, not a public enumeration RPC.
revoke execute on function public.get_assessment_student_paper(text) from authenticated;
