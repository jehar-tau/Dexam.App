begin;
select no_plan();

-- Two coaching students and a B.Des candidate.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
select format('e3000000-0000-4000-8000-00000000000%s', n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', format('nidmock-%s@dexam.test', n), ''
from generate_series(1, 3) n;
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'e3000000-%';
insert into public.people (id, member_id, display_name)
values
  ('e3100000-0000-4000-8000-000000000001', 'DXM-RVNSTUDE2EEE', 'Fictional NID Student'),
  ('e3100000-0000-4000-8000-000000000002', null, 'Fictional NID Candidate'),
  ('e3100000-0000-4000-8000-000000000003', 'DXM-RVNSTUDE3EEE', 'Fictional NID Second Student');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('e3100000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'member_id'::public.auth_identity_kind),
  ('e3100000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000002', 'oauth_google'::public.auth_identity_kind),
  ('e3100000-0000-4000-8000-000000000003', 'e3000000-0000-4000-8000-000000000003', 'member_id'::public.auth_identity_kind);
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('e3100000-0000-4000-8000-000000000001', 'student'::public.membership_kind, 'active', now() - interval '1 day'),
  ('e3100000-0000-4000-8000-000000000002', 'candidate'::public.membership_kind, 'active', now() - interval '1 day'),
  ('e3100000-0000-4000-8000-000000000003', 'student'::public.membership_kind, 'active', now() - interval '1 day');
insert into public.candidate_profiles (person_id, level, exams, exam_year)
values ('e3100000-0000-4000-8000-000000000002', 'bdes', '{nid-bdes}', 2027);

-- A fictional drawing pool: 14 B.Des-or-both tasks across types, and 3 M.Des-only tasks
-- (on top of whatever the database already holds).
select set_config('test.base', (select count(*) from public.assessment_drawing_pool('bdes'))::text, true);
insert into public.assessment_topics (slug, name)
select 'drawing-' || t, initcap(t) from unnest(array['scene', 'story', 'product', 'communication', 'creative', 'problem']) t
on conflict (slug) do nothing;
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind, topic_id
)
select format('e3200000-0000-4000-8000-0000000000%s', lpad(n::text, 2, '0'))::uuid, format('nidpool-%s', n), 1,
  md5('nidpool' || n) || md5(n || 'nidpool'), 'descriptive', format('Fictional drawing task %s', n),
  'upload', 'ready', '{}', 'original', 'original',
  (select id from public.assessment_topics where slug = 'drawing-' || kind)
from (values
  (1, 'scene'), (2, 'scene'), (3, 'story'), (4, 'story'), (5, 'product'), (6, 'product'),
  (7, 'communication'), (8, 'communication'), (9, 'creative'), (10, 'creative'), (11, 'scene'),
  (12, 'product'), (13, 'story'), (14, 'creative'), (15, 'problem'), (16, 'problem'), (17, 'product')
) as pool(n, kind);
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select format('e3200000-0000-4000-8000-0000000000%s', lpad(n::text, 2, '0'))::uuid, 'nid', 2026,
  case when n <= 7 then 'nid-bdes-dat-mock-90' when n <= 14 then 'nid-task-collection-90' else 'nid-mdes-dat-mock-90' end,
  n::text
from generate_series(1, 17) n;

select is(public.assessment_drawing_level('uceed-2025'), 'bdes', 'UCEED Part B is B.Des');
select is(public.assessment_drawing_level('ceed-2025'), 'mdes', 'CEED Part B is M.Des');
select is(public.assessment_drawing_level('nid-task-collection-01'), 'both', 'task collections serve both levels');
select is(
  (select sum((slot ->> 'marks')::numeric) from jsonb_array_elements(public.assessment_drawing_blueprint('nid-dat-bdes-2026') -> 'slots') slot),
  100::numeric, 'the B.Des mock is out of 100'
);
select ok(not has_function_privilege('authenticated', 'public.assessment_drawing_pool(text)', 'execute'),
  'students cannot list the raw drawing pool');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e3000000-0000-4000-8000-000000000001"}';
select is(
  (select (m ->> 'pool')::integer from jsonb_array_elements(public.list_drawing_mocks()) m where m ->> 'key' = 'nid-dat-bdes-2026'),
  current_setting('test.base')::integer + 14, 'the B.Des pool gains the B.Des and both-level tasks'
);
select throws_ok($$select public.start_drawing_mock('nid-dat-2099')$$, '22023', null, 'unknown mocks are refused');

select set_config('test.mock', public.start_drawing_mock('nid-dat-bdes-2026') ->> 'attemptId', true);
select is(public.start_drawing_mock('nid-dat-bdes-2026') ->> 'attemptId', current_setting('test.mock'), 'starting again resumes it');
select is(public.get_part_b(current_setting('test.mock')::uuid) ->> 'kind', 'drawing', 'the mock is a drawing sitting');
select is((public.get_part_b(current_setting('test.mock')::uuid) ->> 'available')::integer, 6, 'six tasks are pinned');
select is(jsonb_array_length(public.get_part_b(current_setting('test.mock')::uuid) -> 'tasks'), 0, 'tasks stay hidden until drawing begins');
select is((public.get_part_b(current_setting('test.mock')::uuid) ->> 'minutes')::integer, 180, 'it runs for 3 hours');

reset role;
select is(
  (select count(distinct coalesce(substring(t.slug from '^drawing-(.*)$'), '?'))::integer
     from public.assessment_attempt_tasks x
     join public.assessment_questions q on q.id = x.question_id
     join public.assessment_topics t on t.id = q.topic_id
     where x.attempt_id = current_setting('test.mock')::uuid),
  5, 'the mock mixes five kinds of task plus one more'
);
select is(
  (select count(*)::integer from public.assessment_attempt_tasks x
     join public.assessment_question_provenance p on p.question_id = x.question_id
     where x.attempt_id = current_setting('test.mock')::uuid and p.paper_id = 'nid-mdes-dat-mock-90'),
  0, 'no M.Des-only task enters a B.Des mock'
);
set local role authenticated;

select set_config('test.began', public.begin_part_b(current_setting('test.mock')::uuid)::text, true);
select is(jsonb_array_length(current_setting('test.began')::jsonb -> 'tasks'), 6, 'beginning shows the six tasks');
select is((current_setting('test.began')::jsonb ->> 'maxScore')::numeric, 100::numeric, 'with their marks adding to 100');
select ok(
  (current_setting('test.began')::jsonb ->> 'drawingDeadline')::timestamptz
    between now() + interval '179 minutes' and now() + interval '181 minutes',
  'and the 3-hour clock'
);

-- Finish it, then a second mock prefers the tasks not yet seen.
reset role;
update public.assessment_attempts set part_b_status = 'submitted', part_b_submitted_at = now()
  where id = current_setting('test.mock')::uuid;
set local role authenticated;
select set_config('test.mock2', public.start_drawing_mock('nid-dat-bdes-2026') ->> 'attemptId', true);
select isnt(current_setting('test.mock2'), current_setting('test.mock'), 'a new mock is built after the first is done');
reset role;
select is(
  (select count(*)::integer from public.assessment_attempt_tasks a
     join public.assessment_attempt_tasks b on b.question_id = a.question_id
     where a.attempt_id = current_setting('test.mock2')::uuid and b.attempt_id = current_setting('test.mock')::uuid),
  0, 'the second mock repeats no task while new ones remain'
);

-- The draw is random, so check the rules over many draws: 200 times, build a first mock, finish it
-- and build a second (each pass rolled back), keeping the worst case seen. A pass that broke a rule
-- one time in ten would almost surely show here.
set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"e3000000-0000-4000-8000-000000000003"}';
do $$
declare
  v_first uuid;
  v_second uuid;
  v_value integer;
  v_passes integer := 0;
  v_fewest_kinds integer := 5;
  v_most_mdes integer := 0;
  v_most_repeats integer := 0;
