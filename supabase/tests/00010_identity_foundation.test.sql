begin;

select plan(13);

select has_table('public', 'people', 'people table exists');
select has_table('public', 'auth_identities', 'auth identities table exists');
select has_table('public', 'memberships', 'memberships table exists');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-1@internal.invalid', ''),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-2@internal.invalid', '');

insert into public.people (id, member_id)
values
  ('20000000-0000-0000-0000-000000000001', 'DXM-7K3M9Q2RW5TY'),
  ('20000000-0000-0000-0000-000000000002', 'DXM-8K3M9Q2RW5TY');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'member_id'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'member_id');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('20000000-0000-0000-0000-000000000001', 'student', 'active', now()),
  ('20000000-0000-0000-0000-000000000002', 'student', 'active', now());

select throws_ok(
  $$insert into public.people (member_id) values ('DXM-7K3M9Q2RW5TY')$$,
  '23505',
  null,
  'duplicate Member IDs are rejected'
);

select throws_ok(
  $$insert into public.people (member_id) values ('student@email.test')$$,
  '23514',
  null,
  'Member IDs must use the approved non-email format'
);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::integer from public.people),
  1,
  'an active person can read only their own person record'
);

select is(
  (select count(*)::integer from public.auth_identities),
  1,
  'an active person can read only their own authentication link'
);

select is(
  (select count(*)::integer from public.memberships),
  1,
  'an active person can read only their own memberships'
);

select throws_ok(
  $$update public.people set member_id = 'DXM-CHANGED001' where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  null,
  'authenticated users cannot change their Member ID'
);

reset role;

update public.people
set status = 'suspended', suspended_at = now()
where id = '20000000-0000-0000-0000-000000000001';

set local role authenticated;

select is(
  (select count(*)::integer from public.people),
  0,
  'a suspended person cannot read their person record with an existing token'
);

select is(
  (select count(*)::integer from public.auth_identities),
  0,
  'a suspended person cannot read authentication links with an existing token'
);

select is(
  (select count(*)::integer from public.memberships),
  0,
  'a suspended person cannot read memberships with an existing token'
);

select is(
  (select public.current_person_is_active()),
  false,
  'current-state authorization reports a suspended person inactive'
);

select * from finish();

rollback;
