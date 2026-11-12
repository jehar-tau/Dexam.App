-- D-062 fix: a UCEED/CEED mock's Part B takes tasks the student has never had before matching a
-- position's type.
--
-- 20261029030000 ranked UCEED's position type (drawing first, design aptitude second) above an
-- unseen task, so once the student had drawn every task of that type the position repeated one
-- even while unseen tasks of the other type remained. ADR-062 sets "tasks the student has never
-- had first"; the type still decides among unseen tasks (and among seen ones when nothing unseen
-- is left). Only the order of the first two keys changes.

create or replace function public.assessment_pin_mock_part_b(p_attempt_id uuid)
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
        exists (
          select 1 from public.assessment_attempt_tasks x
          join public.assessment_attempts a on a.id = x.attempt_id
          where x.question_id = pool.question_id and a.person_id = v_attempt.person_id
        ),
        case
          when v_attempt.exam = 'uceed' and v_position = 0 then pool.drawing_type not in ('scene', 'story', 'skill')
          when v_attempt.exam = 'uceed' and v_position = 1 then pool.drawing_type not in ('product', 'problem', 'communication', 'creative')
          else false
        end,
        random()
      limit 1;
    exit when v_task is null;
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
      values (p_attempt_id, v_task, v_position, round(100.0 / v_need, 2));
    v_task := null;
  end loop;
end;
$$;
