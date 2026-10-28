-- D-061: NID DAT drawing mocks mixed from the common drawing pool.
--
-- NID DAT Prelims (2026 pattern) is one 3-hour, 100-mark, all-drawing paper of six tasks.
-- A mock picks six ready drawing tasks for the student's level from every source (NID, UCEED
-- and CEED Part B, NIFT CAT, Dexam originals, the owner's task collections), one per drawing
-- type where possible, tasks the student has never had first. The tasks are pinned when the
-- mock starts; Part B's flow then runs it (instructions, the 3-hour clock, uploads, evaluation).

-- B.Des, M.Des, both (task collections) or neither, from the source paper.
create function public.assessment_drawing_level(p_paper_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_paper_id like 'nid-task-collection-%' then 'both'
    when p_paper_id like 'uceed-%' or p_paper_id like 'nid-bdes-%' then 'bdes'
    when p_paper_id like 'ceed-%' or p_paper_id like 'nid-mdes-%' then 'mdes'
    when p_paper_id like 'nift-%bdes%' then 'bdes'
    when p_paper_id like 'nift-%mdes%' then 'mdes'
  end
$$;

-- Six slots: a drawing type and its marks (100 in all), as on the 2026 paper.
create function public.assessment_drawing_blueprint(p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'nid-dat-bdes-2026' then '{"key":"nid-dat-bdes-2026","exam":"nid","level":"bdes","title":"NID DAT B.Des drawing mock","minutes":180,"slots":[{"type":"scene","marks":15},{"type":"story","marks":15},{"type":"product","marks":15},{"type":"communication","marks":20},{"type":"creative","marks":15},{"type":"any","marks":20}]}'::jsonb
    when 'nid-dat-mdes-2026' then '{"key":"nid-dat-mdes-2026","exam":"nid","level":"mdes","title":"NID DAT M.Des drawing mock","minutes":180,"slots":[{"type":"problem","marks":15},{"type":"product","marks":15},{"type":"communication","marks":20},{"type":"scene","marks":15},{"type":"creative","marks":15},{"type":"any","marks":20}]}'::jsonb
  end
$$;

-- Ready drawing tasks for a level.
create function public.assessment_drawing_pool(p_level text)
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
    and public.assessment_drawing_level(p.paper_id) in (p_level, 'both')
$$;

-- Candidates get one free drawing mock per level; coaching students have unlimited mocks.
create function public.current_person_can_start_drawing_mock(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.assessment_drawing_blueprint(p_key) is not null and (
    public.current_person_has_active_student_membership()
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
$$;

create function public.list_drawing_mocks()
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
  return (
    select jsonb_agg(
      jsonb_build_object(
        'key', blueprint ->> 'key',
        'level', blueprint ->> 'level',
        'title', blueprint ->> 'title',
        'minutes', (blueprint ->> 'minutes')::integer,
        'tasks', jsonb_array_length(blueprint -> 'slots'),
        'totalMarks', (select sum((slot ->> 'marks')::numeric) from jsonb_array_elements(blueprint -> 'slots') slot),
        'pool', (select count(*) from public.assessment_drawing_pool(blueprint ->> 'level')),
        'unseen', (
          select count(*) from public.assessment_drawing_pool(blueprint ->> 'level') pool
          where not exists (
            select 1 from public.assessment_attempt_tasks x
            join public.assessment_attempts a on a.id = x.attempt_id
            where x.question_id = pool.question_id and a.person_id = v_person
          )
        ),
        'taken', (
          select count(*) from public.assessment_attempts a
          where a.person_id = v_person and a.kind = 'drawing' and a.paper_id = 'mock-' || (blueprint ->> 'key')
            and public.assessment_part_b_effective_status(a) in ('submitted', 'evaluated')
        ),
        'openAttemptId', (
          select a.id from public.assessment_attempts a
          where a.person_id = v_person and a.kind = 'drawing' and a.paper_id = 'mock-' || (blueprint ->> 'key')
            and public.assessment_part_b_effective_status(a) in ('none', 'drawing', 'uploading')
          order by a.opened_at desc
          limit 1
        ),
        'canStart', public.current_person_can_start_drawing_mock(blueprint ->> 'key')
      )
      order by ordinality
    )
    from unnest(array['nid-dat-bdes-2026', 'nid-dat-mdes-2026']) with ordinality as item(key, ordinality),
      lateral (select public.assessment_drawing_blueprint(item.key) as blueprint) b
  );
end;
$$;

-- Builds (or resumes) the student's NID DAT drawing mock and returns its attempt id.
create function public.start_drawing_mock(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_blueprint jsonb := public.assessment_drawing_blueprint(p_key);
  v_paper text := 'mock-' || coalesce(p_key, '');
  v_attempt uuid;
  v_slot jsonb;
  v_position integer := 0;
  v_task uuid;
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  if v_blueprint is null then
    raise exception 'Unknown drawing mock.' using errcode = '22023';
  end if;

  select a.id into v_attempt
    from public.assessment_attempts a
    where a.person_id = v_person and a.kind = 'drawing' and a.paper_id = v_paper
      and public.assessment_part_b_effective_status(a) in ('none', 'drawing', 'uploading')
    order by a.opened_at desc
    limit 1;
  if v_attempt is not null then
    return jsonb_build_object('attemptId', v_attempt);
  end if;

  if not public.current_person_can_start_drawing_mock(p_key) then
    raise exception 'This mock is not included in your access.' using errcode = 'DX001';
  end if;
  if (select count(*) from public.assessment_drawing_pool(v_blueprint ->> 'level')) < 4 then
    raise exception 'Not enough drawing tasks are ready for this mock yet.' using errcode = 'P0002';
  end if;

  insert into public.assessment_attempts (
    person_id, paper_id, exam, status, started_at, submitted_at, submit_reason,
    duration_minutes, objective_count, marking, kind, title, drawing_minutes
  )
  values (
    v_person, v_paper, 'nid', 'submitted', now(), now(), 'candidate',
    (v_blueprint ->> 'minutes')::integer, 0, '{}'::jsonb, 'drawing', v_blueprint ->> 'title',
    (v_blueprint ->> 'minutes')::integer
  )
  returning id into v_attempt;

  for v_slot in select value from jsonb_array_elements(v_blueprint -> 'slots') loop
    -- The slot's type if any is left (else any type), never a task already in this mock, and
    -- tasks the student has never had before ones they have.
    select pool.question_id into v_task
      from public.assessment_drawing_pool(v_blueprint ->> 'level') pool
      where not exists (
          select 1 from public.assessment_attempt_tasks x
          where x.attempt_id = v_attempt and x.question_id = pool.question_id
        )
      order by
        (v_slot ->> 'type' <> 'any' and pool.drawing_type <> v_slot ->> 'type'),
        exists (
          select 1 from public.assessment_attempt_tasks x
          join public.assessment_attempts a on a.id = x.attempt_id
          where x.question_id = pool.question_id and a.person_id = v_person and a.id <> v_attempt
        ),
        random()
      limit 1;
    exit when v_task is null;
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
      values (v_attempt, v_task, v_position, (v_slot ->> 'marks')::numeric);
    v_position := v_position + 1;
  end loop;

  return jsonb_build_object('attemptId', v_attempt);
end;
$$;

revoke all on function
  public.assessment_drawing_level(text),
  public.assessment_drawing_blueprint(text),
  public.assessment_drawing_pool(text),
  public.current_person_can_start_drawing_mock(text),
  public.list_drawing_mocks(),
  public.start_drawing_mock(text)
from public, anon;
revoke all on function public.assessment_drawing_pool(text) from authenticated;
grant execute on function public.assessment_drawing_pool(text) to service_role;
grant execute on function
  public.assessment_drawing_level(text),
  public.assessment_drawing_blueprint(text),
  public.current_person_can_start_drawing_mock(text),
  public.list_drawing_mocks(),
  public.start_drawing_mock(text)
to authenticated;

-- Part B keeps tasks that were pinned when a mock was built (with their marks).
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

-- A drawing sitting's task count is its pinned tasks once a mock has pinned them.
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
      when v_attempt.kind = 'paper' then public.assessment_part_b_minutes(v_attempt.exam, v_available)
    end,
    'available', case
      when v_attempt.kind = 'drawing' then greatest(v_available, v_pinned)
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
