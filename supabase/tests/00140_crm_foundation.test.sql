begin;

select plan(69);

select has_table('public', 'crm_contact_points', 'CRM contact points exist');
select has_table('public', 'crm_enquiries', 'CRM enquiries exist');
select has_table('public', 'crm_enquiry_ownership_history', 'CRM ownership history exists');
select has_table('public', 'crm_activities', 'CRM activity history exists');
select has_table('public', 'crm_follow_ups', 'CRM follow-ups exist');
select has_table('public', 'crm_identity_candidates', 'CRM identity candidates exist');
select has_table('public', 'crm_enrolment_review_requests', 'CRM enrolment review handoff exists');
select has_function(
  'public', 'create_crm_enquiry',
  array['text', 'text', 'crm_contact_relationship', 'crm_contact_kind', 'text', 'text', 'text', 'text', 'uuid'],
  'trusted CRM intake exists'
);
select has_function(
  'public', 'list_crm_enquiries', array['integer', 'text', 'text'],
  'scoped CRM queue exists'
);
select has_function(
  'public', 'schedule_crm_follow_up', array['uuid', 'timestamp with time zone'],
  'follow-up scheduling exists'
);
select has_function(
  'public', 'request_crm_enrolment_review', array['uuid', 'text'],
  'enrolment review handoff exists'
);
select is(
  (select count(*)::integer from public.notification_templates where audience = 'sales' and active),
  2,
  'two safe Sales notification templates are active'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('b0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crm-sales-one@dexam.test', ''),
  ('b0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crm-sales-two@dexam.test', ''),
  ('b0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crm-assigner@dexam.test', ''),
  ('b0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crm-student@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('b1000000-0000-4000-8000-000000000001', null, 'Fictional Sales One'),
  ('b1000000-0000-4000-8000-000000000002', null, 'Fictional Sales Two'),
  ('b1000000-0000-4000-8000-000000000003', null, 'Fictional CRM Assigner'),
  ('b1000000-0000-4000-8000-000000000004', 'DXM-B83M9Q2RW5TY', 'Fictional CRM Student');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'employee_email'),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'employee_email'),
  ('b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'member_id');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('b1000000-0000-4000-8000-000000000002', 'employee', 'active', now() - interval '1 day'),
  ('b1000000-0000-4000-8000-000000000003', 'employee', 'active', now() - interval '1 day'),
  ('b1000000-0000-4000-8000-000000000004', 'student', 'active', now() - interval '1 day');

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('b1000000-0000-4000-8000-000000000001', 'sales', 'F010 assigned Sales one'),
  ('b1000000-0000-4000-8000-000000000002', 'sales', 'F010 assigned Sales two'),
  ('b1000000-0000-4000-8000-000000000003', 'ordinary_admin', 'F010 CRM assignment operator');

insert into public.capability_grants (
  person_id, capability_key, required_role_key, grant_reason
)
values (
  'b1000000-0000-4000-8000-000000000003', 'lead.assign', 'ordinary_admin',
  'F010 lead assignment authority'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(public.current_person_has_capability('lead.manage_assigned'), true, 'Sales receives assigned-lead capability');
select is(public.current_person_has_capability('lead.assign'), false, 'Sales cannot assign arbitrary leads');

select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Prospect One', 'Fictional Prospect One', 'self', 'phone', '+919876543210',
    'NID and UCEED preparation', '2027 entrance', 'manual',
    'b2000000-0000-4000-8000-000000000001'
  )$$,
  'Sales can create an assigned manual enquiry through the trusted workflow'
);

select is(
  (select possible_identity_match from public.create_crm_enquiry(
    'Fictional Prospect One', 'Fictional Prospect One', 'self', 'phone', '+919876543210',
    'NID and UCEED preparation', '2027 entrance', 'manual',
    'b2000000-0000-4000-8000-000000000001'
  )),
  false,
  'retrying the same request key is idempotent'
);

select is((select count(*)::integer from public.list_crm_enquiries(25, null)), 1, 'Sales sees their assigned enquiry');
select is(
  (select subject_name from public.list_crm_enquiries(25, 'Prospect One')),
  'Fictional Prospect One',
  'bounded search returns the assigned prospect'
);
select is(
  (select contact_value from public.list_crm_enquiries(25, null)),
  '+919876543210',
  'assigned Sales can use the primary contact route'
);

select is(
  (select possible_identity_match from public.create_crm_enquiry(
    'Fictional Prospect Two', 'Fictional Guardian Two', 'guardian', 'phone', '+919876543210',
    'NIFT preparation', '2027 entrance', 'manual',
    'b2000000-0000-4000-8000-000000000002'
  )),
  true,
  'a shared phone produces a possible-match warning'
);

reset role;

