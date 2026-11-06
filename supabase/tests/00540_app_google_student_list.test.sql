begin;
select no_plan();
-- D-067/F056: only listed full-course students enter the Dexam App with Google.
-- Users: 1 Sales, 2 Elevated Admin, 3 teacher, 4 listed student's Google, 5 unlisted Google, 6 Mock Test candidate's Google.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
select ('ae000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'app'||n||'@fixture.invalid',now(),'{}' from generate_series(1,6) n;
insert into auth.identities(provider_id,user_id,identity_data,provider)
select 'fixture-app-google-'||n,('ae000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  jsonb_build_object('sub','fixture-app-google-'||n,'email','app'||n||'@fixture.invalid','email_verified',true),'google'
from generate_series(4,6) n;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now()-interval '1 minute',now() from auth.users where id::text like 'ae000000-%';
-- The admin also holds a verified-TOTP session for revocation (requires live MFA).
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
values('ae300000-0000-4000-8000-000000000002','ae000000-0000-4000-8000-000000000002','totp','verified',now(),now());
insert into auth.sessions(id,user_id,factor_id,aal,created_at,updated_at)
values('ae400000-0000-4000-8000-000000000002','ae000000-0000-4000-8000-000000000002','ae300000-0000-4000-8000-000000000002','aal2',now()-interval '1 minute',now());
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at)
values('ae500000-0000-4000-8000-000000000002','ae400000-0000-4000-8000-000000000002','totp',now(),now());
insert into public.people(id,member_id,display_name) values
 ('ae100000-0000-4000-8000-000000000001',null,'Fictional Sales'),
 ('ae100000-0000-4000-8000-000000000002',null,'Fictional App Admin'),
 ('ae100000-0000-4000-8000-000000000003',null,'Fictional Teacher'),
 ('ae100000-0000-4000-8000-000000000004','DXM-AE3M9Q2RW5TY','Fictional Paid Student'),
 ('ae100000-0000-4000-8000-000000000006',null,'Fictional Mock Test Candidate'),
 ('ae100000-0000-4000-8000-000000000007','DXM-AF3M9Q2RW5TY','Fictional Former Student');
insert into public.auth_identities(person_id,auth_user_id,kind) values
 ('ae100000-0000-4000-8000-000000000001','ae000000-0000-4000-8000-000000000001','employee_email'),
 ('ae100000-0000-4000-8000-000000000002','ae000000-0000-4000-8000-000000000002','employee_email'),
 ('ae100000-0000-4000-8000-000000000003','ae000000-0000-4000-8000-000000000003','employee_email'),
 ('ae100000-0000-4000-8000-000000000006','ae000000-0000-4000-8000-000000000006','oauth_google');
insert into public.memberships(person_id,kind,status,starts_at) values
 ('ae100000-0000-4000-8000-000000000001','employee','active',now()-interval '1 day'),
 ('ae100000-0000-4000-8000-000000000002','employee','active',now()-interval '1 day'),
 ('ae100000-0000-4000-8000-000000000003','employee','active',now()-interval '1 day'),
 ('ae100000-0000-4000-8000-000000000004','student','active',now()-interval '1 day'),
 ('ae100000-0000-4000-8000-000000000006','candidate','active',now()-interval '1 day'),
 ('ae100000-0000-4000-8000-000000000007','student','ended',now()-interval '400 days');
insert into public.role_assignments(person_id,role_key,grant_reason) values
 ('ae100000-0000-4000-8000-000000000001','sales','Fictional App Sales'),
 ('ae100000-0000-4000-8000-000000000002','elevated_admin','Fictional App Admin'),
 ('ae100000-0000-4000-8000-000000000003','teacher','Fictional App Teacher');
update public.app_google_login_gate set enabled=true;

set local role authenticated;
-- Sales add a current student's Google email; retries are idempotent.
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000001","session_id":"ae000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.get_my_navigation_access()->>'studentLogins','true','Sales see the Google list link');
select is(public.get_my_navigation_access()->>'studentLoginRevoke','false','Sales cannot revoke');
select is((select count(*)::int from public.list_student_google_logins('fictional paid')),1,'Sales find the current student');
select is((select count(*)::int from public.list_student_google_logins('former')),0,'former students are not listed');
select is(public.approve_student_google_login('ae200000-0000-4000-8000-000000000001','ae100000-0000-4000-8000-000000000004','  App4@Fixture.invalid ','Paid full course'),1::bigint,'Sales add the student''s Google email');
select is(public.approve_student_google_login('ae200000-0000-4000-8000-000000000001','ae100000-0000-4000-8000-000000000004','app4@fixture.invalid','Paid full course'),1::bigint,'retry is idempotent');
select throws_ok($$select public.approve_student_google_login('ae200000-0000-4000-8000-000000000002','ae100000-0000-4000-8000-000000000004','other@fixture.invalid','Second email')$$,'22023',null,'a second email needs admin revocation first');
select throws_ok($$select public.approve_student_google_login('ae200000-0000-4000-8000-000000000003','ae100000-0000-4000-8000-000000000007','app7@fixture.invalid','Former student')$$,'22023',null,'former students cannot be added');
select throws_ok($$select public.approve_student_google_login('ae200000-0000-4000-8000-000000000004','ae100000-0000-4000-8000-000000000006','app6@fixture.invalid','Candidate')$$,'22023',null,'Mock Test candidates cannot be added');
select throws_ok($$select public.revoke_student_google_login('ae200000-0000-4000-8000-000000000005','ae100000-0000-4000-8000-000000000004',1,'Sales revoke')$$,'42501',null,'Sales cannot revoke');
-- Security review: Sales must not bind a Google account to a staff member who is also a student.
reset role;
insert into public.memberships(person_id,kind,status,starts_at) values('ae100000-0000-4000-8000-000000000003','student','active',now()-interval '1 day');
set local role authenticated;
select is((select count(*)::int from public.list_student_google_logins('fictional teacher')),0,'staff-students are not on the student list');
select throws_ok($$select public.approve_student_google_login('ae200000-0000-4000-8000-000000000012','ae100000-0000-4000-8000-000000000003','app5@fixture.invalid','Takeover attempt')$$,'22023',null,'Sales cannot add a staff member');
select throws_ok($$select * from public.approved_login_emails$$,'42501',null,'no direct table access');
-- A teacher has no list access.
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000003","session_id":"ae000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select throws_ok($$select * from public.list_student_google_logins('')$$,'42501',null,'teacher denied');
select throws_ok($$select public.approve_student_google_login('ae200000-0000-4000-8000-000000000006','ae100000-0000-4000-8000-000000000004','app4@fixture.invalid','Teacher add')$$,'42501',null,'teacher cannot add');

