insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values
  ('content.manage_drafts', 'Create and edit curriculum and assignment drafts within an authorized offering scope.', false, false),
  ('content.publish', 'Review and publish immutable curriculum and assignment versions within an authorized offering scope.', false, false);

alter table public.curriculum_versions
  add column source_curriculum_version_id uuid references public.curriculum_versions (id) on delete restrict,
  add column release_note text,
  add constraint curriculum_versions_source_not_self check (
    source_curriculum_version_id is null or source_curriculum_version_id <> id
  ),
  add constraint curriculum_versions_release_note_length check (
    release_note is null or length(btrim(release_note)) between 3 and 500
  );

alter table public.curriculum_versions
  drop constraint curriculum_versions_lifecycle_consistent,
  add constraint curriculum_versions_lifecycle_consistent check (
    (
      status = 'draft'
      and published_at is null
      and published_by_person_id is null
      and retired_at is null
      and release_note is null
    )
    or (
      status = 'published'
      and published_at is not null
      and published_by_person_id is not null
      and retired_at is null
      and release_note is not null
    )
    or (
      status = 'retired'
      and published_at is not null
      and published_by_person_id is not null
      and retired_at is not null
      and retired_at >= published_at
      and release_note is not null
    )
  );

create or replace function public.enforce_curriculum_version_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode = '23514', message = 'a curriculum version must be created as a draft';
    end if;

    return new;
  end if;

  if old.status = 'draft' then
    if new.status = 'retired' then
      raise exception using errcode = '23514', message = 'a draft curriculum cannot be retired';
    end if;

    if new.status = 'published' and not exists (
      select 1
      from public.curriculum_sections s
      join public.curriculum_topics t on t.section_id = s.id
      where s.curriculum_version_id = old.id
    ) then
      raise exception using errcode = '23514', message = 'a curriculum needs at least one topic before publication';
    end if;

    return new;
  end if;

  if old.status = 'published'
    and new.status = 'retired'
    and row(
      new.id, new.offering_id, new.version_number, new.title,
      new.created_by_person_id, new.published_by_person_id, new.published_at, new.created_at,
      new.source_curriculum_version_id, new.release_note
    ) is not distinct from row(
      old.id, old.offering_id, old.version_number, old.title,
      old.created_by_person_id, old.published_by_person_id, old.published_at, old.created_at,
      old.source_curriculum_version_id, old.release_note
    )
  then
    return new;
  end if;

  raise exception using errcode = '55000', message = 'published curriculum versions are immutable';
end;
$$;

create or replace function public.current_person_can_manage_content(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_capability('content.manage_drafts')
    or public.current_person_has_capability('content.manage_drafts', 'offering', p_offering_id),
    false
  )
$$;

create or replace function public.current_person_can_publish_content(p_offering_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    public.current_person_has_capability('content.publish')
    or public.current_person_has_capability('content.publish', 'offering', p_offering_id),
    false
  )
$$;

grant select, insert, update, delete on table public.curriculum_versions to authenticated;
grant select, insert, update, delete on table public.curriculum_sections to authenticated;
grant select, insert, update, delete on table public.curriculum_topics to authenticated;
grant select, insert, update, delete on table public.curriculum_lessons to authenticated;

create policy offerings_select_content_author
on public.offerings
for select
to authenticated
using (
  (select public.current_person_can_manage_content(id))
  or (select public.current_person_can_publish_content(id))
);

create policy curriculum_versions_select_content_author
on public.curriculum_versions
for select
to authenticated
using (
  (select public.current_person_can_manage_content(offering_id))
  or (select public.current_person_can_publish_content(offering_id))
);

create policy curriculum_versions_insert_content_author
on public.curriculum_versions
for insert
to authenticated
with check (
  status = 'draft'
  and (select public.current_person_can_manage_content(offering_id))
  and created_by_person_id = (select public.current_person_id())
);

