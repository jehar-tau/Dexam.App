begin;

select plan(71);

select has_type('public', 'crm_privacy_lifecycle_state', 'CRM privacy lifecycle enum exists');
select has_type('public', 'crm_privacy_case_status', 'privacy case status enum exists');
select has_table('public', 'crm_privacy_cases', 'privacy cases table exists');
select has_table('public', 'crm_privacy_holds', 'time-limited privacy holds table exists');
select has_table('public', 'crm_privacy_erasure_tombstones', 'restore-safe erasure tombstones exist');
select has_function('public', 'list_crm_privacy_cases', array['integer', 'text'], 'protected privacy case queue exists');
select has_function(
  'public', 'create_crm_privacy_case',
  array['uuid', 'crm_privacy_case_kind', 'crm_privacy_requester_relationship', 'crm_privacy_verification_method', 'text'],
  'verified staff-recorded case creation exists'
);
select has_function(
  'public', 'apply_crm_privacy_correction',
  array['uuid', 'crm_privacy_correction_field', 'text', 'text'],
  'bounded correction workflow exists'
);
select has_function('public', 'preview_crm_erasure', array['uuid'], 'erasure dry run exists');
select has_function('public', 'propose_crm_erasure', array['uuid', 'text'], 'erasure proposal exists');
select has_function('public', 'decide_crm_erasure', array['uuid', 'boolean', 'text'], 'separate erasure decision exists');
select has_function('public', 'execute_approved_crm_erasure', array['uuid'], 'service-only erasure execution exists');
select has_function('public', 'list_crm_records_due_for_minimization', array['integer'], 'service minimization queue exists');
select ok((select requires_mfa and not requires_two_person from public.capabilities where key = 'privacy.manage'), 'privacy management requires MFA');
select ok((select requires_mfa and requires_two_person from public.capabilities where key = 'privacy.erase_approve'), 'erasure approval is marked two-person and MFA-gated');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('e0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f013-operator@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f013-approver@dexam.test', ''),
  ('e0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'f013-sales@dexam.test', '');

insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at)
select id, id, 'totp', 'verified', now(), now() from auth.users
where id::text like 'e0000000-0000-4000-8000-%';
insert into auth.sessions (id, user_id, factor_id, aal, created_at, updated_at)
select id, id, id, 'aal2', now(), now() from auth.users
where id::text like 'e0000000-0000-4000-8000-%';

insert into public.people (id, display_name)
values
  ('e1000000-0000-4000-8000-000000000001', 'Fictional Privacy Operator'),
  ('e1000000-0000-4000-8000-000000000002', 'Fictional Privacy Approver'),
  ('e1000000-0000-4000-8000-000000000003', 'Fictional Privacy Sales');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('e1000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('e1000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'employee_email'),
  ('e1000000-0000-4000-8000-000000000003', 'e0000000-0000-4000-8000-000000000003', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('e1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000002', 'employee', 'active', now() - interval '1 day'),
  ('e1000000-0000-4000-8000-000000000003', 'employee', 'active', now() - interval '1 day');

insert into public.role_assignments (person_id, role_key, grant_reason)
values
  ('e1000000-0000-4000-8000-000000000001', 'elevated_admin', 'F013 privacy operator'),
  ('e1000000-0000-4000-8000-000000000002', 'elevated_admin', 'F013 privacy approver'),
  ('e1000000-0000-4000-8000-000000000003', 'sales', 'F013 assigned Sales');

insert into public.capability_grants (person_id, capability_key, required_role_key, grant_reason)
values
  ('e1000000-0000-4000-8000-000000000001', 'privacy.manage', 'elevated_admin', 'F013 verified privacy operations'),
  ('e1000000-0000-4000-8000-000000000001', 'privacy.erase_approve', 'elevated_admin', 'F013 self-approval denial test'),
  ('e1000000-0000-4000-8000-000000000002', 'privacy.manage', 'elevated_admin', 'F013 privacy review'),
  ('e1000000-0000-4000-8000-000000000002', 'privacy.erase_approve', 'elevated_admin', 'F013 independent erasure approval');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000003","session_id":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Correction Prospect', 'Fictional Correction Prospect', 'self', 'email',
    'correction.prospect@example.test', 'Original design preparation', '2027 entrance', 'manual',
    'e2000000-0000-4000-8000-000000000001'
  )$$,
  'Sales creates the correction fixture'
);
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Erasure Prospect', 'Fictional Erasure Guardian', 'guardian', 'phone',
    '+919811110013', 'NID preparation to be erased', '2027 entrance', 'manual',
    'e2000000-0000-4000-8000-000000000002'
  )$$,
  'Sales creates the prospect-only erasure fixture'
);
select lives_ok(
  $$select * from public.create_crm_enquiry(
    'Fictional Converted Student', 'Fictional Converted Student', 'self', 'email',
    'converted.student@example.test', 'UCEED preparation', '2027 entrance', 'manual',
    'e2000000-0000-4000-8000-000000000003'
  )$$,
  'Sales creates the converted-student fixture'
);