begin
  for i in 1 .. 200 loop
    begin
      v_first := (public.start_drawing_mock('nid-dat-bdes-2026') ->> 'attemptId')::uuid;
      select count(distinct t.slug) into v_value
        from public.assessment_attempt_tasks x
        join public.assessment_questions q on q.id = x.question_id
        join public.assessment_topics t on t.id = q.topic_id
        where x.attempt_id = v_first
          and t.slug in ('drawing-scene', 'drawing-story', 'drawing-product', 'drawing-communication', 'drawing-creative');
      v_fewest_kinds := least(v_fewest_kinds, v_value);
      select count(*) into v_value
        from public.assessment_attempt_tasks x
        join public.assessment_question_provenance p on p.question_id = x.question_id
        where x.attempt_id = v_first and p.paper_id = 'nid-mdes-dat-mock-90';
      v_most_mdes := greatest(v_most_mdes, v_value);
      update public.assessment_attempts set part_b_status = 'submitted', part_b_submitted_at = now()
        where id = v_first;
      v_second := (public.start_drawing_mock('nid-dat-bdes-2026') ->> 'attemptId')::uuid;
      select count(*) into v_value
        from public.assessment_attempt_tasks a
        join public.assessment_attempt_tasks b on b.question_id = a.question_id
        where a.attempt_id = v_second and b.attempt_id = v_first;
      v_most_repeats := greatest(v_most_repeats, v_value);
      v_passes := v_passes + 1;
      raise exception using errcode = 'DXT00';
    exception when sqlstate 'DXT00' then
      null;
    end;
  end loop;
  perform set_config('test.passes', v_passes::text, true);
  perform set_config('test.fewest_kinds', v_fewest_kinds::text, true);
  perform set_config('test.most_mdes', v_most_mdes::text, true);
  perform set_config('test.most_repeats', v_most_repeats::text, true);
