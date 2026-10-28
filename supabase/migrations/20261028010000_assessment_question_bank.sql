-- F038: assessment question bank (D-054 A, D-055 A).
-- Answer keys sit in a table with no browser grant at all. Students reach questions only through
-- get_assessment_student_paper(), which never returns keys or provenance, and read figures of
-- ready questions through the storage policy below. The importer writes with the service role.

insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values
  (
    'assessment.bank.read',
    'Read assessment questions, options, assets, quarantine reasons, provenance and import runs.',
    false,
    false
  ),
  (
    'assessment.bank.import',
    'Run assessment bank imports and read answer keys (operator environment only).',
    true,
    false
  );

insert into public.role_capabilities (role_key, capability_key)
values
  ('elevated_admin', 'assessment.bank.read'),
  ('elevated_admin', 'assessment.bank.import');

create table public.assessment_topics (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  name text not null check (char_length(name) between 1 and 120),
  parent_id uuid references public.assessment_topics (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.assessment_questions (
  id uuid primary key default gen_random_uuid(),
  external_key text not null check (external_key ~ '^[a-z0-9][a-z0-9-]{0,119}$'),
  version integer not null check (version >= 1),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  question_type text not null check (question_type in ('nat', 'msq', 'mcq', 'descriptive')),
  prompt text not null check (char_length(prompt) <= 20000),
  topic_id uuid references public.assessment_topics (id) on delete restrict,
  subtopic_id uuid references public.assessment_topics (id) on delete restrict,
  difficulty text not null default 'unassessed'
    check (difficulty in ('easy', 'medium', 'hard', 'unassessed')),
  estimated_seconds integer check (estimated_seconds between 1 and 3600),
  visual_dependency boolean not null default false,
  response_mode text not null check (response_mode in ('auto', 'upload')),
  publication_state text not null check (publication_state in ('quarantined', 'ready', 'retired')),
  quarantine_reasons text[] not null default '{}',
  licence text not null check (char_length(licence) between 1 and 80),
  source_kind text not null check (source_kind in ('official', 'owner_authorized', 'original')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (external_key, version),
  constraint assessment_questions_state_reasons check (
    (publication_state <> 'ready' or cardinality(quarantine_reasons) = 0)
    and (publication_state <> 'quarantined' or cardinality(quarantine_reasons) > 0)
  )
);

-- At most one live (non-retired) version per workstation question.
create unique index assessment_questions_one_live_version
  on public.assessment_questions (external_key)
  where publication_state <> 'retired';

create table public.assessment_question_assets (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  role text not null check (role in ('figure', 'option', 'source_page')),
  storage_path text not null check (
    storage_path ~ '^[a-z0-9][a-z0-9/_.-]{0,255}\.(png|jpe?g|webp)$'
    and storage_path !~ '\.\.'
    and storage_path !~ '//'
  ),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  width integer check (width between 1 and 20000),
  height integer check (height between 1 and 20000),
  mime_type text not null check (mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  position smallint not null default 0 check (position between 0 and 50),
  unique (question_id, role, position)
);

create index assessment_question_assets_path on public.assessment_question_assets (storage_path);

create table public.assessment_question_options (
  question_id uuid not null references public.assessment_questions (id) on delete cascade,
  option_key text not null check (option_key in ('A', 'B', 'C', 'D', 'E', 'F')),
  body text not null check (char_length(body) <= 4000),
  asset_id uuid references public.assessment_question_assets (id) on delete set null,
  position smallint not null check (position between 0 and 5),
  primary key (question_id, option_key)
);

create table public.assessment_question_keys (
  question_id uuid primary key references public.assessment_questions (id) on delete cascade,
  answer jsonb not null check (jsonb_typeof(answer) = 'object' and answer ? 'kind'),
  answer_status text not null,
  explanation text,
  explanation_status text not null default 'pending'
);

create table public.assessment_question_provenance (
  question_id uuid primary key references public.assessment_questions (id) on delete cascade,
  exam text not null check (exam ~ '^[a-z0-9-]{1,40}$'),
  year integer check (year between 1990 and 2100),
  paper_id text not null check (paper_id ~ '^[a-z0-9][a-z0-9-]{0,79}$'),
  question_no text check (char_length(question_no) <= 20),
  page integer check (page between 0 and 1000),
  source_sha256 text check (source_sha256 ~ '^[0-9a-f]{64}$'),
  extraction text,
  ocr boolean not null default false,
  answer_key_source text,
  verification text,
  verifier text,
  corrections jsonb not null default '[]'::jsonb check (jsonb_typeof(corrections) = 'array')
);

create index assessment_question_provenance_paper
  on public.assessment_question_provenance (paper_id);

create table public.assessment_import_runs (
  id uuid primary key default gen_random_uuid(),
  export_digest text not null check (export_digest ~ '^[0-9a-f]{64}$'),
  dry_run boolean not null default false,
  counts jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  actor text not null check (char_length(actor) between 1 and 120),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

alter table public.assessment_topics enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.assessment_question_assets enable row level security;
alter table public.assessment_question_options enable row level security;
alter table public.assessment_question_keys enable row level security;
alter table public.assessment_question_provenance enable row level security;
alter table public.assessment_import_runs enable row level security;

revoke all on
  public.assessment_topics,
  public.assessment_questions,
  public.assessment_question_assets,
  public.assessment_question_options,
  public.assessment_question_keys,
  public.assessment_question_provenance,
  public.assessment_import_runs
from public, anon, authenticated;

-- Staff with assessment.bank.read can browse everything except answer keys.
grant select on
  public.assessment_topics,
  public.assessment_questions,
  public.assessment_question_assets,
  public.assessment_question_options,
  public.assessment_question_provenance,
  public.assessment_import_runs
to authenticated;

grant all on
  public.assessment_topics,
  public.assessment_questions,
  public.assessment_question_assets,
  public.assessment_question_options,
  public.assessment_question_keys,
  public.assessment_question_provenance,
  public.assessment_import_runs
to service_role;

create policy assessment_topics_staff_read on public.assessment_topics
  for select to authenticated using (public.current_person_has_capability('assessment.bank.read'));
create policy assessment_questions_staff_read on public.assessment_questions
  for select to authenticated using (public.current_person_has_capability('assessment.bank.read'));
create policy assessment_question_assets_staff_read on public.assessment_question_assets
  for select to authenticated using (public.current_person_has_capability('assessment.bank.read'));
create policy assessment_question_options_staff_read on public.assessment_question_options
  for select to authenticated using (public.current_person_has_capability('assessment.bank.read'));
create policy assessment_question_provenance_staff_read on public.assessment_question_provenance
  for select to authenticated using (public.current_person_has_capability('assessment.bank.read'));
create policy assessment_import_runs_staff_read on public.assessment_import_runs
  for select to authenticated using (public.current_person_has_capability('assessment.bank.read'));
-- assessment_question_keys: no browser grant and no policy; the service role only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assessment-media',
  'assessment-media',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
);

-- Students may read figures and option images of ready questions; staff may read all bank media.
create function public.current_person_can_read_assessment_media(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_capability('assessment.bank.read')
    or (
      public.current_person_has_active_student_membership()
      and exists (
        select 1
        from public.assessment_question_assets asset
        join public.assessment_questions question on question.id = asset.question_id
        where asset.storage_path = p_object_name
          and asset.role in ('figure', 'option')
          and question.publication_state = 'ready'
          and question.response_mode = 'auto'
      )
    ),
    false
  )
$$;

revoke all on function public.current_person_can_read_assessment_media(text) from public, anon;
grant execute on function public.current_person_can_read_assessment_media(text)
  to authenticated, service_role;

create policy assessment_media_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'assessment-media'
    and public.current_person_can_read_assessment_media(name)
  );

-- The candidate view of a paper: ready objective questions only, in paper order, without
-- answer keys, quarantine reasons, licences or provenance.
create function public.get_assessment_student_paper(p_paper_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
begin
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  if p_paper_id is null or p_paper_id !~ '^[a-z0-9][a-z0-9-]{0,79}$' then
    raise exception 'Invalid paper.' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'paperId', p_paper_id,
    'objectiveCount', (
      select count(*)
      from public.assessment_question_provenance p
      join public.assessment_questions q on q.id = p.question_id
      where p.paper_id = p_paper_id
        and q.publication_state <> 'retired'
        and q.response_mode = 'auto'
    ),
    'questions', coalesce(jsonb_agg(item.body order by item.number_sort nulls last, item.number), '[]'::jsonb)
  )
  into result
  from (
    select
      p.question_no as number,
      nullif(substring(p.question_no from '^[0-9]+'), '')::integer as number_sort,
      jsonb_build_object(
        'id', q.id,
        'number', p.question_no,
        'type', q.question_type,
        'prompt', q.prompt,
        'visualDependency', q.visual_dependency,
        'figures', coalesce((
          select jsonb_agg(
            jsonb_build_object('path', a.storage_path, 'width', a.width, 'height', a.height)
            order by a.position
          )
          from public.assessment_question_assets a
          where a.question_id = q.id and a.role = 'figure'
        ), '[]'::jsonb),
        'options', coalesce((
          select jsonb_agg(
            jsonb_build_object('key', o.option_key, 'text', o.body, 'imagePath', oa.storage_path)
            order by o.position
          )
          from public.assessment_question_options o
          left join public.assessment_question_assets oa on oa.id = o.asset_id
          where o.question_id = q.id
        ), '[]'::jsonb)
      ) as body
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where p.paper_id = p_paper_id
      and q.publication_state = 'ready'
      and q.response_mode = 'auto'
  ) item;

  return result;
end;
$$;

revoke all on function public.get_assessment_student_paper(text) from public, anon;
grant execute on function public.get_assessment_student_paper(text) to authenticated;

-- Per-paper readiness for the Papers page: counts only.
create function public.list_assessment_student_papers()
returns table (paper_id text, ready_count integer, objective_count integer)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_has_active_student_membership() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  return query
    select
      p.paper_id,
      (count(*) filter (where q.publication_state = 'ready'))::integer,
      count(*)::integer
    from public.assessment_question_provenance p
    join public.assessment_questions q on q.id = p.question_id
    where q.publication_state <> 'retired' and q.response_mode = 'auto'
    group by p.paper_id;
end;
$$;

revoke all on function public.list_assessment_student_papers() from public, anon;
grant execute on function public.list_assessment_student_papers() to authenticated;

-- One question per call, atomically: retire the previous live version (if any), then insert the
-- new version with its topics, assets, options, key and provenance. Service role only.
create function public.assessment_import_question(p_question jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question_id uuid;
  v_topic_id uuid;
  v_subtopic_id uuid;
  v_asset jsonb;
  v_asset_ids uuid[] := '{}';
  v_asset_id uuid;
  v_option jsonb;
  v_previous uuid := nullif(p_question ->> 'previousId', '')::uuid;
begin
  if v_previous is not null then
    update public.assessment_questions
    set publication_state = 'retired', updated_at = now()
    where id = v_previous
      and external_key = p_question ->> 'externalKey'
      and publication_state <> 'retired';
    if not found then
      raise exception 'The previous version of % is not live.', p_question ->> 'externalKey';
    end if;
  end if;

  if p_question ->> 'topic' is not null then
    insert into public.assessment_topics (slug, name)
    values (p_question ->> 'topic', initcap(replace(p_question ->> 'topic', '-', ' ')))
    on conflict (slug) do nothing;
    select id into v_topic_id from public.assessment_topics where slug = p_question ->> 'topic';
  end if;
  if p_question ->> 'subtopic' is not null then
    insert into public.assessment_topics (slug, name, parent_id)
    values (p_question ->> 'subtopic', initcap(replace(p_question ->> 'subtopic', '-', ' ')), v_topic_id)
    on conflict (slug) do nothing;
    select id into v_subtopic_id from public.assessment_topics where slug = p_question ->> 'subtopic';
  end if;

  insert into public.assessment_questions (
    external_key, version, content_hash, question_type, prompt, topic_id, subtopic_id,
    difficulty, estimated_seconds, visual_dependency, response_mode, publication_state,
    quarantine_reasons, licence, source_kind
  )
  values (
    p_question ->> 'externalKey',
    (p_question ->> 'version')::integer,
    p_question ->> 'contentHash',
    p_question ->> 'type',
    p_question ->> 'prompt',
    v_topic_id,
    v_subtopic_id,
    p_question ->> 'difficulty',
    nullif(p_question ->> 'estimatedSeconds', '')::integer,
    (p_question ->> 'visualDependency')::boolean,
    p_question ->> 'responseMode',
    p_question ->> 'state',
    array(select jsonb_array_elements_text(p_question -> 'reasons')),
    p_question ->> 'licence',
    p_question ->> 'sourceKind'
  )
  returning id into v_question_id;

  for v_asset in select * from jsonb_array_elements(p_question -> 'assets') loop
    insert into public.assessment_question_assets (
      question_id, role, storage_path, sha256, width, height, mime_type, position
    )
    values (
      v_question_id,
      v_asset ->> 'role',
      v_asset ->> 'storagePath',
      v_asset ->> 'sha256',
      nullif(v_asset ->> 'width', '')::integer,
      nullif(v_asset ->> 'height', '')::integer,
      v_asset ->> 'mimeType',
      (v_asset ->> 'position')::smallint
    )
    returning id into v_asset_id;
    v_asset_ids := v_asset_ids || v_asset_id;
  end loop;

  for v_option in select * from jsonb_array_elements(p_question -> 'options') loop
    insert into public.assessment_question_options (question_id, option_key, body, asset_id, position)
    values (
      v_question_id,
      v_option ->> 'key',
      v_option ->> 'text',
      case
        when v_option ->> 'assetIndex' is null then null
        else v_asset_ids[(v_option ->> 'assetIndex')::integer + 1]
      end,
      (v_option ->> 'position')::smallint
    );
  end loop;

  if p_question -> 'key' is not null and jsonb_typeof(p_question -> 'key') = 'object' then
    insert into public.assessment_question_keys (
      question_id, answer, answer_status, explanation, explanation_status
    )
    values (
      v_question_id,
      p_question -> 'key' -> 'answer',
      p_question -> 'key' ->> 'status',
      p_question -> 'key' ->> 'explanation',
      coalesce(p_question -> 'key' ->> 'explanationStatus', 'pending')
    );
  end if;

  insert into public.assessment_question_provenance (
    question_id, exam, year, paper_id, question_no, page, source_sha256, extraction, ocr,
    answer_key_source, verification
  )
  values (
    v_question_id,
    p_question -> 'provenance' ->> 'exam',
    nullif(p_question -> 'provenance' ->> 'year', '')::integer,
    p_question -> 'provenance' ->> 'paperId',
    p_question -> 'provenance' ->> 'questionNo',
    nullif(p_question -> 'provenance' ->> 'page', '')::integer,
    p_question -> 'provenance' ->> 'sourceSha256',
    p_question -> 'provenance' ->> 'extraction',
    coalesce((p_question -> 'provenance' ->> 'ocr')::boolean, false),
    p_question -> 'provenance' ->> 'answerKeySource',
    p_question -> 'provenance' ->> 'verification'
  );

  return v_question_id;
end;
$$;

revoke all on function public.assessment_import_question(jsonb) from public, anon, authenticated;
grant execute on function public.assessment_import_question(jsonb) to service_role;
