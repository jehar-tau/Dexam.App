begin;
select no_plan();

insert into auth.users(id,aud,role,email) values
 ('b1510000-0000-4000-a000-000000000001','authenticated','authenticated','projection-owner@dexam.test'),
 ('b1510000-0000-4000-a000-000000000002','authenticated','authenticated','projection-other@dexam.test');
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
 select id,id,'aal1',now(),now() from auth.users where id in
 ('b1510000-0000-4000-a000-000000000001','b1510000-0000-4000-a000-000000000002');
insert into public.people(id,member_id,display_name) values
 ('b1510000-0000-4000-a000-000000000001','DXM-V72Q9M4X6WKP','Fictional Projection Owner'),
 ('b1510000-0000-4000-a000-000000000002','DXM-V72Q9M4X6WKR','Fictional Projection Other');
insert into public.auth_identities(person_id,auth_user_id,kind)
 select id,id,'member_id' from public.people where id in
 ('b1510000-0000-4000-a000-000000000001','b1510000-0000-4000-a000-000000000002');
insert into public.memberships(person_id,kind,status,starts_at) values
 ('b1510000-0000-4000-a000-000000000001','student','active',now()-interval '1 day'),
 ('b1510000-0000-4000-a000-000000000002','student','active',now()-interval '1 day');
insert into public.offerings(id,code,title,status)
 values ('b1520000-0000-4000-a000-000000000001','PROJECTION_QA','Fictional Projection Course','active');
insert into public.enrollments(id,person_id,offering_id,status,source_type,approved_by_person_id,approved_at,activated_at)
 values ('b1530000-0000-4000-a000-000000000001','b1510000-0000-4000-a000-000000000001',
 'b1520000-0000-4000-a000-000000000001','active','manual','b1510000-0000-4000-a000-000000000001',now(),now());

set local role authenticated;
set local request.jwt.claims='{"sub":"b1510000-0000-4000-a000-000000000002","session_id":"b1510000-0000-4000-a000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*) from public.list_my_student_enrollment_access()),0::bigint,'another student cannot see the enrollment');
set local request.jwt.claims='{"sub":"b1510000-0000-4000-a000-000000000001","session_id":"b1510000-0000-4000-a000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select access_state from public.list_my_student_enrollment_access()),'active','an active legacy enrollment retains learning access');
reset role;
insert into public.enrollment_access_windows(enrollment_id,starts_at,expires_at,updated_by)
 values ('b1530000-0000-4000-a000-000000000001',now()+interval '1 day',now()+interval '2 days','b1510000-0000-4000-a000-000000000001');
set local role authenticated;
select is((select access_state from public.list_my_student_enrollment_access()),'scheduled','an upcoming window is scheduled');
reset role;
update public.enrollment_access_windows set starts_at=now()-interval '3 years', expires_at=now() where enrollment_id='b1530000-0000-4000-a000-000000000001';
set local role authenticated;
select ok((select access_state='expired' and archive_available from public.list_my_student_enrollment_access()),'the expired course card opens its currently available archive');
reset role;
update public.enrollment_access_windows set expires_at=now()-interval '12 months' where enrollment_id='b1530000-0000-4000-a000-000000000001';
set local role authenticated;
select ok((select access_state='expired' and not archive_available from public.list_my_student_enrollment_access()),'the card cannot offer an elapsed archive');
reset role;
update public.enrollment_access_windows set state='revoked' where enrollment_id='b1530000-0000-4000-a000-000000000001';
set local role authenticated;
select ok((select access_state='revoked' and not archive_available from public.list_my_student_enrollment_access()),'revocation takes priority over timed expiry');
select ok(not has_function_privilege('anon','public.list_my_student_enrollment_access()','execute'),'anonymous callers have no projection access');
select * from finish();
rollback;