end;
$$;
select is(current_setting('test.passes')::integer, 200, 'two hundred random draws ran');
select is(current_setting('test.fewest_kinds')::integer, 5, 'every draw has a scene, story, product, communication and creative task');
select is(current_setting('test.most_mdes')::integer, 0, 'no draw puts an M.Des-only task in a B.Des mock');
select is(current_setting('test.most_repeats')::integer, 0, 'no second mock repeats a task while new ones remain');

-- When a slot's type has no unseen task left, an unseen task of another type beats a repeat.
insert into public.assessment_attempts (
  id, person_id, paper_id, exam, status, started_at, submitted_at, submit_reason,
  duration_minutes, objective_count, marking, kind, title, drawing_minutes, part_b_status, part_b_submitted_at
)
values (
  'e3300000-0000-4000-8000-000000000001', 'e3100000-0000-4000-8000-000000000003', 'mock-nid-dat-bdes-2026',
  'nid', 'submitted', now(), now(), 'candidate', 180, 0, '{}'::jsonb, 'drawing', 'NID DAT B.Des drawing mock',
  180, 'submitted', now()
);
insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
values
  ('e3300000-0000-4000-8000-000000000001', 'e3200000-0000-4000-8000-000000000007', 0, 20),
  ('e3300000-0000-4000-8000-000000000001', 'e3200000-0000-4000-8000-000000000008', 1, 20);
select set_config('test.mock3', public.start_drawing_mock('nid-dat-bdes-2026') ->> 'attemptId', true);
select is(
  (select count(*)::integer from public.assessment_attempt_tasks where attempt_id = current_setting('test.mock3')::uuid),
  6, 'a mock still gets six tasks once one type is used up'
);
select is(
  (select count(*)::integer from public.assessment_attempt_tasks
     where attempt_id = current_setting('test.mock3')::uuid
       and question_id in ('e3200000-0000-4000-8000-000000000007', 'e3200000-0000-4000-8000-000000000008')),
  0, 'and it repeats neither communication task the student already drew'
);

-- The candidate gets one free drawing mock.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e3000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e3000000-0000-4000-8000-000000000002"}';
select ok(public.start_drawing_mock('nid-dat-bdes-2026') ? 'attemptId', 'a candidate can start a free mock');
reset role;
update public.assessment_attempts set part_b_status = 'submitted', part_b_submitted_at = now()
  where person_id = 'e3100000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select public.start_drawing_mock('nid-dat-bdes-2026')$$, 'DX001', null, 'but only one without a plan');
select throws_ok(
  format($$select public.get_part_b(%L)$$, current_setting('test.mock')),
  '42501', null, 'another person''s mock stays private'
);

reset role;
set local role anon;
select throws_ok($$select public.list_drawing_mocks()$$, '42501', null, 'signed-out visitors cannot list drawing mocks');

select * from finish();
rollback;
