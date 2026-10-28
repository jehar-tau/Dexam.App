-- F046 progress and F047 topic practice. Practice sets are attempts too: pinned, timed or
-- untimed, scored by the same server rules and reviewed on the same result page. Questions the
-- student has not seen in any attempt are chosen first.

alter table public.assessment_attempts
  add column kind text not null default 'paper' check (kind in ('paper', 'practice')),
  add column title text check (char_length(title) <= 120),
  add column timed boolean not null default true;

create or replace function public.assessment_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select jsonb_build_object(
    'attemptId', a.id,
    'kind', a.kind,
    'title', a.title,
    'timed', a.timed,
    'paperId', a.paper_id,
    'exam', a.exam,
    'status', a.status,
    'startedAt', a.started_at,
    'deadline', a.deadline,
    'durationMinutes', a.duration_minutes,
    'objectiveCount', a.objective_count,
    'marking', a.marking,
    'questions', coalesce((
      select jsonb_agg(public.assessment_question_payload(aq.question_id) order by aq.position)
      from public.assessment_attempt_questions aq
      where aq.attempt_id = a.id
    ), '[]'::jsonb)
  )
  from public.assessment_attempts a
  where a.id = p_attempt_id
$$;

-- The caller's own unfinished attempt, for resuming a practice set by its id.
create function public.get_assessment_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_has_active_student_membership()
    or not exists (
      select 1 from public.assessment_attempts
      where id = p_attempt_id and person_id = public.current_person_id() and status <> 'submitted'
    ) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  return public.assessment_attempt_payload(p_attempt_id);
end;
$$;

-- Topics with ready questions, optionally for one exam, and how many the caller has not seen.
create function public.list_assessment_practice_topics(p_exam text default null)
returns table (slug text, name text, ready_count integer, unseen_count integer)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  if p_exam is not null and p_exam not in ('uceed', 'ceed', 'nid', 'nift') then
    raise exception 'Invalid exam.' using errcode = '22023';
  end if;
  return query
    select
      t.slug,
      t.name,
      count(*)::integer,
      (count(*) filter (where not exists (
        select 1
        from public.assessment_attempt_questions aq
        join public.assessment_attempts a on a.id = aq.attempt_id
        where aq.question_id = q.id and a.person_id = public.current_person_id()
      )))::integer
    from public.assessment_questions q
    join public.assessment_topics t on t.id = q.topic_id
    join public.assessment_question_provenance p on p.question_id = q.id
    where q.publication_state = 'ready'
      and q.response_mode = 'auto'
      and (p_exam is null or p.exam = p_exam)
    group by t.slug, t.name
    order by count(*) desc, t.name;
end;
$$;

-- Builds a practice set: up to p_size ready questions on a topic, unseen ones first, in random
-- order. Replaces the caller's unfinished set on the same topic and exam.
create function public.start_assessment_practice(
  p_topic text,
  p_size integer,
  p_timed boolean,
  p_exam text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_topic public.assessment_topics;
  v_paper text;
  v_attempt uuid;
  v_count integer;
  v_marking_exam text := coalesce(p_exam, '');
begin
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  if p_size not in (10, 25, 50) or p_timed is null then
    raise exception 'Invalid practice size.' using errcode = '22023';
  end if;
  if p_exam is not null and p_exam not in ('uceed', 'ceed', 'nid', 'nift') then
    raise exception 'Invalid exam.' using errcode = '22023';
  end if;
  select * into v_topic from public.assessment_topics where slug = p_topic;
  if v_topic.id is null then
    raise exception 'Unknown topic.' using errcode = '22023';
  end if;

  v_paper := left(format('practice-%s-%s', coalesce(p_exam, 'all'), v_topic.slug), 80);
  delete from public.assessment_attempts
    where person_id = v_person and paper_id = v_paper and status <> 'submitted';

  insert into public.assessment_attempts (
    person_id, paper_id, exam, kind, title, timed, duration_minutes, objective_count, marking
  )
  values (
    v_person,
    v_paper,
    coalesce(p_exam, ''),
    'practice',
    left('Practice · ' || v_topic.name, 120),
    p_timed,
    1, -- set below once the size is known
    0,
    jsonb_build_object(
      'nat', public.assessment_marking(v_marking_exam, 'nat'),
      'msq', public.assessment_marking(v_marking_exam, 'msq'),
      'mcq', public.assessment_marking(v_marking_exam, 'mcq')
    )
  )
  returning id into v_attempt;

  insert into public.assessment_attempt_questions (attempt_id, question_id, position)
  select v_attempt, picked.id, (row_number() over (order by picked.seen, picked.shuffle) - 1)::smallint
  from (
    select
      q.id,
      exists (
        select 1
        from public.assessment_attempt_questions aq
        join public.assessment_attempts a on a.id = aq.attempt_id
        where aq.question_id = q.id and a.person_id = v_person and a.id <> v_attempt
      ) as seen,
      random() as shuffle
    from public.assessment_questions q
    join public.assessment_question_provenance p on p.question_id = q.id
    where q.topic_id = v_topic.id
      and q.publication_state = 'ready'
      and q.response_mode = 'auto'
      and (p_exam is null or p.exam = p_exam)
    order by 2, 3
    limit p_size
  ) picked;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No reviewed questions on this topic yet.' using errcode = 'P0002';
  end if;

  -- Timed sets allow 90 seconds a question; untimed sets keep a 10-hour server limit.
  update public.assessment_attempts
    set objective_count = v_count,
        duration_minutes = case when p_timed then greatest(5, ceil(v_count * 1.5)::integer) else 600 end
    where id = v_attempt;

  return public.assessment_attempt_payload(v_attempt);
end;
$$;

-- Progress across the caller's submitted papers and practice sets, plus topic accuracy.
create function public.get_assessment_progress()
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
  if not public.current_person_has_active_student_membership() then
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
      where a.person_id = v_person and a.status = 'submitted'
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

-- Results now carry the attempt kind and title (practice sets have no catalogue paper).
create or replace function public.get_assessment_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id();
  if v_attempt.id is null or not public.current_person_has_active_student_membership() then
    raise exception 'Result not found.' using errcode = '42501';
  end if;
  if v_attempt.status <> 'submitted' then
    raise exception 'The result is released after submission.' using errcode = '42501';
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
$$;

revoke all on function
  public.get_assessment_attempt(uuid),
  public.list_assessment_practice_topics(text),
  public.start_assessment_practice(text, integer, boolean, text),
  public.get_assessment_progress()
from public, anon;
grant execute on function
  public.get_assessment_attempt(uuid),
  public.list_assessment_practice_topics(text),
  public.start_assessment_practice(text, integer, boolean, text),
  public.get_assessment_progress()
to authenticated;