select is((select count(*)::integer from public.crm_enquiries), 2, 'two distinct enquiries are retained');
select is((select count(*)::integer from public.crm_identity_candidates), 1, 'weak duplicate evidence creates one review candidate');
select is(
  (select count(*)::integer from public.people where display_name like 'Fictional Prospect%'),
  2,
  'weak contact evidence never auto-merges prospective students'
);
select is(
  (select count(*)::integer from public.people p join public.memberships m on m.person_id = p.id where p.display_name like 'Fictional Prospect%'),
  0,
  'CRM intake grants no student or employee membership'
);
select is(
  (select count(*)::integer from public.people p join public.auth_identities a on a.person_id = p.id where p.display_name like 'Fictional Prospect%'),
  0,
  'CRM intake creates no authentication identity'
);
select is((select count(*)::integer from public.crm_enquiry_ownership_history), 2, 'initial ownership is append-only history');
select is((select count(*)::integer from public.domain_events where event_type = 'lead_assigned'), 2, 'initial assignments emit durable events');

create temporary table crm_test_ids (enquiry_one uuid, enquiry_two uuid);
insert into crm_test_ids
select
  (select id from public.crm_enquiries where request_key = 'b2000000-0000-4000-8000-000000000001'),
  (select id from public.crm_enquiries where request_key = 'b2000000-0000-4000-8000-000000000002');
grant select on table crm_test_ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select public.record_crm_activity(
    (select enquiry_one from crm_test_ids),
    'connected', 'Discussed the fictional course schedule.'
  )$$,
  'assigned Sales records a bounded activity'
);

select lives_ok(
  $$select public.schedule_crm_follow_up(
    (select enquiry_one from crm_test_ids),
    now() + interval '1 day'
  )$$,
  'assigned Sales schedules a future follow-up'
);

select is(
  (select count(*)::integer from public.list_crm_enquiries(25, null) where follow_up_id is not null),
  1,
  'one open follow-up is visible to the owner'
);

select lives_ok(
  $$select public.schedule_crm_follow_up(
    (select enquiry_one from crm_test_ids),
    now() + interval '2 days'
  )$$,
  'rescheduling creates a replacement follow-up'
);

reset role;

select is((select count(*)::integer from public.crm_follow_ups where status = 'open'), 1, 'rescheduling preserves one current follow-up');
select is((select count(*)::integer from public.crm_follow_ups where status = 'replaced'), 1, 'rescheduling preserves immutable replacement history');

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select public.schedule_crm_follow_up(
    (select enquiry_two from crm_test_ids),
    now() + interval '3 days'
  )$$,
  'an active enquiry can receive a follow-up before closure'
);
select lives_ok(
  $$select public.update_crm_enquiry_stage(
    (select enquiry_two from crm_test_ids),
    'closed', 'marked_dead', 'No response after repeated fictional follow-ups.'
  )$$,
  'Sales can move an assigned enquiry to the dead-enquiry area with a reason'
);
select is(
  (select count(*)::integer from public.list_crm_enquiries(25, null, 'active')),
  1,
  'a dead enquiry leaves the active queue immediately'
);
select is(
  (select count(*)::integer from public.list_crm_enquiries(25, null, 'recently_dead')),
  1,
  'a newly dead enquiry remains in the seven-day holding area'
);

reset role;
select is(
  (select count(*)::integer from public.crm_follow_ups where status = 'open'),
  1,
  'closing an enquiry cancels only its open follow-up'
);
select is(
  (select count(*)::integer from public.crm_follow_ups where status = 'cancelled'),
  1,
  'the cancelled follow-up is retained as history'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select public.schedule_crm_follow_up(
    (select enquiry_two from crm_test_ids),
    now() + interval '4 days'
  )$$,
  '55000',
  'CRM enquiry is closed',
  'a dead enquiry cannot receive a new follow-up'
);

reset role;
update public.crm_enquiries
set closed_at = now() - interval '8 days'
where id = (select enquiry_two from crm_test_ids);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  (select count(*)::integer from public.list_crm_enquiries(25, null, 'dead_archive')),
  1,
  'after seven days the dead enquiry appears in the archive automatically'
);
select lives_ok(
  $$select public.update_crm_enquiry_stage(
    (select enquiry_two from crm_test_ids),
    'contact_in_progress', 'enquiry_restored', 'The fictional prospect contacted Dexam again.'
  )$$,
  'an archived dead enquiry can be restored without recreating it'
);
select is(
  (select count(*)::integer from public.list_crm_enquiries(25, null, 'active')),
  2,
  'restoring returns the same enquiry to the active queue'
);

reset role;
select is(
  (
    select (closed_at is null and closed_reason is null)::text
    from public.crm_enquiries
    where id = (select enquiry_two from crm_test_ids)
  ),
  'true',
  'restoring clears only current closure metadata while transition history remains'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_crm_enquiries(25, null)), 0, 'another Sales employee cannot see unassigned enquiries');
