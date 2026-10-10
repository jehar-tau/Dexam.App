insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values
  (
    'feedback.review',
    'Review submitted work and prepare or publish feedback within an authorized teaching scope.',
    false,
    false
  ),
  (
    'feedback.ai_assist',
    'Manually request bounded transcription, proofreading, or rubric-grounded feedback assistance.',
    false,
    false
  );

create type public.feedback_revision_status as enum ('draft', 'published');
create type public.feedback_source_kind as enum (
  'human',
  'dictation_assisted',
  'ai_proofread',
  'ai_generated',
  'mixed'
);
create type public.feedback_outcome as enum ('review_completed', 'correction_requested');
create type public.feedback_audio_kind as enum ('voice_note', 'dictation_temp');
create type public.feedback_audio_status as enum ('pending', 'ready');
create type public.feedback_assistance_kind as enum ('transcription', 'proofread', 'rubric_draft');
create type public.feedback_assistance_status as enum (
  'queued',
  'processing',
  'ready',
  'accepted',
  'rejected',
  'failed',
  'cancelled'
);
create type public.feedback_batch_status as enum (
  'queued',
  'processing',
  'partially_completed',
  'ready_for_review',
  'failed',
  'cancelled'
);
create type public.feedback_provider_mode as enum ('disabled', 'fictional', 'external');

create table public.feedback_provider_activations (
  capability public.feedback_assistance_kind primary key,
  mode public.feedback_provider_mode not null default 'disabled',
  provider_key text,
  model_config text,
  processing_region text,
  monthly_budget_paise bigint not null default 0,
  activated_by_person_id uuid references public.people (id) on delete restrict,
  activated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint feedback_provider_budget_nonnegative check (monthly_budget_paise >= 0),
  constraint feedback_provider_activation_consistent check (
    (
      mode = 'disabled'
      and provider_key is null and model_config is null and processing_region is null
      and monthly_budget_paise = 0 and activated_by_person_id is null and activated_at is null
    )
    or (
      mode = 'fictional'
      and provider_key = 'deterministic-fixture'
      and model_config is not null
      and monthly_budget_paise = 0
    )
    or (
      mode = 'external'
      and provider_key is not null and model_config is not null
      and processing_region is not null and monthly_budget_paise > 0
      and activated_by_person_id is not null and activated_at is not null
    )
  )
);

insert into public.feedback_provider_activations (capability)
values ('transcription'), ('proofread'), ('rubric_draft');

create table public.feedback_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_attempt_id uuid not null references public.submission_attempts (id) on delete restrict,
  assignment_version_id uuid not null references public.assignment_versions (id) on delete restrict,
  revision_number integer not null,
  status public.feedback_revision_status not null default 'draft',
  written_text text not null default '',
  source_kind public.feedback_source_kind not null default 'human',
  voice_equivalent_confirmed boolean not null default false,
  ai_assisted boolean not null default false,
  outcome public.feedback_outcome,
  correction_reason text,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  updated_by_person_id uuid not null references public.people (id) on delete restrict,
  published_by_person_id uuid references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint feedback_revision_number_positive check (revision_number > 0),
  constraint feedback_revision_attempt_number_unique unique (submission_attempt_id, revision_number),
  constraint feedback_revision_text_length check (length(written_text) <= 10000),
  constraint feedback_revision_correction_reason_length check (
    correction_reason is null or length(btrim(correction_reason)) between 3 and 500
  ),
  constraint feedback_revision_lifecycle_consistent check (
    (
      status = 'draft'
      and outcome is null and correction_reason is null
      and published_by_person_id is null and published_at is null
    )
    or (
      status = 'published'
      and outcome is not null and published_by_person_id is not null and published_at is not null
      and length(btrim(written_text)) between 3 and 10000
      and (
        (outcome = 'review_completed' and correction_reason is null)
        or (outcome = 'correction_requested' and correction_reason is not null)
      )
    )
  )
);

create unique index feedback_revisions_one_draft_per_attempt
  on public.feedback_revisions (submission_attempt_id)
  where status = 'draft';

create table public.feedback_audio_files (
  id uuid primary key default gen_random_uuid(),
  feedback_revision_id uuid not null references public.feedback_revisions (id) on delete restrict,
  kind public.feedback_audio_kind not null,
  object_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  duration_seconds numeric(7, 2) not null,
  status public.feedback_audio_status not null default 'pending',
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  expires_at timestamptz,
  purged_at timestamptz,
  constraint feedback_audio_revision_kind_unique unique (feedback_revision_id, kind),
  constraint feedback_audio_name_present check (
    length(btrim(original_file_name)) between 1 and 180
  ),
  constraint feedback_audio_mime_allowed check (
    mime_type in ('audio/webm', 'audio/mpeg', 'audio/mp4')
  ),
  constraint feedback_audio_size_allowed check (byte_size between 1 and 10485760),
  constraint feedback_audio_duration_allowed check (duration_seconds > 0 and duration_seconds <= 300),
  constraint feedback_audio_ready_consistent check (
    (status = 'pending' and ready_at is null)
    or (status = 'ready' and ready_at is not null)
  ),
  constraint feedback_audio_expiry_consistent check (
    (kind = 'voice_note' and expires_at is null)
    or kind = 'dictation_temp'
  )
);

