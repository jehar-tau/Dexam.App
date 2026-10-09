begin;

select plan(12);

select has_table('public', 'auth_sign_in_attempt_buckets', 'sign-in throttle table exists');
select has_function(
  'public',
  'current_person_has_active_student_membership',
  array[]::text[],
  'current student membership check exists'
);
select has_function(
  'public',
  'consume_student_sign_in_attempt',
  array['text', 'text'],
  'student sign-in attempt throttle exists'
);
select has_function(
  'public',
  'clear_student_sign_in_member_attempts',
  array['text'],
  'successful sign-in reset exists'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dxm-7k3m9q2rw5ty@members.dexam.invalid', ''),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'student-test-employee@dexam.test', '');

insert into public.people (id, member_id, display_name, status, suspended_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'DXM-7K3M9Q2RW5TY', 'Fictional Student', 'active', null),
  ('b1000000-0000-4000-8000-000000000002', null, 'Fictional Employee', 'active', null);

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'member_id'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'student', 'active', now() - interval '1 day'),
  ('b1000000-0000-4000-8000-000000000002', 'employee', 'active', now() - interval '1 day');

set local role anon;

select throws_ok(
  $$select public.current_person_has_active_student_membership()$$,
  '42501', null, 'anonymous users cannot check student access'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select ok(
  public.current_person_has_active_student_membership(),
  'active student can pass the current-state access check'
);

set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select isnt(
  public.current_person_has_active_student_membership(),
  true,
  'employee identity cannot enter the student workspace'
);

select throws_ok(
  $$select public.consume_student_sign_in_attempt(repeat('a', 64), repeat('b', 64))$$,
  '42501', null, 'browser clients cannot mutate sign-in throttle buckets'
);

reset role;
set local role service_role;

select ok(
  (select bool_and(public.consume_student_sign_in_attempt(repeat('a', 64), repeat('b', 64)))
   from generate_series(1, 10)),
  'first ten Member ID attempts remain within the application limit'
);

select isnt(
  public.consume_student_sign_in_attempt(repeat('a', 64), repeat('b', 64)),
  true,
  'the eleventh Member ID attempt is blocked'
);

do $$
begin
  perform public.clear_student_sign_in_member_attempts(repeat('a', 64));
end;
$$;

select ok(
  public.consume_student_sign_in_attempt(repeat('a', 64), repeat('c', 64)),
  'a successful sign-in reset clears the Member ID bucket'
);

reset role;

update public.people
set status = 'suspended', suspended_at = now()
where id = 'b1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select isnt(
  public.current_person_has_active_student_membership(),
  true,
  'suspension blocks an existing student token immediately'
);

select * from finish();

rollback;
