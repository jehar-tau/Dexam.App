begin;

select plan(33);

select has_function(
  'public', 'list_crm_assignment_queue', array['integer', 'text', 'text'],
  'capability-gated CRM assignment queue exists'
);
select has_function(
  'public', 'list_crm_eligible_owners', array['integer', 'text'],
  'minimal eligible-owner discovery exists'
);
select has_function(
  'public', 'assign_crm_enquiry', array['uuid', 'uuid', 'text', 'uuid', 'boolean'],
  'concurrency-aware single-enquiry assignment exists'
);
select is(
  to_regprocedure('public.assign_crm_enquiry(uuid,uuid,text)') is null,
  true,
  'the stale assignment signature is no longer exposed'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f011-owner-active@dexam.test', ''),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f011-owner-inactive@dexam.test', ''),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f011-coordinator@dexam.test', ''),
  ('c0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f011-sales@dexam.test', '');

insert into public.people (id, display_name)
values
  ('c1000000-0000-4000-8000-000000000001', 'Fictional Active Owner'),
  ('c1000000-0000-4000-8000-000000000002', 'Fictional Inactive Owner'),
  ('c1000000-0000-4000-8000-000000000003', 'Fictional CRM Coordinator'),
  ('c1000000-0000-4000-8000-000000000004', 'Fictional Ordinary Sales');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'employee_email'),
  ('c1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'employee_email'),
  ('c1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000002', 'employee', 'active', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000003', 'employee', 'active', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000004', 'employee', 'active', now() - interval '1 day');

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('c1000000-0000-4000-8000-000000000001', 'sales', 'F011 active owner'),
  ('c1000000-0000-4000-8000-000000000002', 'sales', 'F011 owner later suspended'),
  ('c1000000-0000-4000-8000-000000000003', 'sales', 'F011 CRM Coordinator'),
  ('c1000000-0000-4000-8000-000000000004', 'sales', 'F011 ordinary Sales');

insert into public.capability_grants (
  person_id, capability_key, required_role_key, grant_reason
)
values (
  'c1000000-0000-4000-8000-000000000003', 'lead.assign', 'sales',
  'F011 approved CRM Coordinator responsibility'
);

-- Explicit owned provider sessions for fictional JWT fixtures; rolled back with this test.
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now(),now() from auth.users where id in ('c0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000003','c0000000-0000-4000-8000-000000000004') on conflict(id) do nothing;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000001"}';
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Unassigned Prospect', 'Fictional Unassigned Prospect', 'self', 'email',
    'unassigned.prospect@example.test', 'UCEED preparation', '2027 entrance', 'manual',
    'c2000000-0000-4000-8000-000000000001'
  )$$,
  'active Sales can create the enquiry used by the assignment queue'
);

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000002"}';
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Stranded Prospect', 'Fictional Guardian', 'guardian', 'phone',
    '+919811112222', 'NID preparation', '2027 entrance', 'manual',
    'c2000000-0000-4000-8000-000000000002'
  )$$,
  'a second owner can create the enquiry used for inactive-owner recovery'
);

reset role;

update public.crm_enquiries
set owner_person_id = null
where request_key = 'c2000000-0000-4000-8000-000000000001';

insert into public.crm_follow_ups (
  enquiry_id, assigned_to_person_id, due_at, created_by_person_id
)
select e.id, e.owner_person_id, now() + interval '1 day', e.owner_person_id
from public.crm_enquiries e
where e.request_key = 'c2000000-0000-4000-8000-000000000002';

update public.people
set status = 'suspended', suspended_at = now()
where id = 'c1000000-0000-4000-8000-000000000002';

create temporary table f011_test_ids (
  unassigned_enquiry uuid,
  stranded_enquiry uuid
);
insert into f011_test_ids
select
  (select id from public.crm_enquiries where request_key = 'c2000000-0000-4000-8000-000000000001'),
  (select id from public.crm_enquiries where request_key = 'c2000000-0000-4000-8000-000000000002');
grant select on table f011_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000003"}';

select is(public.current_person_has_capability('lead.assign'), true, 'explicit Sales grant enables CRM Coordinator authority');
select is((select count(*)::integer from public.list_crm_assignment_queue(25, null, 'unassigned')), 1, 'coordinator sees one unassigned enquiry');
select is((select count(*)::integer from public.list_crm_assignment_queue(25, null, 'needs_reassignment')), 1, 'coordinator sees one inactive-owner enquiry');
select is((select current_owner_person_id is null from public.list_crm_assignment_queue(25, 'Unassigned', 'unassigned')), true, 'unassigned queue carries an explicit empty owner state');
select is((select owner_is_eligible from public.list_crm_assignment_queue(25, 'Stranded', 'needs_reassignment')), false, 'stranded queue explains that the recorded owner is ineligible');
select is((select count(*)::integer from public.list_crm_eligible_owners(50, null)), 3, 'owner discovery returns only the three currently eligible Sales employees');
select is((select display_name from public.list_crm_eligible_owners(50, 'Active Owner')), 'Fictional Active Owner', 'bounded owner search returns minimum operational identity');

