begin;

select plan(62);

select has_table('public', 'feedback_provider_activations', 'provider activation gate exists');
select has_table('public', 'feedback_revisions', 'feedback revisions exist');
select has_table('public', 'feedback_audio_files', 'private feedback audio metadata exists');
select has_table('public', 'feedback_assistance_requests', 'provider-neutral assistance requests exist');
select has_table('public', 'feedback_ai_batches', 'bounded AI batches exist');
select has_table('public', 'feedback_ai_batch_items', 'per-submission AI batch items exist');
select is(
  (select public from storage.buckets where id = 'teacher-feedback-audio'),
  false,
  'teacher feedback audio bucket is private'
);
select has_function('public', 'list_feedback_review_queue', array[]::text[], 'teacher review queue exists');
select has_function('public', 'start_feedback_draft', array['uuid'], 'retry-safe feedback draft operation exists');
select has_function(
  'public', 'save_feedback_draft', array['uuid', 'text', 'feedback_source_kind', 'boolean'],
  'feedback draft save operation exists'
);
select has_function(
  'public', 'publish_feedback_revision', array['uuid', 'feedback_outcome', 'text'],
  'explicit feedback publication operation exists'
);
select has_function(
  'public', 'reserve_feedback_audio_file',
  array['uuid', 'feedback_audio_kind', 'text', 'text', 'bigint', 'numeric'],
  'trusted feedback audio reservation exists'
);
select has_function(
  'public', 'request_feedback_assistance',
  array['uuid', 'feedback_assistance_kind', 'uuid', 'text'],
  'provider-neutral assistance request exists'
);
select has_function(
  'public', 'start_feedback_ai_batch', array['uuid', 'uuid[]', 'uuid'],
  'bounded rubric assistance batch operation exists'
);
select is(
  (select count(*)::integer from public.feedback_provider_activations),
  3,
  'transcription, proofreading, and rubric assistance gates are seeded'
);
select is(
  (select count(*)::integer from public.feedback_provider_activations where mode = 'disabled' and monthly_budget_paise = 0),
  3,
  'all external processing starts disabled with a zero budget'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'teacher-feedback@dexam.test', ''),
  ('f0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-student-one@dexam.test', ''),
  ('f0000000-0000-4000-8000-000000000003', '00000000-0000-0000-8000-000000000000', 'authenticated', 'authenticated', 'feedback-student-two@dexam.test', ''),
  ('f0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-sales@dexam.test', ''),
  ('f0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'feedback-other-teacher@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('f1000000-0000-4000-8000-000000000001', null, 'Fictional Feedback Teacher'),
  ('f1000000-0000-4000-8000-000000000002', 'DXM-F72Q9M4X6WKP', 'Fictional Feedback Student One'),
  ('f1000000-0000-4000-8000-000000000003', 'DXM-F83M9Q2RW5TY', 'Fictional Feedback Student Two'),
  ('f1000000-0000-4000-8000-000000000004', null, 'Fictional Feedback Sales'),
  ('f1000000-0000-4000-8000-000000000005', null, 'Fictional Other Feedback Teacher');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'member_id'),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'member_id'),
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000004', 'employee_email'),
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000005', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('f1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('f1000000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day'),
  ('f1000000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day'),
  ('f1000000-0000-4000-8000-000000000004', 'employee', 'active', now() - interval '1 day'),
  ('f1000000-0000-4000-8000-000000000005', 'employee', 'active', now() - interval '1 day');

insert into public.offerings (id, code, title, status)
values
  ('f2000000-0000-4000-8000-000000000001', 'FEEDBACK_FOUNDATION', 'Fictional Feedback Foundation', 'active'),
  ('f2000000-0000-4000-8000-000000000002', 'FEEDBACK_OTHER', 'Fictional Other Feedback Offering', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values (
  'f3000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'FEEDBACK_A', 'Fictional Feedback A', 'active'
);

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  approved_by_person_id, requested_at, approved_at, activated_at
)
values
  (
    'f4000000-0000-4000-8000-000000000001',
    'f1000000-0000-4000-8000-000000000002',
    'f2000000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001',
    'active', 'manual', 'f1000000-0000-4000-8000-000000000001',
    now() - interval '3 days', now() - interval '2 days', now() - interval '2 days'
  ),
  (
    'f4000000-0000-4000-8000-000000000002',
    'f1000000-0000-4000-8000-000000000003',
    'f2000000-0000-4000-8000-000000000001',
    'f3000000-0000-4000-8000-000000000001',
    'active', 'manual', 'f1000000-0000-4000-8000-000000000001',
    now() - interval '3 days', now() - interval '2 days', now() - interval '2 days'
  );

