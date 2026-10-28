-- F044 (with F042 phase 2b in part): server-side attempts, deterministic scoring and results.
-- An attempt pins the exact question versions it served. The browser never reads attempt tables
-- directly: it opens, begins and submits through the functions below, and answer keys are only
-- returned for the caller's own submitted attempts.

-- Marking per exam and question type. UCEED and CEED follow the verified 2026 Part A brochures;
-- exams without a published per-question scheme use Dexam practice marking (+1, no negative).
create function public.assessment_marking(p_exam text, p_type text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_exam || ':' || p_type
    when 'uceed:nat' then '{"correct":4,"wrong":0}'::jsonb
    when 'uceed:msq' then '{"correct":4,"wrong":-1,"partial":true}'::jsonb
    when 'uceed:mcq' then '{"correct":3,"wrong":-0.71}'::jsonb
    when 'ceed:nat' then '{"correct":4,"wrong":0}'::jsonb
    when 'ceed:msq' then '{"correct":4,"wrong":-1,"partial":true}'::jsonb
    when 'ceed:mcq' then '{"correct":3,"wrong":-0.5}'::jsonb
    else '{"correct":1,"wrong":0,"practice":true}'::jsonb
  end
$$;

-- Official Part A minutes scaled to the questions shown; one minute per question otherwise.
create function public.assessment_paper_minutes(p_exam text, p_shown integer, p_total integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_exam in ('uceed', 'ceed') then greatest(
      5,
      round((case p_exam when 'uceed' then 120 else 60 end)::numeric * p_shown / greatest(p_total, p_shown, 1))::integer
    )
    else greatest(5, p_shown)
  end
$$;

/**
 * Scores one response. Returns the outcome and the marks.
 *  - MCQ: any listed option is correct.
 *  - MSQ: the exact set earns full marks; with partial marking, a non-empty subset of a correct
 *    set with no wrong option earns one mark per option chosen (the IIT Bombay 2026 ladder);
 *    anything else is wrong. Alternative sets take the best result.
 *  - NAT: an exact value or a value inside an accepted range (inclusive).
 *  - Dropped questions score nothing and leave the maximum; full-marks questions award everyone.
 */
create function public.assessment_score_response(
  p_type text,
  p_key jsonb,
  p_response jsonb,
  p_marking jsonb
)
returns table (outcome text, marks numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_correct numeric := (p_marking ->> 'correct')::numeric;
  v_wrong numeric := (p_marking ->> 'wrong')::numeric;
  v_partial boolean := coalesce((p_marking ->> 'partial')::boolean, false);
  v_kind text := p_key ->> 'kind';
  v_chosen text[];
  v_set text[];
  v_best_marks numeric;
  v_best_outcome text;
  v_value numeric;
  v_accepted jsonb;
begin
  if p_key is null or v_kind = 'dropped' then
    return query select 'dropped'::text, 0::numeric;
    return;
  end if;
  if v_kind = 'full_marks' then
    return query select 'full_marks'::text, v_correct;
    return;
  end if;
  if p_response is null
    or p_response = 'null'::jsonb
    or (jsonb_typeof(p_response) = 'string' and btrim(p_response #>> '{}') = '')
    or (jsonb_typeof(p_response) = 'array' and jsonb_array_length(p_response) = 0) then
    return query select 'unanswered'::text, 0::numeric;
    return;
  end if;

  if p_type = 'mcq' then
    if jsonb_typeof(p_response) = 'string' and (p_key -> 'correct') ? (p_response #>> '{}') then
      return query select 'correct'::text, v_correct;
    else
      return query select 'wrong'::text, v_wrong;
    end if;
    return;
  end if;

  if p_type = 'msq' then
    if jsonb_typeof(p_response) <> 'array' then
      return query select 'wrong'::text, v_wrong;
      return;
    end if;
    select coalesce(array_agg(distinct value order by value), '{}')
      into v_chosen
      from jsonb_array_elements_text(p_response) as value;
    v_best_marks := v_wrong;
    v_best_outcome := 'wrong';
    for v_set in
      select array(select jsonb_array_elements_text(candidate) order by 1)
      from jsonb_array_elements(
        case when p_key ? 'correct' then jsonb_build_array(p_key -> 'correct') else p_key -> 'alternatives' end
      ) as candidate
    loop
      if v_chosen = v_set then
        v_best_marks := v_correct;
        v_best_outcome := 'correct';
        exit;
      elsif v_partial and v_chosen <@ v_set and cardinality(v_chosen) < cardinality(v_set)
        and cardinality(v_chosen) > v_best_marks then
        v_best_marks := cardinality(v_chosen);
        v_best_outcome := 'partial';
      end if;
    end loop;
    return query select v_best_outcome, v_best_marks;
    return;
  end if;

  -- NAT
  if jsonb_typeof(p_response) <> 'string' or (p_response #>> '{}') !~ '^\s*-?\d+(\.\d+)?\s*$' then
    return query select 'wrong'::text, v_wrong;
    return;
  end if;
  v_value := btrim(p_response #>> '{}')::numeric;
  for v_accepted in select * from jsonb_array_elements(p_key -> 'accepted') loop
    if (v_accepted ? 'exact' and v_value = (v_accepted ->> 'exact')::numeric)
      or (v_accepted ? 'range'
        and v_value between (v_accepted -> 'range' ->> 0)::numeric and (v_accepted -> 'range' ->> 1)::numeric) then
      return query select 'correct'::text, v_correct;
      return;
    end if;
  end loop;
  return query select 'wrong'::text, v_wrong;
end;
$$;

revoke all on function public.assessment_marking(text, text) from public, anon;
revoke all on function public.assessment_paper_minutes(text, integer, integer) from public, anon;
revoke all on function public.assessment_score_response(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.assessment_marking(text, text) to authenticated, service_role;
grant execute on function public.assessment_paper_minutes(text, integer, integer) to authenticated, service_role;
grant execute on function public.assessment_score_response(text, jsonb, jsonb, jsonb) to service_role;

create table public.assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  paper_id text not null check (paper_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  exam text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'submitted')),
  opened_at timestamptz not null default now(),
  started_at timestamptz,
  deadline timestamptz,
  submitted_at timestamptz,
  submit_reason text check (submit_reason in ('candidate', 'time')),
  submitted_late boolean not null default false,
  duration_minutes integer not null check (duration_minutes between 1 and 600),
  objective_count integer not null check (objective_count >= 0),
  marking jsonb not null,
  score numeric(7, 2),
  max_score numeric(7, 2),
  constraint assessment_attempts_started check ((status = 'open') = (started_at is null)),
  constraint assessment_attempts_submitted check ((status = 'submitted') = (submitted_at is not null))
);

-- One unfinished attempt per student and paper.
create unique index assessment_attempts_one_unfinished
  on public.assessment_attempts (person_id, paper_id)
  where status <> 'submitted';
create index assessment_attempts_person on public.assessment_attempts (person_id, opened_at desc);

create table public.assessment_attempt_questions (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete restrict,
  position smallint not null check (position >= 0),
  response jsonb,
  marked_review boolean not null default false,
  outcome text check (outcome in ('correct', 'partial', 'wrong', 'unanswered', 'dropped', 'full_marks')),
  marks numeric(6, 2),
  primary key (attempt_id, question_id),
  unique (attempt_id, position)
);

alter table public.assessment_attempts enable row level security;
alter table public.assessment_attempt_questions enable row level security;
revoke all on public.assessment_attempts, public.assessment_attempt_questions from public, anon, authenticated;
grant all on public.assessment_attempts, public.assessment_attempt_questions to service_role;
-- No browser grants: attempts are reached only through the functions below.

-- Candidate-facing content of one question (no key, provenance or licence).
create function public.assessment_question_payload(p_question_id uuid)
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

create function public.assessment_paper_exam(p_paper_id text)
returns text
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select p.exam from public.assessment_question_provenance p where p.paper_id = p_paper_id limit 1
$$;

revoke all on function public.assessment_paper_exam(text) from public, anon, authenticated;
grant execute on function public.assessment_paper_exam(text) to service_role;

-- The candidate view of a paper now also carries its exam, timing and marking, so the server
-- is the single source for both.
create or replace function public.get_assessment_student_paper(p_paper_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_exam text;
  v_questions jsonb;
  v_total integer;
begin
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  if p_paper_id is null or p_paper_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid paper.' using errcode = '22023';
  end if;
  v_exam := public.assessment_paper_exam(p_paper_id);

  select count(*)
    into v_total
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = p_paper_id and q.publication_state <> 'retired' and q.response_mode = 'auto';

  select coalesce(jsonb_agg(public.assessment_question_payload(q.id)
      order by nullif(substring(p.question_no from '^[0-9]+'), '')::integer nulls last, p.question_no), '[]'::jsonb)
    into v_questions
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = p_paper_id and q.publication_state = 'ready' and q.response_mode = 'auto';

  return jsonb_build_object(
    'paperId', p_paper_id,
    'exam', v_exam,
    'objectiveCount', v_total,
    'durationMinutes', public.assessment_paper_minutes(coalesce(v_exam, ''), jsonb_array_length(v_questions), v_total),
    'marking', jsonb_build_object(
      'nat', public.assessment_marking(coalesce(v_exam, ''), 'nat'),
      'msq', public.assessment_marking(coalesce(v_exam, ''), 'msq'),
      'mcq', public.assessment_marking(coalesce(v_exam, ''), 'mcq')
    ),
    'questions', v_questions
  );
end;
$$;

create function public.assessment_attempt_payload(p_attempt_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select jsonb_build_object(
    'attemptId', a.id,
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

revoke all on function public.assessment_attempt_payload(uuid) from public, anon, authenticated;
grant execute on function public.assessment_attempt_payload(uuid) to service_role;

-- Opens the student's unfinished attempt at this paper, or creates one pinning the ready
-- questions as they are now. The clock does not start until begin_assessment_attempt().
create function public.open_assessment_attempt(p_paper_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_attempt uuid;
  v_paper jsonb;
  v_shown integer;
begin
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  if p_paper_id is null or p_paper_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid paper.' using errcode = '22023';
  end if;

  select id into v_attempt
    from public.assessment_attempts
    where person_id = v_person and paper_id = p_paper_id and status <> 'submitted';
  if v_attempt is not null then
    return public.assessment_attempt_payload(v_attempt);
  end if;

  v_paper := public.get_assessment_student_paper(p_paper_id);
  v_shown := jsonb_array_length(v_paper -> 'questions');
  if v_shown = 0 then
    raise exception 'This paper has no reviewed questions yet.' using errcode = 'P0002';
  end if;

  insert into public.assessment_attempts (
    person_id, paper_id, exam, duration_minutes, objective_count, marking
  )
  values (
    v_person,
    p_paper_id,
    coalesce(v_paper ->> 'exam', ''),
    (v_paper ->> 'durationMinutes')::integer,
    (v_paper ->> 'objectiveCount')::integer,
    v_paper -> 'marking'
  )
  returning id into v_attempt;

  insert into public.assessment_attempt_questions (attempt_id, question_id, position)
  select v_attempt, (question ->> 'id')::uuid, (ordinality - 1)::smallint
  from jsonb_array_elements(v_paper -> 'questions') with ordinality as item(question, ordinality);

  return public.assessment_attempt_payload(v_attempt);
end;
$$;

-- Starts the clock once; calling it again returns the same deadline.
create function public.begin_assessment_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if v_attempt.id is null or not public.current_person_has_active_student_membership() then
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
$$;

-- Scores and closes the attempt. Responses are {"<question id>": "B" | ["A","C"] | "12.5"}.
-- Submitting twice returns the first result. Responses received more than two minutes after
-- the deadline are still scored but the attempt is marked late.
create function public.submit_assessment_attempt(
  p_attempt_id uuid,
  p_responses jsonb,
  p_reason text default 'candidate'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_entry record;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if v_attempt.id is null or not public.current_person_has_active_student_membership() then
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
$$;

-- The released result of the caller's own submitted attempt: keys and verified explanations
-- included, never provenance or licences.
create function public.get_assessment_attempt_result(p_attempt_id uuid)
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

create function public.list_assessment_attempts()
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
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  return query
    select a.id, a.paper_id, a.status, a.started_at, a.submitted_at, a.score, a.max_score,
      (select count(*)::integer from public.assessment_attempt_questions aq where aq.attempt_id = a.id)
    from public.assessment_attempts a
    where a.person_id = public.current_person_id()
    order by a.opened_at desc
    limit 200;
end;
$$;

revoke all on function
  public.open_assessment_attempt(text),
  public.begin_assessment_attempt(uuid),
  public.submit_assessment_attempt(uuid, jsonb, text),
  public.get_assessment_attempt_result(uuid),
  public.list_assessment_attempts()
from public, anon;
grant execute on function
  public.open_assessment_attempt(text),
  public.begin_assessment_attempt(uuid),
  public.submit_assessment_attempt(uuid, jsonb, text),
  public.get_assessment_attempt_result(uuid),
  public.list_assessment_attempts()
to authenticated;

-- Students may also read the figures of questions in their own attempts, so a result stays
-- reviewable after a question is retired.
create or replace function public.current_person_can_read_assessment_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_capability('assessment.bank.read')
    or (
      public.current_person_has_active_student_membership()
      and exists (
        select 1
        from public.assessment_question_assets asset
        join public.assessment_questions question on question.id = asset.question_id
        where asset.storage_path = p_object_name
          and asset.role in ('figure', 'option')
          and question.response_mode = 'auto'
          and (
            question.publication_state = 'ready'
            or exists (
              select 1
              from public.assessment_attempt_questions aq
              join public.assessment_attempts a on a.id = aq.attempt_id
              where aq.question_id = question.id and a.person_id = public.current_person_id()
            )
          )
      )
    ),
    false
  )
$$;
