begin;

select plan(47);

select has_table('public', 'assignment_definitions', 'stable assignment definitions exist');
select has_table('public', 'assignment_versions', 'versioned assignment content exists');
select has_table('public', 'assignment_topic_links', 'assignments can link to curriculum topics');
select has_table('public', 'assignment_materials', 'private assignment material metadata exists');
select is(
  (select public from storage.buckets where id = 'assignment-materials'),
  false,
  'assignment material bucket is private'
);
select has_function(
  'public',
  'clone_curriculum_version',
  array['uuid', 'text'],
  'published curriculum copy operation exists'
);
select has_function(
  'public',
  'publish_assignment_version',
  array['uuid', 'text'],
  'audited assignment publication operation exists'
);
select has_function(
  'public',
  'create_assignment_draft',
  array['uuid', 'uuid', 'text', 'text', 'text', 'text', 'text'],
  'transactional assignment draft creation operation exists'
);
select has_function(
  'public',
  'clone_assignment_version',
  array['uuid'],
  'published assignment copy operation exists'
);

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

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  public.current_person_can_manage_content('d2000000-0000-4000-8000-000000000001'),
  true,
  'scoped editor can manage their granted offering'
);
select is(
  public.current_person_can_manage_content('d2000000-0000-4000-8000-000000000002'),
  false,
  'scoped editor cannot manage another offering'
);
select is(
  public.current_person_can_publish_content('d2000000-0000-4000-8000-000000000001'),
  false,
  'draft authority does not imply publication authority'
);
select is((select count(*)::integer from public.offerings), 1, 'editor sees only their offering');
select is((select count(*)::integer from public.curriculum_versions), 1, 'editor initially sees only their offering curriculum');

select lives_ok(
  $$select public.clone_curriculum_version('d3000000-0000-4000-8000-000000000001', 'Editable foundation copy')$$,
  'editor can copy a published curriculum into a draft'
);
select is(
  (select count(*)::integer from public.curriculum_versions where status = 'draft'),
  1,
  'copy creates one visible draft'
);
select is(
  (select source_curriculum_version_id from public.curriculum_versions where status = 'draft'),
  'd3000000-0000-4000-8000-000000000001'::uuid,
  'draft retains its source-version lineage'
);
select lives_ok(
  $$update public.curriculum_lessons set body_markdown = 'Updated editable lesson material.' where id in (
    select l.id
    from public.curriculum_lessons l
    join public.curriculum_topics t on t.id = l.topic_id
    join public.curriculum_sections s on s.id = t.section_id
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where cv.status = 'draft' and l.code = 'ONE_POINT'
  )$$,
  'editor can change lesson material in a draft'
);
select throws_ok(
  $$insert into public.curriculum_versions (offering_id, version_number, title, created_by_person_id) values ('d2000000-0000-4000-8000-000000000002', 2, 'Unauthorized draft', 'd1000000-0000-4000-8000-000000000001')$$,
  '42501', null, 'editor cannot create a draft in another offering'
);
select throws_ok(
  $$select public.publish_curriculum_version((select id from public.curriculum_versions where status = 'draft'), 'Editor must not publish')$$,
  '42501', 'content publication access denied',
  'draft editor cannot publish without the separate capability'
);

