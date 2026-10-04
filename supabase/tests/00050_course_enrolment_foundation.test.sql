begin;

select plan(20);

select has_table('public', 'offerings', 'offerings exist');
select has_table('public', 'cohorts', 'optional cohorts exist');
select has_table('public', 'enrollments', 'enrolments exist');
select has_table('public', 'enrollment_transitions', 'enrolment transition history exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('80000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-one@members.dexam.invalid', ''),
  ('80000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-two@members.dexam.invalid', ''),
  ('80000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator-f004@dexam.test', ''),
  ('80000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales-f004@dexam.test', '');

insert into public.people (id, member_id)
values
  ('81000000-0000-0000-0000-000000000001', 'DXM-7K3M9Q2RW5TY'),
  ('81000000-0000-0000-0000-000000000002', 'DXM-8K3M9Q2RW5TY'),
  ('81000000-0000-0000-0000-000000000003', null),
  ('81000000-0000-0000-0000-000000000004', null);

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('81000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', 'member_id'),
  ('81000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', 'member_id'),
  ('81000000-0000-0000-0000-000000000003', '80000000-0000-0000-0000-000000000003', 'employee_email'),
  ('81000000-0000-0000-0000-000000000004', '80000000-0000-0000-0000-000000000004', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('81000000-0000-0000-0000-000000000001', 'student', 'active', now()),
  ('81000000-0000-0000-0000-000000000002', 'student', 'active', now()),
  ('81000000-0000-0000-0000-000000000003', 'employee', 'active', now()),
  ('81000000-0000-0000-0000-000000000004', 'employee', 'active', now());

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('81000000-0000-0000-0000-000000000003', 'ordinary_admin', 'F004 test operator'),
  ('81000000-0000-0000-0000-000000000004', 'sales', 'F004 test sales');

insert into public.capability_grants (person_id, capability_key, required_role_key, grant_reason)
values ('81000000-0000-0000-0000-000000000003', 'enrollment.operate', 'ordinary_admin', 'F004 test operator grant');

insert into public.offerings (id, code, title, status)
values ('82000000-0000-0000-0000-000000000001', 'NID_V1', 'Fictional Design Entrance Foundation', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values ('83000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'BATCH_A', 'Fictional Batch A', 'active');

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  requested_by_person_id, approved_by_person_id, approved_at, activated_at
)
values
  (
    '84000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'active', 'authorized_staff',
    '81000000-0000-0000-0000-000000000004',
    '81000000-0000-0000-0000-000000000003', now(), now()
  ),
  (
    '84000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    '82000000-0000-0000-0000-000000000001',
    '83000000-0000-0000-0000-000000000001',
    'requested', 'authorized_staff',
    '81000000-0000-0000-0000-000000000004', null, null, null
  );

select is(public.enrollment_can_issue_activation('84000000-0000-0000-0000-000000000001'), true, 'active approved enrolment is activation eligible');
select is(public.enrollment_can_issue_activation('84000000-0000-0000-0000-000000000002'), false, 'requested enrolment is not activation eligible');

select throws_ok(
  $$insert into public.enrollments (person_id, offering_id, cohort_id, status, source_type) values ('81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 'requested', 'authorized_staff')$$,
  '23505', null, 'duplicate open enrolment in one offering/cohort is rejected'
);

select throws_ok(
  $$insert into public.enrollments (person_id, offering_id, status, source_type, activated_at) values ('81000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000001', 'active', 'authorized_staff', now())$$,
  '23514', null, 'activation without approval evidence is rejected'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.enrollments), 1, 'student sees only their own enrolment');
select is((select count(*)::integer from public.offerings), 1, 'student sees the offering attached to their enrolment');
select is((select count(*)::integer from public.cohorts), 1, 'student sees the cohort attached to their enrolment');
select throws_ok(
  $$update public.enrollments set status = 'completed' where id = '84000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'student cannot mutate their enrolment'
);

set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.enrollments), 0, 'Sales cannot browse academic enrolments');
select throws_ok(
  $$select public.enrollment_can_issue_activation('84000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'authenticated clients cannot call activation eligibility helper'
);

set local request.jwt.claims = '{"sub":"80000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.enrollments), 2, 'Enrolment Operator can read enrolments');

reset role;

update public.role_assignments
set revoked_at = now()
where person_id = '81000000-0000-0000-0000-000000000003';

set local role authenticated;

select is((select count(*)::integer from public.enrollments), 0, 'revoked operator loses enrolment access immediately');

reset role;

update public.people
set status = 'suspended', suspended_at = now()
where id = '81000000-0000-0000-0000-000000000001';

select is(public.enrollment_can_issue_activation('84000000-0000-0000-0000-000000000001'), false, 'suspended student is not activation eligible');

select lives_ok(
  $$insert into public.enrollments (person_id, offering_id, status, source_type) values ('81000000-0000-0000-0000-000000000001', '82000000-0000-0000-0000-000000000001', 'completed', 'historical_import')$$,
  'a historical ended enrolment may coexist with an open-context record'
);

select is((select count(*)::integer from public.offerings), 1, 'one fictional offering is used by the test');
select is((select count(*)::integer from public.cohorts), 1, 'one fictional cohort is used by the test');

select * from finish();

rollback;
