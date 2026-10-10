begin;

select plan(28);

select has_table('public', 'curriculum_versions', 'curriculum versions exist');
select has_table('public', 'curriculum_sections', 'curriculum sections exist');
select has_table('public', 'curriculum_topics', 'curriculum topics exist');
select has_table('public', 'curriculum_lessons', 'optional curriculum lessons exist');
select has_function(
  'public',
  'current_person_can_read_curriculum',
  array['uuid'],
  'current-state curriculum access check exists'
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coursework-student-one@dexam.test', ''),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coursework-student-two@dexam.test', ''),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coursework-student-three@dexam.test', ''),
  ('c0000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'coursework-employee@dexam.test', '');

insert into public.people (id, member_id, display_name)
values
  ('c1000000-0000-4000-8000-000000000001', 'DXM-CW3M9Q2RW5TY', 'Fictional Coursework Student One'),
  ('c1000000-0000-4000-8000-000000000002', 'DXM-CW4M9Q2RW5TY', 'Fictional Coursework Student Two'),
  ('c1000000-0000-4000-8000-000000000003', 'DXM-CW5M9Q2RW5TY', 'Fictional Coursework Student Three'),
  ('c1000000-0000-4000-8000-000000000004', null, 'Fictional Coursework Employee');

insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'member_id'),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'member_id'),
  ('c1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'member_id'),
  ('c1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', 'employee_email');

insert into public.memberships (person_id, kind, status, starts_at)
values
  ('c1000000-0000-4000-8000-000000000001', 'student', 'active', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000003', 'student', 'active', now() - interval '1 day'),
  ('c1000000-0000-4000-8000-000000000004', 'employee', 'active', now() - interval '1 day');

insert into public.offerings (id, code, title, status)
values
  ('c2000000-0000-4000-8000-000000000001', 'DESIGN_FOUNDATION', 'Fictional Design Entrance Foundation', 'active'),
  ('c2000000-0000-4000-8000-000000000002', 'DESIGN_ADVANCED', 'Fictional Advanced Design Preparation', 'active');

insert into public.cohorts (id, offering_id, code, name, status)
values
  ('c3000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 'FOUNDATION_A', 'Fictional Foundation Batch A', 'active'),
  ('c3000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'ADVANCED_A', 'Fictional Advanced Batch A', 'active');

select throws_ok(
  $$insert into public.curriculum_versions (offering_id, version_number, title, status, published_by_person_id, published_at) values ('c2000000-0000-4000-8000-000000000001', 90, 'Bypass attempt', 'published', 'c1000000-0000-4000-8000-000000000004', now())$$,
  '23514', 'a curriculum version must be created as a draft',
  'a curriculum cannot bypass the draft lifecycle on creation'
);

insert into public.curriculum_versions (
  id, offering_id, version_number, title, created_by_person_id
)
values
  ('c4000000-0000-4000-8000-000000000001', 'c2000000-0000-4000-8000-000000000001', 1, 'Foundation curriculum 2026', 'c1000000-0000-4000-8000-000000000004'),
  ('c4000000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 1, 'Advanced curriculum 2026', 'c1000000-0000-4000-8000-000000000004'),
  ('c4000000-0000-4000-8000-000000000003', 'c2000000-0000-4000-8000-000000000001', 2, 'Future foundation draft', 'c1000000-0000-4000-8000-000000000004');

select throws_ok(
  $$update public.curriculum_versions set status = 'published', published_by_person_id = 'c1000000-0000-4000-8000-000000000004', published_at = now() where id = 'c4000000-0000-4000-8000-000000000003'$$,
  '23514', 'a curriculum needs at least one topic before publication',
  'an empty curriculum cannot be published'
);

insert into public.curriculum_sections (id, curriculum_version_id, code, title, description, position)
values
  ('c5000000-0000-4000-8000-000000000001', 'c4000000-0000-4000-8000-000000000001', 'DRAWING', 'Drawing', 'Develop observation and visual communication skills.', 1),
  ('c5000000-0000-4000-8000-000000000002', 'c4000000-0000-4000-8000-000000000001', 'APTITUDE', 'Aptitude', 'Build spatial and analytical reasoning.', 2),
  ('c5000000-0000-4000-8000-000000000003', 'c4000000-0000-4000-8000-000000000002', 'ADVANCED_DRAWING', 'Advanced drawing', null, 1);

insert into public.curriculum_topics (id, section_id, code, title, summary, position)
values
  ('c6000000-0000-4000-8000-000000000001', 'c5000000-0000-4000-8000-000000000001', 'PERSPECTIVE', 'Perspective', 'Construct spaces using one, two, and three point perspective.', 1),
  ('c6000000-0000-4000-8000-000000000002', 'c5000000-0000-4000-8000-000000000002', 'SPATIAL', 'Spatial reasoning', 'Understand forms, rotations, and spatial relationships.', 1),
  ('c6000000-0000-4000-8000-000000000003', 'c5000000-0000-4000-8000-000000000003', 'STORYBOARDING', 'Storyboarding', null, 1);

insert into public.curriculum_lessons (id, topic_id, code, title, summary, body_markdown, position)
values
  ('c7000000-0000-4000-8000-000000000001', 'c6000000-0000-4000-8000-000000000001', 'ONE_POINT', 'One-point perspective', 'Use a horizon and one vanishing point.', 'Practice constructing a simple interior.', 1),
  ('c7000000-0000-4000-8000-000000000002', 'c6000000-0000-4000-8000-000000000003', 'SEQUENCING', 'Visual sequencing', null, null, 1);

update public.curriculum_versions
set status = 'published',
    published_by_person_id = 'c1000000-0000-4000-8000-000000000004',
    published_at = now()
where id in (
  'c4000000-0000-4000-8000-000000000001',
  'c4000000-0000-4000-8000-000000000002'
);

select throws_ok(
  $$update public.cohorts set curriculum_version_id = 'c4000000-0000-4000-8000-000000000002' where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '23503', null, 'a cohort cannot receive a curriculum from another offering'
);

select throws_ok(
  $$update public.cohorts set curriculum_version_id = 'c4000000-0000-4000-8000-000000000003' where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '23514', 'only a published curriculum can be assigned',
  'a draft curriculum cannot be assigned'
);

update public.cohorts
set curriculum_version_id = 'c4000000-0000-4000-8000-000000000001'
where id = 'c3000000-0000-4000-8000-000000000001';

select is(
  (select curriculum_version_id from public.cohorts where id = 'c3000000-0000-4000-8000-000000000001'),
  'c4000000-0000-4000-8000-000000000001'::uuid,
  'a published curriculum can be pinned to a cohort'
);

select throws_ok(
  $$update public.cohorts set curriculum_version_id = null where id = 'c3000000-0000-4000-8000-000000000001'$$,
  '55000', 'curriculum assignment is immutable',
  'a pinned cohort curriculum cannot be silently replaced or removed'
);

select throws_ok(
  $$update public.curriculum_versions set title = 'Changed after publication' where id = 'c4000000-0000-4000-8000-000000000001'$$,
  '55000', 'published curriculum versions are immutable',
  'published curriculum metadata is immutable'
);

select throws_ok(
  $$insert into public.curriculum_sections (curriculum_version_id, code, title, position) values ('c4000000-0000-4000-8000-000000000001', 'EXTRA', 'Extra section', 3)$$,
  '55000', 'published curriculum content is immutable',
  'sections cannot be added after publication'
);

select throws_ok(
  $$update public.curriculum_topics set title = 'Changed topic' where id = 'c6000000-0000-4000-8000-000000000001'$$,
  '55000', 'published curriculum content is immutable',
  'topics cannot be edited after publication'
);

select throws_ok(
  $$delete from public.curriculum_lessons where id = 'c7000000-0000-4000-8000-000000000001'$$,
  '55000', 'published curriculum content is immutable',
  'lessons cannot be deleted after publication'
);

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, status, source_type,
  approved_by_person_id, approved_at, activated_at
)
values
  (
    'c8000000-0000-4000-8000-000000000001',
    'c1000000-0000-4000-8000-000000000001',
    'c2000000-0000-4000-8000-000000000001',
    'c3000000-0000-4000-8000-000000000001',
    'active', 'authorized_staff',
    'c1000000-0000-4000-8000-000000000004', now(), now()
  ),
  (
    'c8000000-0000-4000-8000-000000000003',
    'c1000000-0000-4000-8000-000000000003',
    'c2000000-0000-4000-8000-000000000002',
    null,
    'active', 'authorized_staff',
    'c1000000-0000-4000-8000-000000000004', now(), now()
  );

insert into public.enrollments (
  id, person_id, offering_id, cohort_id, curriculum_version_id, status, source_type,
  approved_by_person_id, approved_at, activated_at
)
values (
  'c8000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000002',
  'c2000000-0000-4000-8000-000000000002',
  null,
  'c4000000-0000-4000-8000-000000000002',
  'active', 'authorized_staff',
  'c1000000-0000-4000-8000-000000000004', now(), now()
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 1, 'cohort student sees only their assigned curriculum version');
select is((select count(*)::integer from public.curriculum_sections), 2, 'cohort student sees all sections in their curriculum');
select is((select count(*)::integer from public.curriculum_topics), 2, 'cohort student sees all topics in their curriculum');
select is((select count(*)::integer from public.curriculum_lessons), 1, 'cohort student sees optional lessons in their curriculum');
select is(
  (select count(*)::integer from public.curriculum_versions where id = 'c4000000-0000-4000-8000-000000000002'),
  0,
  'student cannot read another offering curriculum'
);
select throws_ok(
  $$update public.curriculum_versions set title = 'Student mutation' where id = 'c4000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'student cannot mutate curriculum data'
);

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 1, 'cohort-free student sees their directly pinned curriculum');

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 0, 'student without a curriculum assignment sees no curriculum');

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 0, 'employee membership does not grant student curriculum access');

reset role;

update public.people
set status = 'suspended', suspended_at = now()
where id = 'c1000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 0, 'suspension revokes curriculum access immediately');

reset role;

update public.people
set status = 'active', suspended_at = null
where id = 'c1000000-0000-4000-8000-000000000001';
update public.enrollments
set status = 'completed', ended_at = now()
where id = 'c8000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 0, 'an ended enrolment no longer grants curriculum access');

reset role;

update public.curriculum_versions
set status = 'retired', retired_at = now()
where id = 'c4000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}';

select is((select count(*)::integer from public.curriculum_versions), 0, 'a retired curriculum is unavailable to students');

set local role anon;

select throws_ok(
  $$select count(*) from public.curriculum_versions$$,
  '42501', null, 'anonymous users cannot read curriculum data'
);

select * from finish();

rollback;
