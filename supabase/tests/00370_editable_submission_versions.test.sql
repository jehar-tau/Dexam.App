begin;
select no_plan();
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
    'fb000000-0000-4000-8000-000000000001', 1, 'draft',
    'f1000000-0000-4000-8000-000000000002', now(), null, null
  ),
  (
    'fc000000-0000-4000-8000-000000000002',
    'fb000000-0000-4000-8000-000000000002', 1, 'draft',
    'f1000000-0000-4000-8000-000000000003', now(), null, null
  );

-- Explicit owned provider sessions for fictional JWT fixtures; rolled back with this test.
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now(),now() from auth.users where id in ('f0000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002','f0000000-0000-4000-8000-000000000004','f0000000-0000-4000-8000-000000000005') on conflict(id) do nothing;

update public.student_assignment_instances set status='in_progress' where id in ('fb000000-0000-4000-8000-000000000001','fb000000-0000-4000-8000-000000000002');


insert into public.submission_files(id,submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,position,status,ready_at)
values('fd000000-0000-4000-8000-000000000001','fc000000-0000-4000-8000-000000000001',
 'fb000000-0000-4000-8000-000000000001/fc000000-0000-4000-8000-000000000001/fd000000-0000-4000-8000-000000000001.jpg','drawing.jpg','image/jpeg',3,3,1,'ready',now());
insert into storage.objects(bucket_id,name,metadata)
select 'student-submissions',object_path,jsonb_build_object('mimetype',mime_type,'size',byte_size) from public.submission_files;

set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select lives_ok($$select public.finalize_submission_attempt('fc000000-0000-4000-8000-000000000001')$$,'initial submit works');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000001"}';
select set_config('test.old_feedback',public.start_feedback_draft('fc000000-0000-4000-8000-000000000001')::text,true);
select public.save_feedback_draft(current_setting('test.old_feedback')::uuid,'Original private draft retained','human',false);
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000004"}';
select throws_ok($$select public.edit_assignment_attempt('fc000000-0000-4000-8000-000000000001')$$,'42501',null,'employee cannot edit student work');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select set_config('test.edited',public.edit_assignment_attempt('fc000000-0000-4000-8000-000000000001')::text,true);
select is(public.edit_assignment_attempt('fc000000-0000-4000-8000-000000000001'),current_setting('test.edited')::uuid,'edit retry returns same version');
select is((select logical_attempt_number from public.submission_attempts where id=current_setting('test.edited')::uuid),1,'edited version retains logical attempt one');
select is((select submission_version from public.submission_attempts where id=current_setting('test.edited')::uuid),2,'edit creates internal version two');
select is((select count(*)::int from public.submission_files),2,'old and current snapshot reference retained bytes');
select is((select status::text from public.submission_attempts where id='fc000000-0000-4000-8000-000000000001'),'submitted','original snapshot remains submitted');
select is(public.start_assignment_attempt('fb000000-0000-4000-8000-000000000001'),current_setting('test.edited')::uuid,'only one draft can exist');
select throws_ok($$select public.edit_assignment_attempt('fc000000-0000-4000-8000-000000000002')$$,'42501',null,'another student attempt is denied');
select is((select delete_object from public.remove_draft_submission_file((select id from public.submission_files where submission_attempt_id=current_setting('test.edited')::uuid))),false,'removing copied reference preserves original object bytes');
select is((select count(*)::int from public.submission_files),1,'only draft reference was removed');
select throws_ok($$select * from public.submission_file_removal_receipts$$,'42501',null,'private removal receipt table cannot be listed');
reset role;
-- Restore a reference for remaining version/publication tests, with immutable bytes.
insert into public.submission_files(submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,position,status,ready_at)
select current_setting('test.edited')::uuid,object_path,original_file_name,mime_type,byte_size,original_byte_size,1,status,ready_at from public.submission_files where submission_attempt_id='fc000000-0000-4000-8000-000000000001';
update public.submission_files set created_at=now()-interval '35 days' where submission_attempt_id=current_setting('test.edited')::uuid;
select is((select count(*)::int from public.list_submission_files_due_for_purge(100)),0,'abandoned draft copy cannot purge a referenced submitted snapshot');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.publish_feedback_revision(current_setting('test.old_feedback')::uuid,'review_completed',null)$$,'23514',null,'stale feedback publication blocked while student edits');
select is((select written_text from public.feedback_revisions where id=current_setting('test.old_feedback')::uuid),'Original private draft retained','stale teacher draft not deleted');
select is((select count(*)::int from public.list_feedback_review_queue()),0,'editing version is not queued as submitted');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select lives_ok($$select public.finalize_submission_attempt(current_setting('test.edited')::uuid)$$,'student can resubmit edited version');
select set_config('test.second',public.start_assignment_attempt('fb000000-0000-4000-8000-000000000001')::text,true);
select is((select logical_attempt_number from public.submission_attempts where id=current_setting('test.second')::uuid),2,'student starts second attempt without correction request');
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000001"}';
select is((select count(*)::int from public.list_feedback_review_queue()),1,'earlier current submitted attempt remains queued while later draft exists');
select is((select submission_version from public.list_feedback_review_queue()),2,'teacher sees version two explicitly');
select is((select previous_feedback_text from public.list_feedback_review_queue()),'Original private draft retained','previous writing available only as teacher reference');
select throws_ok($$select public.publish_feedback_revision(current_setting('test.old_feedback')::uuid,'review_completed',null)$$,'23514',null,'stale feedback stays blocked after resubmission');
select set_config('test.new_feedback',public.start_feedback_draft(current_setting('test.edited')::uuid)::text,true);
select public.save_feedback_draft(current_setting('test.new_feedback')::uuid,'Reviewed the updated files','human',false);
select lives_ok($$select public.publish_feedback_revision(current_setting('test.new_feedback')::uuid,'review_completed',null)$$,'teacher publishes for exact updated version');
select is((select status::text from public.student_assignment_instances where id='fb000000-0000-4000-8000-000000000001'),'in_progress','review of older logical attempt does not overwrite later draft state');
reset role;
select is((select count(*)::int from public.domain_events where event_key='feedback_revision:'||current_setting('test.new_feedback')),1,'older-attempt review still emits its existing feedback notice');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.edit_assignment_attempt(current_setting('test.edited')::uuid)$$,'55000','reviewed attempts cannot be edited','published review permanently locks that attempt');
select throws_ok($$update public.submission_attempts set submitted_at=now() where id=current_setting('test.edited')::uuid$$,'42501',null,'student cannot directly bypass version guards');
reset role;
insert into public.submission_files(id,submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,position,status,ready_at,created_at)
values('fd000000-0000-4000-8000-000000000002',current_setting('test.second')::uuid,
 'fb000000-0000-4000-8000-000000000001/'||current_setting('test.second')||'/fd000000-0000-4000-8000-000000000002.jpg','old-draft.jpg','image/jpeg',3,3,1,'ready',now(),now()-interval '35 days');
