begin;
select no_plan();
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('d0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'content-editor@dexam.test', ''),
  ('d0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'content-publisher@dexam.test', ''),
  ('d0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'content-sales@dexam.test', ''),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'content-student@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('d1000000-0000-4000-8000-000000000001', null, 'Fictional Content Editor'),
  ('d1000000-0000-4000-8000-000000000002', null, 'Fictional Content Publisher'),
  ('d1000000-0000-4000-8000-000000000003', null, 'Fictional Sales User'),
  ('d1000000-0000-4000-8000-000000000004', 'DXM-DW3M9Q2RW5TY', 'Fictional Student');

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
  ('d1000000-0000-4000-8000-000000000004', 'student', 'active', now() - interval '1 day');

insert into public.offerings (id, code, title, status)
values
  ('d2000000-0000-4000-8000-000000000001', 'CONTENT_FOUNDATION', 'Fictional Content Foundation', 'active'),
  ('d2000000-0000-4000-8000-000000000002', 'CONTENT_OTHER', 'Fictional Other Offering', 'active');

insert into public.role_assignments (
  person_id, role_key, scope_type, scope_id, grant_reason
)
values
  ('d1000000-0000-4000-8000-000000000001', 'teacher', 'offering', 'd2000000-0000-4000-8000-000000000001', 'F009 scoped editor test'),
  ('d1000000-0000-4000-8000-000000000002', 'elevated_admin', 'global', null, 'F009 publisher test'),
  ('d1000000-0000-4000-8000-000000000003', 'sales', 'global', null, 'F009 Sales denial test');

insert into public.capability_grants (
  person_id, capability_key, required_role_key, scope_type, scope_id, grant_reason
)
values
  ('d1000000-0000-4000-8000-000000000001', 'content.manage_drafts', 'teacher', 'offering', 'd2000000-0000-4000-8000-000000000001', 'F009 scoped draft grant'),
  ('d1000000-0000-4000-8000-000000000002', 'content.manage_drafts', 'elevated_admin', 'global', null, 'F009 global draft grant'),
  ('d1000000-0000-4000-8000-000000000002', 'content.publish', 'elevated_admin', 'global', null, 'F009 global publish grant');

insert into public.curriculum_versions (
  id, offering_id, version_number, title, created_by_person_id
)
values
  ('d3000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 1, 'Published foundation source', 'd1000000-0000-4000-8000-000000000002'),
  ('d3000000-0000-4000-8000-000000000002', 'd2000000-0000-4000-8000-000000000002', 1, 'Published other source', 'd1000000-0000-4000-8000-000000000002');

insert into public.curriculum_sections (id, curriculum_version_id, code, title, position)
values
  ('d4000000-0000-4000-8000-000000000001', 'd3000000-0000-4000-8000-000000000001', 'DRAWING', 'Drawing', 1),
  ('d4000000-0000-4000-8000-000000000002', 'd3000000-0000-4000-8000-000000000002', 'OTHER', 'Other subject', 1);

insert into public.curriculum_topics (id, section_id, code, title, summary, position)
values
  ('d5000000-0000-4000-8000-000000000001', 'd4000000-0000-4000-8000-000000000001', 'PERSPECTIVE', 'Perspective', 'Construct spaces with confidence.', 1),
  ('d5000000-0000-4000-8000-000000000002', 'd4000000-0000-4000-8000-000000000002', 'OTHER_TOPIC', 'Other topic', null, 1);

insert into public.curriculum_lessons (id, topic_id, code, title, summary, body_markdown, position)
values
  ('d6000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001', 'ONE_POINT', 'One-point perspective', null, 'Original lesson material.', 1);


insert into auth.sessions(id,user_id,aal,created_at,updated_at) select id,id,'aal1',now(),now() from auth.users where id::text like 'd0000000-%';
set local role anon;
select throws_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','notes.pdf','application/pdf',10)$$,'42501',null,'anonymous upload denied');
reset role;
set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','notes.pdf','application/pdf',10)$$,'scoped editor reserves');
select throws_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','bad.exe','application/x-msdownload',10)$$,'23514',null,'type constrained');
select throws_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','big.pdf','application/pdf',10485761)$$,'23514',null,'size constrained');
select throws_ok($$select public.complete_lesson_upload(gen_random_uuid())$$,'42501',null,'browser cannot attest file validation');
select throws_ok($$select object_path from public.lesson_file_assets$$,'42501',null,'raw paths not exposed');
reset role;
select set_config('test.file',(select id::text from public.lesson_file_assets where file_name='notes.pdf'),true);
set local role authenticated;
select throws_ok($$select public.attach_lesson_file(current_setting('test.file')::uuid)$$,'55000',null,'unvalidated reserved file cannot attach');
reset role; set local role service_role;
select lives_ok($$select public.complete_lesson_upload(current_setting('test.file')::uuid)$$,'trusted completion');
reset role;set local role authenticated;
select lives_ok($$select public.attach_lesson_file(current_setting('test.file')::uuid)$$,'current editor attaches');
select is((select count(*)::integer from public.list_lesson_files('d6000000-0000-4000-8000-000000000001')),1,'minimal editor file list');
select lives_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','two.pdf','application/pdf',10)$$,'second slot');
select lives_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','three.pdf','application/pdf',10)$$,'third slot');
select lives_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','four.pdf','application/pdf',10)$$,'fourth slot');
select lives_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','five.pdf','application/pdf',10)$$,'fifth slot');
select throws_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','six.pdf','application/pdf',10)$$,'23514',null,'pending uploads count against five-file limit');
reset role;set local role service_role;
select lives_ok($$select public.abandon_lesson_upload((select id from public.lesson_file_assets where file_name='three.pdf'))$$,'uncertain pending upload is fenced');
reset role;set local role authenticated;
select throws_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','retry.pdf','application/pdf',10)$$,'23514',null,'uncertain uploads count during grace to bound storage');
select is(public.current_person_can_open_content_workspace(),true,'existing scoped content editor may open workspace');
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000003"}';
select is((select count(*)::integer from public.list_lesson_files('d6000000-0000-4000-8000-000000000001')),0,'Sales file denial');
select is(public.current_person_can_open_content_workspace(),false,'Sales gets no content entrance permission');
select throws_ok($$select public.remove_lesson_file('d6000000-0000-4000-8000-000000000001',current_setting('test.file')::uuid)$$,'42501',null,'Sales mutation denial');
reset role;
update public.curriculum_versions set status='published',published_by_person_id='d1000000-0000-4000-8000-000000000002',published_at=now()-interval '14 months',release_note='Fictional lesson file release' where id='d3000000-0000-4000-8000-000000000001';
insert into public.enrollments(id,person_id,offering_id,curriculum_version_id,status,source_type) values('d7000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','active','manual');
set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000004"}';
select is((select count(*)::integer from public.list_lesson_files('d6000000-0000-4000-8000-000000000001')),1,'assigned active student reads');
select is((select count(*)::integer from public.get_lesson_file('d6000000-0000-4000-8000-000000000001',current_setting('test.file')::uuid)),1,'current student download lookup');
select throws_ok($$select public.reserve_lesson_file('d6000000-0000-4000-8000-000000000001','student.pdf','application/pdf',10)$$,'42501',null,'student upload denied');
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.remove_lesson_file('d6000000-0000-4000-8000-000000000001',current_setting('test.file')::uuid)$$,'42501',null,'published reference immutable');
reset role;set local role service_role;
select set_config('test.fifth',(select id::text from public.lesson_file_assets where file_name='five.pdf'),true);
select lives_ok($$select public.complete_lesson_upload((select id from public.lesson_file_assets where file_name='five.pdf'))$$,'previously reserved upload can finish object validation');
reset role;set local role authenticated;
select throws_ok($$select public.attach_lesson_file(current_setting('test.fifth')::uuid)$$,'42501',null,'publication blocks late upload attachment');
select lives_ok($$select public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001','Fictional shared files copy')$$,'copy curriculum preserves files');
reset role;
select set_config('test.copy_lesson',(select l.id::text from public.curriculum_lessons l where l.id<>'d6000000-0000-4000-8000-000000000001' and public.lesson_version_id(l.id) in(select id from public.curriculum_versions where source_curriculum_version_id='d3000000-0000-4000-8000-000000000001')),true);
select is((select count(*)::integer from public.lesson_materials where asset_id=current_setting('test.file')::uuid),2,'published and draft share same immutable asset');
set local role authenticated;
select lives_ok($$select public.remove_lesson_file(current_setting('test.copy_lesson')::uuid,current_setting('test.file')::uuid)$$,'remove copy reference only');
select set_config('test.pending',(select file_id::text from public.reserve_lesson_file(current_setting('test.copy_lesson')::uuid,'pending.pdf','application/pdf',10)),true);
reset role;set local role service_role;
select lives_ok($$select public.complete_lesson_upload(current_setting('test.pending')::uuid)$$,'trusted upload complete before employee revocation');
reset role;
update public.memberships set status='suspended' where person_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.attach_lesson_file(current_setting('test.pending')::uuid)$$,'42501',null,'revoked employee cannot finalize previously reserved upload');
reset role;
update public.memberships set status='active' where person_id='d1000000-0000-4000-8000-000000000001';
reset role;set local role service_role;
select lives_ok($$select public.abandon_lesson_upload(current_setting('test.file')::uuid)$$,'failure cleanup never deletes linked published asset');
reset role;
select is((select state from public.lesson_file_assets where id=current_setting('test.file')::uuid),'ready','published shared file preserved');
update public.people set status='suspended',suspended_at=now() where id='d1000000-0000-4000-8000-000000000004';
set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000004"}';
select is((select count(*)::integer from public.list_lesson_files('d6000000-0000-4000-8000-000000000001')),0,'suspended student denies next read');
reset role;set local role service_role;
select is((select count(*)::integer from public.claim_lesson_files_for_purge(100)),0,'recent/unretired files cannot purge');
reset role;
update public.lesson_file_assets set created_at=now()-interval '31 days' where file_name='two.pdf';
set local role service_role;
select is((select count(*)::integer from public.claim_lesson_files_for_purge(100)),1,'30-day unattached cleanup bounded');
reset role;
select is((select state from public.lesson_file_assets where file_name='two.pdf'),'deleting','cleanup claims fence asset');
set local role service_role;
select lives_ok($$select public.complete_lesson_file_purge((select id from public.lesson_file_assets where file_name='two.pdf'))$$,'trusted purge completion');
reset role;
select is((select state from public.lesson_file_assets where file_name='two.pdf'),'deleted','purge metadata confirmed');
set local role authenticated;
select throws_ok($$select public.lesson_version_id('d6000000-0000-4000-8000-000000000001')$$,'42501',null,'private lineage helper denied to browsers');
select throws_ok($$select public.claim_lesson_files_for_purge(10)$$,'42501',null,'browser purge denied');
reset role;set local role service_role;
select throws_ok($$select public.claim_lesson_files_for_purge(null)$$,'23514',null,'null cannot remove purge bound');
select lives_ok($$select public.abandon_lesson_upload((select id from public.lesson_file_assets where file_name='three.pdf'))$$,'uncertain upload fenced');
reset role;
select is((select state from public.lesson_file_assets where file_name='three.pdf'),'abandoned','uncertain upload not immediately deletion eligible');
set local role service_role;
select is((select count(*)::integer from public.claim_lesson_files_for_purge(100)),0,'uncertain fresh upload gets abandoned-upload grace');
select throws_ok($$select public.complete_lesson_upload((select id from public.lesson_file_assets where file_name='three.pdf'))$$,'55000',null,'late completion cannot restore abandoned upload');
reset role;
update public.curriculum_versions set status='retired',retired_at=now()-interval '13 months' where id='d3000000-0000-4000-8000-000000000001';
select is(public.lesson_asset_due_for_purge(current_setting('test.file')::uuid),false,'retired old files preserved by active enrolment');
update public.enrollments set status='completed',ended_at=now() where id='d7000000-0000-4000-8000-000000000001';
select is(public.lesson_asset_due_for_purge(current_setting('test.file')::uuid),true,'retired old file eligible only after active references end');
set local role service_role;
select is((select count(*)::integer from public.claim_lesson_files_for_purge(100)),1,'retired unreferenced old asset claimed');
reset role;set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select is((select count(*)::integer from public.get_lesson_file('d6000000-0000-4000-8000-000000000001',current_setting('test.file')::uuid)),0,'claimed deletion denies new download');
select throws_ok($$select public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001','Unavailable exact copy')$$,'55000',null,'copy cannot silently omit fenced source files');
select * from finish();rollback;