create policy curriculum_versions_update_content_author
on public.curriculum_versions
for update
to authenticated
using (
  status = 'draft'
  and (select public.current_person_can_manage_content(offering_id))
)
with check (
  status = 'draft'
  and (select public.current_person_can_manage_content(offering_id))
);

create policy curriculum_versions_delete_content_author
on public.curriculum_versions
for delete
to authenticated
using (
  status = 'draft'
  and (select public.current_person_can_manage_content(offering_id))
);

create policy curriculum_sections_select_content_author
on public.curriculum_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.curriculum_versions cv
    where cv.id = curriculum_version_id
      and (
        public.current_person_can_manage_content(cv.offering_id)
        or public.current_person_can_publish_content(cv.offering_id)
      )
  )
);

create policy curriculum_sections_mutate_content_author
on public.curriculum_sections
for all
to authenticated
using (
  exists (
    select 1 from public.curriculum_versions cv
    where cv.id = curriculum_version_id
      and cv.status = 'draft'
      and public.current_person_can_manage_content(cv.offering_id)
  )
)
with check (
  exists (
    select 1 from public.curriculum_versions cv
    where cv.id = curriculum_version_id
      and cv.status = 'draft'
      and public.current_person_can_manage_content(cv.offering_id)
  )
);

create policy curriculum_topics_select_content_author
on public.curriculum_topics
for select
to authenticated
using (
  exists (
    select 1
    from public.curriculum_sections s
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where s.id = section_id
      and (
        public.current_person_can_manage_content(cv.offering_id)
        or public.current_person_can_publish_content(cv.offering_id)
      )
  )
);

create policy curriculum_topics_mutate_content_author
on public.curriculum_topics
for all
to authenticated
using (
  exists (
    select 1
    from public.curriculum_sections s
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where s.id = section_id
      and cv.status = 'draft'
      and public.current_person_can_manage_content(cv.offering_id)
  )
)
with check (
  exists (
    select 1
    from public.curriculum_sections s
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where s.id = section_id
      and cv.status = 'draft'
      and public.current_person_can_manage_content(cv.offering_id)
  )
);

create policy curriculum_lessons_select_content_author
on public.curriculum_lessons
for select
to authenticated
using (
  exists (
    select 1
    from public.curriculum_topics t
    join public.curriculum_sections s on s.id = t.section_id
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where t.id = topic_id
      and (
        public.current_person_can_manage_content(cv.offering_id)
        or public.current_person_can_publish_content(cv.offering_id)
      )
  )
);

create policy curriculum_lessons_mutate_content_author
on public.curriculum_lessons
for all
to authenticated
using (
  exists (
    select 1
    from public.curriculum_topics t
    join public.curriculum_sections s on s.id = t.section_id
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where t.id = topic_id
      and cv.status = 'draft'
      and public.current_person_can_manage_content(cv.offering_id)
  )
)
with check (
  exists (
    select 1
    from public.curriculum_topics t
    join public.curriculum_sections s on s.id = t.section_id
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where t.id = topic_id
      and cv.status = 'draft'
      and public.current_person_can_manage_content(cv.offering_id)
  )
);

