begin;

select plan(18);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'operator-pack@dexam.test', ''),
  ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sales-pack@dexam.test', '');

insert into public.people (id, member_id)
values
  ('91000000-0000-0000-0000-000000000001', null),
  ('91000000-0000-0000-0000-000000000002', null),
  ('91000000-0000-0000-0000-000000000003', 'DXM-2K3M9Q2RW5TY'),
  ('91000000-0000-0000-0000-000000000004', 'DXM-3K3M9Q2RW5TY');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 'employee_email'),
  ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('91000000-0000-0000-0000-000000000001', 'employee', 'active', now()),
  ('91000000-0000-0000-0000-000000000002', 'employee', 'active', now()),
  ('91000000-0000-0000-0000-000000000003', 'student', 'active', now()),
  ('91000000-0000-0000-0000-000000000004', 'student', 'active', now());

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('91000000-0000-0000-0000-000000000001', 'ordinary_admin', 'activation-pack test operator'),
  ('91000000-0000-0000-0000-000000000002', 'sales', 'activation-pack test sales');

insert into public.capability_grants (person_id, capability_key, required_role_key, grant_reason)
values ('91000000-0000-0000-0000-000000000001', 'enrollment.operate', 'ordinary_admin', 'activation-pack test grant');

insert into public.offerings (id, code, title, status)
values ('92000000-0000-0000-0000-000000000001', 'PACK_V1', 'Fictional Activation Test Offering', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values ('93000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', 'PACK_A', 'Fictional Pack Batch', 'active');

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  requested_by_person_id, approved_by_person_id, approved_at
)
values
  (
    '94000000-0000-0000-0000-000000000001',
    '91000000-0000-0000-0000-000000000003',
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'approved', 'authorized_staff',
    '91000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000001', now()
  ),
  (
    '94000000-0000-0000-0000-000000000002',
    '91000000-0000-0000-0000-000000000004',
    '92000000-0000-0000-0000-000000000001',
    '93000000-0000-0000-0000-000000000001',
    'requested', 'authorized_staff',
    '91000000-0000-0000-0000-000000000002', null, null
  );

set local role authenticated;
set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  (select member_id from public.issue_student_activation_pack(
    '94000000-0000-0000-0000-000000000001', repeat('a', 64), repeat('b', 64),
    now() + interval '48 hours', 'initial_activation_pack'
  )),
  'DXM-2K3M9Q2RW5TY',
  'authorized operator receives the permanent Member ID'
);

reset role;

select is((select status::text from public.enrollments where id = '94000000-0000-0000-0000-000000000001'), 'active', 'issuance activates the approved enrolment');
select ok((select activated_at is not null from public.enrollments where id = '94000000-0000-0000-0000-000000000001'), 'issuance records activation time');
select is((select count(*)::integer from public.enrollment_transitions where enrollment_id = '94000000-0000-0000-0000-000000000001'), 1, 'issuance records one enrolment transition');
select is((select count(*)::integer from public.account_action_tokens where enrollment_id = '94000000-0000-0000-0000-000000000001' and invalidated_at is null), 1, 'issuance creates one pending token');
select is((select count(*)::integer from public.security_audit_events where event_type = 'activation_pack_issued' and subject_person_id = '91000000-0000-0000-0000-000000000003'), 1, 'issuance creates an attributable audit event');

set local role authenticated;

select is(
  (select is_reissue from public.issue_student_activation_pack(
    '94000000-0000-0000-0000-000000000001', repeat('c', 64), repeat('d', 64),
    now() + interval '1 hour', 'student_lost_unused_pack'
  )),
  true,
  'operator may reissue an unused pre-activation pack with a reason'
);

reset role;

select is((select count(*)::integer from public.account_action_tokens where enrollment_id = '94000000-0000-0000-0000-000000000001' and invalidated_at is null), 1, 'reissue leaves exactly one pending token');
select is((select count(*)::integer from public.account_action_tokens where enrollment_id = '94000000-0000-0000-0000-000000000001' and invalidated_at is not null), 1, 'reissue invalidates the earlier token');
select is((select count(*)::integer from public.security_audit_events where event_type = 'activation_pack_reissued' and reason_code = 'student_lost_unused_pack'), 1, 'reissue reason is audited');

set local role authenticated;

select throws_ok(
  $$select * from public.issue_student_activation_pack('94000000-0000-0000-0000-000000000001', repeat('e', 64), repeat('f', 64), now() + interval '1 hour', 'initial_activation_pack')$$,
  '22023', null, 'reissue cannot reuse the initial-issuance reason'
);

select throws_ok(
  $$select * from public.issue_student_activation_pack('94000000-0000-0000-0000-000000000002', repeat('e', 64), repeat('f', 64), now() + interval '1 hour', 'initial_activation_pack')$$,
  'P0001', null, 'requested enrolment cannot issue a pack'
);

set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}';

select throws_ok(
  $$select * from public.issue_student_activation_pack('94000000-0000-0000-0000-000000000001', repeat('e', 64), repeat('f', 64), now() + interval '1 hour', 'sales_attempt')$$,
  '42501', null, 'Sales cannot issue an activation pack'
);

reset role;

update public.role_assignments
set revoked_at = now()
where person_id = '91000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"90000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}';

select throws_ok(
  $$select * from public.issue_student_activation_pack('94000000-0000-0000-0000-000000000001', repeat('e', 64), repeat('f', 64), now() + interval '1 hour', 'revoked_attempt')$$,
  '42501', null, 'revoked operator immediately loses issuance authority'
);

reset role;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values ('90000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'claimed-pack@members.dexam.invalid', '');

insert into public.auth_identities (person_id, auth_user_id, kind)
values ('91000000-0000-0000-0000-000000000003', '90000000-0000-0000-0000-000000000003', 'member_id');

update public.role_assignments
set revoked_at = null
where person_id = '91000000-0000-0000-0000-000000000001';

set local role authenticated;

select throws_ok(
  $$select * from public.issue_student_activation_pack('94000000-0000-0000-0000-000000000001', repeat('e', 64), repeat('f', 64), now() + interval '1 hour', 'claimed_attempt')$$,
  'P0001', null, 'claimed account cannot receive a new activation pack'
);

reset role;

select is((select count(*)::integer from public.account_action_tokens where enrollment_id = '94000000-0000-0000-0000-000000000001'), 2, 'denied attempts create no extra tokens');
select is((select count(*)::integer from public.enrollment_transitions where enrollment_id = '94000000-0000-0000-0000-000000000001'), 1, 'reissue does not duplicate enrolment activation history');
select is((select count(*)::integer from public.security_audit_events where subject_person_id = '91000000-0000-0000-0000-000000000003' and event_type in ('activation_pack_issued', 'activation_pack_reissued')), 2, 'only successful issuance events are audited as success');

select * from finish();

rollback;