reset role;

update public.crm_enquiries
set stage = 'closed', closed_reason = 'No longer interested', closed_at = now() - interval '10 days'
where request_key = 'e2000000-0000-4000-8000-000000000002';
update public.crm_enquiries
set stage = 'converted'
where request_key = 'e2000000-0000-4000-8000-000000000003';
insert into public.memberships (person_id, kind, status, starts_at)
select subject_person_id, 'student', 'active', now() - interval '1 day'
from public.crm_enquiries where request_key = 'e2000000-0000-4000-8000-000000000003';
insert into public.crm_activities (enquiry_id, outcome, note, actor_person_id)
select id, 'note_added', 'Personal free text that must not survive erasure', 'e1000000-0000-4000-8000-000000000003'
from public.crm_enquiries where request_key = 'e2000000-0000-4000-8000-000000000002';

create temporary table f013_ids (
  purpose text primary key,
  enquiry_id uuid not null,
  case_id uuid,
  hold_id uuid
);
insert into f013_ids (purpose, enquiry_id)
select 'correction', id from public.crm_enquiries where request_key = 'e2000000-0000-4000-8000-000000000001'
union all
select 'erasure', id from public.crm_enquiries where request_key = 'e2000000-0000-4000-8000-000000000002'
union all
select 'converted', id from public.crm_enquiries where request_key = 'e2000000-0000-4000-8000-000000000003';
grant select, update on table f013_ids to authenticated;
grant select on table f013_ids to service_role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';
select is(public.current_person_has_capability('privacy.manage'), false, 'AAL1 cannot use the MFA-gated privacy capability');
select throws_ok(
  $$select public.create_crm_privacy_case(
    (select enquiry_id from f013_ids where purpose = 'correction'), 'correction', 'self',
    'existing_contact_callback', 'Verified correction request.'
  )$$,
  '42501', 'privacy case creation denied',
  'AAL1 privacy case creation fails closed'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(public.current_person_has_capability('privacy.manage'), true, 'AAL2 activates the explicit privacy grant');
select lives_ok(
  $$update f013_ids set case_id = public.create_crm_privacy_case(
    enquiry_id, 'correction', 'self', 'existing_contact_callback',
    'Verified request to correct the recorded interest.'
  ) where purpose = 'correction'$$,
  'privacy operator records a verified correction case'
);
select lives_ok(
  $$update f013_ids set case_id = public.create_crm_privacy_case(
    enquiry_id, 'erasure', 'parent_guardian', 'existing_contact_callback',
    'Verified guardian request to erase the closed enquiry.'
  ) where purpose = 'erasure'$$,
  'privacy operator records a verified erasure case'
);
select is((select count(*)::integer from public.list_crm_privacy_cases(50, 'open')), 2, 'privacy operator sees only the two open cases');

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000003","session_id":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select throws_ok(
  $$select * from public.list_crm_privacy_cases(50, 'open')$$,
  '42501', 'privacy operations access denied',
  'ordinary Sales cannot infer privacy cases'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok(
  $$select public.apply_crm_privacy_correction(
    (select case_id from f013_ids where purpose = 'correction'),
    'interest_summary', 'Corrected UCEED preparation', 'Requester confirmed the intended exam.'
  )$$,
  'authorized operator applies one field-scoped correction'
);

reset role;
select is(
  (select interest_summary from public.crm_enquiries where id = (select enquiry_id from f013_ids where purpose = 'correction')),
  'Corrected UCEED preparation',
  'the authoritative CRM value is corrected'
);
select is((select count(*)::integer from public.crm_privacy_corrections), 1, 'one correction evidence record is retained');
select is((select length(before_fingerprint) from public.crm_privacy_corrections), 64, 'prior value is represented by a keyed fingerprint');
select isnt((select before_fingerprint from public.crm_privacy_corrections), 'Original design preparation', 'readable prior value is absent from correction evidence');
select is(
  (select status::text from public.crm_privacy_cases where id = (select case_id from f013_ids where purpose = 'correction')),
  'completed',
  'correction case completes after the trusted update'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok(
  $$update f013_ids set case_id = public.create_crm_privacy_case(
    enquiry_id, 'correction', 'self', 'member_account',
    'Verified request that would alter a canonical student name.'
  ) where purpose = 'converted'$$,
  'operator records the protected canonical-name correction case'
);
select throws_ok(
  $$select public.apply_crm_privacy_correction(
    (select case_id from f013_ids where purpose = 'converted'),
    'subject_name', 'Different Canonical Name', 'Requested identity correction.'
  )$$,
  '55000', 'canonical identity correction requires a separate elevated workflow',
  'CRM privacy correction cannot silently rewrite a canonical student identity'
);

select lives_ok(
  $$select public.propose_crm_erasure(
    (select case_id from f013_ids where purpose = 'erasure'),
    'Verified closed-enquiry erasure with no remaining CRM purpose.'
  )$$,
  'privacy operator proposes the scoped erasure'
);
reset role;
select is(
  (select status::text from public.crm_privacy_cases where id = (select case_id from f013_ids where purpose = 'erasure')),
  'approval_required',
  'erasure waits for separate approval'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select throws_ok(
  $$select public.decide_crm_erasure(
    (select case_id from f013_ids where purpose = 'erasure'), true,
    'Attempted self-approval must fail.'
  )$$,
  '42501', 'erasure proposer cannot approve their own request',
  'proposer cannot approve irreversible erasure even with the capability'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select lives_ok(
  $$select public.decide_crm_erasure(
    (select case_id from f013_ids where purpose = 'erasure'), true,
    'Scope and protected-record boundary independently confirmed.'
  )$$,
  'a different Elevated Admin approves erasure'
);
reset role;
select is(
  (select status::text from public.crm_privacy_cases where id = (select case_id from f013_ids where purpose = 'erasure')),
  'approved',
  'approved case is ready for the trusted worker'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select is((select count(*)::integer from public.preview_crm_erasure((select case_id from f013_ids where purpose = 'erasure'))), 4, 'dry run groups the affected data without exposing hidden values');
select lives_ok(
  $$update f013_ids set hold_id = public.place_crm_privacy_hold(
    enquiry_id, 'active_investigation',
    'Temporary review hold with a named operational purpose.', now() + interval '30 days'
  ) where purpose = 'erasure'$$,
  'authorized operator places a bounded hold'
);
reset role;
select is(
  (select privacy_state::text from public.crm_enquiries where id = (select enquiry_id from f013_ids where purpose = 'erasure')),
  'held',
  'active hold visibly pauses lifecycle execution'
);

set local role service_role;
select throws_ok(
  $$select public.execute_approved_crm_erasure((select case_id from f013_ids where purpose = 'erasure'))$$,
  '55000', 'an active privacy hold prevents erasure',
  'trusted worker cannot bypass an active hold'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select lives_ok(
  $$select public.release_crm_privacy_hold(
    (select hold_id from f013_ids where purpose = 'erasure'),
    'Investigation completed without a retention requirement.'
  )$$,
  'authorized operator deliberately releases the hold'
);

set local role service_role;
select lives_ok(
  $$select public.execute_approved_crm_erasure((select case_id from f013_ids where purpose = 'erasure'))$$,
  'trusted worker executes the distinctly approved erasure'
);
reset role;

select is(
  (select privacy_state::text from public.crm_enquiries where id = (select enquiry_id from f013_ids where purpose = 'erasure')),
  'minimized',
  'erased enquiry is irreversibly removed from CRM operational use'
);
select is(
  (select interest_summary from public.crm_enquiries where id = (select enquiry_id from f013_ids where purpose = 'erasure')),
  'Erased CRM record',
  'required enquiry text contains no prior content'
);
select matches(
  (select normalized_value from public.crm_contact_points point join public.crm_enquiries enquiry on enquiry.primary_contact_point_id = point.id where enquiry.id = (select enquiry_id from f013_ids where purpose = 'erasure')),
  '^erased\+[0-9a-f]+@example\.invalid$',
  'direct contact value is replaced by a non-deliverable marker'
);
select is(
  (select note from public.crm_activities where enquiry_id = (select enquiry_id from f013_ids where purpose = 'erasure')),
  null,
  'CRM activity free text is erased'
);
select is((select count(*)::integer from public.crm_privacy_erasure_tombstones where case_id = (select case_id from f013_ids where purpose = 'erasure')), 1, 'one non-content restore tombstone is retained');

set local role service_role;
select lives_ok(
  $$select public.execute_approved_crm_erasure((select case_id from f013_ids where purpose = 'erasure'))$$,
  'erasure execution is safe to retry'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000003","session_id":"e0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';
select is((select count(*)::integer from public.list_crm_enquiries(25, null, 'dead_archive')), 0, 'minimized enquiry disappears from Sales archives');
reset role;
select is((select status::text from public.crm_privacy_holds limit 1), 'released', 'released hold remains attributable history');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok(
  $$update f013_ids set case_id = public.create_crm_privacy_case(
    enquiry_id, 'erasure', 'self', 'member_account',
    'Verified request concerning the converted CRM record.'
  ) where purpose = 'converted'$$,
  'operator records a converted-student CRM erasure case'
);
select lives_ok(
  $$select public.propose_crm_erasure(
    (select case_id from f013_ids where purpose = 'converted'),
    'Minimize CRM-only data without changing the student account.'
  )$$,
  'operator proposes CRM-only minimization for the converted student'
);

set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select lives_ok(
  $$select public.decide_crm_erasure(
    (select case_id from f013_ids where purpose = 'converted'), true,
    'Student and academic records are explicitly outside this erasure scope.'
  )$$,
  'independent approver confirms the converted-record boundary'
);

set local role service_role;
select lives_ok(
  $$select public.execute_approved_crm_erasure((select case_id from f013_ids where purpose = 'converted'))$$,
  'worker minimizes CRM-only data for the converted record'
);
reset role;
select is(
  (select display_name from public.people person join public.crm_enquiries enquiry on enquiry.subject_person_id = person.id where enquiry.id = (select enquiry_id from f013_ids where purpose = 'converted')),
  'Fictional Converted Student',
  'canonical student identity is preserved'
);
select is(
  (select count(*)::integer from public.memberships membership join public.crm_enquiries enquiry on enquiry.subject_person_id = membership.person_id where enquiry.id = (select enquiry_id from f013_ids where purpose = 'converted') and membership.kind = 'student'),
  1,
  'student membership is preserved'
);
select is(
  (select privacy_state::text from public.crm_enquiries where id = (select enquiry_id from f013_ids where purpose = 'converted')),
  'minimized',
  'converted CRM record itself is minimized'
);

-- Active enquiries have no retention dates; independently approved erasure must
-- still complete atomically without requiring a fabricated closed stage.
select is((select privacy_state::text from public.crm_enquiries where id=(select enquiry_id from f013_ids where purpose='correction')), 'active', 'active erasure fixture starts without retention scheduling');
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select lives_ok($$update f013_ids set case_id=public.create_crm_privacy_case(enquiry_id,'erasure','self','existing_contact_callback','Verified active enquiry erasure') where purpose='correction'$$, 'active enquiry erasure case created');
select lives_ok($$select public.propose_crm_erasure((select case_id from f013_ids where purpose='correction'),'Verified request to erase active enquiry')$$, 'active enquiry erasure proposed');
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000002","session_id":"e0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}';
select lives_ok($$select public.decide_crm_erasure((select case_id from f013_ids where purpose='correction'),true,'Independent verification complete')$$, 'different operator approves active enquiry erasure');
set local role service_role;
select lives_ok($$select public.execute_approved_crm_erasure((select case_id from f013_ids where purpose='correction'))$$, 'active enquiry erasure executes without missing-date violation');
reset role;
select is((select privacy_state::text from public.crm_enquiries where id=(select enquiry_id from f013_ids where purpose='correction')), 'minimized', 'active enquiry is minimized');
select ok((select retention_anchor_at is not null and minimization_due_at is not null and minimized_at is not null from public.crm_enquiries where id=(select enquiry_id from f013_ids where purpose='correction')), 'minimized lifecycle has required dates');
select is((select stage::text from public.crm_enquiries where id=(select enquiry_id from f013_ids where purpose='correction')), 'new', 'erasure does not invent a sales closeout');
set local role service_role;
select lives_ok($$select public.execute_approved_crm_erasure((select case_id from f013_ids where purpose='correction'))$$, 'active enquiry erasure retry is idempotent');
reset role;
select is((select count(*)::integer from public.crm_privacy_erasure_tombstones where case_id=(select case_id from f013_ids where purpose='correction')),1,'active erasure has one restoration tombstone');

update public.capability_grants set revoked_at = now()
where person_id = 'e1000000-0000-4000-8000-000000000001'
  and capability_key = 'privacy.manage';
set local role authenticated;
set local request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","session_id":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}';
select is(public.current_person_has_capability('privacy.manage'), false, 'revocation removes privacy authority immediately');
select throws_ok(
  $$select * from public.list_crm_privacy_cases(50, 'all')$$,
  '42501', 'privacy operations access denied',
  'revoked operator cannot reuse a stale session'
);

select * from finish();

rollback;
