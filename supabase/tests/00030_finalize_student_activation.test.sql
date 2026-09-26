begin;

select plan(8);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'activation-1@members.dexam.invalid', ''),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'activation-2@members.dexam.invalid', '');

insert into public.people (id, member_id)
values
  ('50000000-0000-0000-0000-000000000001', 'DXM-7K3M9Q2RW5TY'),
  ('50000000-0000-0000-0000-000000000002', 'DXM-8K3M9Q2RW5TY');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('50000000-0000-0000-0000-000000000001', 'student', 'active', now()),
  ('50000000-0000-0000-0000-000000000002', 'student', 'suspended', now());

insert into public.account_action_tokens (
  id, person_id, kind, link_token_hash, backup_code_hash, expires_at
)
values
  ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'activation', repeat('a', 64), repeat('b', 64), now() + interval '1 hour'),
  ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000002', 'activation', repeat('c', 64), repeat('d', 64), now() + interval '1 hour');

select is(
  public.finalize_student_activation(
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    '60000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    'backup'
  ),
  true,
  'a valid backup code finalizes activation'
);

select is(
  (select count(*)::integer from public.auth_identities where person_id = '50000000-0000-0000-0000-000000000001'),
  1,
  'activation links exactly one Auth user to the person'
);

select ok(
  (select consumed_at is not null from public.account_action_tokens where id = '60000000-0000-0000-0000-000000000001'),
  'activation consumes the one-time token'
);

select is(
  (select count(*)::integer from public.security_audit_events where subject_person_id = '50000000-0000-0000-0000-000000000001' and event_type = 'activation_completed'),
  1,
  'activation creates one audit event'
);

select is(
  public.finalize_student_activation(
    '50000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    repeat('b', 64),
    'backup'
  ),
  false,
  'a consumed token cannot be replayed'
);

select is(
  public.finalize_student_activation(
    '50000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000002',
    repeat('d', 64),
    'backup'
  ),
  false,
  'a suspended membership cannot activate'
);

select is(
  (select count(*)::integer from public.auth_identities where person_id = '50000000-0000-0000-0000-000000000002'),
  0,
  'failed activation does not create an authentication link'
);

set local role authenticated;

select throws_ok(
  $$
    select public.finalize_student_activation(
      '50000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000002',
      repeat('d', 64),
      'backup'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot call the trusted finalization function'
);

select * from finish();

rollback;

