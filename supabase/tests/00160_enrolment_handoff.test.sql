begin;

select plan(55);

select has_type('public', 'crm_enrolment_review_status', 'review lifecycle enum exists');
select has_type('public', 'crm_student_resolution_mode', 'student resolution enum exists');
select has_function('public', 'list_enrolment_handoffs', array['integer', 'text'], 'operator inbox exists');
select has_function('public', 'list_enrolment_identity_candidates', array['uuid'], 'candidate evidence lookup exists');
select has_function('public', 'search_enrolment_students', array['integer', 'text'], 'bounded student lookup exists');
select has_function('public', 'list_enrolment_handoff_choices', array[]::text[], 'offering and cohort choices exist');
select has_function('public', 'return_crm_enrolment_review', array['uuid', 'text'], 'return workflow exists');
select has_function(
  'public', 'approve_crm_enrolment_review',
  array['uuid', 'crm_student_resolution_mode', 'uuid', 'uuid', 'uuid', 'text', 'uuid[]', 'text[]'],
  'atomic approval workflow exists'
);
select has_index('public', 'crm_enrolment_review_requests', 'crm_review_one_pending_per_enquiry', 'only one pending request is allowed per enquiry');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('d0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f012-operator@dexam.test', ''),
  ('d0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f012-sales@dexam.test', ''),
  ('d0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f012-outsider@dexam.test', ''),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f012-claimed@members.dexam.invalid', '');

insert into public.people (id, member_id, display_name)
values
  ('d1000000-0000-4000-8000-000000000001', null, 'Fictional Handoff Operator'),
  ('d1000000-0000-4000-8000-000000000002', null, 'Fictional Handoff Sales'),
  ('d1000000-0000-4000-8000-000000000003', null, 'Fictional Handoff Outsider'),
  ('d1000000-0000-4000-8000-000000000004', 'DXM-7K3M9Q2RW5TY', 'Fictional Existing Student'),
  ('d1000000-0000-4000-8000-000000000005', 'DXM-8K3M9Q2RW5TY', 'Fictional Contact Match');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('d1000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('d1000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'employee_email'),
  ('d1000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 'employee_email'),
  ('d1000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000004', 'member_id');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('d1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('d1000000-0000-4000-8000-000000000002', 'employee', 'active', now() - interval '1 day'),
  ('d1000000-0000-4000-8000-000000000003', 'employee', 'active', now() - interval '1 day'),
  ('d1000000-0000-4000-8000-000000000004', 'student', 'active', now() - interval '1 day'),
  ('d1000000-0000-4000-8000-000000000005', 'student', 'active', now() - interval '1 day');

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('d1000000-0000-4000-8000-000000000001', 'ordinary_admin', 'F012 Enrolment Operator'),
  ('d1000000-0000-4000-8000-000000000002', 'sales', 'F012 assigned Sales'),
  ('d1000000-0000-4000-8000-000000000003', 'ordinary_admin', 'F012 ordinary admin without direct grant');

insert into public.capability_grants (person_id, capability_key, required_role_key, grant_reason)
values (
  'd1000000-0000-4000-8000-000000000001', 'enrollment.operate', 'ordinary_admin',
  'F012 approved Enrolment Operator responsibility'
);

insert into public.offerings (id, code, title, status)
values
  ('d2000000-0000-4000-8000-000000000001', 'F012_FOUNDATION', 'Fictional Foundation 2027', 'active'),
  ('d2000000-0000-4000-8000-000000000002', 'F012_OTHER', 'Fictional Portfolio Sprint', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'F012_STUDIO_A', 'Fictional Studio A', 'active'),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 'F012_PORTFOLIO_A', 'Fictional Portfolio A', 'active');

insert into public.crm_contact_points (
  person_id, kind, normalized_value, display_value, created_by_person_id
)
values
  ('d1000000-0000-4000-8000-000000000004', 'phone', '+919822223333', '+91 98222 23333', 'd1000000-0000-4000-8000-000000000002'),
  ('d1000000-0000-4000-8000-000000000005', 'phone', '+919811112222', '+91 98111 12222', 'd1000000-0000-4000-8000-000000000002');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Return Prospect', 'Fictional Return Prospect', 'self', 'email',
    'return.prospect@example.test', 'UCEED foundation', '2027 entrance', 'manual',
    'd4000000-0000-4000-8000-000000000001'
  )$$,
  'Sales creates the prospect used for a returned handoff'
);
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional New Student', 'Fictional New Student', 'self', 'phone',
    '+919811112222', 'NID foundation', '2027 entrance', 'manual',
    'd4000000-0000-4000-8000-000000000002'
  )$$,
  'Sales creates a prospect with weak contact-match evidence'
);
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Existing Student', 'Fictional Existing Student', 'self', 'phone',
    '+919822223333', 'NATA foundation', '2027 entrance', 'manual',
    'd4000000-0000-4000-8000-000000000003'
  )$$,
  'Sales creates a prospect later linked to a canonical student'
);
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Duplicate Context', 'Fictional Duplicate Context', 'self', 'email',
    'duplicate.context@example.test', 'NID foundation', '2027 entrance', 'manual',
    'd4000000-0000-4000-8000-000000000004'
  )$$,
  'Sales creates the prospect used for duplicate-enrolment protection'
);

