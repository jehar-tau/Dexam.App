begin;
select no_plan();

-- Golden scoring cases, generated from src/features/testSeries/scoringGolden.json (keep in step).
select results_eq($$select outcome, marks from public.assessment_score_response('mcq', '{"kind": "choice", "correct": ["B"]}'::jsonb, '"B"'::jsonb, '{"correct": 3, "wrong": -0.71}'::jsonb)$$, $$values ('correct'::text, 3::numeric)$$, 'golden: mcq correct');
select results_eq($$select outcome, marks from public.assessment_score_response('mcq', '{"kind": "choice", "correct": ["B"]}'::jsonb, '"C"'::jsonb, '{"correct": 3, "wrong": -0.71}'::jsonb)$$, $$values ('wrong'::text, -0.71::numeric)$$, 'golden: mcq wrong');
select results_eq($$select outcome, marks from public.assessment_score_response('mcq', '{"kind": "choice", "correct": ["A", "B"]}'::jsonb, '"A"'::jsonb, '{"correct": 3, "wrong": -0.71}'::jsonb)$$, $$values ('correct'::text, 3::numeric)$$, 'golden: mcq either accepted');
select results_eq($$select outcome, marks from public.assessment_score_response('mcq', '{"kind": "choice", "correct": ["B"]}'::jsonb, null, '{"correct": 3, "wrong": -0.71}'::jsonb)$$, $$values ('unanswered'::text, 0::numeric)$$, 'golden: mcq unanswered');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["A", "C", "D"]}'::jsonb, '["D", "A", "C"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: msq exact');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["A", "B", "C", "D"]}'::jsonb, '["A", "B", "C"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('partial'::text, 3::numeric)$$, 'golden: msq all four, three chosen');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["A", "C", "D"]}'::jsonb, '["A", "D"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('partial'::text, 2::numeric)$$, 'golden: msq three correct, two chosen');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["B", "C"]}'::jsonb, '["C"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('partial'::text, 1::numeric)$$, 'golden: msq two correct, one chosen');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["A", "C"]}'::jsonb, '["A", "B"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('wrong'::text, -1::numeric)$$, 'golden: msq any wrong option');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["A"]}'::jsonb, '[]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('unanswered'::text, 0::numeric)$$, 'golden: msq empty');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "alternatives": [["B"], ["B", "C"]]}'::jsonb, '["B", "C"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: msq alternatives exact');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "alternatives": [["B"], ["B", "C"]]}'::jsonb, '["B"]'::jsonb, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: msq alternatives single');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "multi", "correct": ["A", "C"]}'::jsonb, '["A"]'::jsonb, '{"correct": 1, "wrong": 0, "practice": true}'::jsonb)$$, $$values ('wrong'::text, 0::numeric)$$, 'golden: msq practice subset is wrong');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"exact": 12}]}'::jsonb, '"12"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: nat exact');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"exact": 2}]}'::jsonb, '"2.00"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: nat exact with zeros');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"exact": 7}, {"exact": 9}]}'::jsonb, '"9"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: nat alternative');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"range": [92.9, 94.6]}]}'::jsonb, '"94.6"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: nat in range');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"range": [92.9, 94.6]}]}'::jsonb, '"94.61"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('wrong'::text, 0::numeric)$$, 'golden: nat out of range');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"exact": -3.5}]}'::jsonb, '"-3.5"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('correct'::text, 4::numeric)$$, 'golden: nat negative');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"exact": 1}]}'::jsonb, '"-"'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('wrong'::text, 0::numeric)$$, 'golden: nat not a number');
select results_eq($$select outcome, marks from public.assessment_score_response('nat', '{"kind": "numeric", "accepted": [{"exact": 1}]}'::jsonb, '"  "'::jsonb, '{"correct": 4, "wrong": 0}'::jsonb)$$, $$values ('unanswered'::text, 0::numeric)$$, 'golden: nat blank');
select results_eq($$select outcome, marks from public.assessment_score_response('mcq', '{"kind": "dropped"}'::jsonb, '"A"'::jsonb, '{"correct": 3, "wrong": -0.71}'::jsonb)$$, $$values ('dropped'::text, 0::numeric)$$, 'golden: dropped');
select results_eq($$select outcome, marks from public.assessment_score_response('msq', '{"kind": "full_marks"}'::jsonb, null, '{"correct": 4, "wrong": -1, "partial": true}'::jsonb)$$, $$values ('full_marks'::text, 4::numeric)$$, 'golden: full marks');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'attempt-student-a@dexam.test', ''),
  ('f0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'attempt-student-b@dexam.test', '');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'f0000000-%';

insert into public.people (id, member_id, display_name)
values
  ('f1000000-0000-4000-8000-000000000001', 'DXM-ATTEMPTSTA2A', 'Fictional Attempt Student A'),
  ('f1000000-0000-4000-8000-000000000002', 'DXM-ATTEMPTSTB2B', 'Fictional Attempt Student B');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'member_id'),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'member_id');
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('f1000000-0000-4000-8000-000000000001', 'student', 'active', now() - interval '1 day'),
  ('f1000000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day');

insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
values
  ('f2000000-0000-4000-8000-000000000001', 'fictionx-2026-q1', 1, repeat('1', 64), 'nat', 'Fictional NAT', 'auto', 'ready', '{}', 'original', 'original'),
  ('f2000000-0000-4000-8000-000000000002', 'fictionx-2026-q2', 1, repeat('2', 64), 'msq', 'Fictional MSQ', 'auto', 'ready', '{}', 'original', 'original'),
  ('f2000000-0000-4000-8000-000000000003', 'fictionx-2026-q3', 1, repeat('3', 64), 'mcq', 'Fictional MCQ', 'auto', 'ready', '{}', 'original', 'original'),
  ('f2000000-0000-4000-8000-000000000004', 'fictionx-2026-q4', 1, repeat('4', 64), 'mcq', 'Fictional held MCQ', 'auto', 'quarantined', '{unparsed-key}', 'original', 'original');
insert into public.assessment_question_options (question_id, option_key, body, position)
values
  ('f2000000-0000-4000-8000-000000000002', 'A', 'One', 0), ('f2000000-0000-4000-8000-000000000002', 'B', 'Two', 1),
  ('f2000000-0000-4000-8000-000000000002', 'C', 'Three', 2), ('f2000000-0000-4000-8000-000000000002', 'D', 'Four', 3),
  ('f2000000-0000-4000-8000-000000000003', 'A', 'Yes', 0), ('f2000000-0000-4000-8000-000000000003', 'B', 'No', 1);
insert into public.assessment_question_keys (question_id, answer, answer_status, explanation, explanation_status)
values
  ('f2000000-0000-4000-8000-000000000001', '{"kind":"numeric","accepted":[{"exact":8}]}', 'official-key', 'A cube has eight corners.', 'verified'),
  ('f2000000-0000-4000-8000-000000000002', '{"kind":"multi","correct":["A","C","D"]}', 'official-key', 'Unverified note', 'pending'),
  ('f2000000-0000-4000-8000-000000000003', '{"kind":"choice","correct":["B"]}', 'official-key', null, 'pending');
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
values
  ('f2000000-0000-4000-8000-000000000001', 'uceed', 2026, 'fictionx-2026', '1'),
  ('f2000000-0000-4000-8000-000000000002', 'uceed', 2026, 'fictionx-2026', '2'),
  ('f2000000-0000-4000-8000-000000000003', 'uceed', 2026, 'fictionx-2026', '3'),
  ('f2000000-0000-4000-8000-000000000004', 'uceed', 2026, 'fictionx-2026', '4');

select ok(
  not has_table_privilege('authenticated', 'public.assessment_attempts', 'select')
  and not has_table_privilege('authenticated', 'public.assessment_attempt_questions', 'select')
  and not has_function_privilege('authenticated', 'public.assessment_score_response(text, jsonb, jsonb, jsonb)', 'execute'),
  'browser roles have no direct access to attempts or the scorer'
);

set local role anon;
select throws_ok($$select public.open_assessment_attempt('fictionx-2026')$$, '42501', null, 'anon cannot open an attempt');
reset role;

