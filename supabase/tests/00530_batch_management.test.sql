begin;
select no_plan();
-- D-066/F055: Sales create batches; Sales and scoped teachers place students; students never read batch dates.
insert into auth.users(id,instance_id,aud,role,email,encrypted_password)
select ('ba000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','batch-'||n||'@dexam.test',''
from generate_series(1,6) n;
-- 1 Sales, 2 teacher scoped to A, 3 teacher scoped to B, 4 employee without role, 5 student in A, 6 student with pinned curriculum
insert into public.people(id,member_id,display_name) values
 ('ba100000-0000-4000-8000-000000000001',null,'Fictional Sales'),
 ('ba100000-0000-4000-8000-000000000002',null,'Fictional Teacher A'),
 ('ba100000-0000-4000-8000-000000000003',null,'Fictional Teacher B'),
 ('ba100000-0000-4000-8000-000000000004',null,'Fictional Other Employee'),
 ('ba100000-0000-4000-8000-000000000005','DXM-BA3M9Q2RW5TY','Fictional Student One'),
 ('ba100000-0000-4000-8000-000000000006','DXM-BB3M9Q2RW5TY','Fictional Student Two');
insert into public.auth_identities(person_id,auth_user_id,kind)
select ('ba100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('ba000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  (case when n<=4 then 'employee_email' else 'member_id' end)::public.auth_identity_kind from generate_series(1,6) n;
insert into public.memberships(person_id,kind,status,starts_at)
select ('ba100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,(case when n<=4 then 'employee' else 'student' end)::public.membership_kind,'active',now()-interval '1 day'
from generate_series(1,6) n;
insert into public.offerings(id,code,title,status) values
 ('ba200000-0000-4000-8000-000000000001','BATCH_A','Fictional Batch Course A','active'),
 ('ba200000-0000-4000-8000-000000000002','BATCH_B','Fictional Batch Course B','active');
insert into public.role_assignments(person_id,role_key,scope_type,scope_id,grant_reason) values
 ('ba100000-0000-4000-8000-000000000001','sales','global',null,'Fictional batch Sales'),
 ('ba100000-0000-4000-8000-000000000002','teacher','offering','ba200000-0000-4000-8000-000000000001','Fictional batch teacher A'),
 ('ba100000-0000-4000-8000-000000000003','teacher','offering','ba200000-0000-4000-8000-000000000002','Fictional batch teacher B'),
 ('ba100000-0000-4000-8000-000000000004','ordinary_admin','global',null,'Fictional unrelated employee');
insert into public.curriculum_versions(id,offering_id,version_number,title,created_by_person_id) values
 ('ba300000-0000-4000-8000-000000000001','ba200000-0000-4000-8000-000000000001',1,'Fictional batch curriculum','ba100000-0000-4000-8000-000000000001');
insert into public.curriculum_sections(id,curriculum_version_id,code,title,position) values('ba310000-0000-4000-8000-000000000001','ba300000-0000-4000-8000-000000000001','DRAWING','Drawing',1);
insert into public.curriculum_topics(id,section_id,code,title,summary,position) values('ba320000-0000-4000-8000-000000000001','ba310000-0000-4000-8000-000000000001','LINES','Lines',null,1);
update public.curriculum_versions set status='published',published_by_person_id='ba100000-0000-4000-8000-000000000001',published_at=now(),release_note='Fictional batch release'
 where id='ba300000-0000-4000-8000-000000000001';
insert into public.enrollments(id,person_id,offering_id,curriculum_version_id,status,source_type) values
 ('ba400000-0000-4000-8000-000000000001','ba100000-0000-4000-8000-000000000005','ba200000-0000-4000-8000-000000000001',null,'active','manual'),
 ('ba400000-0000-4000-8000-000000000002','ba100000-0000-4000-8000-000000000006','ba200000-0000-4000-8000-000000000001','ba300000-0000-4000-8000-000000000001','active','manual');
-- An older batch without curriculum, so the curriculum-preservation rule can be proven.
insert into public.cohorts(id,offering_id,code,name,status,starts_at,ends_at) values
 ('ba500000-0000-4000-8000-000000000009','ba200000-0000-4000-8000-000000000001','LEGACY_A','Fictional legacy batch','active',now()-interval '30 days',now()+interval '30 days');
insert into public.enrollment_access_windows(enrollment_id,starts_at,expires_at,state,updated_by) values
 ('ba400000-0000-4000-8000-000000000001',now()-interval '1 day',now()+interval '300 days','active','ba100000-0000-4000-8000-000000000004');
insert into auth.sessions(id,user_id,aal,created_at,updated_at) select id,id,'aal1',now(),now() from auth.users where id::text like 'ba000000-%';
create temporary table batch_ids(label text primary key,id uuid);
grant all on batch_ids to authenticated;

set local role authenticated;
-- Sales creates batches with service type and dates; retries are idempotent.
set local request.jwt.claims='{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"ba000000-0000-4000-8000-000000000001"}';
select is((public.get_batch_workspace()->>'canManage')::boolean,true,'Sales may create batches');
select is(jsonb_array_length(public.get_batch_workspace()->'serviceTypes'),4,'four service types offered');
select is(public.get_my_navigation_access()->>'batches','true','Sales see the Batches link');
select is(public.get_my_navigation_access()->>'batchAssign','false','Sales get no Teacher-portal placement link');
insert into batch_ids select 'december',public.save_batch('ba600000-0000-4000-8000-000000000001',null,null,'ba200000-0000-4000-8000-000000000001',
  'Weekend studio','end_to_end','2026-12-01T00:00:00+05:30','2027-12-01T00:00:00+05:30','active');
select is(public.save_batch('ba600000-0000-4000-8000-000000000001',null,null,'ba200000-0000-4000-8000-000000000001',
  'Weekend studio','end_to_end','2026-12-01T00:00:00+05:30','2027-12-01T00:00:00+05:30','active'),(select id from batch_ids where label='december'),'same request returns the same batch');
select throws_ok($$select public.save_batch('ba600000-0000-4000-8000-000000000001',null,null,'ba200000-0000-4000-8000-000000000001',
  'Changed name','end_to_end','2026-12-01T00:00:00+05:30','2027-12-01T00:00:00+05:30','active')$$,'40001',null,'a reused request key cannot change the batch');
insert into batch_ids select 'crash',public.save_batch('ba600000-0000-4000-8000-000000000002',null,null,'ba200000-0000-4000-8000-000000000001',
  'Crash course','crash_course','2026-11-15T00:00:00+05:30','2026-12-30T00:00:00+05:30','active');
select throws_ok($$select public.save_batch('ba600000-0000-4000-8000-000000000003',null,null,'ba200000-0000-4000-8000-000000000001',
  'Backwards','crash_course','2026-11-15T00:00:00+05:30','2026-11-01T00:00:00+05:30','active')$$,'22023',null,'end must follow start');
select throws_ok($$select public.save_batch('ba600000-0000-4000-8000-000000000004',null,null,'ba200000-0000-4000-8000-000000000001',
  'Unknown service','gap_year','2026-11-15T00:00:00+05:30','2026-12-30T00:00:00+05:30','active')$$,'22023',null,'unknown service type refused');
select is((select count(*)::int from jsonb_array_elements(public.get_batch_workspace()->'batches') b where b->>'serviceType'='end_to_end'),1,'service type stored');
select is(public.save_batch('ba600000-0000-4000-8000-000000000005',(select id from batch_ids where label='crash'),1,'ba200000-0000-4000-8000-000000000001',
  'Crash course · November','crash_course','2026-11-15T00:00:00+05:30','2027-01-15T00:00:00+05:30','active'),(select id from batch_ids where label='crash'),'Sales edit with the current revision');
select throws_ok($$select public.save_batch('ba600000-0000-4000-8000-000000000006',(select id from batch_ids where label='crash'),1,'ba200000-0000-4000-8000-000000000001',
  'Stale edit','crash_course','2026-11-15T00:00:00+05:30','2027-01-15T00:00:00+05:30','active')$$,'40001',null,'stale revision refused');
select throws_ok($$select * from public.cohorts$$,'42501',null,'no client may read cohort dates through select *');
-- Sales place a student; the move is recorded with the reason.
select is((select count(*)::int from public.list_batch_students('ba200000-0000-4000-8000-000000000001')),2,'Sales see the course roster for placement');
select is((select movable from public.list_batch_students('ba200000-0000-4000-8000-000000000001') where enrollment_id='ba400000-0000-4000-8000-000000000002'),false,'pinned curriculum enrolment is flagged');
select is(public.assign_student_batch('ba700000-0000-4000-8000-000000000001','ba400000-0000-4000-8000-000000000001',null,(select id from batch_ids where label='december'),'Converted lead joins December'),
  (select id from batch_ids where label='december'),'Sales place a converted student');
select is(public.assign_student_batch('ba700000-0000-4000-8000-000000000001','ba400000-0000-4000-8000-000000000001',null,(select id from batch_ids where label='december'),'Converted lead joins December'),
  (select id from batch_ids where label='december'),'retry is idempotent');
select throws_ok($$select public.assign_student_batch('ba700000-0000-4000-8000-000000000002','ba400000-0000-4000-8000-000000000002',null,(select id from batch_ids where label='december'),'Pinned student')$$,
  '22023',null,'pinned-curriculum enrolment needs an admin');
select throws_ok($$select public.assign_student_batch('ba700000-0000-4000-8000-000000000003','ba400000-0000-4000-8000-000000000001',null,(select id from batch_ids where label='crash'),'Stale view')$$,
  '40001',null,'stale expected batch refused');

-- Teacher scoped to A moves the student; teacher of B and an unrelated employee cannot.
set local request.jwt.claims='{"sub":"ba000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"ba000000-0000-4000-8000-000000000002"}';
select is((public.get_batch_workspace()->>'canManage')::boolean,false,'teacher cannot create batches');
select throws_ok($$select public.save_batch('ba600000-0000-4000-8000-000000000007',null,null,'ba200000-0000-4000-8000-000000000001',
  'Teacher batch','portfolio','2026-11-15T00:00:00+05:30','2026-12-30T00:00:00+05:30','active')$$,'42501',null,'teacher batch creation denied');
select is(public.get_my_navigation_access()->>'batchAssign','true','scoped teacher sees the batch placement link');
select is(public.get_my_navigation_access()->>'batches','false','teacher has no batch creation link');
select is(public.assign_student_batch('ba700000-0000-4000-8000-000000000004','ba400000-0000-4000-8000-000000000001',(select id from batch_ids where label='december'),(select id from batch_ids where label='crash'),'Moved to the crash course'),
  (select id from batch_ids where label='crash'),'scoped teacher moves a student between batches');
select throws_ok($$select public.assign_student_batch('ba700000-0000-4000-8000-000000000005','ba400000-0000-4000-8000-000000000001',(select id from batch_ids where label='crash'),(select id from batch_ids where label='crash'),'Same batch')$$,
  '22023',null,'no-op move refused');
set local request.jwt.claims='{"sub":"ba000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"ba000000-0000-4000-8000-000000000003"}';
select throws_ok($$select * from public.list_batch_students('ba200000-0000-4000-8000-000000000001')$$,'42501',null,'teacher of another course cannot list the roster');
select throws_ok($$select public.assign_student_batch('ba700000-0000-4000-8000-000000000006','ba400000-0000-4000-8000-000000000001',(select id from batch_ids where label='crash'),(select id from batch_ids where label='december'),'Out of scope')$$,
  '42501',null,'teacher of another course cannot move the student');
set local request.jwt.claims='{"sub":"ba000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"ba000000-0000-4000-8000-000000000004"}';
select throws_ok($$select public.get_batch_workspace()$$,'42501',null,'employee without batch authority denied');

-- Student sees the batch name, never its dates.
set local request.jwt.claims='{"sub":"ba000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","session_id":"ba000000-0000-4000-8000-000000000005"}';
select is((select c.name from public.enrollments e join public.cohorts c on c.id=e.cohort_id where e.id='ba400000-0000-4000-8000-000000000001'),'Crash course · November','student reads own batch name');
select throws_ok($$select starts_at from public.cohorts$$,'42501',null,'student cannot read batch start date');
select throws_ok($$select ends_at from public.cohorts$$,'42501',null,'student cannot read batch end date');
select throws_ok($$select public.get_batch_workspace()$$,'42501',null,'student cannot open the batch workspace');
select throws_ok($$select public.assign_student_batch('ba700000-0000-4000-8000-000000000007','ba400000-0000-4000-8000-000000000001',(select id from batch_ids where label='crash'),(select id from batch_ids where label='december'),'Self move')$$,
  '42501',null,'student cannot move themself');
set local role anon;
select throws_ok($$select public.get_batch_workspace()$$,'42501',null,'anonymous denied');

reset role;
select is((select revision from public.enrollment_access_windows where enrollment_id='ba400000-0000-4000-8000-000000000001'),3::bigint,'each placement makes stale admissions editors refresh');
select is((select updated_by from public.enrollment_access_windows where enrollment_id='ba400000-0000-4000-8000-000000000001'),'ba100000-0000-4000-8000-000000000004'::uuid,'access record keeps its last editor');
select ok((select expires_at>now()+interval '299 days' and state='active' from public.enrollment_access_windows where enrollment_id='ba400000-0000-4000-8000-000000000001'),'access dates and state unchanged by placement');
select is((select count(*)::int from public.cohort_assignment_history where enrollment_id='ba400000-0000-4000-8000-000000000001'),2,'each placement recorded once');
select is((select from_cohort_id from public.cohort_assignment_history where request_key='ba700000-0000-4000-8000-000000000004'),(select id from batch_ids where label='december'),'history keeps the previous batch');
select is((select count(*)::int from public.cohort_change_history where action='updated'),1,'batch edit recorded with prior values');
select is((select curriculum_version_id from public.cohorts where id=(select id from batch_ids where label='december')),'ba300000-0000-4000-8000-000000000001'::uuid,'new batch pins the published curriculum');
-- Curriculum preservation: a student in the curriculum-free legacy batch may join, but one pinned through a batch cannot cross curricula.
update public.enrollments set cohort_id='ba500000-0000-4000-8000-000000000009' where id='ba400000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims='{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"ba000000-0000-4000-8000-000000000001"}';
select is(public.assign_student_batch('ba700000-0000-4000-8000-000000000008','ba400000-0000-4000-8000-000000000001','ba500000-0000-4000-8000-000000000009',(select id from batch_ids where label='december'),'Join curriculum batch'),
  (select id from batch_ids where label='december'),'curriculum-free batch member can join a curriculum batch');
select throws_ok($$select public.assign_student_batch('ba700000-0000-4000-8000-000000000009','ba400000-0000-4000-8000-000000000001',(select id from batch_ids where label='december'),'ba500000-0000-4000-8000-000000000009','Back to legacy')$$,
  '22023',null,'cannot leave a pinned curriculum through a batch move');
select * from finish();
rollback;
