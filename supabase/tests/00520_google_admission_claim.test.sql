begin;
select no_plan();
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
select ('ac000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'claim'||n||'@fixture.invalid',now(),'{"email_verified":true}' from generate_series(1,5) n;
insert into auth.identities(provider_id,user_id,identity_data,provider)
select 'fixture-google-'||n,('ac000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 jsonb_build_object('sub','fixture-google-'||n,'email','claim'||n||'@fixture.invalid','email_verified',n<>2),'google' from generate_series(1,5) n;
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now(),now() from auth.users where id::text like 'ac000000-%';
insert into public.people(id,member_id,display_name) values
 ('ac100000-0000-4000-8000-000000000001','DXM-T72Q9M4X6WKP','Fictional Reserved Student'),
 ('ac100000-0000-4000-8000-000000000003',null,'Fictional Employee'),
 ('ac100000-0000-4000-8000-000000000004',null,'Fictional Conflicting Candidate'),
 ('ac100000-0000-4000-8000-000000000005',null,'Fictional Existing Student');
insert into public.approved_login_emails(person_id,email,purpose,created_by) values
 ('ac100000-0000-4000-8000-000000000001','claim1@fixture.invalid','student','ac100000-0000-4000-8000-000000000003'),
 ('ac100000-0000-4000-8000-000000000003','claim3@fixture.invalid','employee','ac100000-0000-4000-8000-000000000003'),
 ('ac100000-0000-4000-8000-000000000005','claim4@fixture.invalid','student','ac100000-0000-4000-8000-000000000003');
insert into public.memberships(person_id,kind,status) values
 ('ac100000-0000-4000-8000-000000000001','student','active'),
 ('ac100000-0000-4000-8000-000000000003','employee','active'),
 ('ac100000-0000-4000-8000-000000000004','candidate','active'),
 ('ac100000-0000-4000-8000-000000000005','student','active');
insert into public.auth_identities(person_id,auth_user_id,kind) values
 ('ac100000-0000-4000-8000-000000000004','ac000000-0000-4000-8000-000000000004','oauth_google');
set local role authenticated;
set local request.jwt.claims='{"sub":"ac000000-0000-4000-8000-000000000001","session_id":"ac000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok('select public.provision_google_candidate()','55000',null,'reserved identity cannot bypass integration gate by becoming a new candidate');
select throws_ok('select public.provision_unreserved_google_candidate()','42501',null,'browser cannot bypass approved claim wrapper');
reset role;
update public.admissions_runtime_gate set enabled=true;
set local role authenticated;
select is(public.provision_google_candidate(),'{"created":false}'::jsonb,'approved claim links existing student instead of creating candidate');
select is(public.current_person_id(),'ac100000-0000-4000-8000-000000000001'::uuid,'Google uses immutable canonical person');
select is(public.provision_google_candidate(),'{"created":false}'::jsonb,'returning Google claim is idempotent');
reset role;
select is((select member_id from public.people where id='ac100000-0000-4000-8000-000000000001'),'DXM-T72Q9M4X6WKP','Member ID is preserved');
select is((select count(*)::integer from public.memberships where person_id='ac100000-0000-4000-8000-000000000001' and kind='candidate'),0,'student claim creates no candidate membership');
select is((select count(*)::integer from public.role_assignments where person_id='ac100000-0000-4000-8000-000000000001'),0,'claim grants no staff/admin role');
set local role authenticated;
set local request.jwt.claims='{"sub":"ac000000-0000-4000-8000-000000000002","session_id":"ac000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select throws_ok('select public.provision_google_candidate()','42501',null,'editable metadata cannot replace provider email verification');
set local request.jwt.claims='{"sub":"ac000000-0000-4000-8000-000000000004","session_id":"ac000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select throws_ok('select public.provision_google_candidate()','40001',null,'existing candidate is never automatically merged into reserved student');
set local request.jwt.claims='{"sub":"ac000000-0000-4000-8000-000000000005","session_id":"ac000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
select is(public.provision_google_candidate(),'{"created":true}'::jsonb,'unreserved verified Google identity keeps approved candidate-only experience');
reset role;
-- A separate legacy Member-ID Auth user shares the same canonical person.
insert into auth.users(id,instance_id,aud,role,email) values('ac000000-0000-4000-8000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated','legacy@fixture.invalid');
insert into public.auth_identities(person_id,auth_user_id,kind) values('ac100000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000006','member_id');
insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values('ac000000-0000-4000-8000-000000000006',now());
set local role authenticated;
set local request.jwt.claims='{"sub":"ac000000-0000-4000-8000-000000000001","session_id":"ac000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.current_person_id(),null::uuid,'legacy-login cutoff also denies old Google session');
select throws_ok('select public.provision_google_candidate()','42501',null,'returning claim cannot escape canonical cutoff');
reset role;
select * from finish();
rollback;
