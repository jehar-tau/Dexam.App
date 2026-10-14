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

insert into public.role_assignments(person_id,role_key,scope_type,scope_id,grant_reason) values('e1000000-0000-4000-8000-000000000001','ordinary_admin','offering','e2000000-0000-4000-8000-000000000001','Fictional scheduler');
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,scope_id,grant_reason) values('e1000000-0000-4000-8000-000000000001','class.schedule','ordinary_admin','offering','e2000000-0000-4000-8000-000000000001','Fictional scheduler');
set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.current_person_can_schedule_classes('e2000000-0000-4000-8000-000000000001'),true,'explicit ordinary admin offering authority');
select is(public.current_person_can_schedule_classes('e2000000-0000-4000-8000-000000000002'),false,'other offering denied');
select set_config('test.class',public.save_class_session(null,'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','Fictional class',now()+interval '2 days',now()+interval '2 days 1 hour','Asia/Kolkata','Studio',0,false,true,'fb900000-0000-4000-8000-000000000001')::text,true);
select is(public.save_class_session(null,'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','Fictional class',now()+interval '2 days',now()+interval '2 days 1 hour','Asia/Kolkata','Studio',0,false,true,'fb900000-0000-4000-8000-000000000001')::text,current_setting('test.class'),'exact retry same class');
select throws_ok($$select public.save_class_session(null,'e2000000-0000-4000-8000-000000000001',null,'Bad',now()-interval '1 day',now()+interval '1 day','Asia/Kolkata',null,0,false,true,gen_random_uuid())$$,'22023',null,'backdated class denied');
select throws_ok($$select public.save_class_session(null,'e2000000-0000-4000-8000-000000000001',null,'Bad',now()+interval '1 day',now()+interval '2 days','Invalid/Zone',null,0,false,true,gen_random_uuid())$$,'22023',null,'invalid timezone denied');
select throws_ok($$select public.save_class_session(null,'e2000000-0000-4000-8000-000000000001',null,'Bad',now()+interval '1 day',now()+interval '2 days','Asia/Kolkata','https://example.invalid',0,false,true,gen_random_uuid())$$,'22023',null,'external link not accepted as location');
select public.save_class_session(current_setting('test.class')::uuid,'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','Fictional class',now()+interval '3 days',now()+interval '3 days 1 hour','Asia/Kolkata','Studio',1,false,true,gen_random_uuid());
select throws_ok($$select public.save_class_session(current_setting('test.class')::uuid,'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001','Fictional class',now()+interval '4 days',now()+interval '4 days 1 hour','Asia/Kolkata','Studio',1,false,true,gen_random_uuid())$$,'55000',null,'stale revision cannot overwrite');
reset role;
insert into public.assignment_releases(id,assignment_version_id,offering_id,target_kind,release_note,request_key,released_by_person_id) values('fb100000-0000-4000-8000-000000000001','e9000000-0000-4000-8000-000000000001','e2000000-0000-4000-8000-000000000001','selected','Mixed queue test',gen_random_uuid(),'e1000000-0000-4000-8000-000000000001');
insert into public.student_assignment_instances(id,assignment_release_id,enrollment_id) values('fb200000-0000-4000-8000-000000000001','fb100000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001');
insert into public.domain_events(event_key,event_type,aggregate_type,aggregate_id,actor_person_id) values('mixed:assignment','assignment_published','student_assignment_instance','fb200000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001');
set local role service_role;
select is((select processed_count from public.process_notification_outbox(2)),2,'mixed bounded queue advances class and assignment domains');
select is((select count(*)::integer from public.domain_events where event_key='mixed:assignment' and processed_at is not null),1,'class backlog cannot starve assignment event');
select is((select count(*)::integer from public.domain_events where aggregate_type='class_session' and processed_at is not null),1,'class domain advances within same bounded call');
select is((select processed_count from public.process_notification_outbox(2)),1,'remaining latest class revision consumed');
select is((select count(*)::integer from public.notifications where class_session_id=current_setting('test.class')::uuid),2,'only latest revision delivered to two active cohort students');
select is((select processed_count from public.process_notification_outbox(100)),0,'retry sends no duplicates');
reset role;set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is(jsonb_array_length(public.list_my_class_agenda()),1,'own active cohort agenda');
select is((select count(*)::integer from public.list_my_notifications(100) where event_type like 'class_%'),1,'own latest class alert visible');
select throws_ok('select * from public.class_sessions','42501',null,'raw session table unavailable');
reset role;
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,scope_id,grant_reason) values('e1000000-0000-4000-8000-000000000001','class.schedule','teacher','offering','e2000000-0000-4000-8000-000000000001','Fictional mixed-role regression');
update public.role_assignments set revoked_at=now() where person_id='e1000000-0000-4000-8000-000000000001' and role_key='ordinary_admin';
set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.current_person_can_schedule_classes('e2000000-0000-4000-8000-000000000001'),false,'mixed teacher grant never replaces revoked ordinary admin role');
select is(jsonb_array_length(public.list_my_class_agenda()),0,'teacher has no new agenda authority');
reset role;
update public.role_assignments set revoked_at=null where person_id='e1000000-0000-4000-8000-000000000001' and role_key='ordinary_admin';
set local role authenticated;
select public.save_class_session(current_setting('test.class')::uuid,'e2000000-0000-4000-8000-000000000001','e3000000-0000-4000-8000-000000000001',repeat('private ignored payload',1000),null,null,'invalid','https://ignored.invalid',2,true,true,gen_random_uuid());
reset role;
select is(position('private ignored' in (select request_arguments::text from public.class_session_revisions where session_id=current_setting('test.class')::uuid and revision=3)),0,'ignored cancellation input never retained');
set local role service_role;
select public.process_notification_outbox(100);
reset role;set local role authenticated;
set local request.jwt.claims='{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select event_type from public.list_my_notifications(100) where event_type like 'class_%'),'class_cancelled','obsolete prior alert hidden after cancellation');
reset role;
update public.enrollments set status='completed',ended_at=clock_timestamp() where id='e4000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.list_my_class_agenda(),'[]'::jsonb,'course closeout hides schedule immediately');
select is((select count(*)::integer from public.list_my_notifications(100)),0,'closed course alert cannot reopen schedule');
reset role;
update public.class_sessions set retention_until=now()-interval '1 second' where id=current_setting('test.class')::uuid;
set local role service_role;
select is(public.purge_expired_class_sessions(100),1,'expired class and linked history removed');
select is(public.purge_expired_class_sessions(100),0,'purge retry idempotent');
select is((select count(*)::integer from public.class_session_revisions),0,'identifiable actor history purged');
select is((select count(*)::integer from public.domain_events where aggregate_type='class_session'),0,'linked schedule events purged');
select * from finish();rollback;