insert into storage.objects(bucket_id,name,metadata) select 'student-submissions',object_path,jsonb_build_object('mimetype',mime_type,'size',byte_size) from public.submission_files where id='fd000000-0000-4000-8000-000000000002';
select is((select count(*)::int from public.list_submission_files_due_for_purge(100)),1,'cleanup atomically claims an eligible unshared abandoned file');
select ok((select purge_claimed_at is not null from public.submission_files where id='fd000000-0000-4000-8000-000000000002'),'claim persists before external byte deletion');
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.finalize_submission_attempt(current_setting('test.second')::uuid)$$,'55000','submission files are undergoing cleanup; refresh before submitting','finalize after cleanup selection is fenced before Storage deletion');
select is((select delete_object from public.remove_draft_submission_file('fd000000-0000-4000-8000-000000000002')),true,'owner can detach claimed unshared file');
select is((select delete_object from public.remove_draft_submission_file('fd000000-0000-4000-8000-000000000002')),true,'removal retry returns exact scoped receipt');
reset role;
insert into public.submission_files(submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,position,status,ready_at)
select current_setting('test.second')::uuid,object_path,original_file_name,mime_type,byte_size,original_byte_size,1,status,ready_at from public.submission_files where submission_attempt_id='fc000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select lives_ok($$select public.finalize_submission_attempt(current_setting('test.second')::uuid)$$,'second attempt finalizes independently after removing obsolete file');
savepoint third_attempt_check;
select set_config('test.third',public.start_assignment_attempt('fb000000-0000-4000-8000-000000000001')::text,true);
select is((select logical_attempt_number from public.submission_attempts where id=current_setting('test.third')::uuid),3,'third numbered attempt can be started without a teacher request');
rollback to savepoint third_attempt_check;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select set_config('test.unfinished_edit',public.edit_assignment_attempt(current_setting('test.second')::uuid)::text,true);
reset role;
update public.enrollments set status='withdrawn',ended_at=now() where id='f4000000-0000-4000-8000-000000000001';
set local role authenticated;
set local request.jwt.claims = '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"f0000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.edit_assignment_attempt('fc000000-0000-4000-8000-000000000001')$$,'42501',null,'ended access denies even an edit retry');
select throws_ok($$select public.start_assignment_attempt('fb000000-0000-4000-8000-000000000001')$$,'42501',null,'ended access cannot create further attempts');
select is((select jsonb_array_length(public.list_student_work_archive()->0->'attempts')),2,'archive retains both logical attempts when an edited version is still a draft');
select ok(exists(select 1 from jsonb_array_elements(public.list_student_work_archive()->0->'attempts') a where a->>'id'=current_setting('test.second') and a->>'attemptNumber'='2'),'archive retains latest finalized second-attempt snapshot with its logical number');
select ok(not exists(select 1 from jsonb_array_elements(public.list_student_work_archive()->0->'attempts') a where a->>'id'=current_setting('test.unfinished_edit')),'archive excludes unfinished edit files and draft data');
select * from finish();
rollback;
