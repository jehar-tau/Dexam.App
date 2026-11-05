-- D-061 fix: a drawing mock takes tasks the student has never had before matching a slot's type.
--
-- 20261029020000 ranked a type match above an unseen task, so once a type's unseen tasks ran out
-- its slot repeated a task the student had already drawn even while unseen tasks of other types
-- remained. ADR-061 sets the order as "tasks the student has never had come first"; the type
-- still decides among unseen tasks (and among seen ones when nothing unseen is left).

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

  return jsonb_build_object('attemptId', v_attempt);
end;
$$;
