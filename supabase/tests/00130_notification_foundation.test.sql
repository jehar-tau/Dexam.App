begin;

select plan(46);

select has_table('public', 'domain_events', 'transactional notification outbox exists');
select has_table('public', 'notification_templates', 'versioned notification templates exist');
select has_table('public', 'notifications', 'recipient-specific in-app notifications exist');
select has_function(
  'public', 'capture_assignment_notification_event', array[]::text[],
  'assignment lifecycle event capture exists'
);
select has_function(
  'public', 'process_notification_outbox', array['integer'],
  'idempotent notification worker exists'
);
select has_function(
  'public', 'list_my_notifications', array['integer'],
  'current-person notification list exists'
);
select has_function(
  'public', 'mark_notification_read', array['uuid'],
  'single notification read operation exists'
);
select has_function(
  'public', 'mark_all_notifications_read', array[]::text[],
  'mark-all-read operation exists'
);
select has_function(
  'public', 'purge_expired_notifications', array['integer'],
  'bounded notification retention cleanup exists'
);
select is(
  (
    select count(*)::integer
    from public.notification_templates
    where active and audience in ('student', 'teacher')
  ),
  4,
  'four approved first-milestone templates are active'
);
select is(
  (select count(*)::integer from public.notification_templates where destination_base_path !~ '^/(student|staff)/'),
  0,
  'every template points only to a protected Dexam route'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('a0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-teacher@dexam.test', ''),
  ('a0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-student@dexam.test', ''),
  ('a0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-other-student@dexam.test', ''),
  ('a0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-other-teacher@dexam.test', ''),
  ('a0000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'notification-sales@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('a1000000-0000-4000-8000-000000000001', null, 'Fictional Notification Teacher'),
  ('a1000000-0000-4000-8000-000000000002', 'DXM-A72Q9M4X6WKP', 'Fictional Notification Student'),
  ('a1000000-0000-4000-8000-000000000003', 'DXM-A83M9Q2RW5TY', 'Fictional Other Notification Student'),
  ('a1000000-0000-4000-8000-000000000004', null, 'Fictional Other Notification Teacher'),
  ('a1000000-0000-4000-8000-000000000005', null, 'Fictional Notification Sales');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'employee_email'),
  ('a1000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'member_id'),
  ('a1000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'member_id'),
  ('a1000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'employee_email'),
  ('a1000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'employee', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000004', 'employee', 'active', now() - interval '1 day'),
  ('a1000000-0000-4000-8000-000000000005', 'employee', 'active', now() - interval '1 day');

insert into public.offerings (id, code, title, status)
values
  ('a2000000-0000-4000-8000-000000000001', 'NOTIFY_FOUNDATION', 'Fictional Notification Foundation', 'active'),
  ('a2000000-0000-4000-8000-000000000002', 'NOTIFY_OTHER', 'Fictional Other Notification Offering', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values (
  'a3000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'NOTIFY_A', 'Fictional Notification A', 'active'
);

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  approved_by_person_id, requested_at, approved_at, activated_at
)
values (
  'a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000002',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'active', 'manual', 'a1000000-0000-4000-8000-000000000001',
  now() - interval '3 days', now() - interval '2 days', now() - interval '2 days'
);

insert into public.role_assignments (person_id, role_key, scope_type, scope_id, grant_reason)
values
  ('a1000000-0000-4000-8000-000000000001', 'teacher', 'offering', 'a2000000-0000-4000-8000-000000000001', 'F008 notification teacher'),
  ('a1000000-0000-4000-8000-000000000004', 'teacher', 'offering', 'a2000000-0000-4000-8000-000000000002', 'F008 other teacher'),
  ('a1000000-0000-4000-8000-000000000005', 'sales', 'global', null, 'F008 Sales denial');

insert into public.capability_grants (
  person_id, capability_key, required_role_key, scope_type, scope_id, grant_reason
)
values
  (
    'a1000000-0000-4000-8000-000000000001', 'feedback.review', 'teacher',
    'offering', 'a2000000-0000-4000-8000-000000000001', 'F008 review alerts'
  ),
  (
    'a1000000-0000-4000-8000-000000000004', 'feedback.review', 'teacher',
    'offering', 'a2000000-0000-4000-8000-000000000002', 'F008 other-scope alerts'
  );

insert into public.assignment_definitions (id, offering_id, code, created_by_person_id)
values (
  'a5000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'NOTIFY_LINES', 'a1000000-0000-4000-8000-000000000001'
);

insert into public.assignment_versions (
  id, assignment_definition_id, version_number, group_name, title,
  instructions, evaluation_rubric, created_by_person_id
)
values (
  'a6000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  1, 'Drawing foundations', 'Fictional notification lines',
  'Practice confident continuous lines.',
  'Check consistency and confidence.',
  'a1000000-0000-4000-8000-000000000001'
);

update public.assignment_versions
set status = 'published',
    published_by_person_id = 'a1000000-0000-4000-8000-000000000001',
    published_at = now(),
    release_note = 'F008 fictional publication'
where id = 'a6000000-0000-4000-8000-000000000001';

insert into public.assignment_releases (
  id, assignment_version_id, offering_id, cohort_id, target_kind,
  release_note, request_key, released_by_person_id
)
values (
  'a7000000-0000-4000-8000-000000000001',
  'a6000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001', 'cohort',
  'Fictional notification release', 'a7000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001'
);

insert into public.student_assignment_instances (
  id, assignment_release_id, enrollment_id, status
)
values (
  'a8000000-0000-4000-8000-000000000001',
  'a7000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001', 'correction_requested'
);

insert into public.student_assignment_transitions (
  assignment_instance_id, from_status, to_status, actor_person_id, reason_code, occurred_at
)
values
  ('a8000000-0000-4000-8000-000000000001', null, 'assigned', 'a1000000-0000-4000-8000-000000000001', 'assignment_distributed', now() - interval '4 hours'),
  ('a8000000-0000-4000-8000-000000000001', 'assigned', 'submitted', 'a1000000-0000-4000-8000-000000000002', 'attempt_submitted', now() - interval '3 hours'),
  ('a8000000-0000-4000-8000-000000000001', 'submitted', 'review_completed', 'a1000000-0000-4000-8000-000000000001', 'feedback_review_completed', now() - interval '2 hours'),
  ('a8000000-0000-4000-8000-000000000001', 'review_completed', 'correction_requested', 'a1000000-0000-4000-8000-000000000001', 'feedback_correction_requested', now() - interval '1 hour');

select is((select count(*)::integer from public.domain_events), 4, 'approved assignment transitions emit four durable events');
select is((select count(distinct event_type)::integer from public.domain_events), 4, 'every approved first-milestone event type is represented');
select is(
  (
    select count(*)::integer
    from public.domain_events e
    where e.payload ? 'transition_id'
      and (select count(*) from jsonb_object_keys(e.payload)) = 1
  ),
  4,
  'event payloads contain only the bounded transition identifier'
);
select is(
  (select processed_count from public.process_notification_outbox(100)),
  4,
  'the worker processes each pending event once'
);
select is(
  (select failed_count from public.process_notification_outbox(100)),
  0,
  'a second worker pass reports no failures'
);
select is((select count(*)::integer from public.notifications), 4, 'worker creates three student alerts and one teacher alert');
select is((select count(*)::integer from public.domain_events where processed_at is not null), 4, 'processed events retain completion evidence');
select is(
  (select processed_count from public.process_notification_outbox(100)),
  0,
  'worker retries are idempotent after completion'
);
select is((select count(*)::integer from public.notifications), 4, 'worker retry does not duplicate notifications');
select ok(
  (select bool_and(expires_at = created_at + interval '12 months') from public.notifications),
  'every inbox record receives the approved 12-month retention window'
);
select is(
  (select count(*)::integer from public.notifications where body ilike '%Fictional Notification%'),
  0,
  'safe summaries do not copy recipient names or private academic content'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 3, 'student receives only their assignment and feedback alerts');
select is(public.get_my_unread_notification_count(), 3, 'student unread count reflects visible authorized alerts');
select is(
  (select count(*)::integer from public.list_my_notifications(50) where destination_path like '/student/assignments?assignment=%'),
  3,
  'student notifications use authenticated assignment destinations'
);
select throws_ok(
  $$select count(*) from public.notifications$$,
  '42501', null,
  'student cannot bypass the protected notification RPC'
);
select throws_ok(
  $$insert into public.domain_events (event_key, event_type, aggregate_type, aggregate_id)
    values ('forged:event', 'assignment_published', 'assignment_instance', 'a8000000-0000-4000-8000-000000000001')$$,
  '42501', null,
  'student cannot forge a domain event'
);
select ok(
  public.current_person_can_read_notification((select id from public.list_my_notifications(50) limit 1)),
  'current-state authorization permits an owning student notification'
);
select lives_ok(
  $$select public.mark_notification_read((select id from public.list_my_notifications(50) limit 1))$$,
  'student can mark one own notification read'
);
select is(public.get_my_unread_notification_count(), 2, 'single read updates the unread count');
select is(public.mark_all_notifications_read(), 2, 'mark-all-read updates only remaining authorized alerts');
select is(public.get_my_unread_notification_count(), 0, 'student can clear their unread count');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 0, 'another student receives no notification for someone else');
select is(
  public.current_person_can_read_notification('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
  false,
  'another student cannot authorize an unknown or inaccessible notification'
);

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 0, 'teacher assigned to another offering receives no review alert');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000005","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 0, 'Sales receives no academic notification data');

set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 1, 'scoped teacher receives the submission review alert');
select is(
  (select count(*)::integer from public.list_my_notifications(50) where destination_path like '/staff/reviews?instance=%'),
  1,
  'teacher notification uses an authenticated review destination'
);

reset role;
update public.capability_grants
set revoked_at = now()
where person_id = 'a1000000-0000-4000-8000-000000000001'
  and capability_key = 'feedback.review';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 0, 'revoked teacher scope immediately hides an existing notification');

reset role;
update public.people set status = 'suspended', suspended_at = now()
where id = 'a1000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.list_my_notifications(50)), 0, 'suspended student immediately loses notification access');

reset role;
set local role anon;
select throws_ok(
  $$select * from public.list_my_notifications(50)$$,
  '42501', null,
  'anonymous users cannot read the notification centre'
);

reset role;
select throws_ok(
  $$select * from public.process_notification_outbox(0)$$,
  '22023', 'notification worker limit must be between 1 and 500',
  'worker rejects an unsafe batch limit'
);

update public.notifications
set created_at = now() - interval '13 months',
    read_at = null,
    expires_at = now() - interval '1 month'
where id = (select id from public.notifications order by id limit 1);

select is(public.purge_expired_notifications(500), 1, 'service cleanup purges one expired inbox record');
select is((select count(*)::integer from public.notifications), 3, 'retention cleanup leaves current inbox records intact');
select is((select count(*)::integer from public.domain_events), 4, 'inbox cleanup does not erase durable source events');
select is((select count(*)::integer from public.domain_events where last_error is not null), 0, 'successful event processing stores no internal error');

select * from finish();

rollback;