reset role;
update public.crm_enquiries set stage = 'qualified';

create temporary table f012_ids (
  purpose text primary key,
  enquiry_id uuid,
  request_id uuid
);
insert into f012_ids (purpose, enquiry_id)
select 'return', id from public.crm_enquiries where request_key = 'd4000000-0000-4000-8000-000000000001'
union all
select 'new', id from public.crm_enquiries where request_key = 'd4000000-0000-4000-8000-000000000002'
union all
select 'existing', id from public.crm_enquiries where request_key = 'd4000000-0000-4000-8000-000000000003'
union all
select 'duplicate', id from public.crm_enquiries where request_key = 'd4000000-0000-4000-8000-000000000004';
grant select, update on table f012_ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select lives_ok($$update f012_ids set request_id = public.request_crm_enrolment_review(enquiry_id, 'Ready for return-path review.') where purpose = 'return'$$, 'Sales requests the return-path review');
select lives_ok($$update f012_ids set request_id = public.request_crm_enrolment_review(enquiry_id, 'Identity and course evidence supplied.') where purpose = 'new'$$, 'Sales requests new-student review');
select lives_ok($$update f012_ids set request_id = public.request_crm_enrolment_review(enquiry_id, 'Existing student details supplied.') where purpose = 'existing'$$, 'Sales requests existing-student review');
select lives_ok($$update f012_ids set request_id = public.request_crm_enrolment_review(enquiry_id, 'Check for duplicate course access.') where purpose = 'duplicate'$$, 'Sales requests duplicate-context review');

select throws_ok(
  $$select * from public.list_enrolment_handoffs(25, null)$$,
  '42501', 'enrolment handoff access denied',
  'Sales cannot infer the operator inbox'
);
select throws_ok(
  $$select * from public.list_enrolment_identity_candidates((select request_id from f012_ids where purpose = 'new'))$$,
  '42501', 'identity candidate access denied',
  'Sales cannot inspect candidate students'
);
select throws_ok(
  $$select * from public.search_enrolment_students(20, 'Fictional')$$,
  '42501', 'student identity search denied',
  'Sales cannot search canonical students'
);
select throws_ok(
  $$select * from public.list_enrolment_handoff_choices()$$,
  '42501', 'enrolment choice access denied',
  'Sales cannot inspect handoff choices'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_enrolment_handoffs(25, null)), 4, 'operator sees only four explicit pending requests');
select is((select count(*)::integer from public.list_enrolment_handoffs(25, 'New Student')), 1, 'bounded inbox search finds one subject');
select is((select count(*)::integer from public.list_enrolment_identity_candidates((select request_id from f012_ids where purpose = 'new'))), 1, 'operator sees one weak match for the new-student request');
select is((select existing_member_id from public.list_enrolment_identity_candidates((select request_id from f012_ids where purpose = 'existing'))), 'DXM-7K3M9Q2RW5TY', 'candidate evidence exposes only the operational Member ID');
select is((select count(*)::integer from public.search_enrolment_students(20, 'Existing')), 1, 'bounded student search returns the eligible canonical student');
select is((select count(*)::integer from public.list_enrolment_handoff_choices()), 4, 'choices contain independent and cohort contexts for active offerings');

select lives_ok(
  $$select public.return_crm_enrolment_review((select request_id from f012_ids where purpose = 'return'), 'Confirm the intended cohort with the family.')$$,
  'operator returns one request with a bounded reason'
);
reset role;
select is((select status::text from public.crm_enrolment_review_requests where id = (select request_id from f012_ids where purpose = 'return')), 'returned', 'returned request is immutable history');
select is((select stage::text from public.crm_enquiries where id = (select enquiry_id from f012_ids where purpose = 'return')), 'qualified', 'returned enquiry goes back to qualified');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select review_status::text from public.list_crm_enquiries(25, 'Return Prospect')), 'returned', 'assigned Sales sees the returned disposition');
select lives_ok(
  $$update f012_ids set request_id = public.request_crm_enrolment_review(enquiry_id, 'Corrected cohort evidence supplied.') where purpose = 'return'$$,
  'Sales resubmits the same enquiry after correction'
);
reset role;
select is((select count(*)::integer from public.crm_enrolment_review_requests r join f012_ids i on i.enquiry_id = r.enquiry_id where i.purpose = 'return'), 2, 'resubmission preserves both request attempts');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select * from public.approve_crm_enrolment_review(
    (select request_id from f012_ids where purpose = 'new'), 'new', null,
    'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001',
    'Identity and selected course context confirmed.',
    array[(select candidate_id from public.list_enrolment_identity_candidates((select request_id from f012_ids where purpose = 'new')))],
    array['distinct_people']
  )$$,
  'operator atomically approves a confirmed new student'
);

