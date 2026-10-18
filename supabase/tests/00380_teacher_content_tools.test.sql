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

set local role authenticated;
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select is((select count(*)::int from public.get_content_offering_permissions()),1,'teacher editor sees one explicitly granted offering');
select is((select can_publish from public.get_content_offering_permissions()),false,'editor does not gain publishing');
select is(public.current_person_can_open_teacher_content(),true,'offering-scoped teacher author can enter without review grant');
select set_config('test.material_lesson',public.ensure_topic_material_lesson('d5000000-0000-4000-8000-000000000001')::text,true);
select is(public.ensure_topic_material_lesson('d5000000-0000-4000-8000-000000000001')::text,current_setting('test.material_lesson'),'material container retries reuse exact lesson');
select throws_ok($$select public.ensure_topic_material_lesson('d5000000-0000-4000-8000-000000000002')$$,'42501',null,'cross offering container denied');
select set_config('test.asset',(select file_id::text from public.reserve_lesson_file(current_setting('test.material_lesson')::uuid,'reference.pdf','application/pdf',10)),true);
reset role;
select public.complete_lesson_upload(current_setting('test.asset')::uuid);
set local role authenticated;
select public.attach_lesson_file(current_setting('test.asset')::uuid);
select lives_ok($$select public.set_content_file_label('lesson',current_setting('test.material_lesson')::uuid,current_setting('test.asset')::uuid,'Vanishing point reference')$$,'teacher names attached lesson reference');
select is((select display_name from public.list_named_lesson_files(current_setting('test.material_lesson')::uuid)),'Vanishing point reference','named read keeps description');
select is((select file_name from public.list_named_lesson_files(current_setting('test.material_lesson')::uuid)),'reference.pdf','naming does not rename shared bytes');
select throws_ok($$select public.set_content_file_label('lesson',current_setting('test.material_lesson')::uuid,current_setting('test.asset')::uuid,'')$$,'22023',null,'empty names rejected');
select throws_ok($$insert into public.content_file_labels(lesson_id,asset_id,label) values(current_setting('test.material_lesson')::uuid,current_setting('test.asset')::uuid,'bypass')$$,'42501',null,'browser cannot bypass name RPC');
select set_config('test.impact',public.preview_draft_topic_removal('d5000000-0000-4000-8000-000000000001')::text,true);
select is((current_setting('test.impact')::jsonb->>'lessons')::int,2,'removal previews lessons');
select is((current_setting('test.impact')::jsonb->>'files')::int,1,'removal previews file references');
select throws_ok($$select public.remove_draft_topic('d5000000-0000-4000-8000-000000000001','{}')$$,'55000',null,'stale removal impact rejected');
select set_config('test.assignment',public.create_assignment_draft('d2000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001','NAMED_REF','Drawing','Reference study','Read the references and draw.','Check perspective and structure.')::text,true);
select throws_ok($$select public.remove_draft_topic('d5000000-0000-4000-8000-000000000001',public.preview_draft_topic_removal('d5000000-0000-4000-8000-000000000001'))$$,'23514',null,'linked assignment blocks removal');
reset role;
-- Exact fictional assignment fixture: exercise labels without Storage byte I/O here.
insert into public.assignment_upload_reservations(id,assignment_version_id,creator_person_id,object_path,file_name,mime_type,byte_size,state)
values('d8000000-0000-4000-8000-000000000001',current_setting('test.assignment')::uuid,'d1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001/'||current_setting('test.assignment')||'/d8000000-0000-4000-8000-000000000001.pdf','brief.pdf','application/pdf',10,'reserved');
insert into storage.objects(bucket_id,name,metadata) select 'assignment-materials',object_path,'{"mimetype":"application/pdf","size":10}'::jsonb from public.assignment_upload_reservations where id='d8000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('test.assignment_file',public.attach_assignment_upload('d8000000-0000-4000-8000-000000000001')::text,true);
select lives_ok($$select public.set_content_file_label('assignment',current_setting('test.assignment')::uuid,current_setting('test.assignment_file')::uuid,'Practice brief')$$,'assignment file can be named separately');
select is((select label from public.content_file_labels where assignment_material_id=current_setting('test.assignment_file')::uuid),'Practice brief','assignment description readable to authorized editor');
select is((select display_name from public.list_assignment_reference_files(current_setting('test.assignment')::uuid)),'Practice brief','assignment reference list includes descriptive title');
select is(public.current_person_can_read_assignment_object((select object_path from public.assignment_materials where id=current_setting('test.assignment_file')::uuid)),true,'attached assignment bytes readable under current author scope');
select throws_ok($$select public.set_content_file_label('assignment',gen_random_uuid(),current_setting('test.assignment_file')::uuid,'Mismatch')$$,'42501',null,'file parent mismatch denied');
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000003"}';
select is((select count(*)::int from public.content_file_labels),0,'Sales cannot read private descriptions');
select is((select count(*)::int from public.list_assignment_reference_files(current_setting('test.assignment')::uuid)),0,'Sales cannot enumerate reference downloads');
select throws_ok($$select public.set_content_file_label('lesson',current_setting('test.material_lesson')::uuid,current_setting('test.asset')::uuid,'Sales overwrite')$$,'42501',null,'Sales cannot rename');
select throws_ok($$select public.preview_draft_topic_removal('d5000000-0000-4000-8000-000000000001')$$,'42501',null,'Sales cannot preview destructive impact');
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000002"}';
reset role;
update public.curriculum_versions set status='published',published_by_person_id='d1000000-0000-4000-8000-000000000002',published_at=now(),release_note='Fictional named materials release' where id='d3000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$select public.publish_assignment_version(current_setting('test.assignment')::uuid,'Publish named practice brief')$$,'separately authorized publisher releases assignment');
select throws_ok($$select public.set_content_file_label('assignment',current_setting('test.assignment')::uuid,current_setting('test.assignment_file')::uuid,'Change published brief')$$,'42501',null,'published assignment name immutable');
select throws_ok($$select public.unlink_draft_topic_assignment('d5000000-0000-4000-8000-000000000001',current_setting('test.assignment')::uuid)$$,'42501',null,'published assignment cannot be unlinked');
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000004"}';
select is((select count(*)::int from public.list_assignment_reference_files(current_setting('test.assignment')::uuid)),0,'unassigned student cannot read published references');
reset role;
insert into public.enrollments(id,person_id,offering_id,curriculum_version_id,status,source_type) values('d9000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000001','d3000000-0000-4000-8000-000000000001','active','manual');
insert into public.assignment_releases(id,assignment_version_id,offering_id,target_kind,release_note,request_key,released_by_person_id) values('d9000000-0000-4000-8000-000000000002',current_setting('test.assignment')::uuid,'d2000000-0000-4000-8000-000000000001','selected','Fictional named material release',gen_random_uuid(),'d1000000-0000-4000-8000-000000000002');
insert into public.student_assignment_instances(id,assignment_release_id,enrollment_id) values('d9000000-0000-4000-8000-000000000003','d9000000-0000-4000-8000-000000000002','d9000000-0000-4000-8000-000000000001');
set local role authenticated;
select is((select display_name from public.list_assignment_reference_files(current_setting('test.assignment')::uuid)),'Practice brief','assigned student sees named reference');
select is(public.assignment_reference_version_for_instance('d9000000-0000-4000-8000-000000000003'),current_setting('test.assignment')::uuid,'owned instance resolves exact reference version');
select is((select display_name from public.list_named_lesson_files(current_setting('test.material_lesson')::uuid)),'Vanishing point reference','assigned coursework shows lesson label');
select throws_ok($$select public.set_content_file_label('assignment',current_setting('test.assignment')::uuid,current_setting('test.assignment_file')::uuid,'Student rename')$$,'42501',null,'student cannot rename references');
reset role;
update public.memberships set status='suspended' where person_id='d1000000-0000-4000-8000-000000000004';
set local role authenticated;
select is((select count(*)::int from public.list_assignment_reference_files(current_setting('test.assignment')::uuid)),0,'student suspension blocks next reference request');
set local request.jwt.claims='{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"d0000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.set_content_file_label('lesson',current_setting('test.material_lesson')::uuid,current_setting('test.asset')::uuid,'Rewrite history')$$,'42501',null,'published description immutable');
select throws_ok($$select public.remove_draft_topic('d5000000-0000-4000-8000-000000000001',current_setting('test.impact')::jsonb)$$,'42501',null,'published topic removal denied');
select set_config('test.copy',public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001','Next edition')::text,true);
select is((select count(*)::int from public.content_file_labels n join public.curriculum_lessons l on l.id=n.lesson_id join public.curriculum_topics t on t.id=l.topic_id join public.curriculum_sections s on s.id=t.section_id where s.curriculum_version_id=current_setting('test.copy')::uuid and n.label='Vanishing point reference'),1,'draft clone retains per-reference description');
select set_config('test.copy_topic',(select t.id::text from public.curriculum_topics t join public.curriculum_sections s on s.id=t.section_id where s.curriculum_version_id=current_setting('test.copy')::uuid),true);
select set_config('test.copy_assignment',public.create_assignment_draft('d2000000-0000-4000-8000-000000000001',current_setting('test.copy_topic')::uuid,'COPY_DRAFT','Drawing','Draft reference study','Draw the composition.','Check the structure.')::text,true);
select lives_ok($$select public.unlink_draft_topic_assignment(current_setting('test.copy_topic')::uuid,current_setting('test.copy_assignment')::uuid)$$,'teacher deliberately unlinks a draft assignment');
select ok(exists(select 1 from public.assignment_versions where id=current_setting('test.copy_assignment')::uuid),'unlink retains assignment draft');
select lives_ok($$select public.remove_draft_topic(current_setting('test.copy_topic')::uuid,public.preview_draft_topic_removal(current_setting('test.copy_topic')::uuid))$$,'unlinked draft topic and lessons removed deliberately');
select is((select count(*)::int from public.curriculum_topics where id=current_setting('test.copy_topic')::uuid),0,'draft topic actually removed');
reset role;
select is((select state from public.lesson_file_assets where id=current_setting('test.asset')::uuid),'ready','shared source bytes retained after draft removal');
select ok(exists(select 1 from public.curriculum_topics where id='d5000000-0000-4000-8000-000000000001'),'published original topic remains');
update public.capability_grants set revoked_at=now() where person_id='d1000000-0000-4000-8000-000000000001' and capability_key='content.manage_drafts';
set local role authenticated;
select is((select count(*)::int from public.get_content_offering_permissions()),0,'revoked grant hides offerings immediately');
select throws_ok($$select public.ensure_topic_material_lesson(current_setting('test.copy_topic')::uuid)$$,'42501',null,'revoked editor cannot mutate');
select * from finish();
rollback;

