begin;select no_plan();
insert into auth.users(id,instance_id,aud,role,email,encrypted_password)
select ('f0260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','nav-'||n||'@fixture.invalid','' from generate_series(1,6) n;
insert into public.people(id,member_id,display_name)
select ('f1260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case n when 1 then 'DXM-7K3M9Q2RW5TY' when 4 then 'DXM-8K3M9Q2RW5TY' else null end,'Fictional navigation '||n from generate_series(1,6)n;
insert into public.auth_identities(person_id,auth_user_id,kind)
select ('f1260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('f0260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=1 then 'member_id'::public.auth_identity_kind else 'employee_email'::public.auth_identity_kind end from generate_series(1,6)n;
insert into public.memberships(person_id,kind,status)
select ('f1260000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,case when n=1 then 'student'::public.membership_kind else 'employee'::public.membership_kind end,'active' from generate_series(1,6)n;
insert into public.memberships(person_id,kind,status) values('f1260000-0000-4000-8000-000000000004','student','active');
insert into auth.sessions(id,user_id,aal,created_at,updated_at) select id,id,'aal1',now(),now() from auth.users where id::text like 'f0260000-%';
insert into public.offerings(id,code,title,status) values('f2260000-0000-4000-8000-000000000001','NAV_FICTIONAL','Fictional navigation offering','active');
insert into public.role_assignments(person_id,role_key,scope_type,scope_id,grant_reason) values
 ('f1260000-0000-4000-8000-000000000002','ordinary_admin','offering','f2260000-0000-4000-8000-000000000001','Fictional scoped operator'),
 ('f1260000-0000-4000-8000-000000000003','sales','global',null,'Fictional Sales'),
 ('f1260000-0000-4000-8000-000000000004','sales','global',null,'Fictional dual membership'),
 ('f1260000-0000-4000-8000-000000000005','teacher','offering','f2260000-0000-4000-8000-000000000001','Fictional scoped reviewer'),
 ('f1260000-0000-4000-8000-000000000006','elevated_admin','global',null,'Fictional admin without verified MFA');
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,scope_id,grant_reason)
select 'f1260000-0000-4000-8000-000000000002',key,'ordinary_admin','offering','f2260000-0000-4000-8000-000000000001','Fictional existing operator scope' from public.capabilities where key in('assignment.distribute','enrollment.operate','content.manage_drafts');
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,scope_id,grant_reason) values('f1260000-0000-4000-8000-000000000005','feedback.review','teacher','offering','f2260000-0000-4000-8000-000000000001','Fictional existing review scope');
set local role anon;
select throws_ok('select public.get_my_navigation_access()','42501',null,'anonymous cannot request private nav flags');
reset role;set local role authenticated;
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000001"}';
select is(public.get_my_navigation_access()->>'student','true','student learning links enabled');
select is(public.get_my_navigation_access()->>'employee','false','student has no staff security');
select is((select count(*) from jsonb_each(public.get_my_navigation_access()) e where e.value='true'::jsonb),1::bigint,'student sees only own audience flag');
select is((select count(*) from jsonb_each(public.get_my_navigation_access()) e where jsonb_typeof(e.value)<>'boolean'),0::bigint,'DTO contains boolean values only');
select is((select count(*) from jsonb_object_keys(public.get_my_navigation_access())),15::bigint,'bounded exact DTO shape');
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000002"}';
select is(public.get_my_navigation_access()->>'distribution','true','scoped distributor visible without global bypass');
select is(public.current_person_can_open_assignment_distribution(),true,'scoped distributor entrance matches existing API scope');
select is(public.get_my_navigation_access()->>'content','true','existing scoped content entrance reused');
select is(public.get_my_navigation_access()->>'closeout','true','scoped closeout visible');
select is(public.get_my_navigation_access()->>'enrolments','false','global-only handoff/activation not widened');
select is(public.get_my_navigation_access()->>'classes','false','scheduling requires its own explicit scope');
select is(public.get_my_navigation_access()->>'curriculumImpact','false','impact preview requires all explicit prerequisites');
select is(public.get_my_navigation_access()->>'reviews','false','operator not made Teacher');
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000003"}';
select is(public.get_my_navigation_access()->>'crm','true','Sales sees assigned CRM');
select is(public.get_my_navigation_access()->>'crmAssignments','false','Sales not automatically coordinator');
select is(public.get_my_navigation_access()->>'privacy','false','Sales not privacy administrator');
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000004"}';
select is(public.get_my_navigation_access()->>'student','true','dual membership keeps student destinations');
select is(public.get_my_navigation_access()->>'employee','true','dual membership keeps security entry');
select is(public.get_my_navigation_access()->>'crm','true','dual membership keeps existing Sales destinations');
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000005"}';
select is(public.get_my_navigation_access()->>'reviews','true','assigned scoped Teacher sees reviews');
select is(public.current_person_can_open_feedback_workspace(),true,'scoped reviewer entrance matches existing API authority');
select is(public.get_my_navigation_access()->>'content','false','D031 A no teaching reader or editing authority');
select is(public.get_my_navigation_access()->>'classes','false','Teacher no scheduling authority');
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000006"}';
select is(public.get_my_navigation_access()->>'employee','true','current admin can reach security before MFA');
select is(public.get_my_navigation_access()->>'employees','false','sensitive admin authority not shown without MFA');
reset role;
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values('f3260000-0000-4000-8000-000000000006','f0260000-0000-4000-8000-000000000006','totp','verified',now(),now());
update auth.sessions set factor_id='f3260000-0000-4000-8000-000000000006',aal='aal2' where id='f0260000-0000-4000-8000-000000000006';
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values('f4260000-0000-4000-8000-000000000006','f0260000-0000-4000-8000-000000000006','totp',now(),now());
set local role authenticated;
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal2","session_id":"f0260000-0000-4000-8000-000000000006"}';
select is(public.get_my_navigation_access()->>'employees','true','fresh elevated admin invitation helper reused');
select is(public.get_my_navigation_access()->>'studentRecovery','true','fresh student recovery helper reused');
select is(public.get_my_navigation_access()->>'staffRecovery','true','fresh staff recovery helper reused');
reset role;
update auth.mfa_amr_claims set updated_at=now()-interval '20 minutes' where id='f4260000-0000-4000-8000-000000000006';
set local role authenticated;
select is(public.get_my_navigation_access()->>'employees','false','stale invitation authority hidden');
select is(public.get_my_navigation_access()->>'studentRecovery','false','stale student recovery hidden');
select is(public.get_my_navigation_access()->>'staffRecovery','false','stale staff recovery hidden');
select is(public.get_my_navigation_access()->>'employee','true','MFA rechallenge security entry remains reachable');
reset role;
update public.capability_grants set revoked_at=now() where person_id='f1260000-0000-4000-8000-000000000002' and capability_key='assignment.distribute';
set local role authenticated;
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000002"}';
select is(public.get_my_navigation_access()->>'distribution','false','revocation hides workspace');
reset role;
update public.memberships set status='suspended' where person_id='f1260000-0000-4000-8000-000000000004';
set local role authenticated;
set local request.jwt.claims='{"sub":"f0260000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"f0260000-0000-4000-8000-000000000004"}';
select is((select count(*) from jsonb_each(public.get_my_navigation_access()) e where e.value='true'::jsonb),0::bigint,'suspended dual membership loses all links');
select * from finish();rollback;
