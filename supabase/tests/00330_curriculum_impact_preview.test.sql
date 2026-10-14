begin;select no_plan();
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
select throws_ok('select public.list_curriculum_preview_context()','42501',null,'anonymous context denied');
reset role;set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'draft-editor authority alone insufficient');
reset role;
insert into public.role_assignments(person_id,role_key,scope_type,scope_id,grant_reason) values('d1000000-0000-4000-8000-000000000001','ordinary_admin','offering','d2000000-0000-4000-8000-000000000001','Fictional preview operator');
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,scope_id,grant_reason)
select 'd1000000-0000-4000-8000-000000000001',key,'ordinary_admin','offering','d2000000-0000-4000-8000-000000000001','Fictional explicit preview authority' from public.capabilities where key in('content.publish','enrollment.operate','curriculum.upgrade_preview');
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),true,'all three current explicit prerequisites');
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000002'),false,'other offering denied');
select is(jsonb_array_length(public.list_curriculum_preview_context()),1,'context only explicit own scope');
select throws_ok($$select public.preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000002')$$,'42501',null,'draft/cross-offering preview denied');
reset role;
insert into public.lesson_file_assets(id,reserved_lesson_id,creator_person_id,object_path,file_name,mime_type,byte_size,state) values('d8000000-0000-4000-8000-000000000001','d6000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000001','private-reference.pdf','application/pdf',10,'ready');
insert into public.lesson_materials(lesson_id,asset_id) values('d6000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000001');
update public.curriculum_versions set status='published',published_at=now(),published_by_person_id='d1000000-0000-4000-8000-000000000002',release_note='Fictional source' where id='d3000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('test.target',public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001','Fictional comparison target')::text,true);
reset role;
select is((select count(*)::integer from public.lesson_materials where asset_id='d8000000-0000-4000-8000-000000000001'),2,'copy shares immutable source material');
select set_config('test.target_lesson',(select id::text from public.curriculum_lessons where public.lesson_version_id(id)=current_setting('test.target')::uuid),true);
delete from public.lesson_materials where lesson_id=current_setting('test.target_lesson')::uuid;
insert into public.lesson_file_assets(id,reserved_lesson_id,creator_person_id,object_path,file_name,mime_type,byte_size,state) values('d8000000-0000-4000-8000-000000000002',current_setting('test.target_lesson')::uuid,'d1000000-0000-4000-8000-000000000001','d8000000-0000-4000-8000-000000000002','private-new-reference.pdf','application/pdf',10,'ready');
insert into public.lesson_materials(lesson_id,asset_id) values(current_setting('test.target_lesson')::uuid,'d8000000-0000-4000-8000-000000000002');
update public.curriculum_topics set summary='New topic summary' where public.lesson_version_id('d6000000-0000-4000-8000-000000000001')<>current_setting('test.target')::uuid and section_id in(select id from public.curriculum_sections where curriculum_version_id=current_setting('test.target')::uuid);
update public.curriculum_lessons set body_markdown='Private body not returned by preview' where public.lesson_version_id(id)=current_setting('test.target')::uuid;
update public.curriculum_versions set status='published',published_at=now(),published_by_person_id='d1000000-0000-4000-8000-000000000002',release_note='Fictional target' where id=current_setting('test.target')::uuid;
insert into public.enrollments(id,person_id,offering_id,curriculum_version_id,status,source_type) values('d7000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','active','manual');
insert into public.people(id,member_id,display_name) values
 ('d1000000-0000-4000-8000-000000000005','DXM-T72Q9M4X6WKP','Fictional cohort student'),
 ('d1000000-0000-4000-8000-000000000006','DXM-8K3M9Q2RW5TY','Fictional inactive cohort student'),
 ('d1000000-0000-4000-8000-000000000007','DXM-7K3M9Q2RW5TY','Fictional ended student');
insert into public.cohorts(id,offering_id,code,name,status,curriculum_version_id) values
 ('d9000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','PREVIEW_ACTIVE','Fictional active cohort','active','d3000000-0000-4000-8000-000000000001'),
 ('d9000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001','PREVIEW_ENDED','Fictional ended cohort','completed','d3000000-0000-4000-8000-000000000001');
insert into public.enrollments(id,person_id,offering_id,cohort_id,status,source_type) values
 ('d7000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000001','active','manual'),
 ('d7000000-0000-4000-8000-000000000006','d1000000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001','d9000000-0000-4000-8000-000000000002','active','manual');