-- Student A opens, begins and submits.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000001"}';
select set_config('test.paper', public.get_assessment_student_paper('fictionx-2026')::text, true);
select is((current_setting('test.paper')::jsonb ->> 'durationMinutes')::integer, 90, 'paper time is the official minutes scaled to ready questions');
select is(current_setting('test.paper')::jsonb -> 'marking' -> 'mcq', '{"correct":3,"wrong":-0.71}'::jsonb, 'paper carries the server marking');
select set_config('test.attempt', public.open_assessment_attempt('fictionx-2026')::text, true);
select is(jsonb_array_length(current_setting('test.attempt')::jsonb -> 'questions'), 3, 'the attempt pins the ready questions');
select ok(position('"kind"' in current_setting('test.attempt')) = 0, 'the open attempt carries no keys');
select is(
  public.open_assessment_attempt('fictionx-2026') ->> 'attemptId',
  current_setting('test.attempt')::jsonb ->> 'attemptId',
  'opening again resumes the same attempt'
);
select throws_ok(
  format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  '22023', null, 'an attempt cannot be submitted before it begins'
);
select throws_ok(
  format($$select public.get_assessment_attempt_result(%L)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  '42501', null, 'no result before submission'
);
select set_config('test.begin', public.begin_assessment_attempt((current_setting('test.attempt')::jsonb ->> 'attemptId')::uuid)::text, true);
select ok((current_setting('test.begin')::jsonb ->> 'deadline')::timestamptz > now() + interval '89 minutes', 'the server sets the deadline');
select is(
  public.begin_assessment_attempt((current_setting('test.attempt')::jsonb ->> 'attemptId')::uuid) ->> 'deadline',
  current_setting('test.begin')::jsonb ->> 'deadline',
  'beginning again keeps the deadline'
);
select throws_ok(
  format($$select public.submit_assessment_attempt(%L, '{"f2000000-0000-4000-8000-000000000004":"A"}'::jsonb)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  '22023', null, 'responses for questions outside the attempt are refused'
);
select throws_ok(
  format($$select public.submit_assessment_attempt(%L, '{"f2000000-0000-4000-8000-000000000002":["A","Z"]}'::jsonb)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  '22023', null, 'malformed responses are refused'
);
reset role;

-- Student B cannot touch A's attempt.
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select throws_ok(
  format($$select public.begin_assessment_attempt(%L)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  '42501', null, 'another student cannot begin the attempt'
);
select throws_ok(
  format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  '42501', null, 'another student cannot submit the attempt'
);
select is((select count(*) from public.list_assessment_attempts()), 0::bigint, 'another student sees no attempts');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000001"}';
select is(
  public.submit_assessment_attempt(
    (current_setting('test.attempt')::jsonb ->> 'attemptId')::uuid,
    '{"f2000000-0000-4000-8000-000000000001":"8","f2000000-0000-4000-8000-000000000002":["A","D"],"f2000000-0000-4000-8000-000000000003":"A"}'::jsonb
  ) - 'attemptId',
  '{"score": 5.29, "maxScore": 11.00}'::jsonb,
  'the server scores the attempt: 4 + 2 (partial) - 0.71'
);
select is(
  public.submit_assessment_attempt((current_setting('test.attempt')::jsonb ->> 'attemptId')::uuid, '{}'::jsonb) - 'attemptId',
  '{"score": 5.29, "maxScore": 11.00}'::jsonb,
  'submitting again returns the first result'
);
select set_config('test.result', public.get_assessment_attempt_result((current_setting('test.attempt')::jsonb ->> 'attemptId')::uuid)::text, true);
select results_eq(
  $$select q ->> 'outcome', q ->> 'response', q ->> 'explanation'
    from jsonb_array_elements(current_setting('test.result')::jsonb -> 'questions') q$$,
  $$values ('correct'::text, '8'::text, 'A cube has eight corners.'::text), ('partial', '["A", "D"]', null), ('wrong', 'A', null)$$,
  'the result shows outcomes and only verified explanations'
);
select is(
  current_setting('test.result')::jsonb -> 'questions' -> 2 -> 'key',
  '{"kind":"choice","correct":["B"]}'::jsonb,
  'keys are released with the result'
);
select ok(position('original' in current_setting('test.result')) = 0, 'the result carries no licence or provenance');
select is((select count(*) from public.list_assessment_attempts() where status = 'submitted'), 1::bigint, 'the student sees their attempt');
select isnt(
  public.open_assessment_attempt('fictionx-2026') ->> 'attemptId',
  current_setting('test.attempt')::jsonb ->> 'attemptId',
  'after submission a new attempt can be opened'
);
reset role;

-- A retired question stays reviewable: figures of attempted questions remain readable.
insert into public.assessment_question_assets (question_id, role, storage_path, sha256, mime_type)
values ('f2000000-0000-4000-8000-000000000003', 'figure', 'fictionx/q3.png', repeat('a', 64), 'image/png');
insert into storage.objects (bucket_id, name, owner_id) values ('assessment-media', 'fictionx/q3.png', null);
update public.assessment_questions set publication_state = 'retired' where id = 'f2000000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000001"}';
select is((select count(*) from storage.objects where name = 'fictionx/q3.png'), 1::bigint, 'an attempted retired figure stays readable');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select is((select count(*) from storage.objects where name = 'fictionx/q3.png'), 0::bigint, 'other students cannot read a retired figure');
reset role;

select * from finish();
rollback;
