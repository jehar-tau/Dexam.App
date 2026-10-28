-- F043 Part B drawing and uploads, F048 evaluation (redesign step 7).
-- After Part A, a student starts Part B: the server pins the paper's ready drawing tasks and
-- times the drawing; then a short upload window opens for photos or PDFs of the answer sheets,
-- enforced by the storage policy. Evaluators (Admin for now, interim F048 gate) mark each task
-- without seeing who the candidate is, then release the Part B score.

insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values (
  'assessment.part_b.evaluate',
  'Evaluate and release Part B drawing submissions (candidates stay anonymous).',
  false,
  false
);
insert into public.role_capabilities (role_key, capability_key)
values ('elevated_admin', 'assessment.part_b.evaluate');

alter table public.assessment_attempts
  add column part_b_status text not null default 'none'
    check (part_b_status in ('none', 'drawing', 'uploading', 'submitted', 'evaluated')),
  add column part_b_started_at timestamptz,
  add column part_b_deadline timestamptz,
  add column upload_deadline timestamptz,
  add column part_b_submitted_at timestamptz,
  add column part_b_score numeric(7, 2),
  add column part_b_max numeric(7, 2);

create table public.assessment_attempt_tasks (
  attempt_id uuid not null references public.assessment_attempts (id) on delete cascade,
  question_id uuid not null references public.assessment_questions (id) on delete restrict,
  position smallint not null check (position >= 0),
  max_marks numeric(6, 2) not null check (max_marks > 0),
  marks numeric(6, 2) check (marks >= 0),
  feedback text check (char_length(feedback) <= 4000),
  evaluated_by uuid references public.people (id) on delete set null,
  evaluated_at timestamptz,
  primary key (attempt_id, question_id),
  unique (attempt_id, position),
  check (marks is null or marks <= max_marks)
);

create table public.assessment_part_b_uploads (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null,
  question_id uuid not null,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'application/pdf')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  uploaded_at timestamptz not null default now(),
  foreign key (attempt_id, question_id)
    references public.assessment_attempt_tasks (attempt_id, question_id) on delete cascade
);

create index assessment_part_b_uploads_task on public.assessment_part_b_uploads (attempt_id, question_id);

alter table public.assessment_attempt_tasks enable row level security;
alter table public.assessment_part_b_uploads enable row level security;
revoke all on public.assessment_attempt_tasks, public.assessment_part_b_uploads from public, anon, authenticated;
grant all on public.assessment_attempt_tasks, public.assessment_part_b_uploads to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-part-b',
  'assessment-part-b',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'application/pdf']
);