-- The listed student enters the App with Google and keeps the canonical person.
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000004","session_id":"ae000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
-- D-068: not before the admission fee is recorded, and the Google account is not linked meanwhile.
select is(public.claim_app_google_login(),'{"allowed":false,"reason":"admission_fee_pending"}'::jsonb,'unpaid listed student is refused');
select is(public.current_person_id(),null,'unpaid student''s Google account is not linked');
reset role;
insert into public.offerings(id,code,title,status) values('ae700000-0000-4000-8000-000000000001','APPFIX','Fictional App Course','active');
insert into public.enrollments(id,person_id,offering_id,status,source_type)
  values('ae800000-0000-4000-8000-000000000004','ae100000-0000-4000-8000-000000000004','ae700000-0000-4000-8000-000000000001','active','fixture');
insert into public.student_payments(request_key,enrollment_id,person_id,kind,method,amount_paise,paid_on,collected_by_person_id,recorded_by_person_id)
  values('ae900000-0000-4000-8000-000000000004','ae800000-0000-4000-8000-000000000004','ae100000-0000-4000-8000-000000000004',
    'admission_fee','cash',500000,current_date,'ae100000-0000-4000-8000-000000000001','ae100000-0000-4000-8000-000000000001');
set local role authenticated;
select is(public.claim_app_google_login(),'{"allowed":true,"audience":"student"}'::jsonb,'listed student is allowed');
select is(public.current_person_id(),'ae100000-0000-4000-8000-000000000004'::uuid,'Google maps to the existing student');
select is(public.claim_app_google_login(),'{"allowed":true,"audience":"student"}'::jsonb,'returning sign-in is idempotent');
-- An unlisted Google account is refused and never becomes a candidate through the App.
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000005","session_id":"ae000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
select is(public.claim_app_google_login(),'{"allowed":false}'::jsonb,'unlisted Google account refused');
select is(public.current_person_id(),null,'no person created for the unlisted account');
-- Even a reservation written directly for a staff-student never binds Google to the staff person.
reset role;
insert into public.approved_login_emails(person_id,email,purpose,created_by) values('ae100000-0000-4000-8000-000000000003','app5@fixture.invalid','student','ae100000-0000-4000-8000-000000000002');
set local role authenticated;
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000005","session_id":"ae000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.claim_app_google_login()$$,'42501',null,'student reservation cannot bind Google to a staff person');
reset role;
delete from public.approved_login_emails where person_id='ae100000-0000-4000-8000-000000000003';
set local role authenticated;
-- A Mock Test candidate's Google account is refused by the App.
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000006","session_id":"ae000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
select is(public.claim_app_google_login(),'{"allowed":false}'::jsonb,'Mock Test candidate cannot enter the App');

