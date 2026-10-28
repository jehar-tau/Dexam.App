-- D-060: exact printed question blocks and standalone timed drawing papers.
--
-- 1. A question can be shown as its exact printed block (`display_mode = 'block'`): the crop
--    of the source page, with the answer buttons below it. The block is an ordinary figure
--    asset, so the media rules are unchanged; the importer sets the mode only for crops the
--    owner has approved.
-- 2. A paper's drawing tasks (Part B, or an all-drawing NID DAT paper) can be taken on their
--    own as a timed drawing paper: attempt kind 'drawing', no Part A. Timing: UCEED 60 min,
--    CEED 120 min, NID DAT and NIFT CAT 180 min. Tasks may carry their own marks.

alter table public.assessment_questions
  add column display_mode text not null default 'text' check (display_mode in ('text', 'block')),
  add column task_marks numeric(6, 2) check (task_marks is null or task_marks > 0);

alter table public.assessment_attempts drop constraint assessment_attempts_kind_check;
alter table public.assessment_attempts
  add constraint assessment_attempts_kind_check
    check (kind in ('paper', 'practice', 'mock', 'live', 'drawing')),
  add column drawing_minutes integer check (drawing_minutes is null or drawing_minutes between 10 and 240);

-- Candidate-facing content of one question, now with how it is displayed.
create or replace function public.assessment_question_payload(p_question_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select jsonb_build_object(
    'id', q.id,
    'number', p.question_no,
    'type', q.question_type,
    'prompt', q.prompt,
    'display', q.display_mode,
    'figures', coalesce((
      select jsonb_agg(
        jsonb_build_object('path', a.storage_path, 'width', a.width, 'height', a.height)
        order by a.position
      )
      from public.assessment_question_assets a
      where a.question_id = q.id and a.role = 'figure'
    ), '[]'::jsonb),
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object('key', o.option_key, 'text', o.body, 'imagePath', oa.storage_path)
        order by o.position
      )
      from public.assessment_question_options o
      left join public.assessment_question_assets oa on oa.id = o.asset_id
      where o.question_id = q.id
    ), '[]'::jsonb)
  )
  from public.assessment_questions q
  join public.assessment_question_provenance p on p.question_id = q.id
  where q.id = p_question_id
$$;

revoke all on function public.assessment_question_payload(uuid) from public, anon, authenticated;
grant execute on function public.assessment_question_payload(uuid) to service_role;

-- Minutes for a standalone drawing paper.
create function public.assessment_drawing_paper_minutes(p_exam text, p_paper_id text, p_tasks integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_exam = 'uceed' then 60
    when p_exam = 'ceed' then 120
    when p_paper_id ~ '^nid-(bdes|mdes)-dat-mock-' then 180
    when p_exam = 'nift' and p_paper_id like '%-cat%' then 180
    else least(180, greatest(30, 20 * p_tasks))
  end
$$;

revoke all on function public.assessment_drawing_paper_minutes(text, text, integer) from public, anon;
grant execute on function public.assessment_drawing_paper_minutes(text, text, integer)
  to authenticated, service_role;

-- Papers whose drawing tasks can be taken as a timed paper, with the caller's latest sitting.
create function public.list_drawing_papers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'paperId', paper.paper_id,
      'exam', paper.exam,
      'tasks', paper.tasks,
      'minutes', public.assessment_drawing_paper_minutes(paper.exam, paper.paper_id, paper.tasks),
      'totalMarks', coalesce(paper.marks, 100),
      'original', paper.original,
      'locked', not public.current_person_can_open_paper(paper.paper_id),
      'latest', (
        select jsonb_build_object(
          'attemptId', a.id,
          'status', public.assessment_part_b_effective_status(a),
          'score', case when public.assessment_part_b_effective_status(a) = 'evaluated' then a.part_b_score end,
          'maxScore', a.part_b_max
        )
        from public.assessment_attempts a
        where a.person_id = v_person and a.kind = 'drawing' and a.paper_id = paper.paper_id
        order by a.opened_at desc
        limit 1
      )
    ) order by paper.paper_id)
    from (
      select p.paper_id, min(p.exam) as exam, count(*)::integer as tasks,
        sum(q.task_marks) as marks, bool_or(q.source_kind = 'original') as original
      from public.assessment_question_provenance p
      join public.assessment_questions q on q.id = p.question_id
      where q.publication_state = 'ready' and q.response_mode = 'upload'
      group by p.paper_id
    ) paper
  ), '[]'::jsonb);
end;
$$;

