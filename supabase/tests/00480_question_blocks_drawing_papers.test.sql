begin;
select no_plan();

-- Two fictional students: a coaching student and a candidate with no access to the paper.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
select format('e2000000-0000-4000-8000-00000000000%s', n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', format('drawing-%s@dexam.test', n), ''
from generate_series(1, 2) n;
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'e2000000-%';
insert into public.people (id, member_id, display_name)
values
  ('e2100000-0000-4000-8000-000000000001', 'DXM-RVNSTUDD2DDD', 'Fictional Drawing Student'),
  ('e2100000-0000-4000-8000-000000000002', null, 'Fictional Drawing Candidate');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('e2100000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'member_id'::public.auth_identity_kind),
  ('e2100000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000002', 'oauth_google'::public.auth_identity_kind);
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('e2100000-0000-4000-8000-000000000001', 'student'::public.membership_kind, 'active', now() - interval '1 day'),
  ('e2100000-0000-4000-8000-000000000002', 'candidate'::public.membership_kind, 'active', now() - interval '1 day');
insert into public.candidate_profiles (person_id, level, exams, exam_year)
values ('e2100000-0000-4000-8000-000000000002', 'mdes', '{ceed}', 2027);

-- A fictional NID DAT drawing mock: three tasks with their own marks (20 + 30 + 50).
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind, task_marks
)
select format('e2200000-0000-4000-8000-00000000000%s', n)::uuid, format('drawmock-%s', n), 1,
  md5('drawmock' || n) || md5(n || 'drawmock'), 'descriptive', format('Fictional drawing task %s', n),
  'upload', 'ready', '{}', 'dexam-original', 'original', marks
from (values (1, 20), (2, 30), (3, 50)) as task(n, marks);
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select format('e2200000-0000-4000-8000-00000000000%s', n)::uuid, 'nid', 2026, 'nid-bdes-dat-mock-94', n::text
from generate_series(1, 3) n;
-- A fictional printed-block question (its crop is an ordinary figure asset).
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind, display_mode
)
values ('e2200000-0000-4000-8000-000000000009', 'drawblock-1', 1, md5('drawblock') || md5('kcolbward'),
  'mcq', 'Fictional printed question', 'auto', 'ready', '{}', 'original', 'original', 'block');
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
values ('e2200000-0000-4000-8000-000000000009', 'nid', 2026, 'nid-bdes-dat-mock-95', '1');

select has_column('public', 'assessment_questions', 'display_mode', 'questions carry a display mode');
select throws_ok(
  $$update public.assessment_questions set display_mode = 'poster' where external_key = 'drawblock-1'$$,
  '23514', null, 'display mode is text or block'
);
select is(
  public.assessment_question_payload('e2200000-0000-4000-8000-000000000009') ->> 'display', 'block',
  'the candidate payload says to show the printed block'
);
select is(public.assessment_drawing_paper_minutes('uceed', 'uceed-2025', 1), 60, 'UCEED Part B is 60 minutes');
select is(public.assessment_drawing_paper_minutes('ceed', 'ceed-2025', 5), 120, 'CEED Part B is 120 minutes');
select is(public.assessment_drawing_paper_minutes('nid', 'nid-bdes-dat-mock-01', 6), 180, 'an NID DAT drawing mock is 3 hours');
select is(public.assessment_drawing_paper_minutes('nift', 'nift-2014-bdes-cat', 2), 180, 'NIFT CAT is 3 hours');
select is(public.assessment_drawing_paper_minutes('nid', 'nid-bdes-2017', 3), 60, 'old NID drawing tasks get 20 minutes each');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e2000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e2000000-0000-4000-8000-000000000001"}';
select is(
  (select e -> 'minutes' from jsonb_array_elements(public.list_drawing_papers()) e where e ->> 'paperId' = 'nid-bdes-dat-mock-94'),
  '180'::jsonb, 'the drawing mock is listed with its 3 hours'
);
select is(
  (select (e ->> 'totalMarks')::numeric from jsonb_array_elements(public.list_drawing_papers()) e where e ->> 'paperId' = 'nid-bdes-dat-mock-94'),
  100::numeric, 'and its 100 marks'
);
select throws_ok($$select public.start_drawing_paper('../x')$$, '22023', null, 'paper ids are validated');
select throws_ok($$select public.start_drawing_paper('nid-bdes-dat-mock-96')$$, 'P0002', null, 'a paper without tasks cannot start');

select set_config('test.attempt', public.start_drawing_paper('nid-bdes-dat-mock-94') ->> 'attemptId', true);
select is(
  public.start_drawing_paper('nid-bdes-dat-mock-94') ->> 'attemptId', current_setting('test.attempt'),
  'starting again resumes the unfinished sitting'
);
select is(public.get_part_b(current_setting('test.attempt')::uuid) ->> 'kind', 'drawing', 'the sitting is a drawing paper');
select is(public.get_part_b(current_setting('test.attempt')::uuid) ->> 'status', 'none', 'nothing runs until it begins');
select is((public.get_part_b(current_setting('test.attempt')::uuid) ->> 'available')::integer, 3, 'three tasks are ready');
select is((public.get_part_b(current_setting('test.attempt')::uuid) ->> 'minutes')::integer, 180, 'with 180 minutes');

select set_config('test.began', public.begin_part_b(current_setting('test.attempt')::uuid)::text, true);
select is(current_setting('test.began')::jsonb ->> 'status', 'drawing', 'beginning starts the drawing clock');
select ok(
  (current_setting('test.began')::jsonb ->> 'drawingDeadline')::timestamptz
    between now() + interval '179 minutes' and now() + interval '181 minutes',
  'the clock runs for 3 hours'
);
select is(
  (select array_agg((t ->> 'maxMarks')::numeric order by t ->> 'number') from jsonb_array_elements(current_setting('test.began')::jsonb -> 'tasks') t),
  array[20, 30, 50]::numeric[], 'each task keeps its own marks'
);
select is((current_setting('test.began')::jsonb ->> 'maxScore')::numeric, 100::numeric, 'the paper is out of 100');

select is(
  (select count(*)::integer from public.list_assessment_attempts() a where a.paper_id = 'nid-bdes-dat-mock-94'),
  0, 'drawing papers stay out of the scored attempt list'
);
select is(
  (select count(*)::integer from jsonb_array_elements(public.get_assessment_progress() -> 'attempts') a where a ->> 'kind' = 'drawing'),
  0, 'and out of the progress chart'
);
select is(
  (select e -> 'latest' ->> 'status' from jsonb_array_elements(public.list_drawing_papers()) e where e ->> 'paperId' = 'nid-bdes-dat-mock-94'),
  'drawing', 'the list shows the sitting in progress'
);

-- The candidate (M.Des, no plan) has no access to a B.Des drawing mock beyond the free slot rules.
set local request.jwt.claims = '{"sub":"e2000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e2000000-0000-4000-8000-000000000002"}';
select is(
  (select (e ->> 'locked')::boolean from jsonb_array_elements(public.list_drawing_papers()) e where e ->> 'paperId' = 'nid-bdes-dat-mock-94'),
  true, 'a B.Des drawing mock is locked for an M.Des candidate'
);
select throws_ok($$select public.start_drawing_paper('nid-bdes-dat-mock-94')$$, 'DX001', null, 'and cannot be started');
select throws_ok(
  format($$select public.get_part_b(%L)$$, current_setting('test.attempt')),
  '42501', null, 'another person''s sitting stays private'
);

reset role;
set local role anon;
select throws_ok($$select public.list_drawing_papers()$$, '42501', null, 'signed-out visitors cannot list drawing papers');

select * from finish();
rollback;
