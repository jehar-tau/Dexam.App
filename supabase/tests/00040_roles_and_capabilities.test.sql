begin;

select plan(23);

select has_table('public', 'app_roles', 'role catalogue exists');
select has_table('public', 'capabilities', 'capability catalogue exists');
select has_table('public', 'role_assignments', 'role assignments exist');
select has_table('public', 'capability_grants', 'explicit capability grants exist');

select is((select count(*)::integer from public.app_roles), 5, 'five approved role labels are seeded');
select is((select count(*)::integer from public.capabilities where requires_two_person), 5, 'five approved high-impact capabilities require two people');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales@dexam.test', ''),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator@dexam.test', ''),
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'elevated@dexam.test', ''),
  ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student@members.dexam.invalid', '');

insert into public.people (id, member_id)
values
  ('71000000-0000-0000-0000-000000000001', null),
  ('71000000-0000-0000-0000-000000000002', null),
  ('71000000-0000-0000-0000-000000000003', null),
  ('71000000-0000-0000-0000-000000000004', 'DXM-7K3M9Q2RW5TY');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 'employee_email'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002', 'employee_email'),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003', 'employee_email'),
  ('71000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000004', 'member_id');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('71000000-0000-0000-0000-000000000001', 'employee', 'active', now()),
  ('71000000-0000-0000-0000-000000000002', 'employee', 'active', now()),
  ('71000000-0000-0000-0000-000000000003', 'employee', 'active', now()),
  ('71000000-0000-0000-0000-000000000004', 'student', 'active', now());

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('71000000-0000-0000-0000-000000000001', 'sales', 'assigned sales employee'),
  ('71000000-0000-0000-0000-000000000002', 'ordinary_admin', 'assigned operations employee');

insert into public.capability_grants (
  person_id,
  capability_key,
  required_role_key,
  grant_reason
)
values (
  '71000000-0000-0000-0000-000000000002',
  'enrollment.operate',
  'ordinary_admin',
  'approved Enrolment Operator'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}';

select is(public.current_person_has_role('sales'), true, 'Sales role is recognized from current state');
select is(public.current_person_has_capability('lead.manage_assigned'), true, 'Sales receives assigned-lead capability');
select is(public.current_person_has_capability('enrollment.request_review'), true, 'Sales may request enrolment review');
select is(public.current_person_has_capability('enrollment.operate'), false, 'Sales cannot perform enrolment operations');
select is(public.current_person_has_capability('student_recovery.assist'), false, 'Sales cannot perform student recovery');

select throws_ok(
  $$insert into public.role_assignments (person_id, role_key, grant_reason) values ('71000000-0000-0000-0000-000000000001', 'elevated_admin', 'self grant')$$,
  '42501',
  null,
  'authenticated employees cannot grant themselves roles'
);

set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}';

select is(public.current_person_has_capability('enrollment.operate'), true, 'approved Enrolment Operator receives the scoped capability');

reset role;

update public.role_assignments
set revoked_at = now()
where person_id = '71000000-0000-0000-0000-000000000002'
  and role_key = 'ordinary_admin';

set local role authenticated;

select is(public.current_person_has_capability('enrollment.operate'), false, 'revoking the required role immediately disables its direct capability grant');

reset role;

select is(public.bootstrap_first_elevated_admin('71000000-0000-0000-0000-000000000003'), true, 'trusted bootstrap creates the first Elevated Admin');
select is(public.bootstrap_first_elevated_admin('71000000-0000-0000-0000-000000000001'), false, 'bootstrap cannot create a second Elevated Admin');

set local role authenticated;
set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}';

select is(public.current_person_has_capability('employee.suspend'), false, 'Elevated Admin capability is denied without MFA');

set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}';

select is(public.current_person_has_capability('employee.suspend'), true, 'Elevated Admin capability is enabled with MFA');
select is(public.current_person_has_capability('elevated_role.manage'), true, 'two-person capability reports eligibility but still requires workflow approval');

reset role;

update public.people
set status = 'suspended', suspended_at = now()
where id = '71000000-0000-0000-0000-000000000003';

set local role authenticated;

select is(public.current_person_has_capability('employee.suspend'), false, 'person suspension immediately overrides Elevated Admin capability');

set local request.jwt.claims = '{"sub":"70000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}';

select is(public.current_person_has_active_employee_membership(), false, 'student membership does not become employee authority');
select is((select count(*)::integer from public.app_roles), 0, 'students cannot read the staff role catalogue');

select throws_ok(
  $$select public.bootstrap_first_elevated_admin('71000000-0000-0000-0000-000000000004')$$,
  '42501',
  null,
  'authenticated clients cannot call the bootstrap function'
);

select * from finish();

rollback;
