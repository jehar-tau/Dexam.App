begin;
select plan(15);
insert into auth.users (id, instance_id, aud, role, email)
values
('fa000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoke-self@fixture.invalid'),
('fa000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'revoke-other@fixture.invalid');
insert into public.people (id) values ('fa100000-0000-4000-8000-000000000001'), ('fa100000-0000-4000-8000-000000000002');
insert into public.auth_identities (person_id, auth_user_id, kind)
values ('fa100000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', 'employee_email'),
('fa100000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000002', 'employee_email');
insert into public.memberships (person_id, kind, status, starts_at)
values ('fa100000-0000-4000-8000-000000000001', 'employee', 'active', now()), ('fa100000-0000-4000-8000-000000000002', 'employee', 'active', now());
insert into public.role_assignments (person_id, role_key, grant_reason)
values ('fa100000-0000-4000-8000-000000000001', 'sales', 'Fictional session barrier test');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
values ('fa200000-0000-4000-8000-000000000001', 'fa000000-0000-4000-8000-000000000001', 'aal1', now() - interval '1 hour', now()),
('fa200000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000001', 'aal1', now() - interval '2 hours', now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fa200000-0000-4000-8000-000000000001","aal":"aal1","role":"authenticated"}';
select is(public.current_person_has_capability('lead.manage_assigned'), true, 'ordinary staff access works before invalidation');
select is(public.current_person_requires_mfa(), false, 'ordinary Sales authority does not require MFA');
reset role;
insert into public.role_assignments (person_id, role_key, grant_reason)
values ('fa100000-0000-4000-8000-000000000001', 'elevated_admin', 'Fictional final-factor guard test');
set local role authenticated;
select is(public.current_person_requires_mfa(), true, 'sensitive authority requires a factor even at password-only assurance');
reset role;
delete from public.role_assignments where person_id = 'fa100000-0000-4000-8000-000000000001' and role_key = 'elevated_admin';
set local role authenticated;
select is(public.current_person_requires_mfa(), false, 'removing sensitive authority updates the factor requirement immediately');
select throws_ok('select * from public.auth_session_cutoffs', '42501', null, 'browser cannot inspect or alter the revocation ledger');
select lives_ok('select public.invalidate_my_staff_sessions()', 'own active staff sessions can be invalidated');
select is(public.current_person_id(), null::uuid, 'old token cannot resolve an authorized application identity');
select is(public.current_person_has_active_employee_membership(), false, 'old session loses staff boundary access');
select is(public.current_person_has_capability('lead.manage_assigned'), false, 'ordinary capabilities are denied immediately too');
select throws_ok('select public.invalidate_my_staff_sessions()', '42501', null, 'invalidated token cannot repeat the action');
set local request.jwt.claims = '{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fa200000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}';
select is(public.current_person_id(), null::uuid, 'another older device is denied by the same cutoff');
set local request.jwt.claims = '{"sub":"fa000000-0000-4000-8000-000000000002","aal":"aal1","role":"authenticated"}';
select is(public.current_person_id(), 'fa100000-0000-4000-8000-000000000002'::uuid, 'another employee is unaffected');
reset role;
select is((select count(*)::integer from public.security_audit_events where subject_person_id = 'fa100000-0000-4000-8000-000000000001' and event_type = 'staff_sessions_invalidated' and metadata = '{}'::jsonb), 1, 'one secret-free revocation event is recorded');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
values ('fa200000-0000-4000-8000-000000000003', 'fa000000-0000-4000-8000-000000000001', 'aal1', clock_timestamp(), clock_timestamp());
set local role authenticated;
set local request.jwt.claims = '{"sub":"fa000000-0000-4000-8000-000000000001","session_id":"fa200000-0000-4000-8000-000000000003","aal":"aal1","role":"authenticated"}';
select is(public.current_person_has_capability('lead.manage_assigned'), true, 'a genuinely new sign-in restores ordinary authorized access');
set local role anon;
select throws_ok('select public.invalidate_my_staff_sessions()', '42501', null, 'anonymous callers cannot invalidate sessions');
select * from finish();
rollback;