create table public.feedback_assistance_requests (
  id uuid primary key default gen_random_uuid(),
  feedback_revision_id uuid not null references public.feedback_revisions (id) on delete restrict,
  audio_file_id uuid references public.feedback_audio_files (id) on delete set null,
  kind public.feedback_assistance_kind not null,
  status public.feedback_assistance_status not null default 'queued',
  input_text text,
  output_text text,
  provider_key text not null,
  model_config text not null,
  external_processing boolean not null default false,
  usage_units bigint,
  error_code text,
  requested_by_person_id uuid not null references public.people (id) on delete restrict,
  reviewed_by_person_id uuid references public.people (id) on delete restrict,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  reviewed_at timestamptz,
  constraint feedback_assistance_input_length check (
    input_text is null or length(input_text) between 1 and 10000
  ),
  constraint feedback_assistance_output_length check (
    output_text is null or length(output_text) between 1 and 10000
  ),
  constraint feedback_assistance_usage_nonnegative check (usage_units is null or usage_units >= 0),
  constraint feedback_assistance_kind_input_consistent check (
    (kind = 'transcription' and audio_file_id is not null and input_text is null)
    or (kind = 'proofread' and audio_file_id is null and input_text is not null)
    or (kind = 'rubric_draft' and audio_file_id is null)
  ),
  constraint feedback_assistance_result_consistent check (
    (
      status in ('queued', 'processing')
      and output_text is null and error_code is null and resolved_at is null
      and reviewed_by_person_id is null and reviewed_at is null
    )
    or (
      status = 'ready'
      and output_text is not null and error_code is null and resolved_at is not null
      and reviewed_by_person_id is null and reviewed_at is null
    )
    or (
      status in ('accepted', 'rejected')
      and output_text is not null and error_code is null and resolved_at is not null
      and reviewed_by_person_id is not null and reviewed_at is not null
    )
    or (
      status in ('failed', 'cancelled')
      and output_text is null and resolved_at is not null
      and reviewed_by_person_id is null and reviewed_at is null
    )
  )
);

create table public.feedback_ai_batches (
  id uuid primary key default gen_random_uuid(),
  assignment_version_id uuid not null references public.assignment_versions (id) on delete restrict,
  offering_id uuid not null references public.offerings (id) on delete restrict,
  status public.feedback_batch_status not null default 'queued',
  request_key uuid not null,
  provider_key text not null,
  model_config text not null,
  external_processing boolean not null default false,
  requested_by_person_id uuid not null references public.people (id) on delete restrict,
  requested_at timestamptz not null default now(),
  finished_at timestamptz,
  constraint feedback_ai_batch_request_unique unique (requested_by_person_id, request_key),
  constraint feedback_ai_batch_finish_consistent check (
    (status in ('queued', 'processing') and finished_at is null)
    or (status in ('partially_completed', 'ready_for_review', 'failed', 'cancelled') and finished_at is not null)
  )
);

create table public.feedback_ai_batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.feedback_ai_batches (id) on delete restrict,
  submission_attempt_id uuid not null references public.submission_attempts (id) on delete restrict,
  feedback_revision_id uuid references public.feedback_revisions (id) on delete restrict,
  status public.feedback_assistance_status not null default 'queued',
  output_text text,
  error_code text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint feedback_ai_batch_attempt_unique unique (batch_id, submission_attempt_id),
  constraint feedback_ai_batch_output_length check (
    output_text is null or length(output_text) between 1 and 10000
  ),
  constraint feedback_ai_batch_item_result_consistent check (
    (status in ('queued', 'processing') and output_text is null and error_code is null and resolved_at is null)
    or (status = 'ready' and output_text is not null and error_code is null and resolved_at is not null)
    or (status in ('failed', 'cancelled') and output_text is null and resolved_at is not null)
    or (
      status in ('accepted', 'rejected')
      and output_text is not null and error_code is null and resolved_at is not null
      and feedback_revision_id is not null
    )
  )
);

create index feedback_revisions_attempt_idx
  on public.feedback_revisions (submission_attempt_id, revision_number desc);
create index feedback_audio_revision_idx
  on public.feedback_audio_files (feedback_revision_id, kind);
create index feedback_audio_cleanup_idx
  on public.feedback_audio_files (expires_at, created_at)
  where purged_at is null;
create index feedback_assistance_revision_idx
  on public.feedback_assistance_requests (feedback_revision_id, requested_at desc);
create index feedback_ai_batch_assignment_idx
  on public.feedback_ai_batches (assignment_version_id, requested_at desc);
create index feedback_ai_batch_items_batch_idx
  on public.feedback_ai_batch_items (batch_id, status);

create or replace function public.current_person_can_review_feedback_instance(
  p_assignment_instance_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.student_assignment_instances i
    join public.assignment_releases r on r.id = i.assignment_release_id
    where i.id = p_assignment_instance_id
      and public.current_person_is_assignment_teacher(r.offering_id)
      and (
        public.current_person_has_capability('feedback.review')
        or public.current_person_has_capability('feedback.review', 'offering', r.offering_id)
      )
  ), false)
$$;