insert into public.role_assignments (person_id, role_key, scope_type, scope_id, grant_reason)
values
  ('f1000000-0000-4000-8000-000000000001', 'teacher', 'offering', 'f2000000-0000-4000-8000-000000000001', 'F007 feedback teacher'),
  ('f1000000-0000-4000-8000-000000000004', 'sales', 'global', null, 'F007 Sales denial'),
  ('f1000000-0000-4000-8000-000000000005', 'teacher', 'offering', 'f2000000-0000-4000-8000-000000000002', 'F007 other teacher denial');

insert into public.capability_grants (
  person_id, capability_key, required_role_key, scope_type, scope_id, grant_reason
)
values
  (
    'f1000000-0000-4000-8000-000000000001', 'feedback.review', 'teacher',
    'offering', 'f2000000-0000-4000-8000-000000000001', 'F007 review access'
  ),
  (
    'f1000000-0000-4000-8000-000000000001', 'feedback.ai_assist', 'teacher',
    'offering', 'f2000000-0000-4000-8000-000000000001', 'F007 bounded AI access'
  ),
  (
    'f1000000-0000-4000-8000-000000000005', 'feedback.review', 'teacher',
    'offering', 'f2000000-0000-4000-8000-000000000002', 'F007 other scope'
  );

insert into public.assignment_definitions (id, offering_id, code, created_by_person_id)
values (
  'f8000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'FEEDBACK_PERSPECTIVE',
  'f1000000-0000-4000-8000-000000000001'
);
insert into public.assignment_versions (
  id, assignment_definition_id, version_number, group_name, title,
  instructions, evaluation_rubric, created_by_person_id
)
values (
  'f9000000-0000-4000-8000-000000000001',
  'f8000000-0000-4000-8000-000000000001',
  1, 'Perspective & Objects', 'Fictional room feedback',
  'Draw one interior using a clear horizon and vanishing point.',
  'Check convergence, proportion, line confidence, and composition.',
  'f1000000-0000-4000-8000-000000000001'
);
update public.assignment_versions
set status = 'published', published_by_person_id = 'f1000000-0000-4000-8000-000000000001',
    published_at = now(), release_note = 'Fictional feedback assignment'
where id = 'f9000000-0000-4000-8000-000000000001';

insert into public.assignment_releases (
  id, assignment_version_id, offering_id, cohort_id, target_kind,
  release_note, request_key, released_by_person_id
)
values (
  'fa000000-0000-4000-8000-000000000001',
  'f9000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'f3000000-0000-4000-8000-000000000001', 'cohort',
  'Fictional feedback release', 'fa000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000001'
);
insert into public.student_assignment_instances (
  id, assignment_release_id, enrollment_id, status
)
values
  (
    'fb000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000001',
    'f4000000-0000-4000-8000-000000000001', 'submitted'
  ),
  (
    'fb000000-0000-4000-8000-000000000002',
    'fa000000-0000-4000-8000-000000000001',
    'f4000000-0000-4000-8000-000000000002', 'submitted'
  );
