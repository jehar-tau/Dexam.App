begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values ('e4000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'mockpartb@dexam.test', '');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
values ('e4000000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'aal1', now(), now());
insert into public.people (id, member_id, display_name)
values ('e4100000-0000-4000-8000-000000000001', 'DXM-RVNSTUDF2FFF', 'Fictional Mock Student');
insert into public.auth_identities (person_id, auth_user_id, kind)
values ('e4100000-0000-4000-8000-000000000001', 'e4000000-0000-4000-8000-000000000001', 'member_id'::public.auth_identity_kind);
insert into public.memberships (person_id, kind, status, starts_at)
values ('e4100000-0000-4000-8000-000000000001', 'student'::public.membership_kind, 'active', now() - interval '1 day');

-- Fictional UCEED Part B tasks: drawing (scene) and design aptitude (product).
insert into public.assessment_topics (slug, name)
select 'drawing-' || t, initcap(t) from unnest(array['scene', 'product']) t
on conflict (slug) do nothing;
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind, topic_id
)
select format('e4200000-0000-4000-8000-00000000000%s', n)::uuid, format('mockpartb-%s', n), 1,
  md5('mockpartb' || n) || md5(n || 'mockpartb'), 'descriptive', format('Fictional Part B task %s', n),
  'upload', 'ready', '{}', 'original', 'original',
  (select id from public.assessment_topics where slug = 'drawing-' || kind)
from (values (1, 'product'), (2, 'scene'), (3, 'product'), (4, 'scene')) as pool(n, kind);
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select format('e4200000-0000-4000-8000-00000000000%s', n)::uuid, 'uceed', 2091, 'uceed-2091', 'B' || n
from generate_series(1, 4) n;

-- Two submitted mocks: UCEED and NIFT.
insert into public.assessment_attempts (
  id, person_id, paper_id, exam, status, started_at, submitted_at, submit_reason,
  duration_minutes, objective_count, marking, kind
)
values
  ('e4300000-0000-4000-8000-000000000001', 'e4100000-0000-4000-8000-000000000001', 'mock-uceed-2026', 'uceed',
    'submitted', now() - interval '2 hours', now(), 'candidate', 120, 0, '{}', 'mock'),
  ('e4300000-0000-4000-8000-000000000002', 'e4100000-0000-4000-8000-000000000001', 'mock-nift-bdes-2026', 'nift',
    'submitted', now() - interval '2 hours', now(), 'candidate', 120, 0, '{}', 'mock');

select ok(not has_function_privilege('authenticated', 'public.assessment_pin_mock_part_b(uuid)', 'execute'),
  'students cannot pin Part B tasks directly');

set local role authenticated;
set local request.jwt.claims = '{"sub":"e4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e4000000-0000-4000-8000-000000000001"}';
select ok((public.get_part_b('e4300000-0000-4000-8000-000000000001') ->> 'available')::integer >= 2,
  'a UCEED mock offers Part B');
select set_config('test.b', public.begin_part_b('e4300000-0000-4000-8000-000000000001')::text, true);
select is(jsonb_array_length(current_setting('test.b')::jsonb -> 'tasks'), 2, 'UCEED Part B has two tasks');
select is((current_setting('test.b')::jsonb ->> 'maxScore')::numeric, 100::numeric, 'worth 100 marks');
select ok(
  (current_setting('test.b')::jsonb ->> 'drawingDeadline')::timestamptz
    between now() + interval '59 minutes' and now() + interval '61 minutes',
  'with 60 minutes of drawing time'
);
select ok(
  (current_setting('test.b')::jsonb ->> 'uploadDeadline')::timestamptz
    between now() + interval '69 minutes' and now() + interval '71 minutes',
  'and a 10-minute upload window after it'
);
reset role;
select ok(
  (select bool_and(case x.position
      when 0 then substring(t.slug from '^drawing-(.*)$') in ('scene', 'story', 'skill')
      else substring(t.slug from '^drawing-(.*)$') in ('product', 'problem', 'communication', 'creative') end)
     from public.assessment_attempt_tasks x
     join public.assessment_questions q on q.id = x.question_id
     join public.assessment_topics t on t.id = q.topic_id
     where x.attempt_id = 'e4300000-0000-4000-8000-000000000001'),
  'a drawing task first, then design aptitude'
);
set local role authenticated;
select throws_ok($$select public.begin_part_b('e4300000-0000-4000-8000-000000000002')$$, '22023', null,
  'a NIFT mock has no Part B');
reset role;

-- Two more design-aptitude tasks, so drawing tasks run out before aptitude ones do; two more
-- students whose history is set below.
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind, topic_id
)
select format('e4200000-0000-4000-8000-00000000000%s', n)::uuid, format('mockpartb-%s', n), 1,
  md5('mockpartb' || n) || md5(n || 'mockpartb'), 'descriptive', format('Fictional Part B task %s', n),
  'upload', 'ready', '{}', 'original', 'original',
  (select id from public.assessment_topics where slug = 'drawing-product')