create or replace function public.current_person_can_use_feedback_ai(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_is_assignment_teacher(p_offering_id)
    and (
      public.current_person_has_capability('feedback.ai_assist')
      or public.current_person_has_capability('feedback.ai_assist', 'offering', p_offering_id)
    ),
    false
  )
$$;

create or replace function public.current_person_can_review_feedback_revision(
  p_feedback_revision_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.feedback_revisions f
    join public.submission_attempts a on a.id = f.submission_attempt_id
    where f.id = p_feedback_revision_id
      and public.current_person_can_review_feedback_instance(a.assignment_instance_id)
  ), false)
$$;

create or replace function public.current_person_can_read_published_feedback_revision(
  p_feedback_revision_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.feedback_revisions f
    join public.submission_attempts a on a.id = f.submission_attempt_id
    where f.id = p_feedback_revision_id
      and f.status = 'published'
      and public.current_person_can_access_assignment_instance(a.assignment_instance_id)
  ), false)
$$;

create or replace function public.feedback_provider_ready(p_capability public.feedback_assistance_kind)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce((
    select mode <> 'disabled'
    from public.feedback_provider_activations
    where capability = p_capability
  ), false)
$$;

create or replace function public.list_feedback_review_queue()
returns table (
  assignment_instance_id uuid,
  submission_attempt_id uuid,
  member_id text,
  display_name text,
  assignment_title text,
  assignment_group text,
  submitted_at timestamptz,
  submission_file_count bigint,
  feedback_revision_id uuid,
  feedback_status public.feedback_revision_status,
  written_text text,
  source_kind public.feedback_source_kind,
  voice_equivalent_confirmed boolean,
  ai_assisted boolean,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    i.id,
    a.id,
    p.member_id,
    p.display_name,
    v.title,
    v.group_name,
    a.submitted_at,
    (select count(*) from public.submission_files sf where sf.submission_attempt_id = a.id and sf.purged_at is null),
    f.id,
    f.status,
    f.written_text,
    f.source_kind,
    f.voice_equivalent_confirmed,
    f.ai_assisted,
    f.published_at
  from public.submission_attempts a
  join public.student_assignment_instances i on i.id = a.assignment_instance_id
  join public.assignment_releases r on r.id = i.assignment_release_id
  join public.assignment_versions v on v.id = r.assignment_version_id
  join public.enrollments e on e.id = i.enrollment_id
  join public.people p on p.id = e.person_id
  left join lateral (
    select fr.*
    from public.feedback_revisions fr
    where fr.submission_attempt_id = a.id
    order by fr.revision_number desc
    limit 1
  ) f on true
  where a.status = 'submitted'
    and i.status = 'submitted'
    and public.current_person_can_review_feedback_instance(i.id)
  order by a.submitted_at asc, p.member_id
$$;

create or replace function public.start_feedback_draft(p_submission_attempt_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_attempt public.submission_attempts%rowtype;
  target_instance public.student_assignment_instances%rowtype;
  target_assignment_version_id uuid;
  existing_draft_id uuid;
  next_revision integer;
  new_revision_id uuid;
  actor_id uuid := public.current_person_id();
begin
  select * into target_attempt from public.submission_attempts
  where id = p_submission_attempt_id for update;
  select * into target_instance from public.student_assignment_instances
  where id = target_attempt.assignment_instance_id for update;
  select r.assignment_version_id into target_assignment_version_id
  from public.assignment_releases r where r.id = target_instance.assignment_release_id;

  if target_attempt.id is null
    or target_attempt.status <> 'submitted'
    or target_instance.status <> 'submitted'
    or not public.current_person_can_review_feedback_instance(target_instance.id)
  then
    raise exception using errcode = '42501', message = 'feedback review access denied';
  end if;

  select id into existing_draft_id from public.feedback_revisions
  where submission_attempt_id = target_attempt.id and status = 'draft';
  if existing_draft_id is not null then return existing_draft_id; end if;

  select coalesce(max(revision_number), 0) + 1 into next_revision
  from public.feedback_revisions where submission_attempt_id = target_attempt.id;

  insert into public.feedback_revisions (
    submission_attempt_id, assignment_version_id, revision_number,
    created_by_person_id, updated_by_person_id
  ) values (
    target_attempt.id, target_assignment_version_id, next_revision, actor_id, actor_id
  ) returning id into new_revision_id;

  return new_revision_id;
end;
$$;

create or replace function public.save_feedback_draft(
  p_feedback_revision_id uuid,
  p_written_text text,
  p_source_kind public.feedback_source_kind,
  p_voice_equivalent_confirmed boolean
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_revision public.feedback_revisions%rowtype;
begin
  select * into target_revision from public.feedback_revisions
  where id = p_feedback_revision_id for update;

  if target_revision.id is null
    or target_revision.status <> 'draft'
    or not public.current_person_can_review_feedback_revision(target_revision.id)
  then
    raise exception using errcode = '42501', message = 'feedback draft access denied';
  end if;
  if length(coalesce(p_written_text, '')) > 10000 then
    raise exception using errcode = '22023', message = 'feedback writing must be at most 10000 characters';
  end if;

  update public.feedback_revisions
  set written_text = coalesce(p_written_text, ''),
      source_kind = p_source_kind,
      voice_equivalent_confirmed = coalesce(p_voice_equivalent_confirmed, false),
      updated_by_person_id = public.current_person_id(),
      updated_at = now()
  where id = target_revision.id;
end;
$$;

create or replace function public.publish_feedback_revision(
  p_feedback_revision_id uuid,
  p_outcome public.feedback_outcome,
  p_correction_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_revision public.feedback_revisions%rowtype;
  target_attempt public.submission_attempts%rowtype;
  target_instance public.student_assignment_instances%rowtype;
  actor_id uuid := public.current_person_id();
  published_at_value timestamptz := now();
begin
  select * into target_revision from public.feedback_revisions
  where id = p_feedback_revision_id for update;
  select * into target_attempt from public.submission_attempts
  where id = target_revision.submission_attempt_id;
  select * into target_instance from public.student_assignment_instances
  where id = target_attempt.assignment_instance_id for update;

  if target_revision.id is null
    or target_revision.status <> 'draft'
    or not public.current_person_can_review_feedback_revision(target_revision.id)
  then
    raise exception using errcode = '42501', message = 'feedback publication access denied';
  end if;
  if target_instance.status <> 'submitted' then
    raise exception using errcode = '23514', message = 'only submitted work can receive a new published review';
  end if;
  if length(btrim(target_revision.written_text)) not between 3 and 10000 then
    raise exception using errcode = '23514', message = 'student-visible writing is required before publication';
  end if;
  if exists (
    select 1 from public.feedback_audio_files af
    where af.feedback_revision_id = target_revision.id
      and af.kind = 'voice_note' and af.purged_at is null
      and af.status <> 'ready'
  ) then
    raise exception using errcode = '23514', message = 'the voice note must finish uploading before publication';
  end if;
  if exists (
    select 1 from public.feedback_audio_files af
    where af.feedback_revision_id = target_revision.id
      and af.kind = 'voice_note' and af.status = 'ready' and af.purged_at is null
  ) and not target_revision.voice_equivalent_confirmed then
    raise exception using errcode = '23514', message = 'confirm the accessible written equivalent before publishing audio';
  end if;
  if p_outcome = 'correction_requested'
    and length(btrim(coalesce(p_correction_reason, ''))) not between 3 and 500
  then
    raise exception using errcode = '22023', message = 'a correction reason between 3 and 500 characters is required';
  end if;
  if p_outcome = 'review_completed' and p_correction_reason is not null then
    raise exception using errcode = '22023', message = 'completed feedback cannot include a correction reason';
  end if;

  update public.feedback_revisions
  set status = 'published', outcome = p_outcome,
      correction_reason = case when p_outcome = 'correction_requested' then btrim(p_correction_reason) else null end,
      published_by_person_id = actor_id, published_at = published_at_value,
      updated_by_person_id = actor_id, updated_at = published_at_value
  where id = target_revision.id;

  insert into public.student_assignment_transitions (
    assignment_instance_id, from_status, to_status, actor_person_id, reason_code, reason_detail
  ) values (
    target_instance.id,
    target_instance.status,
    p_outcome::text::public.student_assignment_status,
    actor_id,
    case when p_outcome = 'correction_requested' then 'feedback_correction_requested' else 'feedback_review_completed' end,
    case when p_outcome = 'correction_requested' then btrim(p_correction_reason) else null end
  );

  update public.student_assignment_instances
  set status = p_outcome::text::public.student_assignment_status, updated_at = published_at_value
  where id = target_instance.id;

  insert into public.security_audit_events (
    subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata
  )
  select e.person_id, actor_id, 'feedback_published', 'succeeded', p_outcome::text,
    jsonb_build_object(
      'feedback_revision_id', target_revision.id,
      'submission_attempt_id', target_attempt.id,
      'assignment_instance_id', target_instance.id,
      'ai_assisted', target_revision.ai_assisted
    )
  from public.enrollments e where e.id = target_instance.enrollment_id;
end;
$$;

create or replace function public.reserve_feedback_audio_file(
  p_feedback_revision_id uuid,
  p_kind public.feedback_audio_kind,
  p_original_file_name text,
  p_mime_type text,
  p_byte_size bigint,
  p_duration_seconds numeric
)
returns table (file_id uuid, object_path text)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_revision public.feedback_revisions%rowtype;
  extension text;
  new_file_id uuid := gen_random_uuid();
  new_object_path text;
begin
  select * into target_revision from public.feedback_revisions
  where id = p_feedback_revision_id for update;

  if target_revision.id is null
    or target_revision.status <> 'draft'
    or not public.current_person_can_review_feedback_revision(target_revision.id)
  then
    raise exception using errcode = '42501', message = 'feedback audio access denied';
  end if;
  if length(btrim(coalesce(p_original_file_name, ''))) not between 1 and 180
    or p_byte_size not between 1 and 10485760
    or p_duration_seconds <= 0 or p_duration_seconds > 300
  then
    raise exception using errcode = '22023', message = 'feedback audio metadata is invalid';
  end if;

  extension := case p_mime_type
    when 'audio/webm' then 'webm'
    when 'audio/mpeg' then 'mp3'
    when 'audio/mp4' then 'm4a'
    else null
  end;
  if extension is null then
    raise exception using errcode = '22023', message = 'feedback audio type is not allowed';
  end if;
  if exists (
    select 1 from public.feedback_audio_files
    where feedback_revision_id = target_revision.id and kind = p_kind and purged_at is null
  ) then
    raise exception using errcode = '23505', message = 'replace the existing feedback audio before uploading another';
  end if;

  new_object_path := target_revision.id::text || '/' || new_file_id::text || '.' || extension;
  insert into public.feedback_audio_files (
    id, feedback_revision_id, kind, object_path, original_file_name,
    mime_type, byte_size, duration_seconds, expires_at
  ) values (
    new_file_id, target_revision.id, p_kind, new_object_path, btrim(p_original_file_name),
    p_mime_type, p_byte_size, p_duration_seconds,
    case when p_kind = 'dictation_temp' then now() + interval '24 hours' else null end
  );

  return query select new_file_id, new_object_path;
end;
$$;

create or replace function public.complete_feedback_audio_file_upload(p_feedback_audio_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_file public.feedback_audio_files%rowtype;
begin
  select * into target_file from public.feedback_audio_files
  where id = p_feedback_audio_file_id for update;
  if target_file.id is null or target_file.status <> 'pending' then
    raise exception using errcode = '23514', message = 'feedback audio is not pending';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'teacher-feedback-audio'
      and o.name = target_file.object_path
      and o.archived_at is null
      and o.metadata ->> 'mimetype' = target_file.mime_type
      and (o.metadata ->> 'size')::bigint = target_file.byte_size
  ) then
    raise exception using errcode = '23514', message = 'verified private audio object is missing';
  end if;
  update public.feedback_audio_files
  set status = 'ready', ready_at = now()
  where id = target_file.id;
end;
$$;

create or replace function public.feedback_audio_removal_target(p_feedback_audio_file_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_path text;
  target_revision_id uuid;
  target_revision_status public.feedback_revision_status;
begin
  select af.object_path, af.feedback_revision_id, fr.status
  into target_path, target_revision_id, target_revision_status
  from public.feedback_audio_files af
  join public.feedback_revisions fr on fr.id = af.feedback_revision_id
  where af.id = p_feedback_audio_file_id and af.purged_at is null;
  if target_path is null or target_revision_status <> 'draft'
    or not public.current_person_can_review_feedback_revision(target_revision_id)
  then
    raise exception using errcode = '42501', message = 'feedback audio removal denied';
  end if;
  return target_path;
end;
$$;

create or replace function public.complete_feedback_audio_file_removal(p_feedback_audio_file_id uuid)
returns void
language sql
security definer
set search_path = ''
set row_security = off
as $$
  delete from public.feedback_audio_files af
  using public.feedback_revisions fr
  where af.id = p_feedback_audio_file_id
    and fr.id = af.feedback_revision_id and fr.status = 'draft'
$$;

create or replace function public.request_feedback_assistance(
  p_feedback_revision_id uuid,
  p_kind public.feedback_assistance_kind,
  p_audio_file_id uuid,
  p_input_text text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_revision public.feedback_revisions%rowtype;
  target_activation public.feedback_provider_activations%rowtype;
  target_audio public.feedback_audio_files%rowtype;
  new_request_id uuid;
begin
  if p_kind not in ('transcription', 'proofread') then
    raise exception using errcode = '22023', message = 'use a bounded batch for rubric-grounded assistance';
  end if;
  select * into target_revision from public.feedback_revisions where id = p_feedback_revision_id for update;
  if target_revision.id is null or target_revision.status <> 'draft'
    or not public.current_person_can_review_feedback_revision(target_revision.id)
  then
    raise exception using errcode = '42501', message = 'feedback assistance access denied';
  end if;
  select * into target_activation from public.feedback_provider_activations where capability = p_kind;
  if target_activation.mode = 'disabled' then
    raise exception using errcode = '55000', message = 'external feedback processing is not activated';
  end if;

  if p_kind = 'transcription' then
    select * into target_audio from public.feedback_audio_files where id = p_audio_file_id;
    if target_audio.id is null or target_audio.feedback_revision_id <> target_revision.id
      or target_audio.kind <> 'dictation_temp' or target_audio.status <> 'ready'
      or target_audio.purged_at is not null or p_input_text is not null
    then
      raise exception using errcode = '22023', message = 'a ready temporary dictation recording is required';
    end if;
  elsif length(coalesce(p_input_text, '')) not between 1 and 10000 or p_audio_file_id is not null then
    raise exception using errcode = '22023', message = 'proofreading requires the current written draft';
  end if;

  insert into public.feedback_assistance_requests (
    feedback_revision_id, audio_file_id, kind, input_text,
    provider_key, model_config, external_processing, requested_by_person_id
  ) values (
    target_revision.id, p_audio_file_id, p_kind, p_input_text,
    target_activation.provider_key, target_activation.model_config,
    target_activation.mode = 'external', public.current_person_id()
  ) returning id into new_request_id;
  return new_request_id;
end;
$$;

create or replace function public.complete_feedback_assistance(
  p_feedback_assistance_id uuid,
  p_output_text text,
  p_error_code text,
  p_usage_units bigint
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_output_text is not null and p_error_code is not null then
    raise exception using errcode = '22023', message = 'assistance cannot succeed and fail together';
  end if;
  if p_output_text is null and p_error_code is null then
    raise exception using errcode = '22023', message = 'assistance completion requires output or an error';
  end if;
  update public.feedback_assistance_requests
  set status = case
        when p_output_text is not null then 'ready'::public.feedback_assistance_status
        else 'failed'::public.feedback_assistance_status
      end,
      output_text = p_output_text,
      error_code = p_error_code,
      usage_units = p_usage_units,
      resolved_at = now()
  where id = p_feedback_assistance_id and status in ('queued', 'processing');
  if not found then
    raise exception using errcode = '23514', message = 'feedback assistance is not awaiting completion';
  end if;
end;
$$;

create or replace function public.review_feedback_assistance(
  p_feedback_assistance_id uuid,
  p_accept boolean,
  p_edited_text text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_request public.feedback_assistance_requests%rowtype;
  accepted_text text;
begin
  select * into target_request from public.feedback_assistance_requests
  where id = p_feedback_assistance_id for update;
  if target_request.id is null or target_request.status <> 'ready'
    or not public.current_person_can_review_feedback_revision(target_request.feedback_revision_id)
  then
    raise exception using errcode = '42501', message = 'feedback assistance review denied';
  end if;

  if p_accept then
    accepted_text := coalesce(p_edited_text, target_request.output_text);
    if length(accepted_text) not between 1 and 10000 then
      raise exception using errcode = '22023', message = 'accepted writing is invalid';
    end if;
    update public.feedback_revisions
    set written_text = accepted_text,
        source_kind = case
          when target_request.kind = 'transcription' then 'dictation_assisted'::public.feedback_source_kind
          else 'ai_proofread'::public.feedback_source_kind
        end,
        ai_assisted = true,
        updated_by_person_id = public.current_person_id(), updated_at = now()
    where id = target_request.feedback_revision_id and status = 'draft';
  end if;

  update public.feedback_assistance_requests
  set status = case
        when p_accept then 'accepted'::public.feedback_assistance_status
        else 'rejected'::public.feedback_assistance_status
      end,
      reviewed_by_person_id = public.current_person_id(), reviewed_at = now()
  where id = target_request.id;

  if target_request.kind = 'transcription' and target_request.audio_file_id is not null then
    update public.feedback_audio_files set expires_at = now()
    where id = target_request.audio_file_id and kind = 'dictation_temp';
  end if;
end;
$$;

create or replace function public.start_feedback_ai_batch(
  p_assignment_version_id uuid,
  p_submission_attempt_ids uuid[],
  p_request_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  actor_id uuid := public.current_person_id();
  target_offering_id uuid;
  target_activation public.feedback_provider_activations%rowtype;
  existing_batch_id uuid;
  requested_count integer;
  eligible_count integer;
  new_batch_id uuid;
begin
  select id into existing_batch_id from public.feedback_ai_batches
  where requested_by_person_id = actor_id and request_key = p_request_key;
  if existing_batch_id is not null then return existing_batch_id; end if;

  select d.offering_id into target_offering_id
  from public.assignment_versions v
  join public.assignment_definitions d on d.id = v.assignment_definition_id
  where v.id = p_assignment_version_id and v.status = 'published';
  if target_offering_id is null or not public.current_person_can_use_feedback_ai(target_offering_id) then
    raise exception using errcode = '42501', message = 'AI feedback assistance access denied';
  end if;
  select * into target_activation from public.feedback_provider_activations where capability = 'rubric_draft';
  if target_activation.mode = 'disabled' then
    raise exception using errcode = '55000', message = 'external feedback processing is not activated';
  end if;

  requested_count := coalesce(cardinality(p_submission_attempt_ids), 0);
  if requested_count not between 1 and 25 then
    raise exception using errcode = '22023', message = 'choose between 1 and 25 submitted attempts';
  end if;
  if (select count(distinct x) from unnest(p_submission_attempt_ids) x) <> requested_count then
    raise exception using errcode = '22023', message = 'batch attempts must be unique';
  end if;

  select count(*) into eligible_count
  from public.submission_attempts a
  join public.student_assignment_instances i on i.id = a.assignment_instance_id
  join public.assignment_releases r on r.id = i.assignment_release_id
  where a.id = any(p_submission_attempt_ids)
    and a.status = 'submitted' and i.status = 'submitted'
    and r.assignment_version_id = p_assignment_version_id
    and public.current_person_can_review_feedback_instance(i.id);
  if eligible_count <> requested_count then
    raise exception using errcode = '23514', message = 'every batch item must be submitted work for one authorized assignment version';
  end if;

  insert into public.feedback_ai_batches (
    assignment_version_id, offering_id, request_key, provider_key, model_config,
    external_processing, requested_by_person_id
  ) values (
    p_assignment_version_id, target_offering_id, p_request_key,
    target_activation.provider_key, target_activation.model_config,
    target_activation.mode = 'external', actor_id
  ) returning id into new_batch_id;

  insert into public.feedback_ai_batch_items (batch_id, submission_attempt_id)
  select new_batch_id, x from unnest(p_submission_attempt_ids) x;
  return new_batch_id;
end;
$$;

create or replace function public.current_person_can_read_feedback_audio_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  revision_id uuid;
begin
  if p_object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webm|mp3|m4a)$' then return false; end if;
  revision_id := split_part(p_object_name, '/', 1)::uuid;
  return exists (
    select 1 from public.feedback_audio_files af
    where af.feedback_revision_id = revision_id
      and af.object_path = p_object_name and af.status = 'ready' and af.purged_at is null
      and (
        public.current_person_can_review_feedback_revision(revision_id)
        or (
          af.kind = 'voice_note'
          and public.current_person_can_read_published_feedback_revision(revision_id)
        )
      )
  );
exception when others then
  return false;
end;
$$;

create or replace function public.list_feedback_audio_due_for_purge(p_limit integer default 100)
returns table (file_id uuid, object_path text)
language sql
security definer
set search_path = ''
set row_security = off
as $$
  select af.id, af.object_path
  from public.feedback_audio_files af
  join public.feedback_revisions fr on fr.id = af.feedback_revision_id
  join public.submission_attempts a on a.id = fr.submission_attempt_id
  join public.student_assignment_instances i on i.id = a.assignment_instance_id
  join public.enrollments e on e.id = i.enrollment_id
  where af.purged_at is null
    and (
      (af.kind = 'dictation_temp' and coalesce(af.expires_at, af.created_at + interval '24 hours') <= now())
      or (fr.status = 'draft' and af.created_at <= now() - interval '30 days')
      or (e.ended_at is not null and e.ended_at <= now() - interval '12 months')
    )
  order by coalesce(af.expires_at, af.created_at)
  limit greatest(1, least(coalesce(p_limit, 100), 500))
$$;

create or replace function public.complete_feedback_audio_purge(p_feedback_audio_file_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  revision_status public.feedback_revision_status;
  audio_kind public.feedback_audio_kind;
begin
  select fr.status, af.kind into revision_status, audio_kind
  from public.feedback_audio_files af
  join public.feedback_revisions fr on fr.id = af.feedback_revision_id
  where af.id = p_feedback_audio_file_id;
  if revision_status is null then return; end if;
  if revision_status = 'draft' or audio_kind = 'dictation_temp' then
    delete from public.feedback_audio_files where id = p_feedback_audio_file_id;
  else
    update public.feedback_audio_files
    set original_file_name = '[purged]', purged_at = now()
    where id = p_feedback_audio_file_id and purged_at is null;
  end if;
end;
$$;

create or replace function public.enforce_published_feedback_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception using errcode = '55000', message = 'published feedback is immutable';
  end if;
  return new;
end;
$$;

create trigger feedback_revisions_immutability_guard
before update or delete on public.feedback_revisions
for each row execute function public.enforce_published_feedback_immutability();

alter table public.feedback_provider_activations enable row level security;
alter table public.feedback_revisions enable row level security;
alter table public.feedback_audio_files enable row level security;
alter table public.feedback_assistance_requests enable row level security;
alter table public.feedback_ai_batches enable row level security;
alter table public.feedback_ai_batch_items enable row level security;

revoke all on table public.feedback_provider_activations from anon, authenticated;
revoke all on table public.feedback_revisions from anon, authenticated;
revoke all on table public.feedback_audio_files from anon, authenticated;
revoke all on table public.feedback_assistance_requests from anon, authenticated;
revoke all on table public.feedback_ai_batches from anon, authenticated;
revoke all on table public.feedback_ai_batch_items from anon, authenticated;

grant select on table public.feedback_revisions to authenticated;
grant select on table public.feedback_audio_files to authenticated;
grant select on table public.feedback_assistance_requests to authenticated;
grant select on table public.feedback_ai_batches to authenticated;
grant select on table public.feedback_ai_batch_items to authenticated;
grant all on table public.feedback_provider_activations to service_role;
grant all on table public.feedback_revisions to service_role;
grant all on table public.feedback_audio_files to service_role;
grant all on table public.feedback_assistance_requests to service_role;
grant all on table public.feedback_ai_batches to service_role;
grant all on table public.feedback_ai_batch_items to service_role;

create policy feedback_revisions_select_authorized
on public.feedback_revisions for select to authenticated
using (
  (select public.current_person_can_review_feedback_revision(id))
  or (select public.current_person_can_read_published_feedback_revision(id))
);

create policy feedback_audio_files_select_authorized
on public.feedback_audio_files for select to authenticated
using (
  (select public.current_person_can_review_feedback_revision(feedback_revision_id))
  or (
    kind = 'voice_note'
    and (select public.current_person_can_read_published_feedback_revision(feedback_revision_id))
  )
);

create policy feedback_assistance_requests_select_reviewer
on public.feedback_assistance_requests for select to authenticated
using ((select public.current_person_can_review_feedback_revision(feedback_revision_id)));

create policy feedback_ai_batches_select_requester
on public.feedback_ai_batches for select to authenticated
using (
  requested_by_person_id = (select public.current_person_id())
  and (select public.current_person_can_use_feedback_ai(offering_id))
);

create policy feedback_ai_batch_items_select_requester
on public.feedback_ai_batch_items for select to authenticated
using (
  exists (
    select 1 from public.feedback_ai_batches b
    where b.id = batch_id
      and b.requested_by_person_id = public.current_person_id()
      and public.current_person_can_use_feedback_ai(b.offering_id)
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'teacher-feedback-audio',
  'teacher-feedback-audio',
  false,
  10485760,
  array['audio/webm', 'audio/mpeg', 'audio/mp4']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy teacher_feedback_audio_objects_select_authorized
on storage.objects for select to authenticated
using (
  bucket_id = 'teacher-feedback-audio'
  and (select public.current_person_can_read_feedback_audio_object(name))
);

revoke all on function public.current_person_can_review_feedback_instance(uuid) from public, anon;
revoke all on function public.current_person_can_use_feedback_ai(uuid) from public, anon;
revoke all on function public.current_person_can_review_feedback_revision(uuid) from public, anon;
revoke all on function public.current_person_can_read_published_feedback_revision(uuid) from public, anon;
revoke all on function public.feedback_provider_ready(public.feedback_assistance_kind) from public, anon;
revoke all on function public.list_feedback_review_queue() from public, anon;
revoke all on function public.start_feedback_draft(uuid) from public, anon;
revoke all on function public.save_feedback_draft(uuid, text, public.feedback_source_kind, boolean) from public, anon;
revoke all on function public.publish_feedback_revision(uuid, public.feedback_outcome, text) from public, anon;
revoke all on function public.reserve_feedback_audio_file(uuid, public.feedback_audio_kind, text, text, bigint, numeric) from public, anon;
revoke all on function public.complete_feedback_audio_file_upload(uuid) from public, anon, authenticated;
revoke all on function public.feedback_audio_removal_target(uuid) from public, anon;
revoke all on function public.complete_feedback_audio_file_removal(uuid) from public, anon, authenticated;
revoke all on function public.request_feedback_assistance(uuid, public.feedback_assistance_kind, uuid, text) from public, anon;
revoke all on function public.complete_feedback_assistance(uuid, text, text, bigint) from public, anon, authenticated;
revoke all on function public.review_feedback_assistance(uuid, boolean, text) from public, anon;
revoke all on function public.start_feedback_ai_batch(uuid, uuid[], uuid) from public, anon;
revoke all on function public.current_person_can_read_feedback_audio_object(text) from public, anon;
revoke all on function public.list_feedback_audio_due_for_purge(integer) from public, anon, authenticated;
revoke all on function public.complete_feedback_audio_purge(uuid) from public, anon, authenticated;
revoke all on function public.enforce_published_feedback_immutability() from public, anon, authenticated;

grant execute on function public.current_person_can_review_feedback_instance(uuid) to authenticated;
grant execute on function public.current_person_can_use_feedback_ai(uuid) to authenticated;
grant execute on function public.current_person_can_review_feedback_revision(uuid) to authenticated;
grant execute on function public.current_person_can_read_published_feedback_revision(uuid) to authenticated;
grant execute on function public.feedback_provider_ready(public.feedback_assistance_kind) to authenticated;
grant execute on function public.list_feedback_review_queue() to authenticated;
grant execute on function public.start_feedback_draft(uuid) to authenticated;
grant execute on function public.save_feedback_draft(uuid, text, public.feedback_source_kind, boolean) to authenticated;
grant execute on function public.publish_feedback_revision(uuid, public.feedback_outcome, text) to authenticated;
grant execute on function public.reserve_feedback_audio_file(uuid, public.feedback_audio_kind, text, text, bigint, numeric) to authenticated;
grant execute on function public.complete_feedback_audio_file_upload(uuid) to service_role;
grant execute on function public.feedback_audio_removal_target(uuid) to authenticated;
grant execute on function public.complete_feedback_audio_file_removal(uuid) to service_role;
grant execute on function public.request_feedback_assistance(uuid, public.feedback_assistance_kind, uuid, text) to authenticated;
grant execute on function public.complete_feedback_assistance(uuid, text, text, bigint) to service_role;
grant execute on function public.review_feedback_assistance(uuid, boolean, text) to authenticated;
grant execute on function public.start_feedback_ai_batch(uuid, uuid[], uuid) to authenticated;
grant execute on function public.current_person_can_read_feedback_audio_object(text) to authenticated;
grant execute on function public.list_feedback_audio_due_for_purge(integer) to service_role;
grant execute on function public.complete_feedback_audio_purge(uuid) to service_role;

comment on table public.feedback_revisions is
  'Immutable-on-publication teacher feedback revisions tied to one submitted attempt and its published rubric version.';
comment on table public.feedback_audio_files is
  'Private five-minute teacher voice notes or temporary dictation audio under D-019.';
comment on table public.feedback_provider_activations is
  'Service-managed capability gate. All production external processing starts disabled with a zero budget under D-020.';
comment on table public.feedback_assistance_requests is
  'Provider-neutral transcription or proofreading requests whose output remains a private teacher-reviewed draft.';
comment on table public.feedback_ai_batches is
  'Manually triggered, maximum-25 rubric-grounded assistance batches; no output can publish automatically.';
