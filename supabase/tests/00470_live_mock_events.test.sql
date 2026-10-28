begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
select format('e1000000-0000-4000-8000-00000000000%s', n)::uuid, '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', format('live-%s@dexam.test', n), ''
from generate_series(1, 4) n;
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'e1000000-%';
insert into public.people (id, member_id, display_name)
values
  ('e1100000-0000-4000-8000-000000000001', 'DXM-RVNSTUDA2AAA', 'Fictional Live Student A'),
  ('e1100000-0000-4000-8000-000000000002', 'DXM-RVNSTUDB2BBB', 'Fictional Live Student B'),
  ('e1100000-0000-4000-8000-000000000003', 'DXM-RVNSTUDC2CCC', 'Fictional Live Student C'),
  ('e1100000-0000-4000-8000-000000000004', null, 'Fictional Live Organiser');
insert into public.auth_identities (person_id, auth_user_id, kind)
select format('e1100000-0000-4000-8000-00000000000%s', n)::uuid, format('e1000000-0000-4000-8000-00000000000%s', n)::uuid,
  (case when n = 4 then 'employee_email' else 'member_id' end)::public.auth_identity_kind
from generate_series(1, 4) n;
insert into public.memberships (person_id, kind, status, starts_at)
select format('e1100000-0000-4000-8000-00000000000%s', n)::uuid, (case when n = 4 then 'employee' else 'student' end)::public.membership_kind,
  'active', now() - interval '1 day'
from generate_series(1, 4) n;
insert into public.role_assignments (person_id, role_key, scope_type, scope_id, grant_reason)
values ('e1100000-0000-4000-8000-000000000004', 'elevated_admin', 'global', null, 'F050 organiser test');

-- A fictional UCEED pool and two drawing tasks.
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
select gen_random_uuid(), format('livepool-%s-%s', kind, n), 1, md5('live' || kind || n) || md5(n || kind || 'live'),
  kind, format('Fictional live %s %s', kind, n), case when kind = 'descriptive' then 'upload' else 'auto' end,
  'ready', '{}', 'original', 'original'
from (values ('nat', 14), ('msq', 15), ('mcq', 28), ('descriptive', 2)) as pool(kind, size), generate_series(1, size) n;
insert into public.assessment_question_keys (question_id, answer, answer_status)
select id, case question_type
  when 'nat' then '{"kind":"numeric","accepted":[{"exact":1}]}'
  when 'msq' then '{"kind":"multi","correct":["A"]}'
  else '{"kind":"choice","correct":["A"]}' end::jsonb, 'official-key'
from public.assessment_questions where external_key like 'livepool-%' and question_type <> 'descriptive';
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select id, 'uceed', 2094, 'uceed-2094', substring(external_key from 'livepool-(.*)$')
from public.assessment_questions where external_key like 'livepool-%';

select ok(
  not has_table_privilege('authenticated', 'public.live_events', 'select')
  and not has_table_privilege('authenticated', 'public.live_event_questions', 'select')
  and not has_table_privilege('authenticated', 'public.live_event_registrations', 'select'),
  'live-event tables have no browser grants'
);

-- Students cannot schedule events.
set local role authenticated;
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}';
select throws_ok(
  $$select public.create_live_event('mock94', 'Fictional live', 'uceed-2026', now() + interval '1 day', null, 15, 2)$$,
  '42501', null, 'students cannot create events'
);

-- The organiser schedules and publishes.
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000004"}';
select throws_ok(
  $$select public.create_live_event('mock94', 'Fictional live', 'nid-2026', now() + interval '1 day', null, 15, 2)$$,
  '22023', null, 'only UCEED and CEED blueprints run live'
);
select throws_ok(
  $$select public.create_live_event('mock94', 'Fictional live', 'uceed-2026', now() - interval '1 minute', null, 15, 2)$$,
  '22023', null, 'the start must be in the future'
);
select throws_ok(
  $$select public.create_live_event('mock94', 'Fictional live', 'uceed-2026', now() + interval '1 day', null, 10, 2)$$,
  '23514', null, 'the break is 15 to 20 minutes'
);
select set_config('test.event', public.create_live_event(
  'mock94', 'Fictional all-India live mock', 'uceed-2026', now() + interval '1 day', now() + interval '1 hour', 15, 2
)::text, true);
select is(public.get_live_event('mock94') ->> 'status', 'draft', 'the event starts as a draft');
select is(public.get_live_event('mock94') -> 'schedule' ->> 'phase', 'registration', 'registration is open');

