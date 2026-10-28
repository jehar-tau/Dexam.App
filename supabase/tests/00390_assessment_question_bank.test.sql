begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('e0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bank-admin@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bank-student@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bank-teacher@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('e1000000-0000-4000-8000-000000000001', null, 'Fictional Bank Admin'),
  ('e1000000-0000-4000-8000-000000000002', 'DXM-BANK2STUDENT', 'Fictional Bank Student'),
  ('e1000000-0000-4000-8000-000000000003', null, 'Fictional Bank Teacher');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'member_id'),
  ('e1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000003', 'employee', 'active', now() - interval '1 day');

insert into public.role_assignments (person_id, role_key, scope_type, scope_id, grant_reason)
values
  ('e1000000-0000-4000-8000-000000000001', 'elevated_admin', 'global', null, 'F038 bank admin test'),
  ('e1000000-0000-4000-8000-000000000003', 'teacher', 'global', null, 'F038 teacher denial test');

insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'e0000000-%';

insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind, visual_dependency
)
values
  ('e2000000-0000-4000-8000-000000000001', 'fiction-2026-q1', 1, repeat('a', 64), 'mcq',
   'Which fictional shape has four equal sides?', 'auto', 'ready', '{}', 'original', 'original', true),
  ('e2000000-0000-4000-8000-000000000002', 'fiction-2026-q2', 1, repeat('b', 64), 'nat',
   'How many fictional corners does a cube have?', 'auto', 'quarantined', '{unparsed-key}', 'original', 'original', false),
  ('e2000000-0000-4000-8000-000000000003', 'fiction-2026-q3', 1, repeat('c', 64), 'descriptive',
   'Draw a fictional chair.', 'upload', 'ready', '{}', 'original', 'original', false);

insert into public.assessment_question_assets (id, question_id, role, storage_path, sha256, mime_type)
values
  ('e3000000-0000-4000-8000-000000000001', 'e2000000-0000-4000-8000-000000000001', 'figure',
   'fiction-2026/q1.png', repeat('d', 64), 'image/png'),
  ('e3000000-0000-4000-8000-000000000002', 'e2000000-0000-4000-8000-000000000002', 'figure',
   'fiction-2026/q2.png', repeat('e', 64), 'image/png');

insert into public.assessment_question_options (question_id, option_key, body, position)
values
  ('e2000000-0000-4000-8000-000000000001', 'A', 'Triangle', 0),
  ('e2000000-0000-4000-8000-000000000001', 'B', 'Square', 1);

insert into public.assessment_question_keys (question_id, answer, answer_status)
values
  ('e2000000-0000-4000-8000-000000000001', '{"kind":"choice","correct":["B"]}', 'official-key'),
  ('e2000000-0000-4000-8000-000000000002', '{"kind":"numeric","accepted":[{"exact":8}]}', 'pending');

insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
values
  ('e2000000-0000-4000-8000-000000000001', 'fiction', 2026, 'fiction-2026', '1'),
  ('e2000000-0000-4000-8000-000000000002', 'fiction', 2026, 'fiction-2026', '2'),
  ('e2000000-0000-4000-8000-000000000003', 'fiction', 2026, 'fiction-2026', '3');

insert into storage.objects (bucket_id, name, owner_id)
values
  ('assessment-media', 'fiction-2026/q1.png', null),
  ('assessment-media', 'fiction-2026/q2.png', null);

-- Schema rules.
select is(
  (select requires_mfa from public.capabilities where key = 'assessment.bank.import'),
  true,
  'importing and reading keys requires MFA'
);
select is(
  (select public from storage.buckets where id = 'assessment-media'),
  false,
  'the media bucket is private'
);
select throws_ok(
  $$insert into public.assessment_questions (external_key, version, content_hash, question_type, prompt, response_mode, publication_state, licence, source_kind)
    values ('fiction-2026-q1', 2, repeat('f', 64), 'mcq', 'x', 'auto', 'ready', 'original', 'original')$$,
  '23505',
  null,
  'only one live version per external key'
);
select throws_ok(
  $$insert into public.assessment_questions (external_key, version, content_hash, question_type, prompt, response_mode, publication_state, licence, source_kind)
    values ('fiction-2026-q9', 1, repeat('f', 64), 'mcq', 'x', 'auto', 'quarantined', 'original', 'original')$$,
  '23514',
  null,
  'a quarantined question must carry a reason'
);
select throws_ok(
  $$insert into public.assessment_question_assets (question_id, role, storage_path, sha256, mime_type)
    values ('e2000000-0000-4000-8000-000000000001', 'figure', 'fiction/../secret.png', repeat('a', 64), 'image/png')$$,
  '23514',
  null,
  'asset paths cannot traverse directories'
);
select throws_ok(
  $$insert into public.assessment_question_assets (question_id, role, storage_path, sha256, mime_type)
    values ('e2000000-0000-4000-8000-000000000001', 'figure', 'fiction/q1.svg', repeat('a', 64), 'image/svg+xml')$$,
  '23514',
  null,
  'SVG assets are not accepted'
);

-- Anonymous visitors get nothing.
set local role anon;
select throws_ok('select count(*) from public.assessment_questions', '42501', null, 'anon cannot read questions');
select throws_ok('select count(*) from public.assessment_question_keys', '42501', null, 'anon cannot read keys');
select throws_ok($$select public.get_assessment_student_paper('fiction-2026')$$, '42501', null, 'anon cannot open a paper');
select is((select count(*) from storage.objects where bucket_id = 'assessment-media'), 0::bigint, 'anon sees no bank media');
reset role;