reset role;
select matches((select member_id from public.people p join public.crm_enquiries e on e.subject_person_id = p.id join f012_ids i on i.enquiry_id = e.id where i.purpose = 'new'), '^DXM-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{12}$', 'new student receives a non-ambiguous Member ID');
select is((select count(*)::integer from public.memberships m join public.crm_enquiries e on e.subject_person_id = m.person_id join f012_ids i on i.enquiry_id = e.id where i.purpose = 'new' and m.kind = 'student' and m.status = 'active'), 1, 'new student receives one active student membership');
select is((select status::text from public.enrollments where source_reference = (select request_id::text from f012_ids where purpose = 'new')), 'approved', 'new unclaimed student receives an approved enrolment');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.list_student_activation_queue(25, 'Fictional New Student')), 1, 'new student enters the existing activation queue');
reset role;
select is((select status::text from public.crm_enrolment_review_requests where id = (select request_id from f012_ids where purpose = 'new')), 'approved', 'new-student request records approval');
select is((select stage::text from public.crm_enquiries where id = (select enquiry_id from f012_ids where purpose = 'new')), 'converted', 'CRM enquiry converts only after enrolment creation');
select is((select status::text from public.crm_identity_candidates c join f012_ids i on i.enquiry_id = c.enquiry_id where i.purpose = 'new'), 'distinct_people', 'weak evidence is explicitly classified as different people');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.list_crm_enquiries(25, 'Fictional New Student', 'active')), 0, 'converted enquiry leaves the active Sales queue');

set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select lives_ok(
  $$select * from public.approve_crm_enrolment_review(
    (select request_id from f012_ids where purpose = 'existing'), 'existing',
    'd1000000-0000-4000-8000-000000000004',
    'd2000000-0000-4000-8000-000000000001', null,
    'Existing canonical account and course confirmed.',
    array[(select candidate_id from public.list_enrolment_identity_candidates((select request_id from f012_ids where purpose = 'existing')))],
    array['resolved']
  )$$,
  'operator links and enrolls an existing claimed student'
);

reset role;
select is((select count(*)::integer from public.people where member_id = 'DXM-7K3M9Q2RW5TY'), 1, 'existing path creates no duplicate canonical person');
select is((select status::text from public.enrollments where source_reference = (select request_id::text from f012_ids where purpose = 'existing')), 'active', 'claimed existing student receives an active enrolment');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.list_student_activation_queue(25, 'DXM-7K3M9Q2RW5TY')), 0, 'claimed existing student receives no duplicate activation pack');
reset role;
select is((select status::text from public.crm_identity_candidates c join f012_ids i on i.enquiry_id = c.enquiry_id where i.purpose = 'existing'), 'resolved', 'same-person candidate evidence is explicitly resolved');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select * from public.approve_crm_enrolment_review(
    (select request_id from f012_ids where purpose = 'duplicate'), 'existing',
    'd1000000-0000-4000-8000-000000000004',
    'd2000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000002',
    'Attempt with an incompatible cohort.', '{}'::uuid[], '{}'::text[]
  )$$,
  '55000', 'the selected cohort is not currently available',
  'mismatched cohort is rejected before mutation'
);
reset role;
select is((select status::text from public.crm_enrolment_review_requests where id = (select request_id from f012_ids where purpose = 'duplicate')), 'pending', 'invalid cohort leaves the request pending');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select * from public.approve_crm_enrolment_review(
    (select request_id from f012_ids where purpose = 'duplicate'), 'existing',
    'd1000000-0000-4000-8000-000000000004',
    'd2000000-0000-4000-8000-000000000001', null,
    'Attempt duplicate independent enrolment.', '{}'::uuid[], '{}'::text[]
  )$$,
  '23505', 'the student already has an open enrolment for this offering and cohort',
  'duplicate open enrolment is rejected atomically'
);
reset role;
select is((select status::text from public.crm_enrolment_review_requests where id = (select request_id from f012_ids where purpose = 'duplicate')), 'pending', 'duplicate conflict leaves the request pending');

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select public.return_crm_enrolment_review((select request_id from f012_ids where purpose = 'new'), 'Stale return attempt.')$$,
  '40001', 'enrolment handoff was already resolved',
  'stale operator action cannot overwrite an approved request'
);

reset role;
update public.capability_grants set revoked_at = now()
where person_id = 'd1000000-0000-4000-8000-000000000001' and capability_key = 'enrollment.operate';
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.current_person_has_capability('enrollment.operate'), false, 'revocation removes handoff authority immediately');
select throws_ok(
  $$select * from public.list_enrolment_handoffs(25, null)$$,
  '42501', 'enrolment handoff access denied',
  'revoked operator cannot reuse a stale session'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select * from public.list_enrolment_handoffs(25, null)$$,
  '42501', 'enrolment handoff access denied',
  'ordinary admin without the direct responsibility grant is denied'
);

select * from finish();

rollback;
