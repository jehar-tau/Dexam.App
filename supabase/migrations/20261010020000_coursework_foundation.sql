create type public.curriculum_status as enum ('draft', 'published', 'retired');

create table public.curriculum_versions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete restrict,
  version_number integer not null,
  title text not null,
  status public.curriculum_status not null default 'draft',
  created_by_person_id uuid references public.people (id) on delete restrict,
  published_by_person_id uuid references public.people (id) on delete restrict,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_versions_number_positive check (version_number > 0),
  constraint curriculum_versions_title_present check (length(btrim(title)) between 2 and 160),
  constraint curriculum_versions_offering_number_unique unique (offering_id, version_number),
  constraint curriculum_versions_id_offering_unique unique (id, offering_id),
  constraint curriculum_versions_lifecycle_consistent check (
    (
      status = 'draft'
      and published_at is null
      and published_by_person_id is null
      and retired_at is null
    )
    or (
      status = 'published'
      and published_at is not null
      and published_by_person_id is not null
      and retired_at is null
    )
    or (
      status = 'retired'
      and published_at is not null
      and published_by_person_id is not null
      and retired_at is not null
      and retired_at >= published_at
    )
  )
);

create table public.curriculum_sections (
  id uuid primary key default gen_random_uuid(),
  curriculum_version_id uuid not null references public.curriculum_versions (id) on delete restrict,
  code text not null,
  title text not null,
  description text,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_sections_code_format check (code ~ '^[A-Z][A-Z0-9_-]{1,31}$'),
  constraint curriculum_sections_title_present check (length(btrim(title)) between 2 and 160),
  constraint curriculum_sections_description_length check (
    description is null or length(description) between 1 and 2000
  ),
  constraint curriculum_sections_position_positive check (position > 0),
  constraint curriculum_sections_version_code_unique unique (curriculum_version_id, code),
  constraint curriculum_sections_version_position_unique unique (curriculum_version_id, position)
);

create table public.curriculum_topics (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.curriculum_sections (id) on delete restrict,
  code text not null,
  title text not null,
  summary text,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_topics_code_format check (code ~ '^[A-Z][A-Z0-9_-]{1,39}$'),
  constraint curriculum_topics_title_present check (length(btrim(title)) between 2 and 200),
  constraint curriculum_topics_summary_length check (
    summary is null or length(summary) between 1 and 4000
  ),
  constraint curriculum_topics_position_positive check (position > 0),
  constraint curriculum_topics_section_code_unique unique (section_id, code),
  constraint curriculum_topics_section_position_unique unique (section_id, position)
);

create table public.curriculum_lessons (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.curriculum_topics (id) on delete restrict,
  code text not null,
  title text not null,
  summary text,
  body_markdown text,
  position integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint curriculum_lessons_code_format check (code ~ '^[A-Z][A-Z0-9_-]{1,39}$'),
  constraint curriculum_lessons_title_present check (length(btrim(title)) between 2 and 200),
  constraint curriculum_lessons_summary_length check (
    summary is null or length(summary) between 1 and 4000
  ),
  constraint curriculum_lessons_body_length check (
    body_markdown is null or length(body_markdown) between 1 and 50000
  ),
  constraint curriculum_lessons_position_positive check (position > 0),
  constraint curriculum_lessons_topic_code_unique unique (topic_id, code),
  constraint curriculum_lessons_topic_position_unique unique (topic_id, position)
);

alter table public.cohorts
  add column curriculum_version_id uuid,
  add constraint cohorts_curriculum_matches_offering foreign key (curriculum_version_id, offering_id)
    references public.curriculum_versions (id, offering_id) on delete restrict;

alter table public.enrollments
  add column curriculum_version_id uuid,
  add constraint enrollments_direct_curriculum_requires_no_cohort check (
    cohort_id is null or curriculum_version_id is null
  ),
  add constraint enrollments_curriculum_matches_offering foreign key (curriculum_version_id, offering_id)
    references public.curriculum_versions (id, offering_id) on delete restrict;

create index curriculum_versions_offering_idx
  on public.curriculum_versions (offering_id, status, version_number desc);