insert into public.submission_attempts (
  id, assignment_instance_id, attempt_number, status, created_by_person_id,
  created_at, submitted_at, submitted_late
)
values
  (
    'fc000000-0000-4000-8000-000000000001',
    'fb000000-0000-4000-8000-000000000001', 1, 'submitted',
    'f1000000-0000-4000-8000-000000000002', now() - interval '2 days', now() - interval '1 day', false
  ),
  (
    'fc000000-0000-4000-8000-000000000002',
    'fb000000-0000-4000-8000-000000000002', 1, 'submitted',
    'f1000000-0000-4000-8000-000000000003', now() - interval '2 days', now() - interval '12 hours', false
  );

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  public.current_person_can_review_feedback_instance('fb000000-0000-4000-8000-000000000001'),
  true,
  'scoped teacher with feedback capability can review the assignment instance'
);
select is(
  public.current_person_can_use_feedback_ai('f2000000-0000-4000-8000-000000000001'),
  true,
  'separate bounded AI capability is recognized in scope'
);
select is(
  (select count(*)::integer from public.list_feedback_review_queue()),
  2,
  'teacher queue contains only submitted work in current scope'
);
select lives_ok(
  $$select public.start_feedback_draft('fc000000-0000-4000-8000-000000000001')$$,
  'teacher can start a feedback draft'
);
select is(
  (select count(*)::integer from public.feedback_revisions),
  1,
  'one feedback draft is created'
);
select lives_ok(
  $$select public.start_feedback_draft('fc000000-0000-4000-8000-000000000001')$$,
  'repeating feedback draft start is retry safe'
);
select is(
  (select count(*)::integer from public.feedback_revisions),
  1,
  'retry does not duplicate the draft'
);
select lives_ok(
  $$select public.save_feedback_draft(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'The convergence is clear. Strengthen the foreground line weight.',
    'human', false
  )$$,
  'teacher can save private written feedback'
);
select is(
  (select written_text from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
  'The convergence is clear. Strengthen the foreground line weight.',
  'saved writing remains private in the draft'
);
select throws_ok(
  $$select * from public.reserve_feedback_audio_file(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'voice_note', 'feedback.wav', 'audio/wav', 1000, 12
  )$$,
  '22023', 'feedback audio type is not allowed',
  'unapproved audio formats are rejected'
);
select lives_ok(
  $$select * from public.reserve_feedback_audio_file(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'voice_note', 'feedback.webm', 'audio/webm', 4096, 42
  )$$,
  'teacher can reserve one bounded private voice note'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata)
    select 'teacher-feedback-audio', object_path, 'f0000000-0000-4000-8000-000000000001',
      jsonb_build_object('mimetype', mime_type, 'size', byte_size)
    from public.feedback_audio_files limit 1$$,
  '42501', null,
  'teacher cannot bypass the trusted audio upload path'
);
select throws_ok(
  $$select public.publish_feedback_revision(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'review_completed', null
  )$$,
  '23514', 'the voice note must finish uploading before publication',
  'pending voice audio blocks publication'
);

reset role;
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'teacher-feedback-audio', object_path, 'f0000000-0000-4000-8000-000000000001',
  jsonb_build_object('mimetype', mime_type, 'size', byte_size)
from public.feedback_audio_files limit 1;
select public.complete_feedback_audio_file_upload((select id from public.feedback_audio_files limit 1));

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select status::text from public.feedback_audio_files limit 1), 'ready', 'trusted audio completion marks the object ready');
select throws_ok(
  $$select public.publish_feedback_revision(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'review_completed', null
  )$$,
  '23514', 'confirm the accessible written equivalent before publishing audio',
  'voice publication requires teacher-confirmed accessible writing'
);
select lives_ok(
  $$select public.save_feedback_draft(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'The convergence is clear. Strengthen the foreground line weight.',
    'human', true
  )$$,
  'teacher can confirm the accessible written equivalent'
);
select lives_ok(
  $$select public.publish_feedback_revision(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
    'review_completed', null
  )$$,
  'authorized teacher can deliberately publish feedback'
);
select is(
  (select status::text from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'),
  'published',
  'published feedback is recorded immutably'
);
select is(
  (select status::text from public.student_assignment_instances where id = 'fb000000-0000-4000-8000-000000000001'),
  'review_completed',
  'published completion advances the assignment lifecycle'
);
select throws_ok(
  $$update public.feedback_revisions set written_text = 'Changed after publication' where submission_attempt_id = 'fc000000-0000-4000-8000-000000000001'$$,
  '42501', null,
  'authenticated users cannot alter published feedback'
);

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.feedback_revisions), 1, 'student sees only published feedback for their own work');
select is((select count(*)::integer from public.feedback_audio_files), 1, 'student can read their published voice note metadata');
select is((select count(*)::integer from public.feedback_assistance_requests), 0, 'student cannot see private assistance records');
select throws_ok(
  $$select public.start_feedback_draft('fc000000-0000-4000-8000-000000000001')$$,
  '42501', 'feedback review access denied',
  'student cannot create teacher feedback'
);

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.feedback_revisions), 0, 'Sales cannot read academic feedback');
select is((select count(*)::integer from public.list_feedback_review_queue()), 0, 'Sales receives no review queue data');
select throws_ok(
  $$select public.start_feedback_draft('fc000000-0000-4000-8000-000000000002')$$,
  '42501', 'feedback review access denied',
  'Sales cannot start feedback'
);

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.feedback_revisions), 0, 'teacher assigned elsewhere cannot read feedback');
select throws_ok(
  $$select public.start_feedback_draft('fc000000-0000-4000-8000-000000000002')$$,
  '42501', 'feedback review access denied',
  'teacher assigned elsewhere cannot review this work'
);