select lives_ok(
  $$
    insert into public.assignment_definitions (id, offering_id, code, created_by_person_id)
    values ('d7000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001', 'PERSPECTIVE_ROOM', 'd1000000-0000-4000-8000-000000000001');
    insert into public.assignment_versions (
      id, assignment_definition_id, version_number, group_name, title,
      instructions, evaluation_rubric, created_by_person_id
    ) values (
      'd8000000-0000-4000-8000-000000000001',
      'd7000000-0000-4000-8000-000000000001', 1,
      'Perspective & Objects', 'Draw a one-point perspective room',
      'Draw one interior using a clear horizon and vanishing point.',
      'Check convergence, proportion, line confidence, and composition.',
      'd1000000-0000-4000-8000-000000000001'
    );
  $$,
  'editor can create a draft assignment definition and version'
);
select throws_ok(
  $$insert into public.assignment_topic_links (assignment_version_id, topic_id) values ('d8000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000002')$$,
  '23514', 'assignment and topic must belong to the same offering',
  'assignment cannot link to another offering topic'
);
select lives_ok(
  $$insert into public.assignment_topic_links (assignment_version_id, topic_id) values ('d8000000-0000-4000-8000-000000000001', 'd5000000-0000-4000-8000-000000000001')$$,
  'assignment can link to a topic in its offering'
);
select lives_ok(
  $$select public.create_assignment_draft(
    'd2000000-0000-4000-8000-000000000001',
    'd5000000-0000-4000-8000-000000000001',
    'RPC_PERSPECTIVE',
    'Perspective & Objects',
    'Construct a street corner',
    'Draw one street corner using two-point perspective.',
    'Check convergence, scale, composition, and line confidence.'
  )$$,
  'editor can create a complete linked assignment draft atomically'
);
select is(
  (select count(*)::integer from public.assignment_versions v join public.assignment_definitions d on d.id = v.assignment_definition_id where d.code = 'RPC_PERSPECTIVE' and v.status = 'draft'),
  1,
  'transactional creation leaves one usable draft version'
);
select throws_ok(
  $$insert into public.assignment_materials (assignment_version_id, object_path, original_file_name, mime_type, byte_size, position, created_by_person_id) values ('d8000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000001.png', 'room.pdf', 'application/pdf', 1024, 1, 'd1000000-0000-4000-8000-000000000001')$$,
  '23514', 'assignment material extension and MIME type do not match',
  'material extension must match its MIME type'
);
select throws_ok(
  $$insert into public.assignment_materials (assignment_version_id, object_path, original_file_name, mime_type, byte_size, position, created_by_person_id) values ('d8000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000001.pdf', 'room.pdf', 'application/pdf', 10485761, 1, 'd1000000-0000-4000-8000-000000000001')$$,
  '23514', null, 'material larger than 10 MB is rejected'
);
select lives_ok(
  $$insert into public.assignment_materials (assignment_version_id, object_path, original_file_name, mime_type, byte_size, position, created_by_person_id) values ('d8000000-0000-4000-8000-000000000001', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000001.pdf', 'room.pdf', 'application/pdf', 1024, 1, 'd1000000-0000-4000-8000-000000000001')$$,
  'valid private assignment material metadata is accepted'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000001.pdf', auth.uid()::text, '{"mimetype":"application/pdf","size":1024}'::jsonb)$$,
  'editor can upload an approved private material object'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000002.pdf', auth.uid()::text, '{"mimetype":"text/html","size":1024}'::jsonb)$$,
  '42501', null, 'storage policy rejects an unsupported MIME type'
);
select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id, metadata) values
      ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000002.pdf', auth.uid()::text, '{"mimetype":"application/pdf","size":1024}'::jsonb),
      ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000003.pdf', auth.uid()::text, '{"mimetype":"application/pdf","size":1024}'::jsonb),
      ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000004.pdf', auth.uid()::text, '{"mimetype":"application/pdf","size":1024}'::jsonb),
      ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000005.pdf', auth.uid()::text, '{"mimetype":"application/pdf","size":1024}'::jsonb);
  $$,
  'editor can upload up to five approved material objects'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name, owner_id, metadata) values ('assignment-materials', 'd2000000-0000-4000-8000-000000000001/d8000000-0000-4000-8000-000000000001/d9000000-0000-4000-8000-000000000006.pdf', auth.uid()::text, '{"mimetype":"application/pdf","size":1024}'::jsonb)$$,
  '42501', null, 'storage policy rejects a sixth material object'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.assignment_definitions), 0, 'Sales cannot read assignment definitions');
select throws_ok(
  $$insert into public.assignment_definitions (offering_id, code, created_by_person_id) values ('d2000000-0000-4000-8000-000000000001', 'SALES_ATTEMPT', 'd1000000-0000-4000-8000-000000000003')$$,
  '42501', null, 'Sales cannot create assignment definitions'
);

set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.assignment_versions), 0, 'student cannot read staff assignment drafts');

set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select public.publish_curriculum_version((select id from public.curriculum_versions where status = 'draft' and offering_id = 'd2000000-0000-4000-8000-000000000001'), 'Reviewed content-authoring release')$$,
  'publisher can publish the reviewed curriculum draft'
);
select is(
  (select status::text from public.curriculum_versions where source_curriculum_version_id = 'd3000000-0000-4000-8000-000000000001'),
  'published',
  'published curriculum is immutable student content'
);

reset role;

select is(
  (select count(*)::integer from public.security_audit_events where event_type = 'curriculum_version_published'),
  1,
  'curriculum publication creates audit evidence'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select lives_ok(
  $$select public.publish_assignment_version('d8000000-0000-4000-8000-000000000001', 'Reviewed assignment release')$$,
  'publisher can publish a reviewed assignment draft'
);
select is(
  (select status::text from public.assignment_versions where id = 'd8000000-0000-4000-8000-000000000001'),
  'published',
  'assignment version becomes immutable after publication'
);
select lives_ok(
  $$select public.clone_assignment_version('d8000000-0000-4000-8000-000000000001')$$,
  'authorized editor can copy a published assignment into a new draft version'
);
select is(
  (select source_assignment_version_id from public.assignment_versions where assignment_definition_id = 'd7000000-0000-4000-8000-000000000001' and status = 'draft'),
  'd8000000-0000-4000-8000-000000000001'::uuid,
  'assignment draft retains source-version lineage'
);

reset role;

select is(
  (select count(*)::integer from public.security_audit_events where event_type = 'assignment_version_published'),
  1,
  'assignment publication creates audit evidence'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is_empty(
  $$update public.assignment_versions
    set instructions = 'Silent published change'
    where id = 'd8000000-0000-4000-8000-000000000001'
    returning 1$$,
  'browser update cannot change a published assignment'
);
select throws_ok(
  $$delete from public.assignment_materials
    where assignment_version_id = 'd8000000-0000-4000-8000-000000000001'
    returning 1$$,
  '55000',
  'published assignment content is immutable',
  'browser delete cannot remove material from a published assignment'
);

reset role;

update public.people
set status = 'suspended', suspended_at = now()
where id = 'd1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is(
  public.current_person_can_manage_content('d2000000-0000-4000-8000-000000000001'),
  false,
  'suspension revokes draft authority immediately'
);
select is((select count(*)::integer from public.curriculum_versions), 0, 'suspended editor loses content visibility immediately');

select * from finish();

rollback;
