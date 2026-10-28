begin;
select no_plan();

select is(
  public.hook_before_user_created('{"user":{"email":"a@example.test","app_metadata":{"provider":"google","providers":["google"]}}}'),
  '{}'::jsonb,
  'Google sign-ups are allowed'
);
select is(
  public.hook_before_user_created('{"user":{"email":"a@example.test","app_metadata":{"provider":"email","providers":["email"]}}}') -> 'error' ->> 'http_code',
  '403',
  'email sign-ups are rejected'
);
select is(
  public.hook_before_user_created('{"user":{"phone":"+910000000000","app_metadata":{"provider":"phone"}}}') -> 'error' ->> 'http_code',
  '403',
  'phone sign-ups are rejected'
);
select is(
  public.hook_before_user_created('{"user":{"app_metadata":{"provider":"github"}}}') -> 'error' ->> 'http_code',
  '403',
  'other providers are rejected'
);
select is(
  public.hook_before_user_created('{"user":{}}') -> 'error' ->> 'http_code',
  '403',
  'a missing provider is rejected'
);
select ok(
  has_function_privilege('supabase_auth_admin', 'public.hook_before_user_created(jsonb)', 'execute'),
  'Supabase Auth can call the hook'
);
select ok(
  not has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'execute'),
  'browser roles cannot call the hook'
);

-- A staff-approved invitation that is being delivered lets its exact email through.
insert into public.people (id, member_id, display_name)
values
  ('c7000000-0000-4000-8000-000000000001', null, 'Fictional Invited Employee'),
  ('c7000000-0000-4000-8000-000000000002', null, 'Fictional Issuer');
insert into public.employee_invitations (id, person_id, email, issuer_person_id, issuer_session_id, status)
values
  ('c7100000-0000-4000-8000-000000000001', 'c7000000-0000-4000-8000-000000000001', 'invited.employee@dexam.invalid', 'c7000000-0000-4000-8000-000000000002', gen_random_uuid(), 'delivering');
select is(
  public.hook_before_user_created('{"user":{"email":"Invited.Employee@dexam.invalid","app_metadata":{"provider":"email"}}}'),
  '{}'::jsonb,
  'the email of an invitation being delivered is allowed'
);
select is(
  public.hook_before_user_created('{"user":{"email":"someone.else@dexam.invalid","app_metadata":{"provider":"email"}}}') -> 'error' ->> 'http_code',
  '403',
  'other emails are still rejected'
);
update public.employee_invitations set status = 'pending' where id = 'c7100000-0000-4000-8000-000000000001';
select is(
  public.hook_before_user_created('{"user":{"email":"invited.employee@dexam.invalid","app_metadata":{"provider":"email"}}}') -> 'error' ->> 'http_code',
  '403',
  'an invitation that is not being delivered does not count'
);
update public.employee_invitations set status = 'delivering', expires_at = created_at + interval '1 second' where id = 'c7100000-0000-4000-8000-000000000001';
select is(
  public.hook_before_user_created('{"user":{"email":"invited.employee@dexam.invalid","app_metadata":{"provider":"phone"}}}') -> 'error' ->> 'http_code',
  '403',
  'only email accounts can use an invitation'
);

select * from finish();
rollback;
