begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('c8000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'partb-student-a@dexam.test', ''),
  ('c8000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'partb-student-b@dexam.test', ''),
  ('c8000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'partb-admin@dexam.test', '');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'c8000000-%';
insert into public.people (id, member_id, display_name)
values
  ('c8100000-0000-4000-8000-000000000001', 'DXM-PARTBSTA2AAA', 'Fictional Part B Student A'),
  ('c8100000-0000-4000-8000-000000000002', 'DXM-PARTBSTB2BBB', 'Fictional Part B Student B'),
  ('c8100000-0000-4000-8000-000000000003', null, 'Fictional Part B Evaluator');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('c8100000-0000-4000-8000-000000000001', 'c8000000-0000-4000-8000-000000000001', 'member_id'),
  ('c8100000-0000-4000-8000-000000000002', 'c8000000-0000-4000-8000-000000000002', 'member_id'),
  ('c8100000-0000-4000-8000-000000000003', 'c8000000-0000-4000-8000-000000000003', 'employee_email');
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('c8100000-0000-4000-8000-000000000001', 'student', 'active', now() - interval '1 day'),
  ('c8100000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day'),
  ('c8100000-0000-4000-8000-000000000003', 'employee', 'active', now() - interval '1 day');
insert into public.role_assignments (person_id, role_key, scope_type, scope_id, grant_reason)
values ('c8100000-0000-4000-8000-000000000003', 'elevated_admin', 'global', null, 'F048 evaluator test');

-- One objective question and two drawing tasks on a fictional CEED paper.
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
values
  ('c8200000-0000-4000-8000-000000000001', 'ceed-2093-q1', 1, repeat('1', 64), 'nat', 'Fictional NAT', 'auto', 'ready', '{}', 'original', 'original'),
  ('c8200000-0000-4000-8000-000000000002', 'ceed-2093-qb1', 1, repeat('2', 64), 'descriptive', 'Draw a fictional lamp.', 'upload', 'ready', '{}', 'original', 'original'),
  ('c8200000-0000-4000-8000-000000000003', 'ceed-2093-qb2', 1, repeat('3', 64), 'descriptive', 'Draw a fictional chair.', 'upload', 'ready', '{}', 'original', 'original');
insert into public.assessment_question_keys (question_id, answer, answer_status)
values ('c8200000-0000-4000-8000-000000000001', '{"kind":"numeric","accepted":[{"exact":1}]}', 'official-key');
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
values
  ('c8200000-0000-4000-8000-000000000001', 'ceed', 2093, 'ceed-2093', '1'),
  ('c8200000-0000-4000-8000-000000000002', 'ceed', 2093, 'ceed-2093', 'B1'),
  ('c8200000-0000-4000-8000-000000000003', 'ceed', 2093, 'ceed-2093', 'B2');

select is((select public from storage.buckets where id = 'assessment-part-b'), false, 'the Part B bucket is private');
select ok(
  not has_table_privilege('authenticated', 'public.assessment_attempt_tasks', 'select')
  and not has_table_privilege('authenticated', 'public.assessment_part_b_uploads', 'select'),
  'Part B tables have no browser grants'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"c8000000-0000-4000-8000-000000000001"}';
select set_config('test.attempt', public.open_assessment_attempt('ceed-2093') ->> 'attemptId', true);
select lives_ok(format($$select public.begin_assessment_attempt(%L)$$, current_setting('test.attempt')), 'Part A begins');
select throws_ok(format($$select public.begin_part_b(%L)$$, current_setting('test.attempt')), '22023', null, 'Part B waits for Part A to be submitted');
select lives_ok(format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.attempt')), 'Part A is submitted');
select is((public.get_part_b(current_setting('test.attempt')::uuid) ->> 'available')::integer, 2, 'two drawing tasks are available');
select is(public.get_part_b(current_setting('test.attempt')::uuid) ->> 'status', 'none', 'Part B has not started');

select set_config('test.partb', public.begin_part_b(current_setting('test.attempt')::uuid)::text, true);
select is(current_setting('test.partb')::jsonb ->> 'status', 'drawing', 'Part B starts in the drawing phase');
select is(jsonb_array_length(current_setting('test.partb')::jsonb -> 'tasks'), 2, 'both tasks are pinned');
select is(current_setting('test.partb')::jsonb -> 'tasks' -> 0 ->> 'maxMarks', '50.00', 'CEED Part B shares 100 marks across the tasks');
select ok(
  (current_setting('test.partb')::jsonb ->> 'drawingDeadline')::timestamptz between now() + interval '119 minutes' and now() + interval '121 minutes',
  'CEED drawing lasts 120 minutes'
);
select is(public.begin_part_b(current_setting('test.attempt')::uuid) ->> 'drawingDeadline', current_setting('test.partb')::jsonb ->> 'drawingDeadline', 'starting again keeps the clock');

select ok(
  public.current_person_can_upload_part_b(current_setting('test.attempt') || '/c8200000-0000-4000-8000-000000000002/' || gen_random_uuid() || '.jpg'),
  'the owner can upload a sheet for a task during the window'
);
select ok(
  not public.current_person_can_upload_part_b(current_setting('test.attempt') || '/c8200000-0000-4000-8000-000000000001/' || gen_random_uuid() || '.jpg'),
  'uploads only go to Part B tasks'
);
select ok(
  not public.current_person_can_upload_part_b(current_setting('test.attempt') || '/c8200000-0000-4000-8000-000000000002/../x.jpg'),
  'malformed paths are refused'
);
select ok(
  not public.current_person_can_upload_part_b(current_setting('test.attempt') || '/c8200000-0000-4000-8000-000000000002/' || gen_random_uuid() || '.svg'),
  'only JPEG, PNG and PDF names are accepted'
);
reset role;

-- Simulate a stored object (as the storage API would create it), then register it.
select set_config('test.path', current_setting('test.attempt') || '/c8200000-0000-4000-8000-000000000002/' || gen_random_uuid() || '.jpg', true);
insert into storage.objects (bucket_id, name, owner_id) values ('assessment-part-b', current_setting('test.path'), null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"c8000000-0000-4000-8000-000000000001"}';
select throws_ok(
  format($$select public.register_part_b_upload(%L, 'c8200000-0000-4000-8000-000000000003', %L, 'image/jpeg', 1000)$$, current_setting('test.attempt'), current_setting('test.path')),
  '22023', null, 'an upload must be registered against its own task'
);
select lives_ok(
  format($$select public.register_part_b_upload(%L, 'c8200000-0000-4000-8000-000000000002', %L, 'image/jpeg', 1000)$$, current_setting('test.attempt'), current_setting('test.path')),
  'the upload is registered'
);
select is(
  (select count(*) from storage.objects where bucket_id = 'assessment-part-b' and name = current_setting('test.path')),
  1::bigint,
  'the owner can read their sheet'
);
select is((public.start_part_b_upload(current_setting('test.attempt')::uuid)) ->> 'status', 'uploading', 'finishing drawing opens the upload window');
select is((public.submit_part_b(current_setting('test.attempt')::uuid)) ->> 'status', 'submitted', 'Part B is submitted');
select ok(
  not public.current_person_can_upload_part_b(current_setting('test.attempt') || '/c8200000-0000-4000-8000-000000000002/' || gen_random_uuid() || '.jpg'),
  'no uploads after submission'
);
select throws_ok(
  format($$select public.save_part_b_evaluation(%L, 'c8200000-0000-4000-8000-000000000002', 10, 'x')$$, current_setting('test.attempt')),
  '42501', null, 'students cannot mark their own work'
);
select is(public.get_part_b(current_setting('test.attempt')::uuid) -> 'tasks' -> 0 -> 'marks', 'null'::jsonb, 'no marks before release');
reset role;

-- Another student sees nothing.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c8000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"c8000000-0000-4000-8000-000000000002"}';
select throws_ok(format($$select public.get_part_b(%L)$$, current_setting('test.attempt')), '42501', null, 'another student cannot open the Part B work');
select is((select count(*) from storage.objects where bucket_id = 'assessment-part-b'), 0::bigint, 'another student cannot read the sheets');
select throws_ok($$select public.list_part_b_queue()$$, '42501', null, 'students have no evaluation queue');
reset role;

-- The evaluator marks anonymously and releases.
set local role authenticated;
set local request.jwt.claims = '{"sub":"c8000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c8000000-0000-4000-8000-000000000003"}';
select is((select count(*) from jsonb_array_elements(public.list_part_b_queue()) item where item ->> 'attemptId' = current_setting('test.attempt')), 1::bigint, 'the submission is in the queue');
select ok(position('Fictional Part B Student' in public.list_part_b_queue()::text) = 0, 'the queue does not name the candidate');
select ok(position('Fictional Part B Student' in public.get_part_b(current_setting('test.attempt')::uuid)::text) = 0, 'the submission does not name the candidate');
select is((select count(*) from storage.objects where bucket_id = 'assessment-part-b' and name like current_setting('test.attempt') || '/%'), 1::bigint, 'the evaluator can read the sheet');
select throws_ok(
  format($$select public.save_part_b_evaluation(%L, 'c8200000-0000-4000-8000-000000000002', 60, 'too many')$$, current_setting('test.attempt')),
  '22023', null, 'marks cannot exceed the task maximum'
);
select lives_ok(
  format($$select public.save_part_b_evaluation(%L, 'c8200000-0000-4000-8000-000000000002', 32.5, 'Good proportions.')$$, current_setting('test.attempt')),
  'the first task is marked'
);
select throws_ok(format($$select public.release_part_b(%L)$$, current_setting('test.attempt')), '22023', null, 'every task must be marked before release');
select lives_ok(
  format($$select public.save_part_b_evaluation(%L, 'c8200000-0000-4000-8000-000000000003', 20, '')$$, current_setting('test.attempt')),
  'the second task is marked'
);
select lives_ok(format($$select public.release_part_b(%L)$$, current_setting('test.attempt')), 'the result is released');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c8000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"c8000000-0000-4000-8000-000000000001"}';
select is(public.get_part_b(current_setting('test.attempt')::uuid) ->> 'status', 'evaluated', 'the student sees the evaluated status');
select is(public.get_part_b(current_setting('test.attempt')::uuid) ->> 'score', '52.50', 'and the Part B score');
select is(public.get_part_b(current_setting('test.attempt')::uuid) -> 'tasks' -> 0 ->> 'feedback', 'Good proportions.', 'and the feedback');
select is(jsonb_array_length(public.list_my_part_b()), 1, 'Sketches lists the sitting');
reset role;

select * from finish();
rollback;
