begin;
select no_plan();
-- D-068/F057: Google sessions replace TOTP, admin-managed courses and fees, the payment ledger.
-- Users: 1 Sales, 2 Elevated Admin (Google), 3 teacher, 4 student, 5 Elevated Admin (password only), 6 second Sales.
insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at,raw_user_meta_data)
select ('af000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
  'pay'||n||'@fixture.invalid',now(),'{}' from generate_series(1,6) n;
insert into auth.identities(provider_id,user_id,identity_data,provider) values
 ('fixture-pay-google-2','af000000-0000-4000-8000-000000000002',
  '{"sub":"fixture-pay-google-2","email":"pay2@fixture.invalid","email_verified":true}','google');
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now()-interval '1 minute',now() from auth.users where id::text like 'af000000-%';
-- Admin 2 signed in with Google; admin 5 with a password.
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values
 ('af500000-0000-4000-8000-000000000002','af000000-0000-4000-8000-000000000002','oauth',now(),now()),
 ('af500000-0000-4000-8000-000000000005','af000000-0000-4000-8000-000000000005','password',now(),now()),
 ('af500000-0000-4000-8000-000000000001','af000000-0000-4000-8000-000000000001','password',now(),now());
insert into public.people(id,member_id,display_name) values
 ('af100000-0000-4000-8000-000000000001',null,'Fictional Pay Sales'),
 ('af100000-0000-4000-8000-000000000002',null,'Fictional Pay Admin'),
 ('af100000-0000-4000-8000-000000000003',null,'Fictional Pay Teacher'),
 ('af100000-0000-4000-8000-000000000004','DXM-AG3M9Q2RW5TY','Fictional Paying Student'),
 ('af100000-0000-4000-8000-000000000005',null,'Fictional Password Admin'),
 ('af100000-0000-4000-8000-000000000006',null,'Fictional Second Sales');
insert into public.auth_identities(person_id,auth_user_id,kind)
select ('af100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('af000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  'employee_email'::public.auth_identity_kind from generate_series(1,6) n where n<>4;
insert into public.memberships(person_id,kind,status,starts_at)
select ('af100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
  (case when n=4 then 'student' else 'employee' end)::public.membership_kind,'active',now()-interval '1 day'
from generate_series(1,6) n;
insert into public.role_assignments(person_id,role_key,grant_reason) values
 ('af100000-0000-4000-8000-000000000001','sales','Fictional Pay Sales'),
 ('af100000-0000-4000-8000-000000000002','elevated_admin','Fictional Pay Admin'),
 ('af100000-0000-4000-8000-000000000003','teacher','Fictional Pay Teacher'),
 ('af100000-0000-4000-8000-000000000005','elevated_admin','Fictional Password Admin'),
 ('af100000-0000-4000-8000-000000000006','sales','Fictional Second Sales');

set local role authenticated;
-- Staff security: a live Google session satisfies former TOTP-only capabilities; a password does not.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000002","session_id":"af000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select ok(public.current_session_is_google(),'Google session is recognised');
select ok(public.current_session_has_live_mfa(),'Google session satisfies staff security');
select is(public.get_my_navigation_access()->>'courses','true','Google admin sees Courses');
select is(public.get_my_navigation_access()->>'paymentLedger','true','Google admin sees the ledger');
select is(public.get_my_navigation_access()->>'studentLoginRevoke','true','Google admin can revoke Google sign-in');
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000005","session_id":"af000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';
select ok(not public.current_session_is_google(),'password session is not a Google session');
select ok(not public.current_session_has_live_mfa(),'password session alone still lacks staff security');
select throws_ok($$select * from public.list_courses()$$,'42501',null,'password-only admin cannot manage courses');
-- A Google identity on the account is not enough: this session itself must come from Google.
reset role;
insert into auth.identities(provider_id,user_id,identity_data,provider) values
 ('fixture-pay-google-5','af000000-0000-4000-8000-000000000005',
  '{"sub":"fixture-pay-google-5","email":"pay5@fixture.invalid","email_verified":true}','google');
set local role authenticated;
select ok(not public.current_session_is_google(),'a password session on a Google-linked account does not count');

-- Courses: the Google admin adds and edits; Sales and teachers cannot.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000002","session_id":"af000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select isnt(public.save_course('af600000-0000-4000-8000-000000000001',null,null,'payfix','Fictional Payments Course','active',300,15000000,1000000,'New course'),
  null,'admin adds a course');
select is((select code from public.offerings where title='Fictional Payments Course'),'PAYFIX','code is normalised');
select is(public.save_course('af600000-0000-4000-8000-000000000001',null,null,'payfix','Fictional Payments Course','active',300,15000000,1000000,'New course'),
  (select id from public.offerings where code='PAYFIX'),'replay is idempotent');
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000001',null,null,'payfix','Changed','active',300,15000000,1000000,'New course')$$,
  '40001',null,'reused request key with other values refused');
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000002',null,null,'payfix','Duplicate','active',null,null,null,'Duplicate')$$,
  '23505',null,'duplicate code refused');
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000003',null,null,'feefix','Fee check','active',30,1000,5000,'Fee above total')$$,
  '22023',null,'admission fee above total refused');
