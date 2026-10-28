begin;
select no_plan();

insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('a5000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'practice-student-a@dexam.test', ''),
  ('a5000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'practice-student-b@dexam.test', '');
insert into auth.sessions (id, user_id, aal, created_at, updated_at)
select id, id, 'aal1', now(), now() from auth.users where id::text like 'a5000000-%';
insert into public.people (id, member_id, display_name)
values
  ('a5100000-0000-4000-8000-000000000001', 'DXM-PRACTSTA2AAA', 'Fictional Practice Student A'),
  ('a5100000-0000-4000-8000-000000000002', 'DXM-PRACTSTB2BBB', 'Fictional Practice Student B');
insert into public.auth_identities (person_id, auth_user_id, kind)
values
  ('a5100000-0000-4000-8000-000000000001', 'a5000000-0000-4000-8000-000000000001', 'member_id'),
  ('a5100000-0000-4000-8000-000000000002', 'a5000000-0000-4000-8000-000000000002', 'member_id');
insert into public.memberships (person_id, kind, status, starts_at)
values
  ('a5100000-0000-4000-8000-000000000001', 'student', 'active', now() - interval '1 day'),
  ('a5100000-0000-4000-8000-000000000002', 'student', 'active', now() - interval '1 day');

insert into public.assessment_topics (id, slug, name)
values
  ('a5200000-0000-4000-8000-000000000001', 'fiction-shapes', 'Fiction Shapes'),
  ('a5200000-0000-4000-8000-000000000002', 'fiction-empty', 'Fiction Empty');

-- Twelve ready NAT questions on one topic (UCEED), one quarantined, all keyed "1".
insert into public.assessment_questions (
  id, external_key, version, content_hash, question_type, prompt, topic_id, response_mode,
  publication_state, quarantine_reasons, licence, source_kind
)
select
  ('a5300000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  'fictionp-q' || n, 1, lpad(n::text, 64, '0'), 'nat', 'Fictional practice question ' || n,
  'a5200000-0000-4000-8000-000000000001', 'auto',
  case when n = 13 then 'quarantined' else 'ready' end,
  case when n = 13 then '{unparsed-key}'::text[] else '{}'::text[] end,
  'original', 'original'
from generate_series(1, 13) n;
insert into public.assessment_question_keys (question_id, answer, answer_status)
select id, '{"kind":"numeric","accepted":[{"exact":1}]}', 'official-key'
from public.assessment_questions where external_key like 'fictionp-q%';
insert into public.assessment_question_provenance (question_id, exam, year, paper_id, question_no)
select id, 'uceed', 2026, 'fictionp-2026', substring(external_key from 'q(\d+)$')
from public.assessment_questions where external_key like 'fictionp-q%';

set local role anon;
select throws_ok($$select public.start_assessment_practice('fiction-shapes', 10, true)$$, '42501', null, 'anon cannot start practice');
select throws_ok($$select public.get_assessment_progress()$$, '42501', null, 'anon has no progress');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"a5000000-0000-4000-8000-000000000001"}';
select results_eq(
  $$select slug, ready_count, unseen_count from public.list_assessment_practice_topics('uceed') where slug like 'fiction-%'$$,
  $$values ('fiction-shapes'::text, 12, 12)$$,
  'topics list ready and unseen counts for the exam'
);
select is(
  (select count(*) from public.list_assessment_practice_topics('ceed') where slug like 'fiction-%'),
  0::bigint,
  'the exam filter applies'
);
select throws_ok($$select public.start_assessment_practice('fiction-shapes', 7, true)$$, '22023', null, 'only sizes 10, 25 and 50');
select throws_ok($$select public.start_assessment_practice('fiction-shapes', 10, true, 'other')$$, '22023', null, 'unknown exams are refused');
select throws_ok($$select public.start_assessment_practice('fiction-empty', 10, true)$$, 'P0002', null, 'a topic with nothing ready is refused');

select set_config('test.first', public.start_assessment_practice('fiction-shapes', 10, true, 'uceed')::text, true);
select is(jsonb_array_length(current_setting('test.first')::jsonb -> 'questions'), 10, 'a set of ten is pinned');
select is(current_setting('test.first')::jsonb ->> 'kind', 'practice', 'the attempt is a practice set');
select is((current_setting('test.first')::jsonb ->> 'durationMinutes')::integer, 15, 'timed practice allows 90 seconds a question');
select is(current_setting('test.first')::jsonb -> 'marking' -> 'nat', '{"correct":4,"wrong":0}'::jsonb, 'practice uses the exam marking');
select ok(position('"kind": "numeric"' in current_setting('test.first')) = 0, 'no keys in the practice payload');

select set_config('test.replaced', public.start_assessment_practice('fiction-shapes', 10, false, 'uceed')::text, true);
select throws_ok(
  'select count(*) from public.assessment_attempts',
  '42501', null, 'attempt tables stay closed to the browser'
);
reset role;
select is(
  (select count(*) from public.assessment_attempts where person_id = 'a5100000-0000-4000-8000-000000000001' and status <> 'submitted'),
  1::bigint,
  'starting again replaces the unfinished set'
);
select is(
  (select duration_minutes from public.assessment_attempts where id = (current_setting('test.replaced')::jsonb ->> 'attemptId')::uuid),
  600,
  'untimed practice keeps a 10-hour server limit'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","session_id":"a5000000-0000-4000-8000-000000000001"}';
select is(
  public.get_assessment_attempt((current_setting('test.replaced')::jsonb ->> 'attemptId')::uuid) ->> 'attemptId',
  current_setting('test.replaced')::jsonb ->> 'attemptId',
  'the student can resume their set by id'
);
select lives_ok(
  format($$select public.begin_assessment_attempt(%L)$$, current_setting('test.replaced')::jsonb ->> 'attemptId'),
  'the set begins'
);
select lives_ok(
  format(
    $$select public.submit_assessment_attempt(%L, %L::jsonb)$$,
    current_setting('test.replaced')::jsonb ->> 'attemptId',
    (select jsonb_object_agg(q ->> 'id', '1') from jsonb_array_elements(current_setting('test.replaced')::jsonb -> 'questions') q)
  ),
  'the set is submitted'
);
select results_eq(
  $$select slug, ready_count, unseen_count from public.list_assessment_practice_topics(null) where slug = 'fiction-shapes'$$,
  $$values ('fiction-shapes'::text, 12, 2)$$,
  'answered questions are no longer unseen'
);
select set_config('test.second', public.start_assessment_practice('fiction-shapes', 10, true, 'uceed')::text, true);
select is(
  (select count(*) from jsonb_array_elements(current_setting('test.second')::jsonb -> 'questions') with ordinality as item(q, n)
    where n <= 2 and (q ->> 'id')::uuid not in (
      select (x ->> 'id')::uuid from jsonb_array_elements(current_setting('test.replaced')::jsonb -> 'questions') x
    )),
  2::bigint,
  'unseen questions come first in the next set'
);
select set_config('test.progress', public.get_assessment_progress()::text, true);
select is(jsonb_array_length(current_setting('test.progress')::jsonb -> 'attempts'), 1, 'progress lists submitted attempts only');
select is(current_setting('test.progress')::jsonb -> 'attempts' -> 0 ->> 'title', 'Practice · Fiction Shapes', 'progress carries the practice title');
select is(
  current_setting('test.progress')::jsonb -> 'topics' -> 0,
  '{"slug":"fiction-shapes","name":"Fiction Shapes","total":10,"scored":10}'::jsonb,
  'topic accuracy is aggregated'
);
select is(
  public.get_assessment_attempt_result((current_setting('test.replaced')::jsonb ->> 'attemptId')::uuid) ->> 'kind',
  'practice',
  'the result names the attempt kind'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"a5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1","session_id":"a5000000-0000-4000-8000-000000000002"}';
select throws_ok(
  format($$select public.get_assessment_attempt(%L)$$, current_setting('test.second')::jsonb ->> 'attemptId'),
  '42501', null, 'another student cannot open the set'
);
select is(public.get_assessment_progress() -> 'attempts', '[]'::jsonb, 'another student sees no progress');
select results_eq(
  $$select unseen_count from public.list_assessment_practice_topics('uceed') where slug = 'fiction-shapes'$$,
  $$values (12)$$,
  'unseen counts are per student'
);
reset role;

select * from finish();
rollback;