set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(public.feedback_provider_ready('proofread'), false, 'proofreading provider is disabled by default');
select lives_ok(
  $$select public.start_feedback_draft('fc000000-0000-4000-8000-000000000002')$$,
  'teacher can start a second student''s feedback draft'
);
select throws_ok(
  $$select public.request_feedback_assistance(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000002'),
    'proofread', null, 'the perspective are good but line need dark'
  )$$,
  '55000', 'external feedback processing is not activated',
  'disabled provider gate prevents accidental processing'
);

reset role;
update public.feedback_provider_activations
set mode = 'fictional', provider_key = 'deterministic-fixture', model_config = 'fixture-v1'
where capability in ('proofread', 'rubric_draft');

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select public.request_feedback_assistance(
    (select id from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000002'),
    'proofread', null, 'the perspective are good but line need dark'
  )$$,
  'approved fictional adapter can queue proofreading without external processing'
);
select is(
  (select status::text from public.feedback_assistance_requests limit 1),
  'queued',
  'proofreading begins as a private queued request'
);

reset role;
select public.complete_feedback_assistance(
  (select id from public.feedback_assistance_requests limit 1),
  'The perspective is good, but the foreground line needs more weight.',
  null,
  0
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select status::text from public.feedback_assistance_requests limit 1), 'ready', 'fictional proofreading result is ready for review');
select lives_ok(
  $$select public.review_feedback_assistance(
    (select id from public.feedback_assistance_requests limit 1), true, null
  )$$,
  'teacher can explicitly accept a proofreading suggestion'
);
select is(
  (select written_text from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000002'),
  'The perspective is good, but the foreground line needs more weight.',
  'accepted suggestion becomes editable draft writing'
);
select is(
  (select ai_assisted from public.feedback_revisions where submission_attempt_id = 'fc000000-0000-4000-8000-000000000002'),
  true,
  'accepted AI transformation remains auditable'
);
select lives_ok(
  $$select public.start_feedback_ai_batch(
    'f9000000-0000-4000-8000-000000000001',
    array['fc000000-0000-4000-8000-000000000002'::uuid],
    'fd000000-0000-4000-8000-000000000001'
  )$$,
  'authorized teacher can start a bounded fictional rubric batch'
);
select is((select count(*)::integer from public.feedback_ai_batch_items), 1, 'batch snapshots one explicit submitted attempt');
select lives_ok(
  $$select public.start_feedback_ai_batch(
    'f9000000-0000-4000-8000-000000000001',
    array['fc000000-0000-4000-8000-000000000002'::uuid],
    'fd000000-0000-4000-8000-000000000001'
  )$$,
  'batch request key makes retries safe'
);

reset role;
update public.people set status = 'suspended', suspended_at = now()
where id = 'f1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_feedback_review_queue()), 0, 'suspended teacher immediately loses the review queue');
select is(
  public.current_person_can_review_feedback_instance('fb000000-0000-4000-8000-000000000002'),
  false,
  'suspended teacher fails current-state feedback authorization'
);

reset role;
update public.enrollments
set status = 'completed',
    requested_at = now() - interval '14 months',
    ended_at = now() - interval '13 months',
    updated_at = now()
where id = 'f4000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.feedback_revisions), 0, 'ended enrolment immediately removes student feedback access');
select throws_ok(
  $$select * from public.list_feedback_audio_due_for_purge(100)$$,
  '42501', null,
  'student cannot inspect the retention cleanup queue'
);

reset role;
select is(
  (select count(*)::integer from public.list_feedback_audio_due_for_purge(100)),
  1,
  'published voice audio becomes purgeable 12 months after enrolment end'
);

select * from finish();

rollback;