select is(public.save_course('af600000-0000-4000-8000-000000000004',(select id from public.offerings where code='PAYFIX'),1,null,
  'Fictional Payments Course','active',365,15000000,1000000,'Year-long course'),(select id from public.offerings where code='PAYFIX'),'admin edits the length');
select is((select duration_days from public.offerings where code='PAYFIX'),365,'length saved');
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000005',(select id from public.offerings where code='PAYFIX'),1,null,'Stale','active',30,null,null,'Stale edit')$$,
  '40001',null,'stale revision refused');
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000006',(select id from public.offerings where code='PAYFIX'),2,'OTHER','Renamed','active',30,null,null,'Code change')$$,
  '22023',null,'course code cannot change');
reset role;
select is((select count(*)::int from public.offering_change_history where offering_id=(select id from public.offerings where code='PAYFIX')),2,'course history recorded');
set local role authenticated;
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000001","session_id":"af000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$select * from public.list_courses()$$,'42501',null,'Sales cannot manage courses');
select throws_ok($$select * from public.offering_change_history$$,'42501',null,'no direct history access');

reset role;
insert into public.enrollments(id,person_id,offering_id,status,source_type)
  values('af800000-0000-4000-8000-000000000004','af100000-0000-4000-8000-000000000004',(select id from public.offerings where code='PAYFIX'),'active','fixture');
set local role authenticated;
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000002","session_id":"af000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000008',(select id from public.offerings where code='PAYFIX'),2,null,'Fictional Payments Course','archived',365,15000000,1000000,'Archive')$$,
  '55000',null,'a course with open enrolments cannot be archived');
select throws_ok($$select public.save_course('af600000-0000-4000-8000-000000000009',(select id from public.offerings where code='PAYFIX'),2,null,'Fictional Payments Course','draft',365,15000000,1000000,'Back to draft')$$,
  '55000',null,'a course with open enrolments cannot go back to draft');

-- Payments: Sales record, with a collector from Sales or Admin.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000001","session_id":"af000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.get_my_navigation_access()->>'payments','true','Sales see Payments');
select is(public.get_my_navigation_access()->>'paymentLedger','false','Sales do not see the full ledger');
select is((select count(*)::int from public.list_payment_collectors()),4,'collectors are current Sales and Admin staff');
select is((select count(*)::int from public.list_payment_collectors() where display_name='Fictional Pay Teacher'),0,'teachers are not collectors');
select is((select admission_paid from public.list_payment_students('paying')),false,'no admission fee yet');
select is((public.record_student_payment('af900000-0000-4000-8000-000000000001','af800000-0000-4000-8000-000000000004','admission_fee','upi',
  500000,current_date,'UPI-REF-1','af100000-0000-4000-8000-000000000001','Part of admission fee'))->>'receiptNumber' like 'DXR-%','t','Sales record a payment');
