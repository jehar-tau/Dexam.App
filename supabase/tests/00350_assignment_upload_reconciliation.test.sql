begin;
select plan(26);
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

update public.curriculum_versions
set status = 'published',
    published_by_person_id = 'd1000000-0000-4000-8000-000000000002',
    published_at = now(),
    release_note = 'Initial fictional source release'
where id in (
  'd3000000-0000-4000-8000-000000000001',
  'd3000000-0000-4000-8000-000000000002'
);

-- Explicit owned provider sessions for fictional JWT fixtures; rolled back with this test.

insert into public.assignment_definitions(id,offering_id,code,created_by_person_id)
values('d7000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','UPLOAD_TEST','d1000000-0000-4000-8000-000000000001');
insert into public.assignment_versions(id,assignment_definition_id,version_number,group_name,title,instructions,evaluation_rubric,created_by_person_id)
values('d8000000-0000-4000-8000-000000000001','d7000000-0000-4000-8000-000000000001',1,'Drawing','Fictional upload','Draw lines.','Check lines.','d1000000-0000-4000-8000-000000000001');
insert into auth.sessions(id,user_id,aal,created_at,updated_at)
select id,id,'aal1',now(),now() from auth.users where id in ('d0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003');
set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.reserve_assignment_upload('d9000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000001','room.pdf','application/pdf',1024)$$,'reserve allowed');
select lives_ok($$select public.reserve_assignment_upload('d9000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000001','room.pdf','application/pdf',1024)$$,'same request retry allowed');
select throws_ok($$select public.reserve_assignment_upload('d9000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000001','changed.pdf','application/pdf',1024)$$,'42501','upload request mismatch','request cannot change');
select throws_ok($$select * from public.assignment_upload_reservations$$,'42501',null,'ledger is private');
select is((select count(*)::integer from public.list_assignment_uploads('d8000000-0000-4000-8000-000000000001')),1,'scoped author can inspect bounded upload state');
select throws_ok($$select public.claim_assignment_upload_cleanup(100)$$,'42501',null,'browser cannot claim deletion');
select throws_ok($$select public.attach_assignment_upload('d9000000-0000-4000-8000-000000000001')$$,'55000','assignment upload not confirmed','missing bytes deny attachment');
insert into storage.objects(bucket_id,name,metadata) values('assignment-materials','d2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000001.pdf','{"mimetype":"application/pdf","size":1024}');
select lives_ok($$select public.attach_assignment_upload('d9000000-0000-4000-8000-000000000001')$$,'confirmed bytes attach');
select lives_ok($$select public.attach_assignment_upload('d9000000-0000-4000-8000-000000000001')$$,'lost attachment response retries idempotently');
select is((select count(*)::integer from public.assignment_materials),1,'only one attachment');
with changed as (update storage.objects set metadata='{}' where bucket_id='assignment-materials' returning id) select is(count(*)::integer,0,'direct overwrite denied') from changed;
select throws_ok($$delete from storage.objects where bucket_id='assignment-materials'$$,'42501',null,'direct delete denied');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('assignment-materials','d2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000009.pdf','{"mimetype":"application/pdf","size":1024}')$$,'42501',null,'unreserved object denied');
select public.reserve_assignment_upload(('d9000000-0000-4000-8000-00000000000'||n)::uuid,'d8000000-0000-4000-8000-000000000001','room.pdf','application/pdf',1024) from generate_series(2,5)n;
select throws_ok($$select public.reserve_assignment_upload('d9000000-0000-4000-8000-000000000006','d8000000-0000-4000-8000-000000000001','room.pdf','application/pdf',1024)$$,'23514','assignment file limit reached','reservations consume slots');
reset role;
select is((select count(*)::integer from public.assignment_upload_reservations),5,'retry does not duplicate reservation');
select is((select count(*)::integer from public.claim_assignment_upload_cleanup(100)),0,'new reservations cannot be deleted');
update public.assignment_upload_reservations set created_at=now()-interval '30 days' where id in ('d9000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000002','d9000000-0000-4000-8000-000000000003');
update public.assignment_upload_reservations set cleanup_hold=true where id='d9000000-0000-4000-8000-000000000003';
select is((select count(*)::integer from public.claim_assignment_upload_cleanup(100)),1,'only unreferenced at boundary claimed, reference and hold protected');
select is((select state from public.assignment_upload_reservations where id='d9000000-0000-4000-8000-000000000001'),'attached','referenced file remains attached');
set local role authenticated;
select throws_ok($$select public.attach_assignment_upload('d9000000-0000-4000-8000-000000000002')$$,'55000','upload no longer attachable','claimed file cannot attach');
select throws_ok($$insert into storage.objects(bucket_id,name,metadata) values('assignment-materials','d2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000002.pdf','{"mimetype":"application/pdf","size":1024}')$$,'42501',null,'claimed file cannot upload');
reset role;
select lives_ok($$select public.complete_assignment_upload_cleanup('d9000000-0000-4000-8000-000000000002')$$,'absence confirmed');
select is((select count(*)::integer from public.claim_assignment_upload_cleanup(100)),1,'deleted marker rechecked for late bytes');
insert into storage.objects(bucket_id,name,metadata) values('assignment-materials','d2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000002.pdf','{"mimetype":"application/pdf","size":1024}');
select throws_ok($$select public.complete_assignment_upload_cleanup('d9000000-0000-4000-8000-000000000002')$$,'55000','cleanup not confirmed','late bytes block false completion');
update public.memberships set status='suspended' where person_id='d1000000-0000-4000-8000-000000000001';
set local role authenticated;
select throws_ok($$select public.attach_assignment_upload('d9000000-0000-4000-8000-000000000001')$$,'42501','draft upload access denied','revoked actor cannot retry');
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000003"}';
select is((select count(*)::integer from public.list_assignment_uploads('d8000000-0000-4000-8000-000000000001')),0,'Sales cannot inspect upload state');
select throws_ok($$select public.reserve_assignment_upload('d9000000-0000-4000-8000-000000000006','d8000000-0000-4000-8000-000000000001','room.pdf','application/pdf',1024)$$,'42501','draft upload access denied','Sales cannot reserve');
reset role;
select * from finish();
rollback;