-- Starts (or resumes) a standalone drawing paper. Part B's own flow then runs it: instructions,
-- "Begin Part B" starts the clock, the 10-minute upload window, submission and evaluation.
create function public.start_drawing_paper(p_paper_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_attempt public.assessment_attempts;
  v_exam text;
  v_tasks integer;
  v_minutes integer;
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  if p_paper_id is null or p_paper_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid paper.' using errcode = '22023';
  end if;
  if not public.current_person_can_open_paper(p_paper_id) then
    raise exception 'This paper is not included in your access.' using errcode = 'DX001';
  end if;

  select a.* into v_attempt
    from public.assessment_attempts a
    where a.person_id = v_person and a.kind = 'drawing' and a.paper_id = p_paper_id
      and public.assessment_part_b_effective_status(a) in ('none', 'drawing', 'uploading')
    order by a.opened_at desc
    limit 1;
  if v_attempt.id is not null then
    return jsonb_build_object('attemptId', v_attempt.id);
  end if;

  select count(*), min(p.exam) into v_tasks, v_exam
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = p_paper_id and q.publication_state = 'ready' and q.response_mode = 'upload';
  if v_tasks = 0 then
    raise exception 'This paper has no drawing tasks ready yet.' using errcode = 'P0002';
  end if;
  v_minutes := public.assessment_drawing_paper_minutes(v_exam, p_paper_id, v_tasks);

  perform public.assessment_claim_paper(p_paper_id);

  -- There is no Part A, so the objective part counts as already done.
  insert into public.assessment_attempts (
    person_id, paper_id, exam, status, started_at, submitted_at, submit_reason,
    duration_minutes, objective_count, marking, kind, title, drawing_minutes
  )
  values (
    v_person, p_paper_id, v_exam, 'submitted', now(), now(), 'candidate',
    v_minutes, 0, '{}'::jsonb, 'drawing', null, v_minutes
  )
  returning * into v_attempt;
  return jsonb_build_object('attemptId', v_attempt.id);
end;
$$;

revoke all on function public.list_drawing_papers(), public.start_drawing_paper(text) from public, anon;
grant execute on function public.list_drawing_papers(), public.start_drawing_paper(text) to authenticated;

-- Part B starts after Part A, or straight away on a drawing paper. Tasks keep their own marks.
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
  if v_attempt.kind not in ('paper', 'drawing') or v_attempt.status <> 'submitted' then
    raise exception 'Part B starts after Part A is submitted.' using errcode = '22023';
  end if;
  if v_attempt.part_b_status = 'none' then
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

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'paperId', v_attempt.paper_id,
    'exam', v_attempt.exam,
    'kind', v_attempt.kind,
    'partAStatus', v_attempt.status,
    'status', v_status,
    'minutes', case
      when v_attempt.kind = 'drawing' then v_attempt.drawing_minutes
      when v_attempt.kind = 'paper' then public.assessment_part_b_minutes(v_attempt.exam, v_available)
    end,
    'available', case
      when v_attempt.kind in ('paper', 'drawing') then v_available
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
    'tasks', coalesce((
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
    ), '[]'::jsonb)
  );
end;
$$;

-- Drawing papers have no Part A score: keep them out of the scored lists and the progress chart.
create or replace function public.list_assessment_attempts()
returns table (
  attempt_id uuid,
  paper_id text,
  status text,
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  question_count integer
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_take_tests() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  return query
    select a.id, a.paper_id, a.status, a.started_at, a.submitted_at, a.score, a.max_score,
      (select count(*)::integer from public.assessment_attempt_questions aq where aq.attempt_id = a.id)
    from public.assessment_attempts a
    where a.person_id = public.current_person_id() and a.kind <> 'drawing'
    order by a.opened_at desc
    limit 200;
end;
$$;

create or replace function public.get_assessment_progress()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
begin
  if not public.current_person_can_take_tests() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attemptId', a.id,
        'kind', a.kind,
        'title', a.title,
        'paperId', a.paper_id,
        'exam', a.exam,
        'submittedAt', a.submitted_at,
        'score', a.score,
        'maxScore', a.max_score,
        'questionCount', (select count(*) from public.assessment_attempt_questions aq where aq.attempt_id = a.id)
      ) order by a.submitted_at)
      from public.assessment_attempts a
      where a.person_id = v_person and a.status = 'submitted' and a.kind <> 'drawing'
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('slug', topic.slug, 'name', topic.name, 'total', topic.total, 'scored', topic.scored)
        order by topic.scored::numeric / topic.total, topic.total desc)
      from (
        select t.slug, t.name,
          count(*)::integer as total,
          (count(*) filter (where aq.outcome in ('correct', 'partial', 'full_marks')))::integer as scored
        from public.assessment_attempt_questions aq
        join public.assessment_attempts a on a.id = aq.attempt_id
        join public.assessment_questions q on q.id = aq.question_id
        join public.assessment_topics t on t.id = q.topic_id
        where a.person_id = v_person and a.status = 'submitted' and aq.outcome <> 'dropped'
        group by t.slug, t.name
      ) topic
    ), '[]'::jsonb)
  );
end;
$$;
