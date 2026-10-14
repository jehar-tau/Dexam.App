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

update public.cohorts set curriculum_version_id='e5000000-0000-4000-8000-000000000001' where id='e3000000-0000-4000-8000-000000000001';
insert into auth.sessions(id,user_id,aal) values('e0000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000003','aal1');
set local role anon;
select throws_ok('select public.list_student_topic_checklist()','42501',null,'anonymous checklist denied');
reset role;set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(jsonb_array_length(public.list_student_topic_checklist()),1,'only own assigned course listed');
select lives_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',true)$$,'owner explicitly marks study');
select ok(public.list_student_topic_checklist()->0->'topics'->0->>'markedAt' is not null,'current mark visible to owner');
select set_config('test.marked_at',public.list_student_topic_checklist()->0->'topics'->0->>'markedAt',true);
select lives_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',true)$$,'same choice retry safe');
select is(public.list_student_topic_checklist()->0->'topics'->0->>'markedAt',current_setting('test.marked_at'),'retry never rewrites original mark time');
select throws_ok('select * from public.student_topic_marks','42501',null,'raw marks unavailable even to owner');
select throws_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000002','e7000000-0000-4000-8000-000000000001',true)$$,'42501',null,'other student course mark denied');
select throws_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001',gen_random_uuid(),true)$$,'42501',null,'unassigned topic denied');
select throws_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',null)$$,'22023',null,'explicit choice required');
select lives_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',false)$$,'owner can undo');
select ok(public.list_student_topic_checklist()->0->'topics'->0->>'markedAt' is null,'undo removes current mark');
select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',true);
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000003","session_id":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select ok(public.list_student_topic_checklist()->0->'topics'->0->>'markedAt' is null,'second student never sees first student mark');
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.list_student_topic_checklist(),'[]'::jsonb,'teacher has no checklist reads');
select throws_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',false)$$,'42501',null,'teacher cannot alter self-report');
reset role;
update public.enrollments set status='withdrawn',ended_at=clock_timestamp() where id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(public.list_student_topic_checklist()->0->>'readOnly','true','withdrawn course checklist read only');
select ok(public.list_student_topic_checklist()->0->'topics'->0->>'markedAt' is not null,'ended course retains prior own mark');
select throws_ok($$select public.set_student_topic_mark('e4000000-0000-4000-8000-000000000001','e7000000-0000-4000-8000-000000000001',false)$$,'42501',null,'cannot undo after course closeout');
select throws_ok('select public.purge_expired_student_topic_marks(500)','42501',null,'student cannot purge marks');
reset role;
update public.memberships set status='suspended' where person_id='e1000000-0000-4000-8000-000000000002' and kind='student';
set local role authenticated;
select is(public.list_student_topic_checklist(),'[]'::jsonb,'inactive membership denies retained marks');
reset role;
update public.memberships set status='active' where person_id='e1000000-0000-4000-8000-000000000002' and kind='student';
update public.enrollments set requested_at=now()-interval '14 months',ended_at=now()-interval '12 months' where id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.list_student_topic_checklist(),'[]'::jsonb,'checklist hidden at exact archive expiry');
reset role;set local role service_role;
set local request.jwt.claims='{"role":"service_role"}';
select is(public.purge_expired_student_topic_marks(500),1,'service deletes expired identifiable mark');
select is(public.purge_expired_student_topic_marks(500),0,'purge retry idempotent');
select throws_ok('select public.purge_expired_student_topic_marks(1001)','22023',null,'purge bounded');
select * from finish();rollback;
