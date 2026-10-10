begin;

select plan(57);

select has_table('public', 'assignment_releases', 'assignment releases exist');
select has_table('public', 'student_assignment_instances', 'private student assignment instances exist');
select has_table('public', 'student_assignment_transitions', 'assignment lifecycle history exists');
select has_table('public', 'submission_attempts', 'versioned submission attempts exist');
select has_table('public', 'submission_files', 'private submission file metadata exists');
select is(
  (select public from storage.buckets where id = 'student-submissions'),
  false,
  'student submission bucket is private'
);
select has_function(
  'public',
  'distribute_assignment_version',
  array['uuid', 'uuid', 'uuid[]', 'timestamp with time zone', 'text', 'uuid'],
  'deliberate distribution operation exists'
);
select has_function(
  'public',
  'start_assignment_attempt',
  array['uuid'],
  'retry-safe attempt operation exists'
);
select has_function(
  'public',
  'finalize_submission_attempt',
  array['uuid'],
  'trusted finalization operation exists'
);
select has_function(
  'public',
  'request_assignment_correction',
  array['uuid', 'text'],
  'teacher correction operation exists'
);
select has_function(
  'public',
  'list_submission_files_due_for_purge',
  array['integer'],
  'bounded retention cleanup queue exists'
);
select has_function(
  'public',
  'list_assignment_distribution_targets',
  array['uuid'],
  'minimum-data distribution target operation exists'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('e0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'distributor@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-one@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-two@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-teacher@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('e1000000-0000-4000-8000-000000000001', null, 'Fictional Assignment Teacher'),
  ('e1000000-0000-4000-8000-000000000002', 'DXM-T72Q9M4X6WKP', 'Fictional Student One'),
  ('e1000000-0000-4000-8000-000000000003', 'DXM-8K3M9Q2RW5TY', 'Fictional Student Two'),
  ('e1000000-0000-4000-8000-000000000004', null, 'Fictional Sales User'),
  ('e1000000-0000-4000-8000-000000000005', null, 'Fictional Other Teacher');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'member_id'),
  ('e1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', 'member_id'),
  ('e1000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000004', 'employee_email'),
  ('e1000000-0000-4000-8000-000000000005', 'e0000000-0000-4000-8000-000000000005', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000004', 'employee', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000005', 'employee', 'active', now() - interval '1 day');

insert into public.offerings (id, code, title, status)
values
  ('e2000000-0000-4000-8000-000000000001', 'ASSIGNMENT_FOUNDATION', 'Fictional Assignment Foundation', 'active'),
  ('e2000000-0000-4000-8000-000000000002', 'ASSIGNMENT_OTHER', 'Fictional Other Assignment Offering', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values (
  'e3000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'FOUNDATION_A',
  'Fictional Foundation A',
  'active'
);

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  approved_by_person_id, requested_at, approved_at, activated_at
)
values
  (
    'e4000000-0000-4000-8000-000000000001',
    'e1000000-0000-4000-8000-000000000002',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'active', 'manual', 'e1000000-0000-4000-8000-000000000001',
    now() - interval '2 days', now() - interval '1 day', now() - interval '1 day'
  ),
  (
    'e4000000-0000-4000-8000-000000000002',
    'e1000000-0000-4000-8000-000000000003',
    'e2000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    'active', 'manual', 'e1000000-0000-4000-8000-000000000001',
    now() - interval '2 days', now() - interval '1 day', now() - interval '1 day'
  );

insert into public.role_assignments (person_id, role_key, scope_type, scope_id, grant_reason)
values
  ('e1000000-0000-4000-8000-000000000001', 'teacher', 'offering', 'e2000000-0000-4000-8000-000000000001', 'F006 assigned teacher'),
  ('e1000000-0000-4000-8000-000000000004', 'sales', 'global', null, 'F006 Sales denial'),
  ('e1000000-0000-4000-8000-000000000005', 'teacher', 'offering', 'e2000000-0000-4000-8000-000000000002', 'F006 other teacher denial');

insert into public.capability_grants (
  person_id, capability_key, required_role_key, scope_type, scope_id, grant_reason
)
values (
  'e1000000-0000-4000-8000-000000000001',
  'assignment.distribute',
  'teacher',
  'offering',
  'e2000000-0000-4000-8000-000000000001',
  'F006 assignment distributor'
);

insert into public.curriculum_versions (
  id, offering_id, version_number, title, created_by_person_id
)
values (
  'e5000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  1,
  'Fictional assignment curriculum',
  'e1000000-0000-4000-8000-000000000001'
);
insert into public.curriculum_sections (id, curriculum_version_id, code, title, position)
values (
  'e6000000-0000-4000-8000-000000000001',
  'e5000000-0000-4000-8000-000000000001',
  'DRAWING', 'Drawing', 1
);
insert into public.curriculum_topics (id, section_id, code, title, position)
values (
  'e7000000-0000-4000-8000-000000000001',
  'e6000000-0000-4000-8000-000000000001',
  'PERSPECTIVE', 'Perspective', 1
);
update public.curriculum_versions
set status = 'published', published_by_person_id = 'e1000000-0000-4000-8000-000000000001',
    published_at = now(), release_note = 'Fictional curriculum release'
where id = 'e5000000-0000-4000-8000-000000000001';

insert into public.assignment_definitions (id, offering_id, code, created_by_person_id)
values (
  'e8000000-0000-4000-8000-000000000001',
  'e2000000-0000-4000-8000-000000000001',
  'PERSPECTIVE_ROOM',
  'e1000000-0000-4000-8000-000000000001'
);
insert into public.assignment_versions (
  id, assignment_definition_id, version_number, group_name, title,
  instructions, evaluation_rubric, created_by_person_id
)
values (
  'e9000000-0000-4000-8000-000000000001',
  'e8000000-0000-4000-8000-000000000001',
  1,
  'Perspective & Objects',
  'Draw a one-point perspective room',
  'Draw one interior using a clear horizon and vanishing point.',
  'Check convergence, proportion, line confidence, and composition.',
  'e1000000-0000-4000-8000-000000000001'
);
insert into public.assignment_topic_links (assignment_version_id, topic_id)
values ('e9000000-0000-4000-8000-000000000001', 'e7000000-0000-4000-8000-000000000001');
update public.assignment_versions
set status = 'published', published_by_person_id = 'e1000000-0000-4000-8000-000000000001',
    published_at = now(), release_note = 'Fictional assignment release'
where id = 'e9000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  public.current_person_can_distribute_assignments('e2000000-0000-4000-8000-000000000001'),
  true,
  'scoped distributor can release assignments in their offering'
);
select is(
  public.current_person_can_distribute_assignments('e2000000-0000-4000-8000-000000000002'),
  false,
  'scoped distributor cannot release assignments in another offering'
);
select is(
  (select count(*)::integer from public.list_assignment_distribution_targets('e2000000-0000-4000-8000-000000000001')),
  2,
  'authorized distributor sees active targets only within their offering'
);
select lives_ok(
  $$select public.distribute_assignment_version(
    'e9000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    null,
    now() + interval '7 days',
    'First fictional cohort assignment',
    'ea000000-0000-4000-8000-000000000001'
  )$$,
  'authorized staff can deliberately release a published assignment'
);
select is((select count(*)::integer from public.assignment_releases), 1, 'one release is created');
select is((select count(*)::integer from public.student_assignment_instances), 2, 'cohort release snapshots two active enrolments');
select is(
  (select assignment_version_id from public.assignment_releases limit 1),
  'e9000000-0000-4000-8000-000000000001'::uuid,
  'release pins the immutable assignment version'
);
select lives_ok(
  $$select public.distribute_assignment_version(
    'e9000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001',
    null,
    now() + interval '7 days',
    'First fictional cohort assignment',
    'ea000000-0000-4000-8000-000000000001'
  )$$,
  'repeating a distribution request is safe'
);
select is((select count(*)::integer from public.assignment_releases), 1, 'retry does not duplicate a release');
select throws_ok(
  $$select public.distribute_assignment_version(
    'e9000000-0000-4000-8000-000000000001', null,
    array['e4000000-0000-4000-8000-000000000001'::uuid],
    now() - interval '1 hour', 'Past deadline is invalid',
    'ea000000-0000-4000-8000-000000000002'
  )$$,
  '22023', 'the due date must be in the future',
  'a new release cannot begin with a past due date'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.student_assignment_instances), 1, 'student sees only their own assignment instance');