create or replace function public.clone_curriculum_version(
  p_source_curriculum_version_id uuid,
  p_title text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  source_version public.curriculum_versions%rowtype;
  new_version_id uuid;
  source_section record;
  source_topic record;
  source_lesson record;
  new_section_id uuid;
  new_topic_id uuid;
begin
  select * into source_version
  from public.curriculum_versions
  where id = p_source_curriculum_version_id;

  if source_version.id is null
    or not public.current_person_can_manage_content(source_version.offering_id)
  then
    raise exception using errcode = '42501', message = 'content draft access denied';
  end if;

  if source_version.status not in ('published', 'retired') then
    raise exception using errcode = '23514', message = 'only a published curriculum can be copied';
  end if;

  insert into public.curriculum_versions (
    offering_id, version_number, title, source_curriculum_version_id, created_by_person_id
  )
  values (
    source_version.offering_id,
    (select coalesce(max(version_number), 0) + 1 from public.curriculum_versions where offering_id = source_version.offering_id),
    p_title,
    source_version.id,
    public.current_person_id()
  )
  returning id into new_version_id;

  for source_section in
    select * from public.curriculum_sections
    where curriculum_version_id = source_version.id
    order by position
  loop
    insert into public.curriculum_sections (
      curriculum_version_id, code, title, description, position
    ) values (
      new_version_id, source_section.code, source_section.title,
      source_section.description, source_section.position
    ) returning id into new_section_id;

    for source_topic in
      select * from public.curriculum_topics
      where section_id = source_section.id
      order by position
    loop
      insert into public.curriculum_topics (
        section_id, code, title, summary, position
      ) values (
        new_section_id, source_topic.code, source_topic.title,
        source_topic.summary, source_topic.position
      ) returning id into new_topic_id;

      for source_lesson in
        select * from public.curriculum_lessons
        where topic_id = source_topic.id
        order by position
      loop
        insert into public.curriculum_lessons (
          topic_id, code, title, summary, body_markdown, position
        ) values (
          new_topic_id, source_lesson.code, source_lesson.title,
          source_lesson.summary, source_lesson.body_markdown, source_lesson.position
        );
      end loop;
    end loop;
  end loop;

  return new_version_id;
end;
$$;

create or replace function public.publish_curriculum_version(
  p_curriculum_version_id uuid,
  p_release_note text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_version public.curriculum_versions%rowtype;
  actor_id uuid := public.current_person_id();
begin
  select * into target_version
  from public.curriculum_versions
  where id = p_curriculum_version_id
  for update;

  if target_version.id is null
    or not public.current_person_can_publish_content(target_version.offering_id)
  then
    raise exception using errcode = '42501', message = 'content publication access denied';
  end if;

  if target_version.status <> 'draft' then
    raise exception using errcode = '23514', message = 'only a draft curriculum can be published';
  end if;

  if length(btrim(coalesce(p_release_note, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'a release note between 3 and 500 characters is required';
  end if;

  update public.curriculum_versions
  set status = 'published',
      release_note = btrim(p_release_note),
      published_by_person_id = actor_id,
      published_at = now(),
      updated_at = now()
  where id = target_version.id;

  insert into public.security_audit_events (
    subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata
  ) values (
    actor_id, actor_id, 'curriculum_version_published', 'succeeded', 'content_release',
    jsonb_build_object(
      'curriculum_version_id', target_version.id,
      'offering_id', target_version.offering_id,
      'version_number', target_version.version_number
    )
  );
end;
$$;

create table public.assignment_definitions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete restrict,
  code text not null,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint assignment_definitions_code_format check (code ~ '^[A-Z][A-Z0-9_-]{1,39}$'),
  constraint assignment_definitions_offering_code_unique unique (offering_id, code),
  constraint assignment_definitions_id_offering_unique unique (id, offering_id)
);

create table public.assignment_versions (
  id uuid primary key default gen_random_uuid(),
  assignment_definition_id uuid not null references public.assignment_definitions (id) on delete restrict,
  version_number integer not null,
  status public.curriculum_status not null default 'draft',
  group_name text not null,
  title text not null,
  instructions text not null,
  evaluation_rubric text not null,
  source_assignment_version_id uuid references public.assignment_versions (id) on delete restrict,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  published_by_person_id uuid references public.people (id) on delete restrict,
  published_at timestamptz,
  retired_at timestamptz,
  release_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assignment_versions_number_positive check (version_number > 0),
  constraint assignment_versions_group_present check (length(btrim(group_name)) between 2 and 120),
  constraint assignment_versions_title_present check (length(btrim(title)) between 2 and 200),
  constraint assignment_versions_instructions_present check (length(btrim(instructions)) between 3 and 10000),
  constraint assignment_versions_rubric_present check (length(btrim(evaluation_rubric)) between 3 and 10000),
  constraint assignment_versions_release_note_length check (
    release_note is null or length(btrim(release_note)) between 3 and 500
  ),
  constraint assignment_versions_source_not_self check (
    source_assignment_version_id is null or source_assignment_version_id <> id
  ),
  constraint assignment_versions_definition_number_unique unique (
    assignment_definition_id, version_number
  ),
  constraint assignment_versions_lifecycle_consistent check (
    (
      status = 'draft' and published_by_person_id is null and published_at is null
      and retired_at is null and release_note is null
    )
    or (
      status = 'published' and published_by_person_id is not null and published_at is not null
      and retired_at is null and release_note is not null
    )
    or (
      status = 'retired' and published_by_person_id is not null and published_at is not null
      and retired_at is not null and retired_at >= published_at and release_note is not null
    )
  )
);

create table public.assignment_topic_links (
  assignment_version_id uuid not null references public.assignment_versions (id) on delete restrict,
  topic_id uuid not null references public.curriculum_topics (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (assignment_version_id, topic_id)
);

create table public.assignment_materials (
  id uuid primary key default gen_random_uuid(),
  assignment_version_id uuid not null references public.assignment_versions (id) on delete restrict,
  object_path text not null unique,
  original_file_name text not null,
  mime_type text not null,
  byte_size bigint not null,
  position integer not null,
  created_by_person_id uuid not null references public.people (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint assignment_materials_name_present check (
    length(btrim(original_file_name)) between 1 and 180
  ),
  constraint assignment_materials_mime_allowed check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint assignment_materials_size_allowed check (
    byte_size between 1 and 10485760
  ),
  constraint assignment_materials_position_allowed check (position between 1 and 5),
  constraint assignment_materials_version_position_unique unique (assignment_version_id, position)
);

create index assignment_definitions_offering_idx on public.assignment_definitions (offering_id, code);
create index assignment_versions_definition_idx on public.assignment_versions (
  assignment_definition_id, status, version_number desc
);
create index assignment_topic_links_topic_idx on public.assignment_topic_links (topic_id);
create index assignment_materials_version_idx on public.assignment_materials (
  assignment_version_id, position
);

create or replace function public.assignment_version_offering_id(p_assignment_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select d.offering_id
  from public.assignment_versions v
  join public.assignment_definitions d on d.id = v.assignment_definition_id
  where v.id = p_assignment_version_id
$$;

create or replace function public.enforce_assignment_draft_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_version_id uuid;
  target_status public.curriculum_status;
  assignment_offering_id uuid;
  topic_offering_id uuid;
begin
  if tg_table_name = 'assignment_topic_links' then
    target_version_id := case when tg_op = 'DELETE' then old.assignment_version_id else new.assignment_version_id end;
  else
    target_version_id := case when tg_op = 'DELETE' then old.assignment_version_id else new.assignment_version_id end;
  end if;

  select v.status, d.offering_id into target_status, assignment_offering_id
  from public.assignment_versions v
  join public.assignment_definitions d on d.id = v.assignment_definition_id
  where v.id = target_version_id;

  if target_status <> 'draft' then
    raise exception using errcode = '55000', message = 'published assignment content is immutable';
  end if;

  if tg_table_name = 'assignment_topic_links' and tg_op <> 'DELETE' then
    select cv.offering_id into topic_offering_id
    from public.curriculum_topics t
    join public.curriculum_sections s on s.id = t.section_id
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where t.id = new.topic_id;

    if topic_offering_id is distinct from assignment_offering_id then
      raise exception using errcode = '23514', message = 'assignment and topic must belong to the same offering';
    end if;
  end if;

  if tg_table_name = 'assignment_materials' and tg_op <> 'DELETE' then
    if new.object_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$'
      or split_part(new.object_path, '/', 1) <> assignment_offering_id::text
      or split_part(new.object_path, '/', 2) <> target_version_id::text
    then
      raise exception using errcode = '23514', message = 'assignment material path is invalid';
    end if;

    if not (
      (new.mime_type = 'application/pdf' and lower(new.object_path) like '%.pdf' and lower(new.original_file_name) like '%.pdf')
      or (new.mime_type = 'image/jpeg' and lower(new.object_path) ~ '\.(jpg|jpeg)$' and lower(new.original_file_name) ~ '\.(jpg|jpeg)$')
      or (new.mime_type = 'image/png' and lower(new.object_path) like '%.png' and lower(new.original_file_name) like '%.png')
      or (new.mime_type = 'image/webp' and lower(new.object_path) like '%.webp' and lower(new.original_file_name) like '%.webp')
    ) then
      raise exception using errcode = '23514', message = 'assignment material extension and MIME type do not match';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.enforce_assignment_version_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception using errcode = '23514', message = 'an assignment version must be created as a draft';
    end if;
    return new;
  end if;

  if old.status = 'draft' then return new; end if;

  if old.status = 'published'
    and new.status = 'retired'
    and row(
      new.id, new.assignment_definition_id, new.version_number, new.group_name,
      new.title, new.instructions, new.evaluation_rubric, new.source_assignment_version_id,
      new.created_by_person_id, new.published_by_person_id, new.published_at,
      new.release_note, new.created_at
    ) is not distinct from row(
      old.id, old.assignment_definition_id, old.version_number, old.group_name,
      old.title, old.instructions, old.evaluation_rubric, old.source_assignment_version_id,
      old.created_by_person_id, old.published_by_person_id, old.published_at,
      old.release_note, old.created_at
    )
  then
    return new;
  end if;

  raise exception using errcode = '55000', message = 'published assignment versions are immutable';
end;
$$;

create trigger assignment_versions_lifecycle_guard
before insert or update on public.assignment_versions
for each row execute function public.enforce_assignment_version_lifecycle();

create trigger assignment_topic_links_draft_guard
before insert or update or delete on public.assignment_topic_links
for each row execute function public.enforce_assignment_draft_content();

create trigger assignment_materials_draft_guard
before insert or update or delete on public.assignment_materials
for each row execute function public.enforce_assignment_draft_content();

create or replace function public.publish_assignment_version(
  p_assignment_version_id uuid,
  p_release_note text
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_version public.assignment_versions%rowtype;
  target_offering_id uuid;
  actor_id uuid := public.current_person_id();
begin
  select v.* into target_version
  from public.assignment_versions v
  where v.id = p_assignment_version_id
  for update of v;

  target_offering_id := public.assignment_version_offering_id(p_assignment_version_id);

  if target_version.id is null
    or not public.current_person_can_publish_content(target_offering_id)
  then
    raise exception using errcode = '42501', message = 'assignment publication access denied';
  end if;

  if target_version.status <> 'draft' then
    raise exception using errcode = '23514', message = 'only a draft assignment can be published';
  end if;

  if length(btrim(coalesce(p_release_note, ''))) not between 3 and 500 then
    raise exception using errcode = '22023', message = 'a release note between 3 and 500 characters is required';
  end if;

  if not exists (
    select 1 from public.assignment_topic_links
    where assignment_version_id = target_version.id
  ) then
    raise exception using errcode = '23514', message = 'an assignment needs at least one topic before publication';
  end if;

  if exists (
    select 1
    from public.assignment_topic_links atl
    join public.curriculum_topics t on t.id = atl.topic_id
    join public.curriculum_sections s on s.id = t.section_id
    join public.curriculum_versions cv on cv.id = s.curriculum_version_id
    where atl.assignment_version_id = target_version.id
      and cv.status <> 'published'
  ) then
    raise exception using errcode = '23514', message = 'assignment topics must belong to a published curriculum';
  end if;

  update public.assignment_versions
  set status = 'published',
      release_note = btrim(p_release_note),
      published_by_person_id = actor_id,
      published_at = now(),
      updated_at = now()
  where id = target_version.id;

  insert into public.security_audit_events (
    subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata
  ) values (
    actor_id, actor_id, 'assignment_version_published', 'succeeded', 'content_release',
    jsonb_build_object(
      'assignment_version_id', target_version.id,
      'offering_id', target_offering_id,
      'version_number', target_version.version_number
    )
  );
end;
$$;

create or replace function public.create_assignment_draft(
  p_offering_id uuid,
  p_topic_id uuid,
  p_code text,
  p_group_name text,
  p_title text,
  p_instructions text,
  p_evaluation_rubric text
)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  definition_id uuid;
  version_id uuid;
  topic_offering_id uuid;
  actor_id uuid := public.current_person_id();
begin
  if not public.current_person_can_manage_content(p_offering_id) then
    raise exception using errcode = '42501', message = 'content draft access denied';
  end if;

  select cv.offering_id into topic_offering_id
  from public.curriculum_topics t
  join public.curriculum_sections s on s.id = t.section_id
  join public.curriculum_versions cv on cv.id = s.curriculum_version_id
  where t.id = p_topic_id;

  if topic_offering_id is distinct from p_offering_id then
    raise exception using errcode = '23514', message = 'assignment and topic must belong to the same offering';
  end if;

  insert into public.assignment_definitions (offering_id, code, created_by_person_id)
  values (p_offering_id, upper(btrim(p_code)), actor_id)
  returning id into definition_id;

  insert into public.assignment_versions (
    assignment_definition_id, version_number, group_name, title,
    instructions, evaluation_rubric, created_by_person_id
  ) values (
    definition_id, 1, btrim(p_group_name), btrim(p_title),
    btrim(p_instructions), btrim(p_evaluation_rubric), actor_id
  ) returning id into version_id;

  insert into public.assignment_topic_links (assignment_version_id, topic_id)
  values (version_id, p_topic_id);

  return version_id;
end;
$$;

create or replace function public.clone_assignment_version(p_source_assignment_version_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  source_version public.assignment_versions%rowtype;
  target_offering_id uuid;
  new_version_id uuid;
begin
  select * into source_version
  from public.assignment_versions
  where id = p_source_assignment_version_id;

  target_offering_id := public.assignment_version_offering_id(p_source_assignment_version_id);

  if source_version.id is null
    or not public.current_person_can_manage_content(target_offering_id)
  then
    raise exception using errcode = '42501', message = 'content draft access denied';
  end if;

  if source_version.status not in ('published', 'retired') then
    raise exception using errcode = '23514', message = 'only a published assignment can be copied';
  end if;

  insert into public.assignment_versions (
    assignment_definition_id, version_number, group_name, title,
    instructions, evaluation_rubric, source_assignment_version_id, created_by_person_id
  ) values (
    source_version.assignment_definition_id,
    (
      select coalesce(max(version_number), 0) + 1
      from public.assignment_versions
      where assignment_definition_id = source_version.assignment_definition_id
    ),
    source_version.group_name,
    source_version.title,
    source_version.instructions,
    source_version.evaluation_rubric,
    source_version.id,
    public.current_person_id()
  ) returning id into new_version_id;

  insert into public.assignment_topic_links (assignment_version_id, topic_id)
  select new_version_id, topic_id
  from public.assignment_topic_links
  where assignment_version_id = source_version.id;

  return new_version_id;
end;
$$;

alter table public.assignment_definitions enable row level security;
alter table public.assignment_versions enable row level security;
alter table public.assignment_topic_links enable row level security;
alter table public.assignment_materials enable row level security;

revoke all on table public.assignment_definitions from anon, authenticated;
revoke all on table public.assignment_versions from anon, authenticated;
revoke all on table public.assignment_topic_links from anon, authenticated;
revoke all on table public.assignment_materials from anon, authenticated;
grant select, insert on table public.assignment_definitions to authenticated;
grant select, insert, update on table public.assignment_versions to authenticated;
grant select, insert, delete on table public.assignment_topic_links to authenticated;
grant select, insert, delete on table public.assignment_materials to authenticated;
grant all on table public.assignment_definitions to service_role;
grant all on table public.assignment_versions to service_role;
grant all on table public.assignment_topic_links to service_role;
grant all on table public.assignment_materials to service_role;

create policy assignment_definitions_select_content_author
on public.assignment_definitions
for select
to authenticated
using (
  (select public.current_person_can_manage_content(offering_id))
  or (select public.current_person_can_publish_content(offering_id))
);

create policy assignment_definitions_insert_content_author
on public.assignment_definitions
for insert
to authenticated
with check (
  (select public.current_person_can_manage_content(offering_id))
  and created_by_person_id = (select public.current_person_id())
);

create policy assignment_versions_select_content_author
on public.assignment_versions
for select
to authenticated
using (
  exists (
    select 1 from public.assignment_definitions d
    where d.id = assignment_definition_id
      and (
        public.current_person_can_manage_content(d.offering_id)
        or public.current_person_can_publish_content(d.offering_id)
      )
  )
);

create policy assignment_versions_insert_content_author
on public.assignment_versions
for insert
to authenticated
with check (
  status = 'draft'
  and created_by_person_id = (select public.current_person_id())
  and exists (
    select 1 from public.assignment_definitions d
    where d.id = assignment_definition_id
      and public.current_person_can_manage_content(d.offering_id)
  )
);

create policy assignment_versions_update_content_author
on public.assignment_versions
for update
to authenticated
using (
  status = 'draft'
  and exists (
    select 1 from public.assignment_definitions d
    where d.id = assignment_definition_id
      and public.current_person_can_manage_content(d.offering_id)
  )
)
with check (
  status = 'draft'
  and exists (
    select 1 from public.assignment_definitions d
    where d.id = assignment_definition_id
      and public.current_person_can_manage_content(d.offering_id)
  )
);

create policy assignment_topic_links_select_content_author
on public.assignment_topic_links
for select
to authenticated
using (
  (select public.current_person_can_manage_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
  or (select public.current_person_can_publish_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
);

create policy assignment_topic_links_insert_content_author
on public.assignment_topic_links
for insert
to authenticated
with check (
  (select public.current_person_can_manage_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
);

create policy assignment_topic_links_delete_content_author
on public.assignment_topic_links
for delete
to authenticated
using (
  (select public.current_person_can_manage_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
);

create policy assignment_materials_select_content_author
on public.assignment_materials
for select
to authenticated
using (
  (select public.current_person_can_manage_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
  or (select public.current_person_can_publish_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
);

create policy assignment_materials_insert_content_author
on public.assignment_materials
for insert
to authenticated
with check (
  created_by_person_id = (select public.current_person_id())
  and (select public.current_person_can_manage_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
);

create policy assignment_materials_delete_content_author
on public.assignment_materials
for delete
to authenticated
using (
  (select public.current_person_can_manage_content(
    public.assignment_version_offering_id(assignment_version_id)
  ))
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-materials',
  'assignment-materials',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.current_person_can_read_assignment_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  version_id uuid;
  offering_id uuid;
begin
  if p_object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$' then
    return false;
  end if;

  version_id := split_part(p_object_name, '/', 2)::uuid;
  offering_id := public.assignment_version_offering_id(version_id);

  return split_part(p_object_name, '/', 1) = offering_id::text
    and (
      public.current_person_can_manage_content(offering_id)
      or public.current_person_can_publish_content(offering_id)
    );
exception when others then
  return false;
end;
$$;

create or replace function public.current_person_can_mutate_assignment_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  version_id uuid;
  offering_id uuid;
  version_status public.curriculum_status;
begin
  if p_object_name !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|jpg|jpeg|png|webp)$' then
    return false;
  end if;

  version_id := split_part(p_object_name, '/', 2)::uuid;
  offering_id := public.assignment_version_offering_id(version_id);
  select status into version_status from public.assignment_versions where id = version_id;

  return split_part(p_object_name, '/', 1) = offering_id::text
    and version_status = 'draft'
    and public.current_person_can_manage_content(offering_id);
exception when others then
  return false;
end;
$$;

create or replace function public.current_person_can_insert_assignment_object(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  version_id uuid;
begin
  if not public.current_person_can_mutate_assignment_object(p_object_name) then
    return false;
  end if;

  version_id := split_part(p_object_name, '/', 2)::uuid;

  return (
    select count(*) < 5
    from storage.objects existing
    where existing.bucket_id = 'assignment-materials'
      and split_part(existing.name, '/', 2) = version_id::text
      and existing.archived_at is null
  );
exception when others then
  return false;
end;
$$;

create policy assignment_material_objects_select_content_author
on storage.objects
for select
to authenticated
using (
  bucket_id = 'assignment-materials'
  and (select public.current_person_can_read_assignment_object(name))
);

create policy assignment_material_objects_insert_content_author
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assignment-materials'
  and (select public.current_person_can_insert_assignment_object(name))
  and (
    (lower(storage.extension(name)) = 'pdf' and metadata ->> 'mimetype' = 'application/pdf')
    or (lower(storage.extension(name)) in ('jpg', 'jpeg') and metadata ->> 'mimetype' = 'image/jpeg')
    or (lower(storage.extension(name)) = 'png' and metadata ->> 'mimetype' = 'image/png')
    or (lower(storage.extension(name)) = 'webp' and metadata ->> 'mimetype' = 'image/webp')
  )
);

create policy assignment_material_objects_update_content_author
on storage.objects
for update
to authenticated
using (
  bucket_id = 'assignment-materials'
  and (select public.current_person_can_mutate_assignment_object(name))
)
with check (
  bucket_id = 'assignment-materials'
  and (select public.current_person_can_mutate_assignment_object(name))
);

create policy assignment_material_objects_delete_content_author
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'assignment-materials'
  and (select public.current_person_can_mutate_assignment_object(name))
);

revoke all on function public.current_person_can_manage_content(uuid) from public, anon;
revoke all on function public.current_person_can_publish_content(uuid) from public, anon;
revoke all on function public.assignment_version_offering_id(uuid) from public, anon, authenticated;
revoke all on function public.clone_curriculum_version(uuid, text) from public, anon;
revoke all on function public.publish_curriculum_version(uuid, text) from public, anon;
revoke all on function public.publish_assignment_version(uuid, text) from public, anon;
revoke all on function public.create_assignment_draft(uuid, uuid, text, text, text, text, text) from public, anon;
revoke all on function public.clone_assignment_version(uuid) from public, anon;
revoke all on function public.current_person_can_read_assignment_object(text) from public, anon;
revoke all on function public.current_person_can_mutate_assignment_object(text) from public, anon;
revoke all on function public.current_person_can_insert_assignment_object(text) from public, anon;
grant execute on function public.current_person_can_manage_content(uuid) to authenticated;
grant execute on function public.current_person_can_publish_content(uuid) to authenticated;
grant execute on function public.assignment_version_offering_id(uuid) to authenticated;
grant execute on function public.clone_curriculum_version(uuid, text) to authenticated;
grant execute on function public.publish_curriculum_version(uuid, text) to authenticated;
grant execute on function public.publish_assignment_version(uuid, text) to authenticated;
grant execute on function public.create_assignment_draft(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.clone_assignment_version(uuid) to authenticated;
grant execute on function public.current_person_can_read_assignment_object(text) to authenticated;
grant execute on function public.current_person_can_mutate_assignment_object(text) to authenticated;
grant execute on function public.current_person_can_insert_assignment_object(text) to authenticated;

comment on function public.current_person_can_manage_content(uuid) is
  'Current-state check for global or offering-scoped content draft authority.';
comment on function public.current_person_can_publish_content(uuid) is
  'Current-state check for global or offering-scoped content publication authority.';
comment on table public.assignment_versions is
  'Immutable once published. New corrections create another version under the stable assignment definition.';
comment on table public.assignment_materials is
  'Metadata for private staff-provided assignment files. Five files maximum, 10 MB each, approved MIME types only.';