select is((public.record_student_payment('af900000-0000-4000-8000-000000000001','af800000-0000-4000-8000-000000000004','admission_fee','upi',
  500000,current_date,'UPI-REF-1','af100000-0000-4000-8000-000000000001','Part of admission fee'))->>'replayed','true','retry is idempotent');
select throws_ok($$select public.record_student_payment('af900000-0000-4000-8000-000000000001','af800000-0000-4000-8000-000000000004','admission_fee','upi',
  900000,current_date,'UPI-REF-1','af100000-0000-4000-8000-000000000001',null)$$,'40001',null,'reused request with another amount refused');
select is((select admission_paid from public.list_payment_students('paying')),false,'₹5,000 of a ₹10,000 admission fee is not enough');
select throws_ok($$select public.record_student_payment('af900000-0000-4000-8000-000000000002','af800000-0000-4000-8000-000000000004','course_fee','card_machine',
  100,current_date,null,'af100000-0000-4000-8000-000000000001',null)$$,'22023',null,'card payment needs a transaction ID');
select throws_ok($$select public.record_student_payment('af900000-0000-4000-8000-000000000003','af800000-0000-4000-8000-000000000004','course_fee','cash',
  100,current_date+2,null,'af100000-0000-4000-8000-000000000001',null)$$,'22023',null,'future date refused');
select throws_ok($$select public.record_student_payment('af900000-0000-4000-8000-000000000004','af800000-0000-4000-8000-000000000004','course_fee','cash',
  100,current_date,null,'af100000-0000-4000-8000-000000000003',null)$$,'22023',null,'a teacher cannot be the collector');
select throws_ok($$select public.record_student_payment('af900000-0000-4000-8000-000000000005','af800000-0000-4000-8000-000000000004','correction','cash',
  100,current_date,null,'af100000-0000-4000-8000-000000000001',null)$$,'22023',null,'corrections are not recorded as payments');
select is((public.record_student_payment('af900000-0000-4000-8000-000000000006','af800000-0000-4000-8000-000000000004','admission_fee','cash',
  500000,current_date,null,'af100000-0000-4000-8000-000000000002',null))->>'replayed','false','cash needs no transaction ID');