select is((select count(*)::integer from public.assignment_versions), 1, 'student sees the published version distributed to them');
select is((select count(*)::integer from public.submission_attempts), 0, 'student does not see another learner attempts');
select lives_ok(
  $$select public.start_assignment_attempt((select id from public.student_assignment_instances limit 1))$$,
  'student can start their own initial attempt'
);
select is((select count(*)::integer from public.submission_attempts), 1, 'one draft attempt is created');
select lives_ok(
  $$select public.start_assignment_attempt((select id from public.student_assignment_instances limit 1))$$,
  'starting the same in-progress assignment is retry-safe'
);
select is((select count(*)::integer from public.submission_attempts), 1, 'retry does not duplicate a draft attempt');
select throws_ok(
  $$select * from public.reserve_submission_file(
    (select id from public.submission_attempts limit 1), 'drawing.svg', 'image/svg+xml',
    1024, 1024, false, 1000, 1000
  )$$,
  '22023', 'submission file type is not allowed',
  'unsupported student file types are rejected'
);
select throws_ok(
  $$select * from public.reserve_submission_file(
    (select id from public.submission_attempts limit 1), 'drawing.jpg', 'image/jpeg',
    10485761, 10485761, false, 3200, 2400
  )$$,
  '22023', 'submission file metadata is invalid',
  'student files larger than 10 MB are rejected'
);
select lives_ok(
  $$select * from public.reserve_submission_file(
    (select id from public.submission_attempts limit 1), 'room-study.jpg', 'image/jpeg',
    1500000, 5000000, true, 3000, 2200
  )$$,
  'student can reserve one compressed image upload'
);
select throws_ok(
  $$select public.finalize_submission_attempt((select id from public.submission_attempts limit 1))$$,
  '23514', 'one to ten verified files within 50 MB are required',
  'pending files cannot be finalized as a submission'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    select 'student-submissions', object_path, auth.uid()::text,
      jsonb_build_object('mimetype', mime_type, 'size', byte_size)
    from public.submission_files limit 1$$,
  '42501', null,
  'students cannot bypass trusted upload validation with direct storage writes'
);
select throws_ok(
  $$select * from public.list_submission_files_due_for_purge(100)$$,
  '42501', null,
  'students cannot inspect the retention cleanup queue'
);

