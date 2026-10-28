-- D-062: UCEED and CEED mocks get their Part B.
--
-- After a UCEED or CEED mock's Part A, Part B pins drawing tasks from that exam's own Part B
-- papers (UCEED: one drawing and one design-aptitude task, 50 marks each, 60 minutes; CEED: five
-- tasks of 20 marks, 120 minutes), tasks the student has never had first. The 10-minute upload
-- window after the drawing time is unchanged.

create function public.assessment_mock_part_b_size(p_exam text)
returns integer
language sql
immutable
set search_path = ''
as $$ select case p_exam when 'uceed' then 2 when 'ceed' then 5 else 0 end $$;

-- That exam's ready Part B tasks with their drawing type.
create function public.assessment_mock_part_b_pool(p_exam text)
returns table (question_id uuid, drawing_type text)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select q.id, coalesce(substring(t.slug from '^drawing-(.*)$'), 'creative')
  from public.assessment_questions q
  join public.assessment_question_provenance p on p.question_id = q.id
  left join public.assessment_topics t on t.id = q.topic_id
  where q.publication_state = 'ready'
    and q.response_mode = 'upload'
    and p.paper_id like p_exam || '-%'
$$;

-- Pins a mock's Part B tasks (once); UCEED's first task is a drawing, its second design aptitude.
create function public.assessment_pin_mock_part_b(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_need integer;
  v_task uuid;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  if exists (select 1 from public.assessment_attempt_tasks where attempt_id = p_attempt_id) then
    return;
  end if;
  v_need := public.assessment_mock_part_b_size(v_attempt.exam);
  for v_position in 0 .. v_need - 1 loop
    select pool.question_id into v_task
      from public.assessment_mock_part_b_pool(v_attempt.exam) pool
      where not exists (
        select 1 from public.assessment_attempt_tasks x
        where x.attempt_id = p_attempt_id and x.question_id = pool.question_id
      )
      order by
        case
          when v_attempt.exam = 'uceed' and v_position = 0 then pool.drawing_type not in ('scene', 'story', 'skill')
          when v_attempt.exam = 'uceed' and v_position = 1 then pool.drawing_type not in ('product', 'problem', 'communication', 'creative')
          else false
        end,
        exists (
          select 1 from public.assessment_attempt_tasks x
          join public.assessment_attempts a on a.id = x.attempt_id
          where x.question_id = pool.question_id and a.person_id = v_attempt.person_id
        ),
        random()
      limit 1;
    exit when v_task is null;
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
      values (p_attempt_id, v_task, v_position, round(100.0 / v_need, 2));
    v_task := null;
  end loop;
end;
$$;

revoke all on function
  public.assessment_mock_part_b_size(text),
  public.assessment_mock_part_b_pool(text),
  public.assessment_pin_mock_part_b(uuid)
from public, anon, authenticated;
grant execute on function public.assessment_mock_part_b_size(text) to authenticated, service_role;
grant execute on function public.assessment_mock_part_b_pool(text), public.assessment_pin_mock_part_b(uuid)
  to service_role;

create or replace function public.begin_part_b(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_count integer;
  v_total numeric;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if v_attempt.id is null or not public.current_person_can_take_tests() then
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
$$;

-- A UCEED or CEED mock offers its Part B; pinned tasks count once Part B begins.
create or replace function public.get_part_b(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_owner boolean;
  v_evaluator boolean := public.current_person_can_evaluate_part_b();
  v_status text;
  v_available integer;
  v_pinned integer;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  v_owner := v_attempt.person_id = public.current_person_id() and public.current_person_can_take_tests();
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
$$;