-- A student sees the candidate view only.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e0000000-0000-4000-8000-000000000002"}';
select is((select count(*) from public.assessment_questions), 0::bigint, 'students cannot read the bank tables');
select is((select count(*) from public.assessment_question_provenance), 0::bigint, 'students cannot read provenance');
select throws_ok('select count(*) from public.assessment_question_keys', '42501', null, 'students cannot read keys');
select throws_ok(
  $$insert into public.assessment_questions (external_key, version, content_hash, question_type, prompt, response_mode, publication_state, licence, source_kind)
    values ('fiction-2026-q8', 1, repeat('f', 64), 'mcq', 'x', 'auto', 'ready', 'original', 'original')$$,
  '42501',
  null,
  'students cannot write questions'
);
select is(
  jsonb_array_length(public.get_assessment_student_paper('fiction-2026') -> 'questions'),
  1,
  'the paper contains only ready objective questions'
);
select is(
  (public.get_assessment_student_paper('fiction-2026') ->> 'objectiveCount')::integer,
  2,
  'the paper reports how many objective questions exist'
);
select is(
  public.get_assessment_student_paper('fiction-2026') -> 'questions' -> 0 ->> 'prompt',
  'Which fictional shape has four equal sides?',
  'the ready question is served'
);
select ok(
  position('"kind"' in public.get_assessment_student_paper('fiction-2026')::text) = 0
  and position('official-key' in public.get_assessment_student_paper('fiction-2026')::text) = 0
  and position('fiction-2026-q1' in public.get_assessment_student_paper('fiction-2026')::text) = 0,
  'the candidate view carries no keys, key status or external keys'
);
select throws_ok($$select public.get_assessment_student_paper('../etc')$$, '22023', null, 'paper ids are validated');
select results_eq(
  $$select paper_id, ready_count, objective_count from public.list_assessment_student_papers() where paper_id = 'fiction-2026'$$,
  $$values ('fiction-2026'::text, 1, 2)$$,
  'paper readiness counts are available to students'
);
select results_eq(
  $$select name from storage.objects where bucket_id = 'assessment-media' and name like 'fiction-2026/%'$$,
  $$values ('fiction-2026/q1.png'::text)$$,
  'students can read only figures of ready questions'
);
reset role;

-- A teacher without the capability gets nothing and cannot open papers.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"e0000000-0000-4000-8000-000000000003"}';
select is((select count(*) from public.assessment_questions), 0::bigint, 'teachers cannot read the bank');
select throws_ok($$select public.get_assessment_student_paper('fiction-2026')$$, '42501', null, 'teachers cannot open a student paper');
select is((select count(*) from storage.objects where bucket_id = 'assessment-media'), 0::bigint, 'teachers see no bank media');
reset role;

-- An admin with the read capability browses the bank but never the keys.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e0000000-0000-4000-8000-000000000001"}';
select is((select count(*) from public.assessment_questions where external_key like 'fiction-2026-%'), 3::bigint, 'bank readers see every question');
select is((select count(*) from public.assessment_question_provenance where paper_id = 'fiction-2026'), 3::bigint, 'bank readers see provenance');
select throws_ok('select count(*) from public.assessment_question_keys', '42501', null, 'bank readers cannot read keys');
select is((select count(*) from storage.objects where bucket_id = 'assessment-media' and name like 'fiction-2026/%'), 2::bigint, 'bank readers see all bank media');
select is(public.current_person_has_capability('assessment.bank.import'), false, 'import is refused without live MFA');
reset role;

-- Only the operator's service role can import; a new version retires the old one atomically.
select ok(
  not has_function_privilege('authenticated', 'public.assessment_import_question(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.assessment_import_question(jsonb)', 'execute'),
  'browser roles cannot run the importer'
);
set local role service_role;
select isnt(
  public.assessment_import_question(jsonb_build_object(
    'externalKey', 'fiction-2026-q1', 'version', 2, 'previousId', 'e2000000-0000-4000-8000-000000000001',
    'contentHash', repeat('9', 64), 'type', 'mcq', 'prompt', 'Which fictional shape has four equal sides now?',
    'topic', 'spatial-reasoning', 'subtopic', null, 'difficulty', 'unassessed', 'estimatedSeconds', null,
    'visualDependency', false, 'responseMode', 'auto', 'state', 'ready', 'reasons', '[]'::jsonb,
    'licence', 'original', 'sourceKind', 'original',
    'assets', '[]'::jsonb,
    'options', '[{"key":"A","text":"Triangle","position":0,"assetIndex":null},{"key":"B","text":"Square","position":1,"assetIndex":null}]'::jsonb,
    'key', '{"answer":{"kind":"choice","correct":["B"]},"status":"official-key"}'::jsonb,
    'provenance', '{"exam":"fiction","year":2026,"paperId":"fiction-2026","questionNo":"1"}'::jsonb
  )),
  null,
  'the service role imports a new version'
);
select results_eq(
  $$select version, publication_state from public.assessment_questions where external_key = 'fiction-2026-q1' order by version$$,
  $$values (1, 'retired'::text), (2, 'ready'::text)$$,
  'the previous version is retired'
);
select is(
  (select slug from public.assessment_topics t join public.assessment_questions q on q.topic_id = t.id where q.external_key = 'fiction-2026-q1' and q.version = 2),
  'spatial-reasoning',
  'topics are created on import'
);
reset role;

select * from finish();
rollback;
