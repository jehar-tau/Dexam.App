-- F050 all-India live mock (redesign step 8c, R3). Staff schedule an event from a blueprint;
-- publishing pins ONE question set (and Part B tasks) shared by every participant, so ranks are
-- fair. Students register for a roll number, wait in the waiting room, and get the questions
-- only when Part A starts; everyone shares the same server deadline. After a 15–20 minute break,
-- Part B runs on the event clock, then the upload window. Ranks are a Dexam cohort estimate.

insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values ('assessment.live.manage', 'Schedule and publish all-India live mock events.', false, false);
insert into public.role_capabilities (role_key, capability_key)
values ('elevated_admin', 'assessment.live.manage');

alter table public.assessment_attempts drop constraint assessment_attempts_kind_check;
alter table public.assessment_attempts
  add constraint assessment_attempts_kind_check check (kind in ('paper', 'practice', 'mock', 'live'));

create table public.live_events (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  title text not null check (char_length(title) between 3 and 120),
  blueprint_key text not null check (blueprint_key in ('uceed-2026', 'ceed-2026')),
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled')),
  registration_closes_at timestamptz not null,
  part_a_starts_at timestamptz not null,
  part_a_minutes integer not null check (part_a_minutes between 10 and 240),
  break_minutes integer not null check (break_minutes between 15 and 20),
  part_b_minutes integer not null check (part_b_minutes between 10 and 180),
  -- Part B's upload window is 10 minutes for every attempt (F043).
  upload_minutes integer not null default 10 check (upload_minutes = 10),
  seat_limit integer not null check (seat_limit between 1 and 100000),
  created_by uuid references public.people (id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  check (registration_closes_at <= part_a_starts_at)
);

create table public.live_event_questions (
  event_id uuid not null references public.live_events (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete restrict,
  position smallint not null,
  primary key (event_id, question_id),
  unique (event_id, position)
);

create table public.live_event_tasks (
  event_id uuid not null references public.live_events (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete restrict,
  position smallint not null,
  max_marks numeric(6, 2) not null,
  primary key (event_id, question_id)
);

create table public.live_event_registrations (
  event_id uuid not null references public.live_events (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  roll_no text not null,
  registered_at timestamptz not null default now(),
  attempt_id uuid references public.assessment_attempts (id) on delete set null,
  primary key (event_id, person_id),
  unique (event_id, roll_no)
);

alter table public.live_events enable row level security;
alter table public.live_event_questions enable row level security;
alter table public.live_event_tasks enable row level security;
alter table public.live_event_registrations enable row level security;
revoke all on public.live_events, public.live_event_questions, public.live_event_tasks, public.live_event_registrations
  from public, anon, authenticated;
grant all on public.live_events, public.live_event_questions, public.live_event_tasks, public.live_event_registrations
  to service_role;

-- The schedule and phase of an event right now.
create function public.live_event_schedule(p_event public.live_events)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'registrationClosesAt', p_event.registration_closes_at,
    'partAStartsAt', p_event.part_a_starts_at,
    'partAEndsAt', p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes),
    'partBStartsAt', p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes + p_event.break_minutes),
    'partBEndsAt', p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes + p_event.break_minutes + p_event.part_b_minutes),
    'uploadEndsAt', p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes + p_event.break_minutes + p_event.part_b_minutes + p_event.upload_minutes),
    'phase', case
      when p_event.status = 'cancelled' then 'cancelled'
      when now() < p_event.registration_closes_at then 'registration'
      when now() < p_event.part_a_starts_at then 'waiting'
      when now() < p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes) then 'part-a'
      when now() < p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes + p_event.break_minutes) then 'break'
      when now() < p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes + p_event.break_minutes + p_event.part_b_minutes) then 'part-b'
      when now() < p_event.part_a_starts_at + make_interval(mins => p_event.part_a_minutes + p_event.break_minutes + p_event.part_b_minutes + p_event.upload_minutes) then 'upload'
      else 'finished'
    end
  )
$$;

create function public.current_person_can_manage_live_events()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$ select public.current_person_has_capability('assessment.live.manage') $$;