select throws_ok(
  $$select public.record_crm_activity(
    (select enquiry_one from crm_test_ids),
    'note_added', 'Attempted cross-owner access.'
  )$$,
  '42501',
  'CRM enquiry access denied',
  'another Sales employee cannot mutate an enquiry'
);

set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

select is(public.current_person_has_capability('lead.assign'), true, 'approved assigner receives assignment capability');
select lives_ok(
  $$select public.assign_crm_enquiry(
    (select enquiry_one from crm_test_ids),
    'b1000000-0000-4000-8000-000000000002',
    'Balanced fictional workload'
  )$$,
  'authorized assigner reassigns the enquiry'
);

reset role;

select is((select count(*)::integer from public.crm_enquiry_ownership_history), 3, 'reassignment appends ownership history');
select is(
  (select owner_person_id from public.crm_enquiries where request_key = 'b2000000-0000-4000-8000-000000000001'),
  'b1000000-0000-4000-8000-000000000002'::uuid,
  'current owner changes atomically'
);
select is((select count(*)::integer from public.crm_follow_ups where status = 'open'), 1, 'open follow-up transfers by replacement');
select is(
  (select assigned_to_person_id from public.crm_follow_ups where status = 'open'),
  'b1000000-0000-4000-8000-000000000002'::uuid,
  'replacement follow-up belongs to the new owner'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.list_crm_enquiries(25, 'Prospect One')), 0, 'prior owner immediately loses enquiry visibility');

set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.list_crm_enquiries(25, 'Prospect One')), 1, 'new owner immediately gains enquiry visibility');

select lives_ok(
  $$select public.update_crm_enquiry_stage(
    (select enquiry_one from crm_test_ids),
    'contact_in_progress', 'contact_started', null
  )$$,
  'new owner starts contact'
);
select lives_ok(
  $$select public.update_crm_enquiry_stage(
    (select enquiry_one from crm_test_ids),
    'engaged', 'prospect_engaged', null
  )$$,
  'new owner marks the enquiry engaged'
);
select lives_ok(
  $$select public.update_crm_enquiry_stage(
    (select enquiry_one from crm_test_ids),
    'qualified', 'qualification_confirmed', null
  )$$,
  'new owner deliberately qualifies the enquiry'
);
select lives_ok(
  $$select public.request_crm_enrolment_review(
    (select enquiry_one from crm_test_ids),
    'Prospect requested the fictional foundation programme.'
  )$$,
  'qualified enquiry can request enrolment review'
);
select is(
  (select stage::text from public.list_crm_enquiries(25, 'Prospect One')),
  'enrolment_review_requested',
  'handoff updates the enquiry lifecycle'
);

reset role;

select is((select count(*)::integer from public.crm_enrolment_review_requests), 1, 'handoff is a separate auditable record');
select is(
  (select count(*)::integer from public.memberships where person_id = (
    select subject_person_id from public.crm_enquiries where request_key = 'b2000000-0000-4000-8000-000000000001'
  )),
  0,
  'Sales handoff still creates no student membership'
);

insert into public.crm_follow_ups (
  enquiry_id, assigned_to_person_id, due_at, created_by_person_id, created_at
)
select
  e.id, e.owner_person_id, now() - interval '1 minute', e.owner_person_id, now() - interval '1 hour'
from public.crm_enquiries e
where e.request_key = 'b2000000-0000-4000-8000-000000000002';

select is(
  (select processed_count from public.process_notification_outbox(100)),
  4,
  'worker processes current CRM assignment and due-follow-up events'
);
select is(
  (select count(*)::integer from public.notifications where audience = 'sales'),
  3,
  'worker skips obsolete assignment/follow-up events and creates only current Sales alerts'
);
select is(
  (select count(*)::integer from public.notifications where body ilike '%Fictional%' or body ilike '%+91%'),
  0,
  'Sales notifications never copy names or contact details'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 1, 'new owner sees only the current assignment alert');
select throws_ok(
  $$select count(*) from public.crm_enquiries$$,
  '42501',
  null,
  'authenticated users cannot query CRM tables directly'
);

set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select * from public.list_crm_enquiries(25, null)$$,
  '42501',
  'CRM access denied',
  'students cannot list CRM enquiries'
);

reset role;
update public.people
set status = 'suspended', suspended_at = now()
where id = 'b1000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select * from public.list_crm_enquiries(25, null)$$,
  '42501',
  'CRM access denied',
  'suspension immediately removes CRM access'
);
select is((select count(*)::integer from public.list_my_notifications(50)), 0, 'suspension also removes protected Sales notifications');

select * from finish();

rollback;
