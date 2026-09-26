create type public.person_status as enum ('active', 'suspended', 'archived');
create type public.membership_kind as enum ('student', 'employee');
create type public.membership_status as enum ('pending', 'active', 'suspended', 'ended');
create type public.auth_identity_kind as enum ('member_id', 'employee_email');

create table public.people (
  id uuid primary key default gen_random_uuid(),
  member_id text,
  status public.person_status not null default 'active',
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint people_member_id_format check (
    member_id is null or member_id ~ '^DXM-[A-Z0-9]{8,20}$'
  ),
  constraint people_suspension_consistent check (
    (status = 'suspended' and suspended_at is not null)
    or (status <> 'suspended' and suspended_at is null)
  )
);

create unique index people_member_id_unique
  on public.people (member_id)
  where member_id is not null;

create table public.auth_identities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  auth_user_id uuid not null references auth.users (id) on delete restrict,
  kind public.auth_identity_kind not null,
  created_at timestamptz not null default now(),
  constraint auth_identities_auth_user_unique unique (auth_user_id),
  constraint auth_identities_person_kind_unique unique (person_id, kind)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  kind public.membership_kind not null,
  status public.membership_status not null default 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memberships_time_order check (
    ends_at is null or starts_at is null or ends_at > starts_at
  )
);

create index memberships_person_id_idx on public.memberships (person_id);
create unique index memberships_one_current_kind_per_person
  on public.memberships (person_id, kind)
  where status in ('pending', 'active', 'suspended');

alter table public.people enable row level security;
alter table public.auth_identities enable row level security;
alter table public.memberships enable row level security;

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select person_id
  from public.auth_identities
  where auth_user_id = (select auth.uid())
  limit 1
$$;

create or replace function public.current_person_is_active()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    (
      select status = 'active'
      from public.people
      where id = public.current_person_id()
    ),
    false
  )
$$;

revoke all on function public.current_person_id() from public;
revoke all on function public.current_person_is_active() from public;
grant execute on function public.current_person_id() to authenticated;
grant execute on function public.current_person_is_active() to authenticated;

revoke all on table public.people from anon, authenticated;
revoke all on table public.auth_identities from anon, authenticated;
revoke all on table public.memberships from anon, authenticated;

grant select on table public.people to authenticated;
grant select on table public.auth_identities to authenticated;
grant select on table public.memberships to authenticated;

create policy people_select_own_active
on public.people
for select
to authenticated
using (
  id = (select public.current_person_id())
  and (select public.current_person_is_active())
);

create policy auth_identities_select_own_active
on public.auth_identities
for select
to authenticated
using (
  person_id = (select public.current_person_id())
  and (select public.current_person_is_active())
);

create policy memberships_select_own_active
on public.memberships
for select
to authenticated
using (
  person_id = (select public.current_person_id())
  and (select public.current_person_is_active())
);

comment on column public.people.member_id is
  'Immutable student-facing Dexam Member ID. It is not an email address or authentication-provider identifier.';
comment on table public.auth_identities is
  'Links a Supabase Auth user to exactly one canonical Dexam person. Creation and mutation are trusted-server operations.';
comment on function public.current_person_is_active() is
  'Checks current database state so suspension overrides stale access-token claims.';