set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}';
select throws_ok($$select public.get_live_event('mock94')$$, '42501', null, 'students cannot see drafts');
select is(
  (select count(*)::integer from jsonb_array_elements(public.list_live_events()) e where e ->> 'key' = 'mock94'),
  0, 'drafts are not listed for students'
);
select throws_ok(format($$select public.publish_live_event(%L)$$, current_setting('test.event')), '42501', null, 'students cannot publish');

set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000004"}';
select set_config('test.published', public.publish_live_event(current_setting('test.event')::uuid)::text, true);
select ok((current_setting('test.published')::jsonb ->> 'questions')::integer > 0, 'publishing pins a question set');
select is((current_setting('test.published')::jsonb ->> 'tasks')::integer, 2, 'and two UCEED drawing tasks');
select throws_ok(format($$select public.publish_live_event(%L)$$, current_setting('test.event')), '22023', null, 'publishing is once only');

-- Registration and roll numbers.
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}';
select is(public.register_live_event('mock94') -> 'me' ->> 'rollNo', 'MOCK94-00001', 'the first student gets roll 00001');
select is(public.register_live_event('mock94') -> 'me' ->> 'rollNo', 'MOCK94-00001', 'registering again keeps the roll number');
select is(public.get_live_event('mock94') -> 'schedule' ->> 'phase', 'registration', 'students see the published event');
select throws_ok($$select public.join_live_part_a('mock94')$$, 'DX006', null, 'Part A cannot be entered early');
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000002"}';
select throws_ok($$select public.join_live_part_a('mock94')$$, '42501', null, 'unregistered students cannot enter');
select is(public.register_live_event('mock94') -> 'me' ->> 'rollNo', 'MOCK94-00002', 'the second student gets roll 00002');
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.register_live_event('mock94')$$, 'DX005', null, 'registration stops at the seat limit');

-- Part A has started.
reset role;
update public.live_events
  set registration_closes_at = now() - interval '10 minutes', part_a_starts_at = now() - interval '5 minutes'
  where key = 'mock94';
set local role authenticated;
select throws_ok($$select public.register_live_event('mock94')$$, 'DX004', null, 'registration closes before the start');

set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}';
select is(public.get_live_event('mock94') -> 'schedule' ->> 'phase', 'part-a', 'Part A is live');
select set_config('test.a', public.join_live_part_a('mock94')::text, true);
select is(current_setting('test.a')::jsonb ->> 'kind', 'live', 'the attempt is a live attempt');
select is(
  jsonb_array_length(current_setting('test.a')::jsonb -> 'questions'),
  (current_setting('test.published')::jsonb ->> 'questions')::integer,
  'the student gets the pinned set'
);
select is(
  (current_setting('test.a')::jsonb ->> 'deadline')::timestamptz,
  now() - interval '5 minutes' + interval '120 minutes',
  'the deadline is the event clock, not the join time'
);
select is(public.join_live_part_a('mock94') ->> 'attemptId', current_setting('test.a')::jsonb ->> 'attemptId', 'joining again resumes');
select throws_ok(
  format($$select public.begin_part_b(%L)$$, current_setting('test.a')::jsonb ->> 'attemptId'),
  'DX006', null, 'Part B waits for the break to end'
);
select throws_ok($$select public.get_live_event_standing('mock94')$$, 'DX006', null, 'ranks wait for Part A to end');
select lives_ok(
  format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.a')::jsonb ->> 'attemptId'),
  'student A submits'
);
select throws_ok(
  format($$select public.get_assessment_attempt_result(%L)$$, current_setting('test.a')::jsonb ->> 'attemptId'),
  'DX006', null, 'answers stay hidden while Part A is live'
);