-- The admin revokes: Google is unlinked and its sessions end; restore is admin-only.
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000002","session_id":"ae400000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is(public.get_my_navigation_access()->>'studentLoginRevoke','true','admin sees revoke');
select is((select linked from public.list_student_google_logins('app4')),true,'list shows the linked Google account');
select throws_ok($$select public.revoke_student_google_login('ae200000-0000-4000-8000-000000000007','ae100000-0000-4000-8000-000000000004',99,'Stale view')$$,'40001',null,'stale revision refused');
select is(public.revoke_student_google_login('ae200000-0000-4000-8000-000000000008','ae100000-0000-4000-8000-000000000004',1,'Course fees refunded'),2::bigint,'admin revokes');
select is((select state from public.list_student_google_logins('app4')),'revoked','list shows revoked');
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000004","session_id":"ae000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select is(public.current_person_id(),null,'revoked student''s Google session no longer acts');
select throws_ok($$select public.claim_app_google_login()$$,'42501',null,'the old Google session is refused outright');
reset role;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
values('ae600000-0000-4000-8000-000000000004','ae000000-0000-4000-8000-000000000004','aal1',now()+interval '1 minute',now());
set local role authenticated;
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000004","session_id":"ae600000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select is(public.claim_app_google_login(),'{"allowed":false}'::jsonb,'a fresh Google sign-in after revocation is refused');
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000001","session_id":"ae000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.approve_student_google_login('ae200000-0000-4000-8000-000000000009','ae100000-0000-4000-8000-000000000004','app4@fixture.invalid','Sales re-add')$$,'42501',null,'Sales cannot undo an admin revocation');
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000002","session_id":"ae400000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is(public.approve_student_google_login('ae200000-0000-4000-8000-000000000010','ae100000-0000-4000-8000-000000000004','app4@fixture.invalid','Fees received again'),3::bigint,'admin restores');
set local request.jwt.claims='{"sub":"ae000000-0000-4000-8000-000000000002","session_id":"ae000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.revoke_student_google_login('ae200000-0000-4000-8000-000000000011','ae100000-0000-4000-8000-000000000004',3,'No MFA')$$,'42501',null,'revocation requires a current MFA session');
set local role anon;
select throws_ok($$select public.claim_app_google_login()$$,'42501',null,'anonymous cannot call the App claim');

reset role;
select is((select count(*)::int from public.student_google_login_history where person_id='ae100000-0000-4000-8000-000000000004'),3,'approve, revoke and restore recorded');
select ok(exists(select 1 from public.auth_session_cutoffs where auth_user_id='ae000000-0000-4000-8000-000000000004'),'revocation cut off the Google sessions');
select is((select count(*)::int from public.memberships where person_id='ae100000-0000-4000-8000-000000000004' and kind='candidate'),0,'App sign-in never created a candidate');
select is((select count(*)::int from public.auth_identities where auth_user_id='ae000000-0000-4000-8000-000000000005'),0,'unlisted account has no person link');
select * from finish();
rollback;