select lives_ok(
  $$select public.assign_crm_enquiry(
    (select unassigned_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000001',
    'Assigned after intake review', null, true
  )$$,
  'coordinator assigns one unassigned enquiry with an expected empty-owner state'
);

reset role;
select is(
  (select owner_person_id from public.crm_enquiries where request_key = 'c2000000-0000-4000-8000-000000000001'),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'single assignment changes the current owner atomically'
);
select is(
  (select count(*)::integer from public.crm_enquiry_ownership_history h join public.crm_enquiries e on e.id = h.enquiry_id where e.request_key = 'c2000000-0000-4000-8000-000000000001'),
  2,
  'single assignment appends history without erasing the intake owner record'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000003"}';
select throws_ok(
  $$select public.assign_crm_enquiry(
    (select unassigned_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000004',
    'Stale coordinator confirmation', null, true
  )$$,
  '40001',
  'CRM enquiry ownership changed; refresh and try again',
  'stale confirmation cannot overwrite a newer owner'
);

select lives_ok(
  $$select public.assign_crm_enquiry(
    (select stranded_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000001',
    'Recovered after owner suspension',
    'c1000000-0000-4000-8000-000000000002', false
  )$$,
  'coordinator recovers an enquiry from an inactive owner'
);

reset role;
select is(
  (select owner_person_id from public.crm_enquiries where request_key = 'c2000000-0000-4000-8000-000000000002'),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'inactive-owner recovery changes only the current owner'
);
select is(
  (select count(*)::integer from public.crm_follow_ups f join public.crm_enquiries e on e.id = f.enquiry_id where e.request_key = 'c2000000-0000-4000-8000-000000000002' and f.status = 'replaced'),
  1,
  'inactive-owner recovery preserves the prior follow-up as replaced history'
);
select is(
  (select assigned_to_person_id from public.crm_follow_ups f join public.crm_enquiries e on e.id = f.enquiry_id where e.request_key = 'c2000000-0000-4000-8000-000000000002' and f.status = 'open'),
  'c1000000-0000-4000-8000-000000000001'::uuid,
  'replacement follow-up belongs to the new active owner'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000003"}';
select throws_ok(
  $$select public.assign_crm_enquiry(
    (select stranded_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000002',
    'Attempted assignment to suspended owner',
    'c1000000-0000-4000-8000-000000000001', false
  )$$,
  '22023',
  'target owner is not an active Sales owner',
  'a suspended employee cannot receive an enquiry'
);
select lives_ok(
  $$select public.assign_crm_enquiry(
    (select stranded_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000001',
    'Confirmed current ownership',
    'c1000000-0000-4000-8000-000000000001', false
  )$$,
  'assigning the already-current eligible owner is a safe no-op'
);

reset role;
select is(
  (select count(*)::integer from public.crm_enquiry_ownership_history h join public.crm_enquiries e on e.id = h.enquiry_id where e.request_key = 'c2000000-0000-4000-8000-000000000002'),
  2,
  'the no-op creates no false ownership history'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000003"}';
select throws_ok(
  $$select public.assign_crm_enquiry(
    (select stranded_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000004',
    'Invalid expected state', null, false
  )$$,
  '22023',
  'expected CRM owner state is invalid',
  'assignment requires an explicit coherent expected-owner state'
);

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000004"}';
select is(public.current_person_has_capability('lead.assign'), false, 'ordinary Sales has no coordinator authority');
select throws_ok(
  $$select * from public.list_crm_assignment_queue(25, null, 'unassigned')$$,
  '42501', 'CRM assignment access denied',
  'ordinary Sales cannot infer the unassigned queue'
);
select throws_ok(
  $$select * from public.list_crm_eligible_owners(50, null)$$,
  '42501', 'CRM assignment access denied',
  'ordinary Sales cannot enumerate eligible owners'
);
select throws_ok(
  $$select public.assign_crm_enquiry(
    (select unassigned_enquiry from f011_test_ids),
    'c1000000-0000-4000-8000-000000000004',
    'Unauthorized assignment attempt',
    'c1000000-0000-4000-8000-000000000001', false
  )$$,
  '42501', 'CRM assignment denied',
  'ordinary Sales cannot assign an enquiry'
);

reset role;
update public.capability_grants
set revoked_at = now()
where person_id = 'c1000000-0000-4000-8000-000000000003'
  and capability_key = 'lead.assign';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000003"}';
select is(public.current_person_has_capability('lead.assign'), false, 'revoking the coordinator grant removes authority immediately');
select throws_ok(
  $$select * from public.list_crm_assignment_queue(25, null, 'unassigned')$$,
  '42501', 'CRM assignment access denied',
  'revoked coordinator cannot use a stale session to read the queue'
);

reset role;
update public.capability_grants
set revoked_at = null
where person_id = 'c1000000-0000-4000-8000-000000000003'
  and capability_key = 'lead.assign';
update public.role_assignments
set revoked_at = now()
where person_id = 'c1000000-0000-4000-8000-000000000003'
  and role_key = 'sales';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"c0000000-0000-4000-8000-000000000003"}';
select is(public.current_person_has_capability('lead.assign'), false, 'the explicit grant is ineffective without its required current Sales role');
select throws_ok(
  $$select * from public.list_crm_assignment_queue(25, null, 'needs_reassignment')$$,
  '42501', 'CRM assignment access denied',
  'revoking the required role denies the next queue request'
);

select * from finish();

rollback;