select is((select admission_paid from public.list_payment_students('paying')),true,'admission fee complete');
select is((select paid_paise from public.list_payment_students('paying')),1000000::bigint,'paid total');
select is((select fee_paise from public.list_payment_students('paying')),15000000::bigint,'course fee applies');
select is((select transaction_id from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi'),'UPI-REF-1','recorder sees own details');
select throws_ok($$select * from public.list_payment_ledger()$$,'42501',null,'Sales cannot open the full ledger');
select throws_ok($$select * from public.student_payments$$,'42501',null,'no direct ledger access');
select throws_ok($$select public.correct_student_payment('afa00000-0000-4000-8000-000000000001',(select payment_id from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi'),-100,'Typo')$$,
  '42501',null,'Sales cannot correct');
-- Another Sales person sees amounts but not someone else's payment details.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000006","session_id":"af000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.list_student_payments('af800000-0000-4000-8000-000000000004')),2,'second Sales sees both amounts');
select is((select count(*)::int from public.list_student_payments('af800000-0000-4000-8000-000000000004') where restricted and transaction_id is null and collected_by is null and receipt_object is null),2,
  'second Sales sees no transaction, collector or receipt details');
-- Receipts: only the recorder (or an admin) uploads, once, with a safe name.
select ok(not public.current_person_can_upload_payment_receipt(
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/receipt-00000000-0000-4000-8000-000000000001.pdf'),
  'another Sales person cannot upload the receipt');
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000001","session_id":"af000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select ok(public.current_person_can_upload_payment_receipt(
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/receipt-00000000-0000-4000-8000-000000000001.pdf'),
  'recorder can upload the receipt');
select ok(not public.current_person_can_upload_payment_receipt(
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/../receipt.pdf'),
  'unsafe object names refused');
select throws_ok($$select public.attach_payment_receipt((select payment_id from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi'),
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/receipt-00000000-0000-4000-8000-000000000001.pdf')$$,
  '22023',null,'a receipt must be uploaded before it is attached');
reset role;
insert into storage.objects(bucket_id,name)
select 'payment-receipts',id::text||'/receipt-00000000-0000-4000-8000-000000000001.pdf' from public.student_payments where transaction_id='UPI-REF-1';
set local role authenticated;
select ok(public.attach_payment_receipt((select payment_id from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi'),
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/receipt-00000000-0000-4000-8000-000000000001.pdf'),
  'recorder attaches the receipt');
select ok(public.current_person_can_read_payment_receipt(
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/receipt-00000000-0000-4000-8000-000000000001.pdf'),
  'recorder can read the receipt');
select throws_ok($$select public.attach_payment_receipt((select payment_id from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi'),
  (select payment_id::text from public.list_student_payments('af800000-0000-4000-8000-000000000004') where method='upi')||'/receipt-00000000-0000-4000-8000-000000000002.pdf')$$,
  '42501',null,'a receipt is attached only once');
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000006","session_id":"af000000-0000-4000-8000-000000000006","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from storage.objects where bucket_id='payment-receipts'),0,'another Sales person cannot read the receipt');

-- Admin: full ledger, corrections and agreed fees.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000002","session_id":"af000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::int from public.list_payment_ledger('paying')),2,'admin sees every payment');
select is((select collected_by from public.list_payment_ledger('UPI-REF-1')),'Fictional Pay Sales','admin sees who collected it');
select is((select count(*)::int from storage.objects where bucket_id='payment-receipts'),1,'admin can read the receipt');
select throws_ok($$select public.correct_student_payment('afa00000-0000-4000-8000-000000000002',(select payment_id from public.list_payment_ledger('UPI-REF-1')),-600000,'Too much')$$,
  '22023',null,'a correction cannot go below zero');
select is((public.correct_student_payment('afa00000-0000-4000-8000-000000000003',(select payment_id from public.list_payment_ledger('UPI-REF-1')),-100000,'Entered ₹1,000 too much'))->>'replayed','false',
  'admin records a correction');
select is((select paid_paise from public.list_payment_students('paying')),900000::bigint,'correction reduces the total');
select is((select admission_paid from public.list_payment_students('paying')),false,'the admission fee is short again');
select is(public.set_enrollment_fee('afb00000-0000-4000-8000-000000000001','af800000-0000-4000-8000-000000000004',null,12000000,'Scholarship'),1::bigint,'admin sets an agreed fee');
select is((select fee_paise from public.list_payment_students('paying')),12000000::bigint,'agreed fee replaces the course fee');
select throws_ok($$select public.set_enrollment_fee('afb00000-0000-4000-8000-000000000002','af800000-0000-4000-8000-000000000004',null,11000000,'Stale')$$,
  '40001',null,'stale fee revision refused');
-- The ledger is append-only even for the database owner.
reset role;
select throws_ok($$update public.student_payments set amount_paise=1 where transaction_id='UPI-REF-1'$$,'42501',null,'payments cannot be edited');
select throws_ok($$delete from public.student_payments where transaction_id='UPI-REF-1'$$,'42501',null,'payments cannot be deleted');
set local role authenticated;
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000001","session_id":"af000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok($$select public.set_enrollment_fee('afb00000-0000-4000-8000-000000000003','af800000-0000-4000-8000-000000000004',1,1,'Sales discount')$$,
  '42501',null,'Sales cannot change the agreed fee');
-- Teachers and students have no payment access.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000003","session_id":"af000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select throws_ok($$select * from public.list_payment_students('')$$,'42501',null,'teacher denied');
-- Batches pre-fill from the course length.
set local request.jwt.claims='{"sub":"af000000-0000-4000-8000-000000000001","session_id":"af000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select (o->>'durationDays')::int from jsonb_array_elements(public.get_batch_workspace()->'offerings') o where o->>'title'='Fictional Payments Course'),
  365,'batch workspace carries the course length');
reset role;
select is((select count(*)::int from public.student_payments where kind='correction'),1,'one correction row');
select * from finish();
rollback;