create index curriculum_sections_version_idx
  on public.curriculum_sections (curriculum_version_id, position);
create index curriculum_topics_section_idx on public.curriculum_topics (section_id, position);
create index curriculum_lessons_topic_idx on public.curriculum_lessons (topic_id, position);
create index cohorts_curriculum_idx on public.cohorts (curriculum_version_id)
  where curriculum_version_id is not null;
create index enrollments_curriculum_idx on public.enrollments (curriculum_version_id)
  where curriculum_version_id is not null;

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
      new.created_by_person_id, new.published_by_person_id, new.published_at, new.created_at
    ) is not distinct from row(
      old.id, old.offering_id, old.version_number, old.title,
      old.created_by_person_id, old.published_by_person_id, old.published_at, old.created_at
    )
  then
    return new;
  end if;

  raise exception using errcode = '55000', message = 'published curriculum versions are immutable';
end;
$$;

create trigger curriculum_versions_lifecycle_guard
before insert or update on public.curriculum_versions
for each row execute function public.enforce_curriculum_version_lifecycle();

create or replace function public.enforce_draft_curriculum_content()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_version_id uuid;
  new_version_id uuid;
  old_status public.curriculum_status;
  new_status public.curriculum_status;
begin
  if tg_table_name = 'curriculum_sections' then
    if tg_op <> 'INSERT' then old_version_id := old.curriculum_version_id; end if;
    if tg_op <> 'DELETE' then new_version_id := new.curriculum_version_id; end if;
  elsif tg_table_name = 'curriculum_topics' then
    if tg_op <> 'INSERT' then
      select s.curriculum_version_id into old_version_id
      from public.curriculum_sections s where s.id = old.section_id;
    end if;
    if tg_op <> 'DELETE' then
      select s.curriculum_version_id into new_version_id
      from public.curriculum_sections s where s.id = new.section_id;
    end if;
  elsif tg_table_name = 'curriculum_lessons' then
    if tg_op <> 'INSERT' then
      select s.curriculum_version_id into old_version_id
      from public.curriculum_topics t
      join public.curriculum_sections s on s.id = t.section_id
      where t.id = old.topic_id;
    end if;
    if tg_op <> 'DELETE' then
      select s.curriculum_version_id into new_version_id
      from public.curriculum_topics t
      join public.curriculum_sections s on s.id = t.section_id
      where t.id = new.topic_id;
    end if;
  end if;

  if old_version_id is not null then
    select status into old_status from public.curriculum_versions where id = old_version_id;
    if old_status <> 'draft' then
      raise exception using errcode = '55000', message = 'published curriculum content is immutable';
    end if;
  end if;

  if new_version_id is not null then
    select status into new_status from public.curriculum_versions where id = new_version_id;
    if new_status <> 'draft' then
      raise exception using errcode = '55000', message = 'published curriculum content is immutable';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger curriculum_sections_draft_guard
before insert or update or delete on public.curriculum_sections
for each row execute function public.enforce_draft_curriculum_content();
create trigger curriculum_topics_draft_guard
before insert or update or delete on public.curriculum_topics
for each row execute function public.enforce_draft_curriculum_content();
create trigger curriculum_lessons_draft_guard
before insert or update or delete on public.curriculum_lessons
for each row execute function public.enforce_draft_curriculum_content();

create or replace function public.enforce_curriculum_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  assigned_status public.curriculum_status;
begin
  if tg_op = 'UPDATE'
    and old.curriculum_version_id is not null
    and new.curriculum_version_id is distinct from old.curriculum_version_id
  then
    raise exception using errcode = '55000', message = 'curriculum assignment is immutable';
  end if;

  if new.curriculum_version_id is null then return new; end if;

  if tg_table_name = 'enrollments' then
    if new.cohort_id is not null then
      raise exception using errcode = '23514', message = 'cohort enrolments inherit curriculum from the cohort';
    end if;
  end if;

  select status into assigned_status
  from public.curriculum_versions
  where id = new.curriculum_version_id;

  if assigned_status is distinct from 'published'::public.curriculum_status then
    raise exception using errcode = '23514', message = 'only a published curriculum can be assigned';
  end if;

  return new;
