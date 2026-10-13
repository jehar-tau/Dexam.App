begin;
select plan(32);
insert into auth.users(id, instance_id, aud, role, email)
values
('fb000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reset-proposer@fixture.invalid'),
('fb000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reset-approver@fixture.invalid'),
('fb000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'reset-target@fixture.invalid');
insert into public.people(id, display_name) values
('fb100000-0000-4000-8000-000000000001', 'Fictional Proposer'),
('fb100000-0000-4000-8000-000000000002', 'Fictional Approver'),
('fb100000-0000-4000-8000-000000000003', 'Fictional Target');
insert into public.auth_identities(person_id, auth_user_id, kind) values
('fb100000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000001', 'employee_email'),
('fb100000-0000-4000-8000-000000000002', 'fb000000-0000-4000-8000-000000000002', 'employee_email'),
('fb100000-0000-4000-8000-000000000003', 'fb000000-0000-4000-8000-000000000003', 'employee_email');
insert into public.memberships(person_id, kind, status, starts_at)
select id, 'employee', 'active', now() from public.people where id::text like 'fb100000-%';
insert into public.role_assignments(person_id, role_key, grant_reason)
select id, 'elevated_admin', 'Fictional recovery test' from public.people where id::text like 'fb100000-%';
insert into auth.mfa_factors(id, user_id, factor_type, status, created_at, updated_at) values
('fb200000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000001', 'totp', 'verified', now(), now()),
('fb200000-0000-4000-8000-000000000002', 'fb000000-0000-4000-8000-000000000002', 'totp', 'verified', now(), now()),
('fb200000-0000-4000-8000-000000000003', 'fb000000-0000-4000-8000-000000000003', 'totp', 'verified', now(), now());
insert into auth.sessions(id, user_id, factor_id, aal, created_at, updated_at) values
('fb300000-0000-4000-8000-000000000001', 'fb000000-0000-4000-8000-000000000001', 'fb200000-0000-4000-8000-000000000001', 'aal2', now(), now()),
('fb300000-0000-4000-8000-000000000002', 'fb000000-0000-4000-8000-000000000002', 'fb200000-0000-4000-8000-000000000002', 'aal2', now(), now()),
('fb300000-0000-4000-8000-000000000003', 'fb000000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000003', 'aal2', now(), now());
insert into auth.mfa_amr_claims(id, session_id, authentication_method, created_at, updated_at) values
('fb400000-0000-4000-8000-000000000001', 'fb300000-0000-4000-8000-000000000001', 'totp', now(), now()),
('fb400000-0000-4000-8000-000000000002', 'fb300000-0000-4000-8000-000000000002', 'totp', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000001","session_id":"fb300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.current_person_can_manage_staff_security(), false, 'password-only admin cannot manage recovery');
select throws_ok($$select public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000003', 'lost_authenticator')$$, '42501', null, 'password-only proposal denied');
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000001","session_id":"fb300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(public.current_person_can_manage_staff_security(), true, 'recent live admin can propose recovery');
select throws_ok($$select public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000001', 'lost_authenticator')$$, '42501', null, 'cross-user factor cannot be selected');
select throws_ok($$select public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000003', 'raw reason with spaces')$$, '22023', null, 'reason must be a non-content code');
select set_config('test.reset_request', public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000003', 'lost_authenticator')::text, true);
select throws_ok($$select public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000003', 'lost_authenticator')$$, '23505', null, 'duplicate active factor proposal denied');
select throws_ok($$select public.decide_staff_mfa_reset(current_setting('test.reset_request')::uuid, true)$$, '42501', null, 'proposer cannot approve own request');
select throws_ok('select * from public.staff_mfa_reset_requests', '42501', null, 'browser cannot inspect private execution keys');
reset role;
update auth.mfa_amr_claims set updated_at = now() - interval '20 minutes' where id = 'fb400000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_person_can_manage_staff_security(), false, 'stale second-factor proof cannot authorize recovery');
reset role;
update auth.mfa_amr_claims set updated_at = now() where id = 'fb400000-0000-4000-8000-000000000001';
update public.role_assignments set revoked_at = now() where person_id = 'fb100000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000002","session_id":"fb300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.decide_staff_mfa_reset(current_setting('test.reset_request')::uuid, true)$$, '42501', null, 'revoked proposer blocks approval');
reset role;
update public.role_assignments set revoked_at = null where person_id = 'fb100000-0000-4000-8000-000000000001';
update public.staff_mfa_reset_requests set created_at = now() - interval '30 minutes', expires_at = now() - interval '15 minutes' where id = current_setting('test.reset_request')::uuid;
set local role authenticated;
select throws_ok($$select public.decide_staff_mfa_reset(current_setting('test.reset_request')::uuid, true)$$, '55000', null, 'expired approval denied');
reset role;
update public.staff_mfa_reset_requests set created_at = now(), expires_at = now() + interval '15 minutes' where id = current_setting('test.reset_request')::uuid;
set local role authenticated;
select lives_ok($$select public.decide_staff_mfa_reset(current_setting('test.reset_request')::uuid, true)$$, 'different active fresh admin approves');
select throws_ok($$select public.decide_staff_mfa_reset(current_setting('test.reset_request')::uuid, true)$$, '55000', null, 'approval replay denied');
select throws_ok($$select * from public.claim_staff_mfa_reset(current_setting('test.reset_request')::uuid)$$, '42501', null, 'browser cannot claim provider execution');
select throws_ok($$select public.finish_staff_mfa_reset(current_setting('test.reset_request')::uuid, gen_random_uuid(), true)$$, '42501', null, 'browser cannot forge completion');
reset role;
update public.role_assignments set revoked_at = now() where person_id = 'fb100000-0000-4000-8000-000000000002';
set local role service_role;
select throws_ok($$select * from public.claim_staff_mfa_reset(current_setting('test.reset_request')::uuid)$$, '42501', null, 'revoked approver blocks execution');
reset role;
update public.role_assignments set revoked_at = null where person_id = 'fb100000-0000-4000-8000-000000000002';
set local role service_role;
select lives_ok($$select * from public.claim_staff_mfa_reset(current_setting('test.reset_request')::uuid)$$, 'trusted service claims approved recovery');
select is((select status from public.staff_mfa_reset_requests where id = current_setting('test.reset_request')::uuid), 'executing', 'execution transition is durable');
select ok(exists(select 1 from public.auth_session_cutoffs where auth_user_id = 'fb000000-0000-4000-8000-000000000003'), 'target old sessions are blocked before provider deletion');
select throws_ok($$select public.finish_staff_mfa_reset(current_setting('test.reset_request')::uuid, (select execution_key from public.staff_mfa_reset_requests where id = current_setting('test.reset_request')::uuid), true)$$, '55000', null, 'completion cannot succeed while factor still exists');
select throws_ok($$select public.finish_staff_mfa_reset(current_setting('test.reset_request')::uuid, gen_random_uuid(), false)$$, '42501', null, 'wrong execution key rejected');
reset role;
delete from auth.mfa_factors where id = 'fb200000-0000-4000-8000-000000000003';
set local role service_role;
select lives_ok($$select public.finish_staff_mfa_reset(current_setting('test.reset_request')::uuid, (select execution_key from public.staff_mfa_reset_requests where id = current_setting('test.reset_request')::uuid), true)$$, 'verified provider outcome can complete recovery');
select lives_ok($$select public.finish_staff_mfa_reset(current_setting('test.reset_request')::uuid, (select execution_key from public.staff_mfa_reset_requests where id = current_setting('test.reset_request')::uuid), true)$$, 'completion retry is idempotent');
select is((select count(*)::integer from public.security_audit_events where subject_person_id = 'fb100000-0000-4000-8000-000000000003' and event_type = 'staff_mfa_reset_finished'), 1, 'one minimized completion event recorded');
set local role authenticated;
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000003","session_id":"fb300000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}';
select is(public.current_person_id(), null::uuid, 'target stale session denied after reset');
reset role;
insert into auth.sessions(id, user_id, aal, created_at, updated_at) values ('fb300000-0000-4000-8000-000000000004', 'fb000000-0000-4000-8000-000000000003', 'aal1', clock_timestamp(), clock_timestamp());
set local role authenticated;
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000003","session_id":"fb300000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select is(public.current_person_has_active_employee_membership(), true, 'target can sign in again after durable invalidation');
select is(public.current_person_has_capability('employee.suspend'), false, 'target must re-enrol before sensitive access');
reset role;
insert into auth.mfa_factors(id, user_id, factor_type, status, created_at, updated_at) values ('fb200000-0000-4000-8000-000000000004', 'fb000000-0000-4000-8000-000000000003', 'totp', 'verified', now(), now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000001","session_id":"fb300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select set_config('test.cancel_request', public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000004', 'lost_authenticator')::text, true);
select lives_ok($$select public.cancel_staff_mfa_reset(current_setting('test.cancel_request')::uuid)$$, 'proposer can cancel before execution');
set local request.jwt.claims = '{"sub":"fb000000-0000-4000-8000-000000000002","session_id":"fb300000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select throws_ok($$select public.decide_staff_mfa_reset(current_setting('test.cancel_request')::uuid, true)$$, '55000', null, 'cancelled request cannot be approved');
reset role;
select is((select status from public.staff_mfa_reset_requests where id = current_setting('test.cancel_request')::uuid), 'cancelled', 'cancellation is durable');
set local role anon;
select throws_ok('select public.staff_security_actor_is_fresh(null, null)', '42501', null, 'private actor metadata helper is not public');
select throws_ok($$select public.propose_staff_mfa_reset('fb100000-0000-4000-8000-000000000003', 'fb200000-0000-4000-8000-000000000004', 'lost_authenticator')$$, '42501', null, 'anonymous recovery proposal denied');
select * from finish();
rollback;
