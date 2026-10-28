begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('d9000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mock-student@dexam.test', ''),
  ('d9000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mock-candidate@dexam.test', ''),
  ('d9000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'mock-other@dexam.test', '');
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
values ('mock-google-sub', 'd9000000-0000-4000-8000-000000000002', '{"sub":"mock-google-sub"}', 'google', now(), now(), now());
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'd9000000-%';
insert into public.people (id, member_id, display_name)
values
  ('d9100000-0000-4000-8000-000000000001', 'DXM-MAXKSTUDE2NT', 'Fictional Mock Student'),
  ('d9100000-0000-4000-8000-000000000003', 'DXM-MAXKTHER2RRR', 'Fictional Other Student');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('d9100000-0000-4000-8000-000000000001', 'd9000000-0000-4000-8000-000000000001', 'member_id'),
  ('d9100000-0000-4000-8000-000000000003', 'd9000000-0000-4000-8000-000000000003', 'member_id');
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('d9100000-0000-4000-8000-000000000001', 'student', 'active', now() - interval '1 day'),
  ('d9100000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day');

-- A fictional UCEED pool: 20 NAT, 20 MSQ, 40 MCQ, plus 5 CEED NAT to mix in.
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
select gen_random_uuid(), format('mockpool-%s-%s', kind, n), 1, md5(kind || n) || md5(n || kind), kind,
  format('Fictional %s %s', kind, n), 'auto', 'ready', '{}', 'original', 'original'
from (values ('nat', 25), ('msq', 20), ('mcq', 40)) as pool(kind, size), generate_series(1, size) n;
insert into public.assessment_question_keys (question_id, answer, answer_status)
select id, case question_type
  when 'nat' then '{"kind":"numeric","accepted":[{"exact":1}]}'
  when 'msq' then '{"kind":"multi","correct":["A"]}'
  else '{"kind":"choice","correct":["A"]}' end::jsonb, 'official-key'
from public.assessment_questions where external_key like 'mockpool-%';
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select id,
  case when external_key ~ '^mockpool-nat-(2[1-5])$' then 'ceed' else 'uceed' end,
  2094,
  case when external_key ~ '^mockpool-nat-(2[1-5])$' then 'ceed-2094' else 'uceed-2094' end,
  substring(external_key from '[0-9]+$')
from public.assessment_questions where external_key like 'mockpool-%';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d9000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.start_assessment_mock('nid-2026')$$, '22023', null, 'unknown blueprints are refused');
select is(
  (select item ->> 'total' from jsonb_array_elements(public.list_assessment_mocks()) item where item ->> 'key' = 'uceed-2026'),
  '57',
  'the UCEED blueprint has 57 questions'
);
select set_config('test.expected', (
  select (item ->> 'available') from jsonb_array_elements(public.list_assessment_mocks()) item where item ->> 'key' = 'uceed-2026'
), true);
select set_config('test.mock1', public.start_assessment_mock('uceed-2026')::text, true);
select is(current_setting('test.mock1')::jsonb ->> 'kind', 'mock', 'the attempt is a mock');
select is(
  jsonb_array_length(current_setting('test.mock1')::jsonb -> 'questions'),
  current_setting('test.expected')::integer,
  'the mock is as large as the blueprint or the unseen pool allows'
);
select is(
  public.start_assessment_mock('uceed-2026') ->> 'attemptId',
  current_setting('test.mock1')::jsonb ->> 'attemptId',
  'starting again resumes the unfinished mock'
);
select ok(
  (select bool_and(q ->> 'type' = 'nat') from jsonb_array_elements(current_setting('test.mock1')::jsonb -> 'questions') with ordinality as item(q, n) where n <= 14),
  'sections follow the blueprint order (NAT first)'
);
select lives_ok(format($$select public.begin_assessment_attempt(%L)$$, current_setting('test.mock1')::jsonb ->> 'attemptId'), 'the mock begins');
select lives_ok(format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.mock1')::jsonb ->> 'attemptId'), 'and is submitted');
select set_config('test.mock2', public.start_assessment_mock('uceed-2026')::text, true);
select is(
  (select count(*) from jsonb_array_elements(current_setting('test.mock2')::jsonb -> 'questions') a
    join jsonb_array_elements(current_setting('test.mock1')::jsonb -> 'questions') b on a ->> 'id' = b ->> 'id'),
  0::bigint,
  'a second mock never repeats a question from the first'
);
select is(
  (select (item ->> 'taken')::integer from jsonb_array_elements(public.list_assessment_mocks()) item where item ->> 'key' = 'uceed-2026'),
  1,
  'one mock is recorded as taken'
);
reset role;

-- Another student cannot open this student's mock.
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"d9000000-0000-4000-8000-000000000003"}';
select throws_ok(
  format($$select public.get_assessment_attempt(%L)$$, current_setting('test.mock2')::jsonb ->> 'attemptId'),
  '42501', null, 'another student cannot open the mock'
);
reset role;

-- A free candidate gets one mock per blueprint.
set local role authenticated;
set local request.jwt.claims = '{"sub":"d9000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"d9000000-0000-4000-8000-000000000002"}';
select lives_ok($$select public.provision_google_candidate()$$, 'the candidate is provisioned');
select lives_ok($$select public.save_candidate_profile('bdes', array['uceed'], 2027)$$, 'and onboarded');
select set_config('test.cmock', public.start_assessment_mock('uceed-2026') ->> 'attemptId', true);
select lives_ok(format($$select public.begin_assessment_attempt(%L)$$, current_setting('test.cmock')), 'the free mock begins');
select lives_ok(format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.cmock')), 'and is submitted');
select is(
  (select (item ->> 'canStart')::boolean from jsonb_array_elements(public.list_assessment_mocks()) item where item ->> 'key' = 'uceed-2026'),
  false,
  'a second UCEED mock is locked for a free candidate'
);
select throws_ok($$select public.start_assessment_mock('uceed-2026')$$, 'DX001', null, 'starting it is refused');
reset role;

set local role anon;
select throws_ok($$select public.list_assessment_mocks()$$, '42501', null, 'anon has no mocks');
reset role;

select * from finish();
rollback;