end;
$$;

create trigger cohorts_curriculum_assignment_guard
before insert or update of curriculum_version_id on public.cohorts
for each row execute function public.enforce_curriculum_assignment();
create trigger enrollments_curriculum_assignment_guard
before insert or update of curriculum_version_id, cohort_id on public.enrollments
for each row execute function public.enforce_curriculum_assignment();

create or replace function public.current_person_can_read_curriculum(p_curriculum_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    public.current_person_has_active_student_membership()
    and exists (
      select 1
      from public.curriculum_versions cv
      join public.offerings o on o.id = cv.offering_id
      join public.enrollments e
        on e.person_id = public.current_person_id()
        and e.offering_id = cv.offering_id
      left join public.cohorts c on c.id = e.cohort_id
      where cv.id = p_curriculum_version_id
        and cv.status = 'published'
        and o.status = 'active'
        and e.status = 'active'
        and (
          (e.cohort_id is null and e.curriculum_version_id = cv.id)
          or (
            e.cohort_id is not null
            and c.status = 'active'
            and c.curriculum_version_id = cv.id
          )
        )
    )
$$;

alter table public.curriculum_versions enable row level security;
alter table public.curriculum_sections enable row level security;
alter table public.curriculum_topics enable row level security;
alter table public.curriculum_lessons enable row level security;

revoke all on table public.curriculum_versions from anon, authenticated;
revoke all on table public.curriculum_sections from anon, authenticated;
revoke all on table public.curriculum_topics from anon, authenticated;
revoke all on table public.curriculum_lessons from anon, authenticated;
grant select on table public.curriculum_versions to authenticated;
grant select on table public.curriculum_sections to authenticated;
grant select on table public.curriculum_topics to authenticated;
grant select on table public.curriculum_lessons to authenticated;
grant all on table public.curriculum_versions to service_role;
grant all on table public.curriculum_sections to service_role;
grant all on table public.curriculum_topics to service_role;
grant all on table public.curriculum_lessons to service_role;

revoke all on function public.enforce_curriculum_version_lifecycle() from public, anon, authenticated;
revoke all on function public.enforce_draft_curriculum_content() from public, anon, authenticated;
revoke all on function public.enforce_curriculum_assignment() from public, anon, authenticated;
revoke all on function public.current_person_can_read_curriculum(uuid) from public, anon;
grant execute on function public.current_person_can_read_curriculum(uuid) to authenticated;

create policy curriculum_versions_select_assigned_published
on public.curriculum_versions
for select
to authenticated
using ((select public.current_person_can_read_curriculum(id)));

create policy curriculum_sections_select_assigned_published
on public.curriculum_sections
for select
to authenticated
using ((select public.current_person_can_read_curriculum(curriculum_version_id)));

create policy curriculum_topics_select_assigned_published
on public.curriculum_topics
for select
to authenticated
using (
  (select public.current_person_can_read_curriculum(
    (select s.curriculum_version_id from public.curriculum_sections s where s.id = section_id)
  ))
);

create policy curriculum_lessons_select_assigned_published
on public.curriculum_lessons
for select
to authenticated
using (
  (select public.current_person_can_read_curriculum(
    (
      select s.curriculum_version_id
      from public.curriculum_topics t
      join public.curriculum_sections s on s.id = t.section_id
      where t.id = topic_id
    )
  ))
);

comment on table public.curriculum_versions is
  'Immutable once published. Cohorts or cohort-free enrolments pin one published version.';
comment on table public.curriculum_sections is
  'Ordered subject areas or curriculum sections, such as Drawing and Aptitude.';
comment on table public.curriculum_topics is
  'Ordered teaching topics sourced from an approved curriculum version.';
comment on table public.curriculum_lessons is
  'Optional text-first lesson content under a curriculum topic. Markdown is stored as untrusted text.';
comment on function public.current_person_can_read_curriculum(uuid) is
  'Current-state student access check for one assigned, published curriculum version.';
