-- F040 mock generator (redesign step 8a). A mock is built per student from the common bank to a
-- 2026 blueprint: each section is filled with ready questions of that type the student has never
-- seen in any attempt (paper, practice or mock), same-exam questions first, then mixed in from
-- other exams. If the bank runs short the mock is smaller and its time is scaled. Mocks are
-- attempts of kind 'mock' and use the normal exam window, scoring and results.

alter table public.assessment_attempts drop constraint assessment_attempts_kind_check;
alter table public.assessment_attempts
  add constraint assessment_attempts_kind_check check (kind in ('paper', 'practice', 'mock'));

-- 2026 blueprints (Part A). UCEED and CEED are verified against the 2026 brochures; NIFT GAT
-- counts and timing are the draft blueprint, interim until the owner confirms. NID waits for
-- the confirmed 2026 format.
create function public.assessment_blueprint(p_key text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case p_key
    when 'uceed-2026' then '{"key":"uceed-2026","exam":"uceed","level":"bdes","title":"UCEED 2026 mock","minutes":120,"sections":[{"type":"nat","count":14},{"type":"msq","count":15},{"type":"mcq","count":28}]}'::jsonb
    when 'ceed-2026' then '{"key":"ceed-2026","exam":"ceed","level":"mdes","title":"CEED 2026 mock","minutes":60,"sections":[{"type":"nat","count":8},{"type":"msq","count":10},{"type":"mcq","count":26}]}'::jsonb
    when 'nift-bdes-2026' then '{"key":"nift-bdes-2026","exam":"nift","level":"bdes","title":"NIFT B.Des GAT 2026 mock","minutes":120,"sections":[{"type":"mcq","count":100}]}'::jsonb
    when 'nift-mdes-2026' then '{"key":"nift-mdes-2026","exam":"nift","level":"mdes","title":"NIFT M.Des GAT 2026 mock","minutes":150,"sections":[{"type":"mcq","count":120}]}'::jsonb
  end
$$;

create function public.assessment_blueprint_keys()
returns text[]
language sql
immutable
set search_path = ''
as $$ select array['uceed-2026', 'ceed-2026', 'nift-bdes-2026', 'nift-mdes-2026'] $$;

-- Ready objective questions of a type that the person has never been served.
create function public.assessment_unseen_count(p_person uuid, p_type text)
returns integer
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select count(*)::integer
  from public.assessment_questions q
  where q.publication_state = 'ready'
    and q.response_mode = 'auto'
    and q.question_type = p_type
    and not exists (
      select 1
      from public.assessment_attempt_questions aq
      join public.assessment_attempts a on a.id = aq.attempt_id
      where aq.question_id = q.id and a.person_id = p_person
    )
$$;

-- Candidates get one free mock per blueprint; coaching students have unlimited mocks.
create function public.current_person_can_start_mock(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.assessment_blueprint(p_key) is not null and (
    public.current_person_has_active_student_membership()
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
$$;

create function public.list_assessment_mocks()
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
      blueprint || jsonb_build_object(
        'available', (
          select coalesce(sum(least((section ->> 'count')::integer, public.assessment_unseen_count(v_person, section ->> 'type'))), 0)
          from jsonb_array_elements(blueprint -> 'sections') section
        ),
        'total', (select sum((section ->> 'count')::integer) from jsonb_array_elements(blueprint -> 'sections') section),
        'taken', (
          select count(*) from public.assessment_attempts a
          where a.person_id = v_person and a.kind = 'mock' and a.paper_id = 'mock-' || (blueprint ->> 'key') and a.status = 'submitted'
        ),
        'openAttemptId', (
          select a.id from public.assessment_attempts a
          where a.person_id = v_person and a.paper_id = 'mock-' || (blueprint ->> 'key') and a.status <> 'submitted'
        ),
        'canStart', public.current_person_can_start_mock(blueprint ->> 'key')
      )
      order by ordinality
    )
    from unnest(public.assessment_blueprint_keys()) with ordinality as item(key, ordinality),
      lateral (select public.assessment_blueprint(item.key) as blueprint) b
  );
end;
$$;

-- Builds (or resumes) the person's mock for a blueprint and returns the attempt payload.
create function public.start_assessment_mock(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_blueprint jsonb := public.assessment_blueprint(p_key);
  v_paper text := 'mock-' || coalesce(p_key, '');
  v_attempt uuid;
  v_section jsonb;
  v_position integer := 0;
  v_total integer := 0;
  v_filled integer := 0;
  v_exam text;
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  if v_blueprint is null then
    raise exception 'Unknown mock.' using errcode = '22023';
  end if;
  select id into v_attempt from public.assessment_attempts
    where person_id = v_person and paper_id = v_paper and status <> 'submitted';
  if v_attempt is not null then
    return public.assessment_attempt_payload(v_attempt);
  end if;
  if not public.current_person_can_start_mock(p_key) then
    raise exception 'This mock is not included in your access.' using errcode = 'DX001';
  end if;
  v_exam := v_blueprint ->> 'exam';

  insert into public.assessment_attempts (
    person_id, paper_id, exam, kind, title, timed, duration_minutes, objective_count, marking
  )
  values (
    v_person, v_paper, v_exam, 'mock', v_blueprint ->> 'title', true, 1, 0,
    jsonb_build_object(
      'nat', public.assessment_marking(v_exam, 'nat'),
      'msq', public.assessment_marking(v_exam, 'msq'),
      'mcq', public.assessment_marking(v_exam, 'mcq')
    )
  )
  returning id into v_attempt;

  for v_section in select * from jsonb_array_elements(v_blueprint -> 'sections') loop
    v_total := v_total + (v_section ->> 'count')::integer;
    with picked as (
      select q.id,
        row_number() over (order by (p.exam = v_exam) desc, random()) as rn
      from public.assessment_questions q
      join public.assessment_question_provenance p on p.question_id = q.id
      where q.publication_state = 'ready'
        and q.response_mode = 'auto'
        and q.question_type = v_section ->> 'type'
        and not exists (
          select 1
          from public.assessment_attempt_questions aq
          join public.assessment_attempts a on a.id = aq.attempt_id
          where aq.question_id = q.id and a.person_id = v_person
        )
    )
    insert into public.assessment_attempt_questions (attempt_id, question_id, position)
    select v_attempt, picked.id, (v_position + picked.rn - 1)::smallint
    from picked
    where picked.rn <= (v_section ->> 'count')::integer;
    get diagnostics v_filled = row_count;
    v_position := v_position + v_filled;
  end loop;

  if v_position = 0 then
    raise exception 'You have seen every reviewed question for this mock.' using errcode = 'P0002';
  end if;

  update public.assessment_attempts
    set objective_count = v_total,
        duration_minutes = greatest(5, round((v_blueprint ->> 'minutes')::numeric * v_position / v_total)::integer)
    where id = v_attempt;

  return public.assessment_attempt_payload(v_attempt);
end;
$$;

revoke all on function
  public.assessment_blueprint(text),
  public.assessment_blueprint_keys(),
  public.assessment_unseen_count(uuid, text),
  public.current_person_can_start_mock(text),
  public.list_assessment_mocks(),
  public.start_assessment_mock(text)
from public, anon;
revoke all on function public.assessment_unseen_count(uuid, text) from authenticated;
grant execute on function
  public.assessment_blueprint(text),
  public.assessment_blueprint_keys(),
  public.current_person_can_start_mock(text),
  public.list_assessment_mocks(),
  public.start_assessment_mock(text)
to authenticated;
grant execute on function public.assessment_unseen_count(uuid, text) to service_role;
