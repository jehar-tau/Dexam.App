begin;
select no_plan();

-- Every fixture and the temporary mutation-gate change roll back together.
insert into auth.users(id,instance_id,aud,role,email)
select ('ab000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'admin'||n||'@admission.fixture.invalid' from generate_series(1,3) n;
insert into public.people(id,display_name)
select ('ab100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'Fictional Admin '||n from generate_series(1,3) n;
insert into public.auth_identities(person_id,auth_user_id,kind)
select ('ab100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('ab000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'employee_email' from generate_series(1,3) n;
insert into public.memberships(person_id,kind,status)
select id,'employee','active' from public.people where id::text like 'ab100000-%';
insert into public.role_assignments(person_id,role_key,grant_reason)
select id,'elevated_admin','Fictional shared directory test' from public.people where id::text like 'ab100000-%';
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)
select ('ab200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('ab000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'totp','verified',now(),now() from generate_series(1,3) n;
insert into auth.sessions(id,user_id,factor_id,aal,created_at,updated_at)
select ('ab300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('ab000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('ab200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'aal2',now(),now() from generate_series(1,3) n;
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at)
select ('ab400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('ab300000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'totp',now(),now() from generate_series(1,3) n;
insert into public.offerings(id,code,title,status) values
 ('ab500000-0000-4000-8000-000000000001','F054_FICTION','Fictional Admissions Course','active');
insert into public.cohorts(id,offering_id,code,name,status) values
 ('ab600000-0000-4000-8000-000000000001','ab500000-0000-4000-8000-000000000001','F054_A','Fictional A','active'),
 ('ab600000-0000-4000-8000-000000000002','ab500000-0000-4000-8000-000000000001','F054_B','Fictional B','active');

select is(public.admission_normalized_email(' Student.Name+Course@Fixture.Invalid '),'student.name+course@fixture.invalid','case and whitespace normalize without stripping dots/plus');
select throws_ok($$select public.admission_normalized_email('a..b@fixture.invalid')$$,'22023',null,'invalid email rejected');
select is(public.admission_preset_expiry('2024-02-29T10:00:00+05:30',12),'2025-02-28T10:00:00+05:30'::timestamptz,'calendar year clamps leap day');
select is(public.admission_preset_expiry('2024-02-29T10:00:00+05:30',48),'2028-02-29T10:00:00+05:30'::timestamptz,'four calendar years preserve leap day');
select is(public.admission_preset_expiry('2026-10-31T10:00:00+05:30',30)-'2026-10-31T10:00:00+05:30'::timestamptz,interval '720 hours','30 days is exact elapsed duration');
select throws_ok($$select public.admission_preset_expiry('9999-01-01T00:00:00Z',48)$$,'22023',null,'unsupported expiry overflow fails closed');
select is((select enabled from public.admissions_runtime_gate),false,'unfinished integration is disabled by default');

-- Stable parameters let replay tests assert exact request identity, not accidental new timestamps.
select set_config('test.start',(now()+interval '1 day')::text,true);
select set_config('test.expiry',(now()+interval '31 days')::text,true);
select set_config('test.paid',now()::text,true);
create function pg_temp.admit(p_request uuid default 'ab700000-0000-4000-8000-000000000001',p_email text default 'student@admission.fixture.invalid',p_person uuid default null,p_confirmed boolean default true)
returns jsonb language sql as $$
 select public.admit_student(p_request,p_person,p_email,'Fictional Learner',
 'ab500000-0000-4000-8000-000000000001','ab600000-0000-4000-8000-000000000001',
 current_setting('test.start')::timestamptz,current_setting('test.expiry')::timestamptz,
 'cash',250000,current_setting('test.paid')::timestamptz,'Fictional receipt only',p_confirmed,'Reviewed fictional admission')
$$;
set local role authenticated;
set local request.jwt.claims='{"sub":"ab000000-0000-4000-8000-000000000001","session_id":"ab300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(public.current_person_can_manage_admissions(),true,'fresh global elevated admin has existing admission authority');
select throws_ok('select pg_temp.admit()','55000',null,'runtime gate blocks writes even for administrator');
select throws_ok('select * from public.approved_login_emails','42501',null,'browser cannot enumerate login reservations directly');
select throws_ok('update public.admissions_runtime_gate set enabled=true','42501',null,'browser cannot enable integration');
reset role;
update public.admissions_runtime_gate set enabled=true;
set local role authenticated;
select throws_ok($$select pg_temp.admit(p_confirmed=>false)$$,'22023',null,'manual confirmation is mandatory');
select set_config('test.admission',pg_temp.admit()::text,true);
select is((pg_temp.admit()->>'replayed')::boolean,true,'same actor and exact request replay one receipt');
select throws_ok($$select pg_temp.admit(p_email=>'other@admission.fixture.invalid')$$,'40001',null,'request cannot be reused for another student');
select throws_ok($$select pg_temp.admit('ab700000-0000-4000-8000-000000000002',' STUDENT@admission.fixture.invalid ')$$,'40001',null,'normalized duplicate requires deliberate canonical selection');
select is(jsonb_array_length(public.list_admissions_directory('Fictional Learner')),1,'first administrator sees shared admission');
set local request.jwt.claims='{"sub":"ab000000-0000-4000-8000-000000000002","session_id":"ab300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is(jsonb_array_length(public.list_admissions_directory('student@admission.fixture.invalid')),1,'second administrator sees same admission');
select throws_ok('select pg_temp.admit()','40001',null,'another actor cannot replay receipt approval');
select is(public.edit_admission((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid,1,1,'ab800000-0000-4000-8000-000000000001','details','Verified name spelling','Fictional Updated Learner'),2::bigint,'second administrator edits shared profile with expected revisions');
select throws_ok($$select public.edit_admission((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid,1,1,'ab800000-0000-4000-8000-000000000002','details','Stale tab edit','Stale Name')$$,'40001',null,'stale edit cannot overwrite newer profile');
select is(public.edit_admission((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid,1,1,'ab800000-0000-4000-8000-000000000001','details','Verified name spelling','Fictional Updated Learner'),2::bigint,'exact edit retry is idempotent');
set local request.jwt.claims='{"sub":"ab000000-0000-4000-8000-000000000003","session_id":"ab300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select is(public.list_admissions_directory('Updated')->0->>'name','Fictional Updated Learner','third administrator sees second administrator edit');
select is(jsonb_array_length(public.get_admission_history((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid)->'receipts'),1,'history keeps exactly one manual receipt');
reset role;
select is((select count(*)::integer from public.admission_receipts where request_key='ab700000-0000-4000-8000-000000000001'),1,'retries never duplicate financial evidence');
select throws_ok($$update public.admission_receipts set amount_paise=1 where request_key='ab700000-0000-4000-8000-000000000001'$$,'55000',null,'even privileged code cannot rewrite receipt evidence');
select throws_ok($$delete from public.admission_change_history where request_key='ab800000-0000-4000-8000-000000000001'$$,'55000',null,'audit evidence is append-only');
select is(public.enrollment_has_current_access((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid),false,'scheduled access denied before start');
update public.enrollment_access_windows set starts_at=statement_timestamp(),expires_at=statement_timestamp()+interval '1 second';
select is(public.enrollment_has_current_access((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid),true,'access includes exact start');
update public.enrollment_access_windows set starts_at=statement_timestamp()-interval '1 day',expires_at=statement_timestamp();
select is(public.enrollment_has_current_access((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid),false,'access excludes exact expiry without scheduler');
update public.enrollment_access_windows set expires_at=now()+interval '1 day',state='suspended';
select is(public.enrollment_has_current_access((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid),false,'suspended access denied despite valid dates');

-- A stale signed-in student must lose exact-course reads/writes immediately.
update public.memberships set starts_at=now()-interval '1 second' where person_id=(current_setting('test.admission')::jsonb->>'personId')::uuid;
insert into public.curriculum_versions(id,offering_id,version_number,title,created_by_person_id)
values('ab900000-0000-4000-8000-000000000001','ab500000-0000-4000-8000-000000000001',1,'Fictional Access Curriculum','ab100000-0000-4000-8000-000000000001');
insert into public.curriculum_sections(id,curriculum_version_id,code,title,position)
values('ab910000-0000-4000-8000-000000000001','ab900000-0000-4000-8000-000000000001','ACCESS','Fictional Studies',1);
insert into public.curriculum_topics(id,section_id,code,title,position)
values('ab920000-0000-4000-8000-000000000001','ab910000-0000-4000-8000-000000000001','ACCESS','Fictional Topic',1);
update public.curriculum_versions set status='published',published_at=now(),published_by_person_id='ab100000-0000-4000-8000-000000000001',release_note='Fictional expiry tests' where id='ab900000-0000-4000-8000-000000000001';
update public.cohorts set curriculum_version_id='ab900000-0000-4000-8000-000000000001' where id::text like 'ab600000-%';
insert into auth.users(id,instance_id,aud,role,email) values('ab000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','learner@admission.fixture.invalid');
insert into public.auth_identities(person_id,auth_user_id,kind) values((current_setting('test.admission')::jsonb->>'personId')::uuid,'ab000000-0000-4000-8000-000000000004','member_id');
insert into auth.sessions(id,user_id,aal,created_at,updated_at) values('ab300000-0000-4000-8000-000000000004','ab000000-0000-4000-8000-000000000004','aal1',now(),now());
update public.enrollment_access_windows set state='active',expires_at=now()+interval '1 day';
set local role authenticated;
set local request.jwt.claims='{"sub":"ab000000-0000-4000-8000-000000000004","session_id":"ab300000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select is(public.current_person_can_read_curriculum('ab900000-0000-4000-8000-000000000001'),true,'active exact-course access permits curriculum');
select is(public.current_person_can_edit_topic_checklist((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid,'ab920000-0000-4000-8000-000000000001'),true,'active exact-course access permits private checklist');
reset role;
insert into public.assessment_attempts(id,person_id,paper_id,exam,duration_minutes,objective_count,marking)
values('ab930000-0000-4000-8000-000000000001',(current_setting('test.admission')::jsonb->>'personId')::uuid,'uceed-fiction-a','uceed',60,0,'{}'),
 ('ab930000-0000-4000-8000-000000000002',(current_setting('test.admission')::jsonb->>'personId')::uuid,'uceed-fiction-b','uceed',60,0,'{}');
select is((select basis from public.assessment_attempt_access_basis where attempt_id='ab930000-0000-4000-8000-000000000001'),'coaching','attempt records creation-time coaching basis');
update public.enrollment_access_windows set expires_at=statement_timestamp();
set local role authenticated;
select is(public.current_person_can_read_curriculum('ab900000-0000-4000-8000-000000000001'),false,'same old session loses curriculum at exact expiry');
select is(public.current_person_can_edit_topic_checklist((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid,'ab920000-0000-4000-8000-000000000001'),false,'same old session loses checklist mutation at expiry');
select throws_ok($$select public.set_student_topic_mark((current_setting('test.admission')::jsonb->>'enrollmentId')::uuid,'ab920000-0000-4000-8000-000000000001',true)$$,'42501',null,'direct checklist RPC cannot bypass expiry');
select is(jsonb_array_length(public.list_student_topic_checklist()),0,'expiry exposes no lessons via checklist reader');
select is(public.current_person_can_take_tests(),false,'expired coaching membership grants no unlimited tests');
select throws_ok($$select public.get_assessment_attempt('ab930000-0000-4000-8000-000000000001')$$,'42501',null,'stale session cannot reopen coaching attempt after expiry');
reset role;
insert into public.assessment_entitlements(person_id,source,paper_id,expires_at)
values((current_setting('test.admission')::jsonb->>'personId')::uuid,'purchase','uceed-fiction-a',now()+interval '1 month');
set local role authenticated;
select is(public.current_person_can_take_tests(),true,'independent valid purchase survives coaching expiry');
select lives_ok($$select public.get_assessment_attempt('ab930000-0000-4000-8000-000000000001')$$,'purchased paper attempt remains accessible');
select throws_ok($$select public.get_assessment_attempt('ab930000-0000-4000-8000-000000000002')$$,'42501',null,'purchase for A cannot restore expired coaching attempt B');
select throws_ok($$select public.begin_assessment_attempt('ab930000-0000-4000-8000-000000000002')$$,'42501',null,'direct attempt mutation cannot use an unrelated purchase');
select is((public.get_test_access()->>'coachingActive')::boolean,false,'client is explicitly told unlimited coaching has expired');
reset role;
update public.role_assignments set role_key='teacher' where person_id='ab100000-0000-4000-8000-000000000003';
set local role authenticated;
set local request.jwt.claims='{"sub":"ab000000-0000-4000-8000-000000000003","session_id":"ab300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select is(public.current_person_can_manage_admissions(),false,'Teacher has no directory authority');
select throws_ok('select public.list_admissions_directory()','42501',null,'Teacher cannot enumerate students');
reset role;
set local role anon;
select throws_ok('select public.list_admissions_directory()','42501',null,'anonymous directory access denied');
reset role;
select * from finish();
rollback;