from generate_series(5, 6) n;
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select format('e4200000-0000-4000-8000-00000000000%s', n)::uuid, 'uceed', 2091, 'uceed-2091', 'B' || n
from generate_series(5, 6) n;
insert into public.people (id, member_id, display_name)
values
  ('e4100000-0000-4000-8000-000000000002', null, 'Fictional Mock Second Student'),
  ('e4100000-0000-4000-8000-000000000003', null, 'Fictional Mock Third Student');

-- A student who has already drawn every drawing task gets unseen aptitude tasks, not a repeat.
insert into public.assessment_attempts (
  id, person_id, paper_id, exam, status, started_at, submitted_at, submit_reason,
  duration_minutes, objective_count, marking, kind
)
values
  ('e4300000-0000-4000-8000-000000000003', 'e4100000-0000-4000-8000-000000000002', 'mock-uceed-2026', 'uceed',
    'submitted', now() - interval '1 day', now() - interval '1 day', 'candidate', 120, 0, '{}', 'mock'),
  ('e4300000-0000-4000-8000-000000000004', 'e4100000-0000-4000-8000-000000000002', 'mock-uceed-2026', 'uceed',
    'submitted', now() - interval '2 hours', now(), 'candidate', 120, 0, '{}', 'mock');
insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
select 'e4300000-0000-4000-8000-000000000003', pool.question_id,
  (row_number() over (order by pool.question_id) - 1)::smallint, 50
from public.assessment_mock_part_b_pool('uceed') pool
where pool.drawing_type in ('scene', 'story', 'skill');
select public.assessment_pin_mock_part_b('e4300000-0000-4000-8000-000000000004');
select is(
  (select count(*)::integer from public.assessment_attempt_tasks where attempt_id = 'e4300000-0000-4000-8000-000000000004'),
  2, 'a UCEED mock still gets two tasks once every drawing task is used'
);
select is(
  (select count(*)::integer from public.assessment_attempt_tasks x
     join public.assessment_attempt_tasks seen on seen.question_id = x.question_id
     where x.attempt_id = 'e4300000-0000-4000-8000-000000000004'
       and seen.attempt_id = 'e4300000-0000-4000-8000-000000000003'),
  0, 'and repeats no drawing task while unseen aptitude tasks remain'
);

-- The draw is random, so check the rules over many draws: 200 times, pin three mocks in a row for
-- a new student (each pass rolled back), keeping the worst case seen. The first two use up the two
-- drawing tasks; the third must take the two aptitude tasks still unseen.
do $$
declare
  v_mocks uuid[];
  v_value integer;
  v_passes integer := 0;
  v_most_misplaced integer := 0;
  v_most_repeats integer := 0;
begin
  for i in 1 .. 200 loop
    begin
      v_mocks := array[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
      for m in 1 .. 3 loop
        insert into public.assessment_attempts (
          id, person_id, paper_id, exam, status, started_at, submitted_at, submit_reason,
          duration_minutes, objective_count, marking, kind
        )
        values (v_mocks[m], 'e4100000-0000-4000-8000-000000000003', 'mock-uceed-2026', 'uceed',
          'submitted', now(), now(), 'candidate', 120, 0, '{}', 'mock');
        perform public.assessment_pin_mock_part_b(v_mocks[m]);
      end loop;
      select count(*) into v_value
        from public.assessment_attempt_tasks x
        join public.assessment_mock_part_b_pool('uceed') pool on pool.question_id = x.question_id
        where x.attempt_id in (v_mocks[1], v_mocks[2])
          and (x.position = 0) <> (pool.drawing_type in ('scene', 'story', 'skill'));
      v_most_misplaced := greatest(v_most_misplaced, v_value);
      select count(*) into v_value from (
        select x.question_id
        from public.assessment_attempt_tasks x
        where x.attempt_id = any (v_mocks)
        group by x.question_id
        having count(*) > 1
      ) repeated;
      v_most_repeats := greatest(v_most_repeats, v_value);
      v_passes := v_passes + 1;
      raise exception using errcode = 'DXT00';
    exception when sqlstate 'DXT00' then
      null;
    end;
  end loop;
  perform set_config('test.passes', v_passes::text, true);
  perform set_config('test.most_misplaced', v_most_misplaced::text, true);
  perform set_config('test.most_repeats', v_most_repeats::text, true);
end;
$$;
select is(current_setting('test.passes')::integer, 200, 'two hundred random draws ran');
select is(current_setting('test.most_misplaced')::integer, 0,
  'while drawing tasks remain unseen, every mock has a drawing task first and design aptitude second');
select is(current_setting('test.most_repeats')::integer, 0, 'no mock repeats a task while unseen tasks remain');

select * from finish();
rollback;
