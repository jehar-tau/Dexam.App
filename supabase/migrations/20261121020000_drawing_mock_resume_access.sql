-- F054: offer Continue only for an unfinished NID drawing sitting the student can still open.
-- Both catalogue and start use the same lookup. Completed attempts remain in the unseen-task history.
create function public.current_person_open_drawing_mock(p_key text)
returns uuid
language sql stable security invoker
set search_path = ''
as $$
  select a.id from public.assessment_attempts a
  where a.person_id = public.current_person_id()
    and a.kind = 'drawing' and a.paper_id = 'mock-' || p_key
    and public.assessment_part_b_effective_status(a) in ('none', 'drawing', 'uploading')
    and public.current_person_can_access_assessment_attempt(a.id)
  order by a.opened_at desc, a.id desc
  limit 1
$$;
-- Only the existing authenticated catalogue/start RPCs call this internal lookup.
revoke all on function public.current_person_open_drawing_mock(text)
from public, anon, authenticated, service_role;

create or replace function public.list_drawing_mocks()
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
        'openAttemptId', public.current_person_open_drawing_mock(blueprint ->> 'key'),
        'canStart', public.current_person_can_start_drawing_mock(blueprint ->> 'key')
      )
      order by ordinality
    )
    from unnest(array['nid-dat-bdes-2026', 'nid-dat-mdes-2026']) with ordinality as item(key, ordinality),
      lateral (select public.assessment_drawing_blueprint(item.key) as blueprint) b
  );
end;
$$;

create or replace function public.start_drawing_mock(p_key text)
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

  v_attempt := public.current_person_open_drawing_mock(p_key);
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
    -- Never a task already in this mock; tasks the student has never had before ones they have;
    -- then the slot's type if any is left (else any type).
    select pool.question_id into v_task
      from public.assessment_drawing_pool(v_blueprint ->> 'level') pool
      where not exists (
          select 1 from public.assessment_attempt_tasks x
          where x.attempt_id = v_attempt and x.question_id = pool.question_id
        )
      order by
        exists (
          select 1 from public.assessment_attempt_tasks x
          join public.assessment_attempts a on a.id = x.attempt_id
          where x.question_id = pool.question_id and a.person_id = v_person and a.id <> v_attempt
        ),
        (v_slot ->> 'type' <> 'any' and pool.drawing_type <> v_slot ->> 'type'),
        random()
      limit 1;
    exit when v_task is null;
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
      values (v_attempt, v_task, v_position, (v_slot ->> 'marks')::numeric);
    v_position := v_position + 1;
  end loop;

  -- Rights can expire while the six tasks are being selected.
  if not public.current_person_can_access_assessment_attempt(v_attempt) then
    raise exception 'This mock is not included in your access.' using errcode = 'DX001';
  end if;
  return jsonb_build_object('attemptId', v_attempt);
end;
$$;
