begin;
select no_plan();

-- A Google user, an email-only user, and a coaching student.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
values
  ('b6000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'google-candidate@dexam.test', '', '{"full_name":"Fictional Google Candidate"}'),
  ('b6000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'email-only@dexam.test', '', '{}'),
  ('b6000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coaching-student@dexam.test', '', '{}');
insert into auth.identities (provider_id, user_id, identity_data, provider)
values
  ('google-sub-1', 'b6000000-0000-4000-8000-000000000001', '{"sub":"google-sub-1"}', 'google'),
  ('b6000000-0000-4000-8000-000000000002', 'b6000000-0000-4000-8000-000000000002', '{"sub":"x"}', 'email');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'b6000000-%';

insert into public.people (id, member_id, display_name)
values ('b6100000-0000-4000-8000-000000000003', 'DXM-CANDSTUD2ENT', 'Fictional Coaching Student');
insert into public.auth_identities (person_id, auth_user_id, kind)
values ('b6100000-0000-4000-8000-000000000003', 'b6000000-0000-4000-8000-000000000003', 'member_id');
insert into public.memberships (person_id, kind, status, starts_at)
values ('b6100000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day');

-- Two fictional UCEED papers and one CEED paper, one ready question each.
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
values
  ('b6200000-0000-4000-8000-000000000001', 'uceed-2091-q1', 1, repeat('1', 64), 'nat', 'Fictional A', 'auto', 'ready', '{}', 'original', 'original'),
  ('b6200000-0000-4000-8000-000000000002', 'uceed-2092-q1', 1, repeat('2', 64), 'nat', 'Fictional B', 'auto', 'ready', '{}', 'original', 'original'),
  ('b6200000-0000-4000-8000-000000000003', 'ceed-2091-q1', 1, repeat('3', 64), 'nat', 'Fictional C', 'auto', 'ready', '{}', 'original', 'original');
insert into public.assessment_question_keys (question_id, answer, answer_status)
select id, '{"kind":"numeric","accepted":[{"exact":1}]}', 'official-key'
from public.assessment_questions where id::text like 'b6200000-%';
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
values
  ('b6200000-0000-4000-8000-000000000001', 'uceed', 2091, 'uceed-2091', '1'),
  ('b6200000-0000-4000-8000-000000000002', 'uceed', 2092, 'uceed-2092', '1'),
  ('b6200000-0000-4000-8000-000000000003', 'ceed', 2091, 'ceed-2091', '1');

select results_eq(
  $$select public.assessment_free_slot(x) from unnest(array['uceed-2025','ceed-2016-paper1','nid-bdes-sample-2025','nid-mdes-2020','nift-2014-bdes-written','nift-mdes-written-sample','nift-bft-written-sample']) x$$,
  $$values ('uceed'::text), ('ceed'), ('nid-bdes'), ('nid-mdes'), ('nift-bdes'), ('nift-mdes'), (null)$$,
  'bank papers map to free-paper slots'
);
select ok(
  not has_table_privilege('authenticated', 'public.assessment_entitlements', 'select')
  and not has_table_privilege('authenticated', 'public.candidate_profiles', 'select')
  and not has_function_privilege('authenticated', 'public.assessment_claim_paper(text)', 'execute'),
  'profiles and entitlements are reached only through functions'
);

-- An email-only login cannot become a candidate.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"b6000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.provision_google_candidate()$$, '42501', null, 'only Google sign-ins can create a candidate');
select is(public.get_test_access() ->> 'kind', null, 'an unlinked login has no test access');
reset role;

-- The Google user becomes a candidate on first sign-in.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"b6000000-0000-4000-8000-000000000001"}';
select is(public.provision_google_candidate(), '{"created": true}'::jsonb, 'the first sign-in creates the candidate');
select is(public.provision_google_candidate(), '{"created": false}'::jsonb, 'provisioning again changes nothing');
select is(public.current_person_has_active_student_membership(), false, 'a candidate is not a coaching student');
select is(public.current_person_can_take_tests(), true, 'a candidate can use the test series');
select is(public.get_test_access() ->> 'displayName', 'Fictional Google Candidate', 'the Google name is used');
select is(public.get_test_access() -> 'profile', 'null'::jsonb, 'no profile before onboarding');
select is(public.current_person_can_open_paper('uceed-2091'), false, 'no free papers before onboarding');
select throws_ok($$select public.save_candidate_profile('bdes', array['ceed'], 2027)$$, '22023', null, 'exams must match the level');
select throws_ok($$select public.save_candidate_profile('bdes', array['uceed'], 2099)$$, '22023', null, 'the exam year is checked');
select lives_ok($$select public.save_candidate_profile('bdes', array['uceed', 'nid-bdes'], 2027)$$, 'onboarding saves the profile');
select is(
  public.get_test_access() -> 'freeSlots',
  '[{"slot":"uceed","paperId":null},{"slot":"nid-bdes","paperId":null},{"slot":"nift-bdes","paperId":null}]'::jsonb,
  'a B.Des candidate has three free-paper slots'
);
select is(public.current_person_can_open_paper('uceed-2091'), true, 'any UCEED paper can be the free one');
select is(public.current_person_can_open_paper('ceed-2091'), false, 'M.Des papers are outside a B.Des free tier');
select throws_ok($$select public.open_assessment_attempt('ceed-2091')$$, 'DX001', null, 'opening a paper outside access is refused');

select set_config('test.attempt', public.open_assessment_attempt('uceed-2091')::text, true);
select is(
  public.get_test_access() -> 'freeSlots' -> 0,
  '{"slot":"uceed","paperId":"uceed-2091"}'::jsonb,
  'opening a paper claims the free UCEED slot'
);
select is(public.current_person_can_open_paper('uceed-2092'), false, 'the slot is used up');
select throws_ok($$select public.open_assessment_attempt('uceed-2092')$$, 'DX001', null, 'a second UCEED paper is refused');
select lives_ok(
  format($$select public.begin_assessment_attempt(%L)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  'the candidate begins the free paper'
);
select lives_ok(
  format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.attempt')::jsonb ->> 'attemptId'),
  'and submits it'
);
select lives_ok($$select public.open_assessment_attempt('uceed-2091')$$, 'the free paper can be taken again');
select is(jsonb_array_length(public.get_assessment_progress() -> 'attempts'), 1, 'the candidate has progress');
reset role;

-- A coaching student can open every paper and never uses free slots.
set local role authenticated;
set local request.jwt.claims = '{"sub":"b6000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"b6000000-0000-4000-8000-000000000003"}';
select is(public.get_test_access() ->> 'kind', 'student', 'coaching students are recognised');
select lives_ok($$select public.open_assessment_attempt('uceed-2092')$$, 'students open any paper');
select lives_ok($$select public.open_assessment_attempt('ceed-2091')$$, 'including other levels');
select throws_ok($$select public.save_candidate_profile('mdes', array['ceed'], 2027)$$, '42501', null, 'students have no candidate profile');
select is(public.provision_google_candidate(), '{"created": false}'::jsonb, 'an existing person is never re-provisioned');
reset role;
select is(
  (select count(*) from public.assessment_entitlements where person_id = 'b6100000-0000-4000-8000-000000000003'),
  0::bigint,
  'students record no free-paper claims'
);

select * from finish();
rollback;
