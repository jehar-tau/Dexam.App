begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('e9000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'buyer@dexam.test', ''),
  ('e9000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-buyer@dexam.test', '');
insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
values
  ('buyer-google', 'e9000000-0000-4000-8000-000000000001', '{"sub":"buyer-google"}', 'google', now(), now(), now()),
  ('other-google', 'e9000000-0000-4000-8000-000000000002', '{"sub":"other-google"}', 'google', now(), now(), now());
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'e9000000-%';

-- Two fictional UCEED papers so the purchase has something to unlock.
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
values
  ('e9200000-0000-4000-8000-000000000001', 'uceed-2095-q1', 1, repeat('5', 64), 'nat', 'Fictional A', 'auto', 'ready', '{}', 'original', 'original'),
  ('e9200000-0000-4000-8000-000000000002', 'uceed-2096-q1', 1, repeat('6', 64), 'nat', 'Fictional B', 'auto', 'ready', '{}', 'original', 'original');
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
values
  ('e9200000-0000-4000-8000-000000000001', 'uceed', 2095, 'uceed-2095', '1'),
  ('e9200000-0000-4000-8000-000000000002', 'uceed', 2096, 'uceed-2096', '1');

select ok(
  not has_table_privilege('authenticated', 'public.commerce_orders', 'select')
  and not has_function_privilege('authenticated', 'public.fulfil_commerce_order(text, text, text, integer, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.attach_commerce_provider_order(uuid, text)', 'execute'),
  'the browser cannot read orders or mark them paid'
);
select is((select count(*) from public.commerce_plans where on_sale), 0::bigint, 'every plan starts off sale');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e9000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.provision_google_candidate()$$, 'the buyer is a candidate');
select lives_ok($$select public.save_candidate_profile('bdes', array['uceed'], 2027)$$, 'with a B.Des profile');
select is(jsonb_array_length(public.list_commerce_plans()), 4, 'four draft plans are listed');
select throws_ok($$select public.create_commerce_order('uceed-bundle')$$, 'DX003', null, 'plans off sale cannot be ordered');
select throws_ok($$select public.create_commerce_order('nope')$$, '22023', null, 'unknown plans are refused');
select set_config('test.free', public.open_assessment_attempt('uceed-2095') ->> 'attemptId', true);
select is(public.current_person_can_open_paper('uceed-2096'), false, 'a second UCEED paper is locked before buying');
reset role;

update public.commerce_plans set on_sale = true where key = 'uceed-bundle';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e9000000-0000-4000-8000-000000000001"}';
select set_config('test.order', public.create_commerce_order('uceed-bundle') ->> 'orderId', true);
select is(
  (public.list_my_orders() -> 0 ->> 'status'),
  'created',
  'the order is created'
);
reset role;

set local role service_role;
select lives_ok(
  format($$select public.attach_commerce_provider_order(%L, 'order_FictionalTest01')$$, current_setting('test.order')),
  'the trusted function attaches the Razorpay order'
);
select throws_ok(
  format($$select public.attach_commerce_provider_order(%L, 'order_FictionalTest02')$$, current_setting('test.order')),
  '55000', null, 'a provider order is attached only once'
);
select is(
  public.fulfil_commerce_order('evt_mismatch', 'order_FictionalTest01', 'pay_FictionalPay01', 100, 'INR'),
  'mismatch',
  'a wrong amount does not pay the order'
);
select is(
  public.fulfil_commerce_order('evt_unknown', 'order_FictionalNope99', 'pay_FictionalPay01', 69900, 'INR'),
  'unknown-order',
  'unknown orders are recorded and ignored'
);
select is(
  public.fulfil_commerce_order('evt_paid', 'order_FictionalTest01', 'pay_FictionalPay01', 69900, 'INR'),
  'paid',
  'a matching captured payment pays the order'
);
select is(
  public.fulfil_commerce_order('evt_paid', 'order_FictionalTest01', 'pay_FictionalPay01', 69900, 'INR'),
  'duplicate',
  'the same event is processed once'
);
select is(
  public.fulfil_commerce_order('evt_paid_again', 'order_FictionalTest01', 'pay_FictionalPay01', 69900, 'INR'),
  'duplicate',
  'a second event for a paid order changes nothing'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e9000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e9000000-0000-4000-8000-000000000001"}';
select is(public.list_my_orders() -> 0 ->> 'status', 'paid', 'the buyer sees the paid order');
select is(public.current_person_can_open_paper('uceed-2096'), true, 'every UCEED paper is unlocked');
select is(public.current_person_can_start_mock('uceed-2026'), true, 'UCEED mocks are unlocked');
select is(public.current_person_can_open_paper('ceed-2091'), false, 'other exams stay locked');
select is(
  (select count(*) from jsonb_array_elements_text(public.get_test_access() -> 'entitledPapers') p where p = 'uceed-2096'),
  1::bigint,
  'access lists the purchased paper'
);
reset role;
select ok(
  (select expires_at > now() + interval '364 days' from public.assessment_entitlements
   where person_id = (select person_id from public.commerce_orders where id = current_setting('test.order')::uuid) and paper_id = 'uceed-2096'),
  'purchased access lasts the plan validity'
);
select is(
  (select expires_at from public.assessment_entitlements
   where person_id = (select person_id from public.commerce_orders where id = current_setting('test.order')::uuid) and paper_id = 'uceed-2095'),
  null,
  'the free paper stays free forever'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e9000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e9000000-0000-4000-8000-000000000002"}';
select lives_ok($$select public.provision_google_candidate()$$, 'another candidate');
select is(public.list_my_orders(), '[]'::jsonb, 'sees no one else''s orders');
reset role;

select * from finish();
rollback;