-- Staff: create a draft event.
create function public.create_live_event(
  p_key text,
  p_title text,
  p_blueprint_key text,
  p_part_a_starts_at timestamptz,
  p_registration_closes_at timestamptz,
  p_break_minutes integer,
  p_seat_limit integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_blueprint jsonb := public.assessment_blueprint(p_blueprint_key);
  v_id uuid;
begin
  if not public.current_person_can_manage_live_events() then
    raise exception 'Live-event access is required.' using errcode = '42501';
  end if;
  if v_blueprint is null or p_blueprint_key not in ('uceed-2026', 'ceed-2026') then
    raise exception 'Live events use the UCEED or CEED 2026 blueprint.' using errcode = '22023';
  end if;
  if p_part_a_starts_at <= now() then
    raise exception 'The start must be in the future.' using errcode = '22023';
  end if;
  insert into public.live_events (
    key, title, blueprint_key, registration_closes_at, part_a_starts_at, part_a_minutes,
    break_minutes, part_b_minutes, seat_limit, created_by
  )
  values (
    p_key, p_title, p_blueprint_key, coalesce(p_registration_closes_at, p_part_a_starts_at), p_part_a_starts_at,
    (v_blueprint ->> 'minutes')::integer, p_break_minutes,
    case p_blueprint_key when 'uceed-2026' then 60 else 120 end,
    p_seat_limit, public.current_person_id()
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Staff: publish pins one question set and the Part B tasks for every participant.
create function public.publish_live_event(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_event public.live_events;
  v_blueprint jsonb;
  v_section jsonb;
  v_position integer := 0;
  v_count integer;
  v_tasks integer;
  v_exam text;
begin
  if not public.current_person_can_manage_live_events() then
    raise exception 'Live-event access is required.' using errcode = '42501';
  end if;
  select * into v_event from public.live_events where id = p_event_id for update;
  if v_event.id is null or v_event.status <> 'draft' or now() >= v_event.registration_closes_at then
    raise exception 'Only a draft event whose registration has not closed can be published.' using errcode = '22023';
  end if;
  v_blueprint := public.assessment_blueprint(v_event.blueprint_key);
  v_exam := v_blueprint ->> 'exam';
  for v_section in select * from jsonb_array_elements(v_blueprint -> 'sections') loop
    with picked as (
      select q.id, row_number() over (order by (p.exam = v_exam) desc, random()) as rn
      from public.assessment_questions q
      join public.assessment_question_provenance p on p.question_id = q.id
      where q.publication_state = 'ready' and q.response_mode = 'auto' and q.question_type = v_section ->> 'type'
    )
    insert into public.live_event_questions (event_id, question_id, position)
    select v_event.id, picked.id, (v_position + picked.rn - 1)::smallint
    from picked where picked.rn <= (v_section ->> 'count')::integer;
    get diagnostics v_count = row_count;
    v_position := v_position + v_count;
  end loop;
  if v_position = 0 then
    raise exception 'The bank has no ready questions for this blueprint.' using errcode = 'P0002';
  end if;
  insert into public.live_event_tasks (event_id, question_id, position, max_marks)
  select v_event.id, picked.id, (picked.rn - 1)::smallint, 1
  from (
    select q.id, row_number() over (order by (p.exam = v_exam) desc, random()) as rn
    from public.assessment_questions q
    join public.assessment_question_provenance p on p.question_id = q.id
    where q.publication_state = 'ready' and q.response_mode = 'upload'
  ) picked
  where picked.rn <= case v_exam when 'uceed' then 2 else 5 end;
  get diagnostics v_tasks = row_count;
  if v_tasks > 0 then
    update public.live_event_tasks set max_marks = round(100.0 / v_tasks, 2) where event_id = v_event.id;
  end if;
  update public.live_events set status = 'published', published_at = now() where id = v_event.id;
  return jsonb_build_object('questions', v_position, 'tasks', v_tasks);
end;
$$;

-- Staff: cancel an event before Part A starts.
create function public.cancel_live_event(p_event_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_manage_live_events() then
    raise exception 'Live-event access is required.' using errcode = '42501';
  end if;
  update public.live_events set status = 'cancelled'
    where id = p_event_id and status in ('draft', 'published') and now() < part_a_starts_at;
  if not found then
    raise exception 'Only an event that has not started can be cancelled.' using errcode = '22023';
  end if;
end;
$$;

create function public.live_event_view(p_event public.live_events, p_person uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select jsonb_build_object(
    'id', p_event.id,
    'key', p_event.key,
    'title', p_event.title,
    'blueprintKey', p_event.blueprint_key,
    'level', public.assessment_blueprint(p_event.blueprint_key) ->> 'level',
    'status', p_event.status,
    'seatLimit', p_event.seat_limit,
    'registered', (select count(*) from public.live_event_registrations r where r.event_id = p_event.id),
    'questionCount', (select count(*) from public.live_event_questions q where q.event_id = p_event.id),
    'taskCount', (select count(*) from public.live_event_tasks t where t.event_id = p_event.id),
    'partAMinutes', p_event.part_a_minutes,
    'breakMinutes', p_event.break_minutes,
    'partBMinutes', p_event.part_b_minutes,
    'uploadMinutes', p_event.upload_minutes,
    'schedule', public.live_event_schedule(p_event),
    'me', (
      select jsonb_build_object('rollNo', r.roll_no, 'attemptId', r.attempt_id, 'registeredAt', r.registered_at)
      from public.live_event_registrations r
      where r.event_id = p_event.id and r.person_id = p_person
    )
  )
$$;

-- Students: published events (and staff: all events).
create function public.list_live_events()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_staff boolean := public.current_person_can_manage_live_events();
begin
  if not (v_staff or public.current_person_can_take_tests()) then
    raise exception 'Access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.live_event_view(e, public.current_person_id()) order by e.part_a_starts_at desc)
    from public.live_events e
    where e.status = 'published' or (v_staff and e.status <> 'cancelled')
  ), '[]'::jsonb);
end;
$$;

create function public.get_live_event(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_event public.live_events;
begin
  select * into v_event from public.live_events where key = p_key;
  if v_event.id is null
    or not (
      public.current_person_can_manage_live_events()
      or (v_event.status = 'published' and public.current_person_can_take_tests())
    ) then
    raise exception 'Event not found.' using errcode = '42501';
  end if;
  return public.live_event_view(v_event, public.current_person_id());
end;
$$;

create function public.register_live_event(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_event public.live_events;
  v_person uuid := public.current_person_id();
  v_seq integer;
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  select * into v_event from public.live_events where key = p_key and status = 'published' for update;
  if v_event.id is null then
    raise exception 'Event not found.' using errcode = '42501';
  end if;
  if exists (select 1 from public.live_event_registrations where event_id = v_event.id and person_id = v_person) then
    return public.live_event_view(v_event, v_person);
  end if;
  if now() >= v_event.registration_closes_at then
    raise exception 'Registration has closed.' using errcode = 'DX004';
  end if;
  select count(*) into v_seq from public.live_event_registrations where event_id = v_event.id;
  if v_seq >= v_event.seat_limit then
    raise exception 'All seats are taken.' using errcode = 'DX005';
  end if;
  insert into public.live_event_registrations (event_id, person_id, roll_no)
  values (v_event.id, v_person, upper(left(v_event.key, 6)) || '-' || lpad((v_seq + 1)::text, 5, '0'));
  return public.live_event_view(v_event, v_person);
end;
$$;

-- Registered students: enter Part A once it has started. Questions are released only now, and
-- the deadline is the same for everyone.
create function public.join_live_part_a(p_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_event public.live_events;
  v_person uuid := public.current_person_id();
  v_registration public.live_event_registrations;
  v_attempt uuid;
  v_blueprint jsonb;
  v_exam text;
begin
  select * into v_event from public.live_events where key = p_key and status = 'published';
  select * into v_registration from public.live_event_registrations
    where event_id = v_event.id and person_id = v_person for update;
  if v_event.id is null or v_registration.person_id is null or not public.current_person_can_take_tests() then
    raise exception 'Register for this event first.' using errcode = '42501';
  end if;
  if v_registration.attempt_id is not null then
    return public.assessment_attempt_payload(v_registration.attempt_id);
  end if;
  if now() < v_event.part_a_starts_at then
    raise exception 'Part A has not started yet.' using errcode = 'DX006';
  end if;
  if now() >= v_event.part_a_starts_at + make_interval(mins => v_event.part_a_minutes) then
    raise exception 'Part A has ended.' using errcode = 'DX007';
  end if;
  v_blueprint := public.assessment_blueprint(v_event.blueprint_key);
  v_exam := v_blueprint ->> 'exam';
  insert into public.assessment_attempts (
    person_id, paper_id, exam, kind, title, timed, duration_minutes, objective_count, marking,
    status, started_at, deadline
  )
  values (
    v_person, 'live-' || v_event.key, v_exam, 'live', v_event.title, true, v_event.part_a_minutes,
    (select count(*) from public.live_event_questions where event_id = v_event.id),
    jsonb_build_object(
      'nat', public.assessment_marking(v_exam, 'nat'),
      'msq', public.assessment_marking(v_exam, 'msq'),
      'mcq', public.assessment_marking(v_exam, 'mcq')
    ),
    'in_progress', v_event.part_a_starts_at, v_event.part_a_starts_at + make_interval(mins => v_event.part_a_minutes)
  )
  returning id into v_attempt;
  insert into public.assessment_attempt_questions (attempt_id, question_id, position)
  select v_attempt, question_id, position from public.live_event_questions where event_id = v_event.id;
  update public.live_event_registrations set attempt_id = v_attempt
    where event_id = v_event.id and person_id = v_person;
  return public.assessment_attempt_payload(v_attempt);
end;
$$;

-- Part B of a live event: the event's tasks on the event's clock.
create function public.begin_live_part_b(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_event public.live_events;
  v_b_start timestamptz;
  v_b_end timestamptz;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id() and kind = 'live'
    for update;
  select * into v_event from public.live_events where 'live-' || key = v_attempt.paper_id;
  if v_attempt.id is null or v_event.id is null then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  v_b_start := v_event.part_a_starts_at + make_interval(mins => v_event.part_a_minutes + v_event.break_minutes);
  v_b_end := v_b_start + make_interval(mins => v_event.part_b_minutes);
  if now() < v_b_start then
    raise exception 'Part B starts after the break.' using errcode = 'DX006';
  end if;
  if v_attempt.part_b_status = 'none' then
    if now() >= v_b_end then
      raise exception 'Part B has ended.' using errcode = 'DX007';
    end if;
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
    select v_attempt.id, question_id, position, max_marks from public.live_event_tasks where event_id = v_event.id;
    if not found then
      raise exception 'This event has no Part B.' using errcode = 'P0002';
    end if;
    update public.assessment_attempts
      set part_b_status = 'drawing', part_b_started_at = now(), part_b_deadline = v_b_end,
          part_b_max = (select sum(max_marks) from public.live_event_tasks where event_id = v_event.id)
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$$;

-- After Part A, the participant's score, rank and percentile within the event (Dexam cohort).
create function public.get_live_event_standing(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_event public.live_events;
  v_mine public.assessment_attempts;
  v_total integer;
  v_above integer;
  v_below integer;
begin
  select * into v_event from public.live_events where key = p_key and status = 'published';
  select a.* into v_mine
    from public.live_event_registrations r
    join public.assessment_attempts a on a.id = r.attempt_id
    where r.event_id = v_event.id and r.person_id = public.current_person_id();
  if v_event.id is null or v_mine.id is null then
    raise exception 'Standing not found.' using errcode = '42501';
  end if;
  if now() < v_event.part_a_starts_at + make_interval(mins => v_event.part_a_minutes) then
    raise exception 'Ranks are published after Part A ends.' using errcode = 'DX006';
  end if;
  select count(*),
    count(*) filter (where a.score > coalesce(v_mine.score, 0)),
    count(*) filter (where a.score < coalesce(v_mine.score, 0))
    into v_total, v_above, v_below
    from public.assessment_attempts a
    where a.paper_id = 'live-' || v_event.key and a.kind = 'live' and a.status = 'submitted'
      and not a.submitted_late;
  return jsonb_build_object(
    'attemptId', v_mine.id,
    'submitted', v_mine.status = 'submitted',
    'ranked', v_mine.status = 'submitted' and not v_mine.submitted_late,
    'score', v_mine.score,
    'maxScore', v_mine.max_score,
    'participants', v_total,
    'rank', case when v_mine.status = 'submitted' and not v_mine.submitted_late then v_above + 1 end,
    'percentile', case when v_mine.status = 'submitted' and not v_mine.submitted_late and v_total > 1
      then round(100.0 * v_below / (v_total - 1), 1) end,
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('rollNo', top.roll_no, 'score', top.score) order by top.score desc, top.roll_no)
      from (
        select r.roll_no, a.score
        from public.live_event_registrations r
        join public.assessment_attempts a on a.id = r.attempt_id
        where r.event_id = v_event.id and a.status = 'submitted' and not a.submitted_late
        order by a.score desc, r.roll_no
        limit 10
      ) top
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function
  public.live_event_schedule(public.live_events),
  public.live_event_view(public.live_events, uuid),
  public.current_person_can_manage_live_events(),
  public.create_live_event(text, text, text, timestamptz, timestamptz, integer, integer),
  public.publish_live_event(uuid),
  public.cancel_live_event(uuid),
  public.list_live_events(),
  public.get_live_event(text),
  public.register_live_event(text),
  public.join_live_part_a(text),
  public.begin_live_part_b(uuid),
  public.get_live_event_standing(text)
from public, anon;
revoke all on function public.live_event_view(public.live_events, uuid) from authenticated;
grant execute on function
  public.current_person_can_manage_live_events(),
  public.create_live_event(text, text, text, timestamptz, timestamptz, integer, integer),
  public.publish_live_event(uuid),
  public.cancel_live_event(uuid),
  public.list_live_events(),
  public.get_live_event(text),
  public.register_live_event(text),
  public.join_live_part_a(text),
  public.begin_live_part_b(uuid),
  public.get_live_event_standing(text)
to authenticated;
grant execute on function public.live_event_view(public.live_events, uuid) to service_role;

-- Part B functions now understand live attempts.
create or replace function public.begin_part_b(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_count integer;
  v_total numeric;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if v_attempt.id is null or not public.current_person_can_take_tests() then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.kind = 'live' then
    return public.begin_live_part_b(v_attempt.id);
  end if;
  if v_attempt.kind <> 'paper' or v_attempt.status <> 'submitted' then
    raise exception 'Part B starts after Part A is submitted.' using errcode = '22023';
  end if;
  if v_attempt.part_b_status = 'none' then
    insert into public.assessment_attempt_tasks (attempt_id, question_id, position, max_marks)
    select v_attempt.id, q.id,
      (row_number() over (order by nullif(substring(p.question_no from '[0-9]+'), '')::integer nulls last, p.question_no) - 1)::smallint,
      1
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = v_attempt.paper_id and q.publication_state = 'ready' and q.response_mode = 'upload';
    get diagnostics v_count = row_count;
    if v_count = 0 then
      raise exception 'This paper has no Part B tasks ready yet.' using errcode = 'P0002';
    end if;
    v_total := public.assessment_part_b_total(v_attempt.exam, v_count);
    update public.assessment_attempt_tasks
      set max_marks = round(v_total / v_count, 2)
      where attempt_id = v_attempt.id;
    update public.assessment_attempts
      set part_b_status = 'drawing',
          part_b_started_at = now(),
          part_b_deadline = now() + make_interval(mins => public.assessment_part_b_minutes(v_attempt.exam, v_count)),
          part_b_max = round(v_total / v_count, 2) * v_count
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$$;

create or replace function public.get_part_b(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
  v_owner boolean;
  v_evaluator boolean := public.current_person_can_evaluate_part_b();
  v_status text;
  v_available integer;
begin
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id;
  v_owner := v_attempt.person_id = public.current_person_id() and public.current_person_can_take_tests();
  if v_attempt.id is null or not (coalesce(v_owner, false) or v_evaluator) then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  v_status := public.assessment_part_b_effective_status(v_attempt);
  select count(*) into v_available
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = v_attempt.paper_id and q.publication_state = 'ready' and q.response_mode = 'upload';

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'paperId', v_attempt.paper_id,
    'exam', v_attempt.exam,
    'kind', v_attempt.kind,
    'partAStatus', v_attempt.status,
    'status', v_status,
    'available', case
      when v_attempt.kind = 'paper' then v_available
      when v_attempt.kind = 'live' then (
        select count(*) from public.live_event_tasks t
        join public.live_events e on e.id = t.event_id
        where 'live-' || e.key = v_attempt.paper_id
      )
      else 0
    end,
    'startedAt', v_attempt.part_b_started_at,
    'drawingDeadline', v_attempt.part_b_deadline,
    'uploadDeadline', case
      when v_attempt.upload_deadline is not null then v_attempt.upload_deadline
      when v_attempt.part_b_deadline is not null then v_attempt.part_b_deadline + interval '10 minutes'
    end,
    'submittedAt', v_attempt.part_b_submitted_at,
    'score', case when v_status = 'evaluated' or v_evaluator then v_attempt.part_b_score end,
    'maxScore', v_attempt.part_b_max,
    'reference', 'CAND-' || upper(left(replace(v_attempt.person_id::text, '-', ''), 8)),
    'tasks', coalesce((
      select jsonb_agg(
        public.assessment_question_payload(task.question_id) || jsonb_build_object(
          'maxMarks', task.max_marks,
          'marks', case when v_status = 'evaluated' or v_evaluator then task.marks end,
          'feedback', case when v_status = 'evaluated' or v_evaluator then task.feedback end,
          'uploads', coalesce((
            select jsonb_agg(jsonb_build_object(
              'path', upload.storage_path, 'mimeType', upload.mime_type, 'bytes', upload.byte_size
            ) order by upload.uploaded_at)
            from public.assessment_part_b_uploads upload
            where upload.attempt_id = task.attempt_id and upload.question_id = task.question_id
          ), '[]'::jsonb)
        )
        order by task.position
      )
      from public.assessment_attempt_tasks task
      where task.attempt_id = v_attempt.id
    ), '[]'::jsonb)
  );
end;
$$;

-- Live results are released only after Part A ends.
create or replace function public.get_assessment_attempt_result(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id();
  if v_attempt.id is null or not public.current_person_can_take_tests() then
    raise exception 'Result not found.' using errcode = '42501';
  end if;
  if v_attempt.status <> 'submitted' then
    raise exception 'The result is released after submission.' using errcode = '42501';
  end if;
  -- Live answers stay hidden until Part A ends for everyone.
  if v_attempt.kind = 'live' and exists (
    select 1 from public.live_events e
    where 'live-' || e.key = v_attempt.paper_id
      and now() < e.part_a_starts_at + make_interval(mins => e.part_a_minutes)
  ) then
    raise exception 'Live results are released after Part A ends.' using errcode = 'DX006';
  end if;

  return jsonb_build_object(
    'attemptId', v_attempt.id,
    'kind', v_attempt.kind,
    'title', v_attempt.title,
    'paperId', v_attempt.paper_id,
    'exam', v_attempt.exam,
    'startedAt', v_attempt.started_at,
    'submittedAt', v_attempt.submitted_at,
    'submitReason', v_attempt.submit_reason,
    'late', v_attempt.submitted_late,
    'durationMinutes', v_attempt.duration_minutes,
    'objectiveCount', v_attempt.objective_count,
    'marking', v_attempt.marking,
    'score', v_attempt.score,
    'maxScore', v_attempt.max_score,
    'questions', coalesce((
      select jsonb_agg(
        public.assessment_question_payload(aq.question_id) || jsonb_build_object(
          'response', aq.response,
          'outcome', aq.outcome,
          'marks', aq.marks,
          'key', k.answer,
          'explanation', case when k.explanation_status = 'verified' then k.explanation end,
          'topic', t.slug,
          'topicName', t.name
        )
        order by aq.position
      )
      from public.assessment_attempt_questions aq
      join public.assessment_questions q on q.id = aq.question_id
      left join public.assessment_question_keys k on k.question_id = q.id
      left join public.assessment_topics t on t.id = q.topic_id
      where aq.attempt_id = v_attempt.id
    ), '[]'::jsonb)
  );
end;
$$;