insert into public.enrollments(id,person_id,offering_id,curriculum_version_id,status,source_type,ended_at) values('d7000000-0000-4000-8000-000000000007','d1000000-0000-4000-8000-000000000007','d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','completed','manual',now());
select set_config('test.before',(select md5(jsonb_agg(to_jsonb(e) order by id)::text) from public.enrollments e),true);
set local role authenticated;
select set_config('test.report',public.preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',current_setting('test.target')::uuid)::text,true);
select is((current_setting('test.report')::jsonb->'counts'->>'changed')::integer,3,'code-matched topic, lesson and replaced material changes');
select is((current_setting('test.report')::jsonb->'affected'->>'direct')::integer,1,'one active direct enrolment');
select is((current_setting('test.report')::jsonb->'affected'->>'cohort')::integer,1,'active cohort count excludes inactive cohort');
select is((current_setting('test.report')::jsonb->'affected'->>'total')::integer,2,'ended and inactive-cohort rows excluded');
select is(position('DXM-' in current_setting('test.report')),0,'no Member ID');
select is(position('Private body' in current_setting('test.report')),0,'no lesson body');
select is(position('object_path' in current_setting('test.report')),0,'no object path');
select is(position('d1000000' in current_setting('test.report')),0,'no person IDs');
select is(position('d8000000' in current_setting('test.report')),0,'no internal file asset IDs');
select is(position('private-reference' in current_setting('test.report')),0,'no private filename dump');
select throws_ok($$select public.preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001')$$,'42501',null,'same version denied');
reset role;
select is((select md5(jsonb_agg(to_jsonb(e) order by id)::text) from public.enrollments e),current_setting('test.before'),'enrolment rows unchanged');
set local role authenticated;
select set_config('test.shared',public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001','Unchanged shared material comparison')::text,true);
reset role;
update public.curriculum_versions set status='published',published_at=now(),published_by_person_id='d1000000-0000-4000-8000-000000000002',release_note='Shared comparison' where id=current_setting('test.shared')::uuid;
set local role authenticated;
select is((public.preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',current_setting('test.shared')::uuid)->'counts'->>'total')::integer,0,'copied IDs do not invent topic/lesson/material changes');
select set_config('test.large',public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001','Large comparison')::text,true);
reset role;
insert into public.curriculum_topics(section_id,code,title,position) select (select id from public.curriculum_sections where curriculum_version_id=current_setting('test.large')::uuid),'EXTRA_'||n,'Extra topic '||n,n+1 from generate_series(1,101)n;
update public.curriculum_versions set status='published',published_at=now(),published_by_person_id='d1000000-0000-4000-8000-000000000002',release_note='Large comparison' where id=current_setting('test.large')::uuid;
set local role authenticated;
select set_config('test.large_report',public.preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',current_setting('test.large')::uuid)::text,true);
select is((current_setting('test.large_report')::jsonb->'counts'->>'total')::integer,101,'full difference total retained');
select is(jsonb_array_length(current_setting('test.large_report')::jsonb->'differences'),100,'response display bounded');
select is(current_setting('test.large_report')::jsonb->>'truncated','true','truncation explicit');
reset role;
update public.capability_grants set revoked_at=now() where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='curriculum.upgrade_preview';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'preview grant revocation effective');
select throws_ok($$select public.preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001',current_setting('test.target')::uuid)$$,'42501',null,'revoked report denied');
reset role;
update public.capability_grants set revoked_at=null where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='curriculum.upgrade_preview';
update public.capability_grants set revoked_at=now() where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='content.publish';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'publication grant required independently');
reset role;
update public.capability_grants set revoked_at=null where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='content.publish';
update public.capability_grants set revoked_at=now() where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='enrollment.operate';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'operation grant required independently');
reset role;
update public.capability_grants set revoked_at=null where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='enrollment.operate';
update public.capability_grants set ends_at=now()-interval '1 second',starts_at=now()-interval '1 day' where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='curriculum.upgrade_preview';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'expired preview grant denied');
reset role;
update public.capability_grants set ends_at=null where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='curriculum.upgrade_preview';
update public.role_assignments set revoked_at=now() where person_id='d1000000-0000-4000-8000-000000000001' and role_key='ordinary_admin';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'revoked required role denied');
reset role;
update public.role_assignments set revoked_at=null,starts_at=now()-interval '1 day',ends_at=now()-interval '1 second' where person_id='d1000000-0000-4000-8000-000000000001' and role_key='ordinary_admin';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'expired required role denied');
reset role;
update public.role_assignments set ends_at=null where person_id='d1000000-0000-4000-8000-000000000001' and role_key='ordinary_admin';
update public.memberships set status='suspended' where person_id='d1000000-0000-4000-8000-000000000001' and kind='employee';
set local role authenticated;
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'suspended employee denied');
reset role;
update public.memberships set status='active' where person_id='d1000000-0000-4000-8000-000000000001' and kind='employee';
set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000004"}';
select is(jsonb_array_length(public.list_curriculum_preview_context()),0,'student context empty');
reset role;
insert into public.capability_grants(person_id,capability_key,required_role_key,scope_type,grant_reason) values('d1000000-0000-4000-8000-000000000002','curriculum.upgrade_preview','elevated_admin','global','Fictional global bypass denial'),('d1000000-0000-4000-8000-000000000002','enrollment.operate','elevated_admin','global','Fictional global operation');
set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000002"}';
select is(public.can_preview_curriculum_upgrade('d2000000-0000-4000-8000-000000000001'),false,'global preview cannot bypass explicit offering grant');
select * from finish();rollback;

