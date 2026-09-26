begin;

select plan(13);

select has_table('public', 'account_action_tokens', 'account action token table exists');
select has_table('public', 'security_audit_events', 'security audit event table exists');

insert into public.people (id, member_id)
values
  ('30000000-0000-0000-0000-000000000001', 'DXM-7K3M9Q2RW5TY'),
  ('30000000-0000-0000-0000-000000000002', 'DXM-8K3M9Q2RW5TY');

select throws_ok(
  $$insert into public.people (member_id) values ('DXM-000000000000')$$,
  '23514',
  null,
  'Member IDs reject ambiguous characters'
);

select throws_ok(
  $$update public.people set member_id = 'DXM-9K3M9Q2RW5TY' where id = '30000000-0000-0000-0000-000000000001'$$,
  '23514',
  'Dexam Member IDs are immutable',
  'issued Member IDs cannot be changed'
);

insert into public.account_action_tokens (
  person_id,
  kind,
  link_token_hash,
  backup_code_hash,
  expires_at
)
values (
  '30000000-0000-0000-0000-000000000001',
  'activation',
  repeat('a', 64),
  repeat('b', 64),
  now() + interval '48 hours'
);

select throws_ok(
  $$
    insert into public.account_action_tokens (
      person_id, kind, link_token_hash, backup_code_hash, expires_at
    ) values (
      '30000000-0000-0000-0000-000000000001',
      'activation',
      repeat('c', 64),
      repeat('d', 64),
      now() + interval '1 hour'
    )
  $$,
  '23505',
  null,
  'only one pending activation token can exist per person'
);

select throws_ok(
  $$
    insert into public.account_action_tokens (
      person_id, kind, link_token_hash, backup_code_hash, expires_at
    ) values (
      '30000000-0000-0000-0000-000000000002',
      'activation',
      repeat('e', 64),
      repeat('f', 64),
      now() + interval '49 hours'
    )
  $$,
  '23514',
  null,
  'activation credentials cannot exceed the approved 48-hour lifetime'
);

select throws_ok(
  $$
    insert into public.account_action_tokens (
      person_id, kind, link_token_hash, backup_code_hash, expires_at
    ) values (
      '30000000-0000-0000-0000-000000000002',
      'recovery',
      'not-a-hash',
      repeat('f', 64),
      now() + interval '1 hour'
    )
  $$,
  '23514',
  null,
  'raw or malformed token values cannot be stored as hashes'
);

select throws_ok(
  $$
    update public.account_action_tokens
    set consumed_at = now(), invalidated_at = now()
    where person_id = '30000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  null,
  'a token cannot be both consumed and invalidated'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000099';

select throws_ok(
  $$select * from public.account_action_tokens$$,
  '42501',
  null,
  'authenticated clients have no permission to read credential hashes'
);

select throws_ok(
  $$
    insert into public.security_audit_events (
      subject_person_id, event_type, outcome
    ) values (
      '30000000-0000-0000-0000-000000000001',
      'activation_completed',
      'succeeded'
    )
  $$,
  '42501',
  null,
  'authenticated clients cannot forge security audit events'
);

reset role;

insert into public.security_audit_events (
  subject_person_id,
  event_type,
  outcome,
  metadata
)
values (
  '30000000-0000-0000-0000-000000000001',
  'activation_pack_issued',
  'succeeded',
  '{"delivery":"in_person"}'::jsonb
);

select is(
  (
    select count(*)::integer
    from public.security_audit_events
    where subject_person_id = '30000000-0000-0000-0000-000000000001'
  ),
  1,
  'trusted workflows can record an activation audit event'
);

select lives_ok(
  $$
    update public.account_action_tokens
    set consumed_at = now()
    where person_id = '30000000-0000-0000-0000-000000000001'
      and kind = 'activation'
      and consumed_at is null
      and invalidated_at is null
      and expires_at > now()
  $$,
  'a valid pending token can move to consumed exactly once'
);

select is(
  (
    select count(*)::integer
    from public.account_action_tokens
    where person_id = '30000000-0000-0000-0000-000000000001'
      and consumed_at is null
      and invalidated_at is null
  ),
  0,
  'a consumed token is no longer pending'
);

select * from finish();

rollback;