-- Drawing minutes (interim, from the 2026 blueprint drafts): UCEED 60, CEED 120, others 15 a task.
create function public.assessment_part_b_minutes(p_exam text, p_tasks integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_exam when 'uceed' then 60 when 'ceed' then 120 else greatest(15, 15 * p_tasks) end
$$;

-- Part B total marks: UCEED and CEED 100 across the tasks; others 10 a task (practice).
create function public.assessment_part_b_total(p_exam text, p_tasks integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case when p_exam in ('uceed', 'ceed') then 100 else 10 * p_tasks end::numeric
$$;

-- Status as of now: drawing ends at its deadline, the upload window closes on its own.
create function public.assessment_part_b_effective_status(p_attempt public.assessment_attempts)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when p_attempt.part_b_status = 'drawing' and now() > p_attempt.part_b_deadline
      then case when now() > p_attempt.part_b_deadline + interval '10 minutes' then 'submitted' else 'uploading' end
    when p_attempt.part_b_status = 'uploading' and now() > p_attempt.upload_deadline then 'submitted'
    else p_attempt.part_b_status
  end
$$;

create function public.current_person_can_evaluate_part_b()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select public.current_person_has_capability('assessment.part_b.evaluate')
$$;

-- Upload paths are <attempt id>/<question id>/<random>.<ext>, written by the attempt's owner
-- while its upload window is open, at most five files per task.
create function public.current_person_can_upload_part_b(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_parts text[] := string_to_array(p_object_name, '/');
  v_attempt public.assessment_attempts;
  v_status text;
begin
  if cardinality(v_parts) <> 3
    or v_parts[1] !~ '^[0-9a-f-]{36}$'
    or v_parts[2] !~ '^[0-9a-f-]{36}$'
    or v_parts[3] !~ '^[0-9a-f-]{36}\.(jpe?g|png|pdf)$' then
    return false;
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = v_parts[1]::uuid and person_id = public.current_person_id();
  if v_attempt.id is null or not public.current_person_can_take_tests() then
    return false;
  end if;
  v_status := public.assessment_part_b_effective_status(v_attempt);
  return v_status in ('drawing', 'uploading')
    and exists (
      select 1 from public.assessment_attempt_tasks
      where attempt_id = v_attempt.id and question_id = v_parts[2]::uuid
    )
    and (
      select count(*) from public.assessment_part_b_uploads
      where attempt_id = v_attempt.id and question_id = v_parts[2]::uuid
    ) < 5;
end;
$$;

create function public.current_person_can_read_part_b_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_can_evaluate_part_b()
    or exists (
      select 1
      from public.assessment_part_b_uploads upload
      join public.assessment_attempts attempt on attempt.id = upload.attempt_id
      where upload.storage_path = p_object_name and attempt.person_id = public.current_person_id()
    ),
    false
  )
$$;

revoke all on function
  public.assessment_part_b_minutes(text, integer),
  public.assessment_part_b_total(text, integer),
  public.assessment_part_b_effective_status(public.assessment_attempts),
  public.current_person_can_evaluate_part_b(),
  public.current_person_can_upload_part_b(text),
  public.current_person_can_read_part_b_object(text)
from public, anon;
grant execute on function
  public.current_person_can_evaluate_part_b(),
  public.current_person_can_upload_part_b(text),
  public.current_person_can_read_part_b_object(text)
to authenticated;
grant execute on function
  public.assessment_part_b_minutes(text, integer),
  public.assessment_part_b_total(text, integer),
  public.assessment_part_b_effective_status(public.assessment_attempts)
to service_role;

create policy assessment_part_b_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'assessment-part-b' and public.current_person_can_upload_part_b(name));
create policy assessment_part_b_read on storage.objects
  for select to authenticated
  using (bucket_id = 'assessment-part-b' and public.current_person_can_read_part_b_object(name));

-- The Part B view of an attempt, for its owner or an evaluator. Marks and feedback reach the
-- owner only after release; evaluators never see who the candidate is.
create function public.get_part_b(p_attempt_id uuid)
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
    'available', case when v_attempt.kind = 'paper' then v_available else 0 end,
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

-- Starts Part B after a submitted Part A: pins the paper's ready drawing tasks and the clock.
create function public.begin_part_b(p_attempt_id uuid)
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

-- The student has finished drawing: open the 10-minute upload window now.
create function public.start_part_b_upload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if v_attempt.id is null or not public.current_person_can_take_tests() then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.part_b_status = 'drawing' then
    update public.assessment_attempts
      set part_b_status = 'uploading',
          upload_deadline = least(now(), part_b_deadline) + interval '10 minutes'
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$$;

-- Records a file the student uploaded (the storage policy already checked path and window).
create function public.register_part_b_upload(
  p_attempt_id uuid,
  p_question_id uuid,
  p_storage_path text,
  p_mime_type text,
  p_byte_size integer
)
returns void
language plpgsql
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
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if public.assessment_part_b_effective_status(v_attempt) not in ('drawing', 'uploading') then
    raise exception 'The upload window has closed.' using errcode = 'DX002';
  end if;
  if p_storage_path is null
    or split_part(p_storage_path, '/', 1) <> p_attempt_id::text
    or split_part(p_storage_path, '/', 2) <> p_question_id::text
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'assessment-part-b' and name = p_storage_path
    ) then
    raise exception 'Upload not found.' using errcode = '22023';
  end if;
  insert into public.assessment_part_b_uploads (attempt_id, question_id, storage_path, mime_type, byte_size)
  values (p_attempt_id, p_question_id, p_storage_path, p_mime_type, p_byte_size)
  on conflict (storage_path) do nothing;
end;
$$;

create function public.submit_part_b(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  select * into v_attempt from public.assessment_attempts
    where id = p_attempt_id and person_id = public.current_person_id()
    for update;
  if v_attempt.id is null or not public.current_person_can_take_tests() then
    raise exception 'Attempt not found.' using errcode = '42501';
  end if;
  if v_attempt.part_b_status in ('drawing', 'uploading') then
    update public.assessment_attempts
      set part_b_status = 'submitted', part_b_submitted_at = now()
      where id = v_attempt.id;
  end if;
  return public.get_part_b(p_attempt_id);
end;
$$;

-- The student's own Part B sittings, newest first.
create function public.list_my_part_b()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.get_part_b(a.id) order by a.part_b_started_at desc)
    from public.assessment_attempts a
    where a.person_id = public.current_person_id() and a.part_b_status <> 'none'
  ), '[]'::jsonb);
end;
$$;