set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000002"}';
select set_config('test.b', public.join_live_part_a('mock94')::text, true);
select is(
  (select array_agg(q ->> 'id' order by q ->> 'id') from jsonb_array_elements(current_setting('test.b')::jsonb -> 'questions') q),
  (select array_agg(q ->> 'id' order by q ->> 'id') from jsonb_array_elements(current_setting('test.a')::jsonb -> 'questions') q),
  'every participant gets the identical paper'
);
select lives_ok(
  format($$select public.submit_assessment_attempt(%L, '{}'::jsonb)$$, current_setting('test.b')::jsonb ->> 'attemptId'),
  'student B submits'
);

-- Fictional scores, then Part A ends and the break passes.
reset role;
update public.assessment_attempts set score = 40 where id = (current_setting('test.a')::jsonb ->> 'attemptId')::uuid;
update public.assessment_attempts set score = 25 where id = (current_setting('test.b')::jsonb ->> 'attemptId')::uuid;
update public.live_events
  set registration_closes_at = now() - interval '140 minutes', part_a_starts_at = now() - interval '136 minutes'
  where key = 'mock94';
set local role authenticated;

set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}';
select is(public.get_live_event('mock94') -> 'schedule' ->> 'phase', 'part-b', 'Part B is live after the break');
select is(public.get_live_event_standing('mock94') ->> 'rank', '1', 'the higher score ranks first');
select is(public.get_live_event_standing('mock94') ->> 'percentile', '100.0', 'with the top percentile');
select is(public.get_live_event_standing('mock94') ->> 'participants', '2', 'among both participants');
select is(
  public.get_live_event_standing('mock94') -> 'top',
  '[{"rollNo":"MOCK94-00001","score":40},{"rollNo":"MOCK94-00002","score":25}]'::jsonb,
  'the top list shows roll numbers, never names'
);
select lives_ok(
  format($$select public.get_assessment_attempt_result(%L)$$, current_setting('test.a')::jsonb ->> 'attemptId'),
  'answers are released after Part A'
);
select set_config('test.partb', public.begin_part_b((current_setting('test.a')::jsonb ->> 'attemptId')::uuid)::text, true);
select is(current_setting('test.partb')::jsonb ->> 'status', 'drawing', 'Part B begins on the event clock');
select is(jsonb_array_length(current_setting('test.partb')::jsonb -> 'tasks'), 2, 'with the event tasks');
select is(
  (current_setting('test.partb')::jsonb ->> 'drawingDeadline')::timestamptz,
  now() - interval '136 minutes' + interval '195 minutes',
  'and the shared Part B deadline'
);

set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000002"}';
select is(public.get_live_event_standing('mock94') ->> 'rank', '2', 'the lower score ranks second');
reset role;
update public.assessment_attempts set submitted_late = true where id = (current_setting('test.b')::jsonb ->> 'attemptId')::uuid;
set local role authenticated;
select is(public.get_live_event_standing('mock94') ->> 'ranked', 'false', 'late submissions are unranked');
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000003"}';
select throws_ok($$select public.get_live_event_standing('mock94')$$, '42501', null, 'non-participants have no standing');

-- Cancelling.
set local request.jwt.claims = '{"sub":"e1000000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000004"}';
select throws_ok(format($$select public.cancel_live_event(%L)$$, current_setting('test.event')), '22023', null, 'a started event cannot be cancelled');
select set_config('test.event2', public.create_live_event(
  'mock95', 'Fictional second live mock', 'ceed-2026', now() + interval '2 days', null, 20, 10
)::text, true);
reset role;
update public.live_events set registration_closes_at = now() - interval '1 minute' where key = 'mock95';
set local role authenticated;
select throws_ok(format($$select public.publish_live_event(%L)$$, current_setting('test.event2')), '22023', null, 'a draft cannot be published after registration would have closed');
select lives_ok(format($$select public.cancel_live_event(%L)$$, current_setting('test.event2')), 'a future event can be cancelled');
select is(
  (select count(*)::integer from jsonb_array_elements(public.list_live_events()) e where e ->> 'key' = 'mock95'),
  0, 'cancelled events are not listed'
);

select * from finish();
rollback;
