begin;
select plan(15);

insert into auth.users (id, instance_id, aud, role, email)
values
('f0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'live-mfa@fixture.invalid'),
('f0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-mfa@fixture.invalid');
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
values ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'totp', 'verified', now(), now());
insert into auth.sessions (id, user_id, factor_id, aal, created_at, updated_at)
values ('f2000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'aal2', now(), now());

insert into public.people (id) values ('f3000000-0000-4000-8000-000000000001');
insert into public.auth_identities (person_id, auth_user_id, kind)
values ('f3000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'employee_email');
insert into public.memberships (person_id, kind, status, starts_at)
values ('f3000000-0000-4000-8000-000000000001', 'employee', 'active', now());
insert into public.role_assignments (person_id, role_key, grant_reason)
values ('f3000000-0000-4000-8000-000000000001', 'elevated_admin', 'Fictional live MFA test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"f2000000-0000-4000-8000-000000000001"}';
select is(public.current_session_has_live_mfa(), true, 'live owned session and verified factor satisfy MFA');
select is(public.current_person_has_capability('employee.suspend'), true, 'live MFA allows an assigned sensitive capability');
select throws_ok('select * from auth.mfa_factors', '42501', null, 'browser cannot read provider factors or secrets');

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2","session_id":"f2000000-0000-4000-8000-000000000001"}';
select is(public.current_session_has_live_mfa(), false, 'another person cannot reuse the session');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(public.current_session_has_live_mfa(), false, 'missing session id is denied');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"malformed"}';
select is(public.current_session_has_live_mfa(), false, 'malformed session id is denied without a cast error');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f2000000-0000-4000-8000-000000000001"}';
select is(public.current_session_has_live_mfa(), false, 'password-only token cannot borrow live assurance');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","session_id":"f2000000-0000-4000-8000-000000000001"}';

reset role;
update auth.sessions set aal = 'aal1' where id = 'f2000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_session_has_live_mfa(), false, 'old aal2 token is denied after live downgrade');
reset role;
update auth.sessions set aal = 'aal2', not_after = now() - interval '1 minute' where id = 'f2000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_session_has_live_mfa(), false, 'expired live session is denied');
reset role;
update auth.sessions set not_after = null where id = 'f2000000-0000-4000-8000-000000000001';
update auth.mfa_factors set status = 'unverified' where id = 'f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_session_has_live_mfa(), false, 'unverified factor is denied');
reset role;
update auth.mfa_factors set status = 'verified', user_id = 'f0000000-0000-4000-8000-000000000002' where id = 'f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_session_has_live_mfa(), false, 'factor owner must also match session owner');
reset role;
delete from auth.mfa_factors where id = 'f1000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_session_has_live_mfa(), false, 'direct factor deletion immediately invalidates old aal2 assurance');
select is(public.current_person_has_capability('employee.suspend'), false, 'factor removal denies sensitive capability despite unchanged role and old token');
reset role;
delete from auth.sessions where id = 'f2000000-0000-4000-8000-000000000001';
set local role authenticated;
select is(public.current_session_has_live_mfa(), false, 'session deletion immediately invalidates old token assurance');
set local role anon;
select throws_ok('select public.current_session_has_live_mfa()', '42501', null, 'anonymous callers cannot execute the MFA check');

select * from finish();
rollback;
