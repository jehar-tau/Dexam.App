begin;

select plan(12);

select has_function(
  'public',
  'list_student_activation_queue',
  array['integer', 'text'],
  'minimal activation queue function exists'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'queue-operator@dexam.test', ''),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'queue-sales@dexam.test', ''),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'claimed-queue-student@members.dexam.invalid', '');

insert into public.people (id, member_id, display_name, status, suspended_at)
values
  ('a1000000-0000-4000-8000-000000000001', null, 'Fictional Queue Operator', 'active', null),
  ('a1000000-0000-4000-8000-000000000002', null, 'Fictional Sales User', 'active', null),
  ('a1000000-0000-4000-8000-000000000003', 'DXM-7K3M9Q2RW5TY', 'Aarohi Deshmukh', 'active', null),
  ('a1000000-0000-4000-8000-000000000004', 'DXM-8K3M9Q2RW5TY', 'Kabir Mehta', 'active', null),
  ('a1000000-0000-4000-8000-000000000005', 'DXM-9K3M9Q2RW5TY', 'Requested Student', 'active', null),
  ('a1000000-0000-4000-8000-000000000006', 'DXM-4K3M9Q2RW5TY', 'Claimed Student', 'active', null),
  ('a1000000-0000-4000-8000-000000000007', 'DXM-5K3M9Q2RW5TY', 'Suspended Student', 'suspended', now());

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'employee_email'),
  ('a1000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000003', 'member_id');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000002', 'employee', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000004', 'student', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000005', 'student', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000006', 'student', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000007', 'student', 'active', now() - interval '1 day');

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('a1000000-0000-4000-8000-000000000001', 'ordinary_admin', 'activation queue test operator'),
  ('a1000000-0000-4000-8000-000000000002', 'sales', 'activation queue test sales');

insert into public.capability_grants (person_id, capability_key, required_role_key, grant_reason)
values (
  'a1000000-0000-4000-8000-000000000001',
  'enrollment.operate',
  'ordinary_admin',
  'activation queue test grant'
);

insert into public.offerings (id, code, title, status)
values (
  'a2000000-0000-4000-8000-000000000001',
  'QUEUE_V1',
  'Fictional Queue Foundation',
  'active'
);

insert into public.cohorts (id, offering_id, code, name, status)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'QUEUE_A',
  'Fictional Queue Cohort',
  'active'
);

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  requested_by_person_id, approved_by_person_id, requested_at, approved_at, activated_at
)
values
  (
    'a4000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000003',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'approved', 'authorized_staff',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    now() - interval '4 days', now() - interval '3 days', null
  ),
  (
    'a4000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000004',
    'a2000000-0000-4000-8000-000000000001',
    null,
    'approved', 'authorized_staff',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    now() - interval '2 days', now() - interval '1 day', null
  ),
  (
    'a4000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000005',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'requested', 'authorized_staff',
    'a1000000-0000-4000-8000-000000000002', null,
    now() - interval '1 day', null, null
  ),
  (
    'a4000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000006',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'approved', 'authorized_staff',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    now() - interval '2 days', now() - interval '1 day', null
  ),
  (
    'a4000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000007',
    'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    'approved', 'authorized_staff',
    'a1000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    now() - interval '2 days', now() - interval '1 day', null
  );

set local role anon;

select throws_ok(
  $$select * from public.list_student_activation_queue(25, null)$$,
  '42501', null, 'anonymous users cannot call the queue'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select throws_ok(
  $$select * from public.list_student_activation_queue(25, null)$$,
  '42501', null, 'Sales cannot call the activation queue'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  (select count(*)::integer from public.list_student_activation_queue(25, null)),
  2,
  'operator sees only currently eligible approved enrolments'
);

select is(
  (select enrollment_id from public.list_student_activation_queue(25, null) limit 1),
  'a4000000-0000-4000-8000-000000000001'::uuid,
  'oldest approval is returned first'
);

select results_eq(
  $$select member_id, student_display_name, offering_title, cohort_name, source_type from public.list_student_activation_queue(25, null) where enrollment_id = 'a4000000-0000-4000-8000-000000000001'$$,
  $$values ('DXM-7K3M9Q2RW5TY'::text, 'Aarohi Deshmukh'::text, 'Fictional Queue Foundation'::text, 'Fictional Queue Cohort'::text, 'authorized_staff'::text)$$,
  'queue exposes only the approved operational identity fields'
);

select is(
  (select count(*)::integer from public.list_student_activation_queue(1, null)),
  1,
  'operator can request a bounded queue page'
);

select throws_ok(
  $$select * from public.list_student_activation_queue(51, null)$$,
  '22023', null, 'queue rejects an excessive page size'
);

select is(
  (select count(*)::integer from public.list_student_activation_queue(25, 'aarohi')),
  1,
  'operator can search by student display name'
);

select is(
  (select count(*)::integer from public.list_student_activation_queue(25, '8k3m9q2')),
  1,
  'operator can search by a case-insensitive Member ID fragment'
);

select throws_ok(
  $$select * from public.list_student_activation_queue(25, repeat('a', 81))$$,
  '22023', null, 'queue rejects an excessive search term'
);

reset role;

update public.capability_grants
set revoked_at = now()
where person_id = 'a1000000-0000-4000-8000-000000000001'
  and capability_key = 'enrollment.operate';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select throws_ok(
  $$select * from public.list_student_activation_queue(25, null)$$,
  '42501', null, 'revoked operator loses queue access immediately'
);

select * from finish();

rollback;
