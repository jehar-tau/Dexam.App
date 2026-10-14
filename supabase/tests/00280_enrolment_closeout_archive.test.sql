begin;

select no_plan();

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

-- Explicit owned provider sessions for fictional JWT fixtures; rolled back with this test.
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now(),now() from auth.users where id in ('e0000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000004') on conflict(id) do nothing;

insert into public.enrollments(id,person_id,offering_id,status,source_type) values('e4000000-0000-4000-8000-000000000003','e1000000-0000-4000-8000-000000000002','e2000000-0000-4000-8000-000000000002','active','manual');
insert into auth.sessions(id,user_id,aal,created_at,updated_at) values('e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','aal1',now(),now());
insert into public.assignment_releases(id,assignment_version_id,offering_id,target_kind,release_note,request_key,released_by_person_id)
values('fa000000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','selected','Fictional closeout release',gen_random_uuid(),'e1000000-0000-4000-8000-000000000001');
insert into public.student_assignment_instances(id,assignment_release_id,enrollment_id) values('fa100000-0000-4000-8000-000000000001','fa000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001');
insert into public.submission_attempts(id,assignment_instance_id,attempt_number,created_by_person_id) values('fa200000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001',1,'e1000000-0000-4000-8000-000000000002');
insert into public.submission_files(id,submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,position,status,ready_at)
values('fa300000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','fa100000-0000-4000-8000-000000000001/fa200000-0000-4000-8000-000000000001/fa300000-0000-4000-8000-000000000001.pdf','Fictional drawing.pdf','application/pdf',100,100,1,'ready',now());
update public.submission_attempts set status='submitted',submitted_at=now()-interval '1 hour',submitted_late=false where id='fa200000-0000-4000-8000-000000000001';
insert into public.submission_attempts(id,assignment_instance_id,attempt_number,created_by_person_id) values('fa200000-0000-4000-8000-000000000002','fa100000-0000-4000-8000-000000000001',2,'e1000000-0000-4000-8000-000000000002');
insert into public.feedback_revisions(id,submission_attempt_id,assignment_version_id,revision_number,written_text,created_by_person_id,updated_by_person_id)
values('fa400000-0000-4000-8000-000000000001','fa200000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001',1,'Published fictional feedback','e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001');
update public.feedback_revisions set status='published',outcome='review_completed',published_at=now(),published_by_person_id='e1000000-0000-4000-8000-000000000001' where id='fa400000-0000-4000-8000-000000000001';
insert into public.feedback_revisions(submission_attempt_id,assignment_version_id,revision_number,written_text,created_by_person_id,updated_by_person_id)
values('fa200000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001',2,'PRIVATE DRAFT NOT IN ARCHIVE','e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001');
set local role anon;
select throws_ok('select public.list_student_work_archive()','42501',null,'anonymous archive denied');
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.close_enrollment('e4000000-0000-4000-8000-000000000001','completed','course_completed',true,'fa900000-0000-4000-8000-000000000001')$$,'42501',null,'Teacher cannot close a course');
reset role;
insert into public.role_assignments(person_id,role_key,scope_type,scope_id,grant_reason) values('e1000000-0000-4000-8000-000000000001','ordinary_admin','offering','e2000000-0000-4000-8000-000000000001','Fictional operator role');
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,scope_id,grant_reason) values('e1000000-0000-4000-8000-000000000001','enrollment.operate','ordinary_admin','offering','e2000000-0000-4000-8000-000000000001','Fictional scoped closeout');
set local role authenticated;
select is(public.current_person_can_close_enrollment('e2000000-0000-4000-8000-000000000002'),false,'operator denied outside offering scope');
select throws_ok($$select public.close_enrollment('e4000000-0000-4000-8000-000000000001','completed','course_completed',false,'fa900000-0000-4000-8000-000000000001')$$,'22023',null,'deliberate confirmation required');
select throws_ok($$select public.close_enrollment('e4000000-0000-4000-8000-000000000001','completed','student_withdrew',true,'fa900000-0000-4000-8000-000000000001')$$,'22023',null,'reason must match outcome');
select set_config('test.ended_at',public.close_enrollment('e4000000-0000-4000-8000-000000000001','completed','course_completed',true,'fa900000-0000-4000-8000-000000000001')::text,true);
select is(public.close_enrollment('e4000000-0000-4000-8000-000000000001','completed','course_completed',true,'fa900000-0000-4000-8000-000000000001'),current_setting('test.ended_at')::timestamptz,'identical authorized retry keeps original end time');
select throws_ok($$select public.close_enrollment('e4000000-0000-4000-8000-000000000001','withdrawn','student_withdrew',true,gen_random_uuid())$$,'55000',null,'cannot rewrite closeout outcome');
reset role;
select is((select status::text from public.enrollments where id='e4000000-0000-4000-8000-000000000003'),'active','other course unchanged');
select is((select member_id from public.people where id='e1000000-0000-4000-8000-000000000002'),'DXM-T72Q9M4X6WKP','permanent Member ID preserved');
select is((select status::text from public.memberships where person_id='e1000000-0000-4000-8000-000000000002' and kind='student'),'active','closeout never suspends global student membership');
select throws_ok($$update public.submission_attempts set status='submitted',submitted_at=now(),submitted_late=false where id='fa200000-0000-4000-8000-000000000002'$$,'42501',null,'late draft finalization is fenced');
set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(public.current_person_can_read_work_archive('e4000000-0000-4000-8000-000000000001'),true,'own ended work archive available');
select is(public.current_person_can_access_assignment_instance('fa100000-0000-4000-8000-000000000001'),false,'archive does not reopen active assignment authority');
select is(jsonb_array_length(public.list_student_work_archive()->0->'attempts'),1,'only finalized attempt included');
select is(jsonb_array_length(public.list_student_work_archive()->0->'attempts'->0->'feedback'),1,'only published feedback included');
select is(position('PRIVATE DRAFT' in public.list_student_work_archive()::text),0,'feedback drafts not exposed');
select is((select count(*)::integer from public.get_student_archive_file('fa300000-0000-4000-8000-000000000001','submission')),1,'own retained final file can be requested');
select throws_ok($$select public.start_assignment_attempt('fa100000-0000-4000-8000-000000000001')$$,'42501',null,'no new attempt in archive');
select is((select count(*)::integer from public.assignment_versions),0,'no full assignment instructions or reference-material RLS expansion');
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000003","session_id":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select is(public.current_person_can_read_work_archive('e4000000-0000-4000-8000-000000000001'),false,'other student denied');
select is(public.list_student_work_archive(),'[]'::jsonb,'other student archive remains empty');
reset role;
update public.people set status='suspended',suspended_at=now() where id='e1000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(public.list_student_work_archive(),'[]'::jsonb,'suspended person denied even with retained work');
reset role;
update public.people set status='active',suspended_at=null where id='e1000000-0000-4000-8000-000000000002';
update public.enrollments set requested_at=now()-interval '14 months',ended_at=now()-interval '12 months' where id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_person_can_read_work_archive('e4000000-0000-4000-8000-000000000001'),false,'archive expires at exact twelve-month boundary');
select is((select count(*)::integer from public.get_student_archive_file('fa300000-0000-4000-8000-000000000001','submission')),0,'expired retained file denied');
reset role;
set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select lives_ok($$select public.complete_submission_file_purge('fa300000-0000-4000-8000-000000000001')$$,'existing service retention purge remains valid after closeout');
select is((select original_file_name from public.submission_files where id='fa300000-0000-4000-8000-000000000001'),'[purged]','retention purge minimizes filename');
select * from finish();
rollback;

