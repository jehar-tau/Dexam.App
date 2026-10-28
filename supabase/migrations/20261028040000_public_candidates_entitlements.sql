-- F039 public candidates and F041 entitlements (redesign step 6).
-- A public candidate signs in with Google, gets a person record with a candidate membership, and
-- chooses B.Des or M.Des. The test series accepts students and candidates; the coaching portal
-- stays students-only. Coaching students can open every paper. A candidate can open one paper of
-- their choice per exam of their level for free, plus any paper they are entitled to later.
-- Enabling Google sign-up itself is an auth configuration change behind Decision Gate D-058.

alter type public.membership_kind add value if not exists 'candidate';
alter type public.auth_identity_kind add value if not exists 'oauth_google';

create table public.candidate_profiles (
  person_id uuid primary key references public.people (id) on delete cascade,
  level text not null check (level in ('bdes', 'mdes')),
  exams text[] not null default '{}' check (
    exams <@ array['uceed', 'ceed', 'nid-bdes', 'nid-mdes', 'nift-bdes', 'nift-mdes']
    and cardinality(exams) <= 6
  ),
  exam_year integer check (exam_year between 2025 and 2035),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assessment_entitlements (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete cascade,
  source text not null check (source in ('free-onboarding', 'purchase', 'grant')),
  paper_id text not null check (paper_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  -- For free papers: which per-exam slot the paper used.
  free_slot text check (free_slot in ('uceed', 'ceed', 'nid-bdes', 'nid-mdes', 'nift-bdes', 'nift-mdes')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (person_id, paper_id),
  constraint assessment_entitlements_free_slot check ((source = 'free-onboarding') = (free_slot is not null))
);

-- One free paper per exam slot.
create unique index assessment_entitlements_one_free_per_slot
  on public.assessment_entitlements (person_id, free_slot)
  where free_slot is not null;

alter table public.candidate_profiles enable row level security;
alter table public.assessment_entitlements enable row level security;
revoke all on public.candidate_profiles, public.assessment_entitlements from public, anon, authenticated;
grant all on public.candidate_profiles, public.assessment_entitlements to service_role;
-- No browser grants: profiles and entitlements are read and written through the functions below.

create function public.current_person_has_active_candidate_membership()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  return coalesce(exists (
    select 1
    from public.people p
    join public.memberships m on m.person_id = p.id
    where p.id = public.current_person_id()
      and p.status = 'active'
      and m.kind::text = 'candidate'
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  ), false);
end;
$$;

-- Who may use the test series: coaching students and public candidates.
create function public.current_person_can_take_tests()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.current_person_has_active_student_membership()
    or public.current_person_has_active_candidate_membership()
$$;

-- The free-paper slot a bank paper belongs to, if any.
create function public.assessment_free_slot(p_paper_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_paper_id like 'uceed-%' then 'uceed'
    when p_paper_id like 'ceed-%' then 'ceed'
    when p_paper_id like 'nid-bdes-%' then 'nid-bdes'
    when p_paper_id like 'nid-mdes-%' then 'nid-mdes'
    when p_paper_id like 'nift-%' and p_paper_id like '%bdes%' then 'nift-bdes'
    when p_paper_id like 'nift-%' and p_paper_id like '%mdes%' then 'nift-mdes'
  end
$$;

create function public.assessment_level_slots(p_level text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select case p_level
    when 'bdes' then array['uceed', 'nid-bdes', 'nift-bdes']
    when 'mdes' then array['ceed', 'nid-mdes', 'nift-mdes']
    else '{}'::text[]
  end
$$;

create function public.current_person_can_open_paper(p_paper_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_slot text := public.assessment_free_slot(p_paper_id);
begin
  if public.current_person_has_active_student_membership() then
    return true;
  end if;
  if not public.current_person_has_active_candidate_membership() then
    return false;
  end if;
  if exists (
    select 1 from public.assessment_entitlements e
    where e.person_id = v_person and e.paper_id = p_paper_id
      and (e.expires_at is null or e.expires_at > now())
  ) then
    return true;
  end if;
  return v_slot is not null
    and v_slot = any (public.assessment_level_slots(
      (select level from public.candidate_profiles where person_id = v_person)
    ))
    and not exists (
      select 1 from public.assessment_entitlements e
      where e.person_id = v_person and e.free_slot = v_slot
    );
end;
$$;

-- Records a candidate's free paper the first time they open it (students need no record).
create function public.assessment_claim_paper(p_paper_id text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
begin
  if public.current_person_has_active_student_membership()
    or exists (
      select 1 from public.assessment_entitlements
      where person_id = v_person and paper_id = p_paper_id
    ) then
    return;
  end if;
  insert into public.assessment_entitlements (person_id, source, paper_id, free_slot)
  values (v_person, 'free-onboarding', p_paper_id, public.assessment_free_slot(p_paper_id));
end;
$$;

revoke all on function
  public.current_person_has_active_candidate_membership(),
  public.current_person_can_take_tests(),
  public.assessment_free_slot(text),
  public.assessment_level_slots(text),
  public.current_person_can_open_paper(text),
  public.assessment_claim_paper(text)
from public, anon;
revoke all on function public.assessment_claim_paper(text) from authenticated;
grant execute on function
  public.current_person_has_active_candidate_membership(),
  public.current_person_can_take_tests(),
  public.assessment_free_slot(text),
  public.assessment_level_slots(text),
  public.current_person_can_open_paper(text)
to authenticated, service_role;
grant execute on function public.assessment_claim_paper(text) to service_role;

-- First sign-in with Google: create the person, link the Google login and start a candidate
-- membership. Only for logins that really came from Google and are not already linked; a coaching
-- Member ID is never linked automatically (F039 Decision Gate).
create function public.provision_google_candidate()
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_user uuid := auth.uid();
  v_person uuid;
  v_name text;
begin
  if v_user is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if exists (select 1 from public.auth_identities where auth_user_id = v_user) then
    return jsonb_build_object('created', false);
  end if;
  if not exists (
    select 1 from auth.identities where user_id = v_user and provider = 'google'
  ) then
    raise exception 'Only Google sign-ins can create a test-series account.' using errcode = '42501';
  end if;

  select left(nullif(btrim(coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      ''
    )), ''), 120)
    into v_name
    from auth.users u where u.id = v_user;

  insert into public.people (display_name) values (coalesce(v_name, 'Dexam candidate'))
    returning id into v_person;
  insert into public.auth_identities (person_id, auth_user_id, kind)
    values (v_person, v_user, 'oauth_google'::text::public.auth_identity_kind);
  insert into public.memberships (person_id, kind, status, starts_at)
    values (v_person, 'candidate'::text::public.membership_kind, 'active', now());
  return jsonb_build_object('created', true);
end;
$$;

-- What the signed-in person can do in the test series.
create function public.get_test_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_person uuid := public.current_person_id();
  v_profile public.candidate_profiles;
  v_kind text;
begin
  if public.current_person_has_active_student_membership() then
    v_kind := 'student';
  elsif public.current_person_has_active_candidate_membership() then
    v_kind := 'candidate';
  else
    return jsonb_build_object('kind', null);
  end if;
  select * into v_profile from public.candidate_profiles where person_id = v_person;
  return jsonb_build_object(
    'kind', v_kind,
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
$$;

create function public.save_candidate_profile(p_level text, p_exams text[], p_exam_year integer)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_has_active_candidate_membership() then
    raise exception 'Only test-series candidates have a profile here.' using errcode = '42501';
  end if;
  if p_level not in ('bdes', 'mdes')
    or p_exams is null
    or not (p_exams <@ public.assessment_level_slots(p_level))
    or (p_exam_year is not null and p_exam_year not between 2025 and 2035) then
    raise exception 'Invalid profile.' using errcode = '22023';
  end if;
  insert into public.candidate_profiles (person_id, level, exams, exam_year)
  values (public.current_person_id(), p_level, p_exams, p_exam_year)
  on conflict (person_id) do update
    set level = excluded.level, exams = excluded.exams, exam_year = excluded.exam_year, updated_at = now();
end;
$$;

revoke all on function
  public.provision_google_candidate(),
  public.get_test_access(),
  public.save_candidate_profile(text, text[], integer)
from public, anon;
grant execute on function
  public.provision_google_candidate(),
  public.get_test_access(),
  public.save_candidate_profile(text, text[], integer)
to authenticated;

-- The assessment functions now admit candidates too; opening a paper also checks access.
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
      public.current_person_can_take_tests()
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
  if not public.current_person_can_take_tests() then
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

create or replace function public.list_assessment_student_papers()
returns table (paper_id text, ready_count integer, objective_count integer)
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
    select
      p.paper_id,
      (count(*) filter (where q.publication_state = 'ready'))::integer,
      count(*)::integer
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where q.publication_state <> 'retired' and q.response_mode = 'auto'
    group by p.paper_id;
end;
$$;

create or replace function public.open_assessment_attempt(p_paper_id text)
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
  if not public.current_person_can_take_tests() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  if p_paper_id is null or p_paper_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid paper.' using errcode = '22023';
  end if;

  if not public.current_person_can_open_paper(p_paper_id) then
    raise exception 'This paper is not included in your access.' using errcode = 'DX001';
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

  perform public.assessment_claim_paper(p_paper_id);

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

create or replace function public.begin_assessment_attempt(p_attempt_id uuid)
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
  if v_attempt.id is null or not public.current_person_can_take_tests() then
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

create or replace function public.submit_assessment_attempt(
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
  if v_attempt.id is null or not public.current_person_can_take_tests() then
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
  if v_attempt.id is null or not public.current_person_can_take_tests() then
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
    where a.person_id = public.current_person_id()
    order by a.opened_at desc
    limit 200;
end;
$$;

create or replace function public.get_assessment_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_take_tests()
    or not exists (
      select 1 from public.assessment_attempts
      where id = p_attempt_id and person_id = public.current_person_id() and status <> 'submitted'
    ) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  return public.assessment_attempt_payload(p_attempt_id);
end;
$$;

create or replace function public.list_assessment_practice_topics(p_exam text default null)
returns table (slug text, name text, ready_count integer, unseen_count integer)
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

create or replace function public.start_assessment_practice(
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
  if not public.current_person_can_take_tests() then
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