-- Evaluator queue: submitted (or closed) Part B sittings, oldest first, without identities.
create function public.list_part_b_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_evaluate_part_b() then
    raise exception 'Evaluator access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'attemptId', a.id,
      'paperId', a.paper_id,
      'exam', a.exam,
      'status', public.assessment_part_b_effective_status(a),
      'submittedAt', coalesce(a.part_b_submitted_at, a.upload_deadline, a.part_b_deadline + interval '10 minutes'),
      'reference', 'CAND-' || upper(left(replace(a.person_id::text, '-', ''), 8)),
      'tasks', (select count(*) from public.assessment_attempt_tasks t where t.attempt_id = a.id),
      'marked', (select count(*) from public.assessment_attempt_tasks t where t.attempt_id = a.id and t.marks is not null),
      'uploads', (select count(*) from public.assessment_part_b_uploads u where u.attempt_id = a.id)
    ) order by coalesce(a.part_b_submitted_at, a.upload_deadline, a.part_b_deadline))
    from public.assessment_attempts a
    where public.assessment_part_b_effective_status(a) in ('submitted', 'evaluated')
  ), '[]'::jsonb);
end;
$$;

create function public.save_part_b_evaluation(
  p_attempt_id uuid,
  p_question_id uuid,
  p_marks numeric,
  p_feedback text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_evaluate_part_b() then
    raise exception 'Evaluator access is required.' using errcode = '42501';
  end if;
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id for update;
  if v_attempt.id is null or public.assessment_part_b_effective_status(v_attempt) <> 'submitted' then
    raise exception 'Only submitted Part B work can be marked.' using errcode = '22023';
  end if;
  update public.assessment_attempt_tasks
    set marks = p_marks,
        feedback = nullif(btrim(p_feedback), ''),
        evaluated_by = public.current_person_id(),
        evaluated_at = now()
    where attempt_id = p_attempt_id and question_id = p_question_id
      and p_marks is not null and p_marks >= 0 and p_marks <= max_marks;
  if not found then
    raise exception 'Marks must be between 0 and the task maximum.' using errcode = '22023';
  end if;
end;
$$;

create function public.release_part_b(p_attempt_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_attempt public.assessment_attempts;
begin
  if not public.current_person_can_evaluate_part_b() then
    raise exception 'Evaluator access is required.' using errcode = '42501';
  end if;
  select * into v_attempt from public.assessment_attempts where id = p_attempt_id for update;
  if v_attempt.id is null or public.assessment_part_b_effective_status(v_attempt) <> 'submitted' then
    raise exception 'Only submitted Part B work can be released.' using errcode = '22023';
  end if;
  if exists (select 1 from public.assessment_attempt_tasks where attempt_id = p_attempt_id and marks is null) then
    raise exception 'Mark every task before releasing.' using errcode = '22023';
  end if;
  update public.assessment_attempts
    set part_b_status = 'evaluated',
        part_b_submitted_at = coalesce(part_b_submitted_at, now()),
        part_b_score = (select sum(marks) from public.assessment_attempt_tasks where attempt_id = p_attempt_id)
    where id = p_attempt_id;
end;
$$;

revoke all on function
  public.get_part_b(uuid),
  public.begin_part_b(uuid),
  public.start_part_b_upload(uuid),
  public.register_part_b_upload(uuid, uuid, text, text, integer),
  public.submit_part_b(uuid),
  public.list_my_part_b(),
  public.list_part_b_queue(),
  public.save_part_b_evaluation(uuid, uuid, numeric, text),
  public.release_part_b(uuid)
from public, anon;
grant execute on function
  public.get_part_b(uuid),
  public.begin_part_b(uuid),
  public.start_part_b_upload(uuid),
  public.register_part_b_upload(uuid, uuid, text, text, integer),
  public.submit_part_b(uuid),
  public.list_my_part_b(),
  public.list_part_b_queue(),
  public.save_part_b_evaluation(uuid, uuid, numeric, text),
  public.release_part_b(uuid)
to authenticated;

-- Evaluators may read the figures of the tasks they mark (Part B prompts reference figures).
create or replace function public.current_person_can_read_assessment_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_capability('assessment.bank.read')
    or public.current_person_can_evaluate_part_b()
    or (
      public.current_person_can_take_tests()
      and exists (
        select 1
        from public.assessment_question_assets asset
        join public.assessment_questions question on question.id = asset.question_id
        where asset.storage_path = p_object_name
          and asset.role in ('figure', 'option')
          and (
            (question.publication_state = 'ready')
            or exists (
              select 1
              from public.assessment_attempt_questions aq
              join public.assessment_attempts a on a.id = aq.attempt_id
              where aq.question_id = question.id and a.person_id = public.current_person_id()
            )
            or exists (
              select 1
              from public.assessment_attempt_tasks t
              join public.assessment_attempts a on a.id = t.attempt_id
              where t.question_id = question.id and a.person_id = public.current_person_id()
            )
          )
      )
    ),
    false
  )
$$;