reset role;

insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'student-submissions', object_path, 'e0000000-0000-4000-8000-000000000002',
  jsonb_build_object('mimetype', mime_type, 'size', byte_size)
from public.submission_files limit 1;
select public.complete_submission_file_upload((select id from public.submission_files limit 1));

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select status::text from public.submission_files limit 1), 'ready', 'trusted upload completion marks the file ready');
select lives_ok(
  $$select public.finalize_submission_attempt((select id from public.submission_attempts limit 1))$$,
  'student can finalize an attempt with verified private work'
);
select is((select status::text from public.submission_attempts limit 1), 'submitted', 'finalized attempt is submitted');
select is((select submitted_late from public.submission_attempts limit 1), false, 'submission before the due date is not late');
select is((select status::text from public.student_assignment_instances limit 1), 'submitted', 'student instance records the submitted state');
select throws_ok(
  $$update public.submission_attempts set submitted_at = now() + interval '1 hour' where status = 'submitted'$$,
  '42501', null,
  'student cannot directly mutate a finalized attempt'
);
select throws_ok(
  $$select public.start_assignment_attempt((select id from public.student_assignment_instances limit 1))$$,
  '23514', 'a new attempt is not currently authorized',
  'student cannot self-authorize a revision'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.student_assignment_instances), 0, 'unassigned teacher cannot read student work');
select throws_ok(
  $$select public.request_assignment_correction(
    (select id from public.student_assignment_instances where false), 'Should not be allowed'
  )$$,
  '42501', 'assignment review access denied',
  'unassigned teacher cannot request correction'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.student_assignment_instances), 2, 'assigned teacher can read work in their offering');
select lives_ok(
  $$select public.request_assignment_correction(
    (select id from public.student_assignment_instances where status = 'submitted'),
    'Please correct the convergence and resubmit.'
  )$$,
  'assigned teacher can request a correction with a reason'
);
select is(
  (select status::text from public.student_assignment_instances where status = 'correction_requested'),
  'correction_requested',
  'correction request changes the student lifecycle state'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select public.start_assignment_attempt((select id from public.student_assignment_instances limit 1))$$,
  'student can start a revision only after teacher authorization'
);
select is((select count(*)::integer from public.submission_attempts), 2, 'revision preserves the original attempt');

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.assignment_releases), 0, 'Sales cannot read assignment releases');
select is((select count(*)::integer from public.student_assignment_instances), 0, 'Sales cannot read student assignment instances');
select throws_ok(
  $$select public.distribute_assignment_version(
    'e9000000-0000-4000-8000-000000000001',
    'e3000000-0000-4000-8000-000000000001', null, null,
    'Sales must not distribute', 'ea000000-0000-4000-8000-000000000003'
  )$$,
  '42501', 'assignment distribution access denied',
  'Sales cannot distribute assignments'
);
select throws_ok(
  $$select * from public.list_assignment_distribution_targets('e2000000-0000-4000-8000-000000000001')$$,
  '42501', 'assignment distribution access denied',
  'Sales cannot list student distribution targets'
);

reset role;
update public.enrollments
set status = 'completed', ended_at = now(), updated_at = now()
where id = 'e4000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.student_assignment_instances), 0, 'ended enrolment immediately removes student assignment access');
select is(
  public.current_person_can_access_assignment_instance(
    (select i.id from public.student_assignment_instances i where false)
  ),
  false,
  'ended student cannot pass current-state assignment access checks'
);

reset role;
update public.people set status = 'suspended', suspended_at = now()
where id = 'e1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.student_assignment_instances), 0, 'suspended teacher immediately loses student-work visibility');
select is(
  public.current_person_can_distribute_assignments('e2000000-0000-4000-8000-000000000001'),
  false,
  'suspended distributor immediately loses release authority'
);

select * from finish();

rollback;
