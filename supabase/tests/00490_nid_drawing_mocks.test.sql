begin;
select no_plan();

-- A coaching student and a B.Des candidate.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
select format('e3000000-0000-4000-8000-00000000000%s', n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', format('nidmock-%s@dexam.test', n), ''
from generate_series(1, 2) n;
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'e3000000-%';
insert into public.people (id, member_id, display_name)
values
  ('e3100000-0000-4000-8000-000000000001', 'DXM-RVNSTUDE2EEE', 'Fictional NID Student'),
  ('e3100000-0000-4000-8000-000000000002', null, 'Fictional NID Candidate');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('e3100000-0000-4000-8000-000000000001', 'e3000000-0000-4000-8000-000000000001', 'member_id'::public.auth_identity_kind),
  ('e3100000-0000-4000-8000-000000000002', 'e3000000-0000-4000-8000-000000000002', 'oauth_google'::public.auth_identity_kind);
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('e3100000-0000-4000-8000-000000000001', 'student'::public.membership_kind, 'active', now() - interval '1 day'),
  ('e3100000-0000-4000-8000-000000000002', 'candidate'::public.membership_kind, 'active', now() - interval '1 day');
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
