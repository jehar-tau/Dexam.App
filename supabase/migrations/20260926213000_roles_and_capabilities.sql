create table public.app_roles (
  key text primary key,
  display_name text not null,
  description text not null,
  is_elevated boolean not null default false,
  created_at timestamptz not null default now(),
  constraint app_roles_key_format check (key ~ '^[a-z][a-z0-9_]{2,49}$')
);

create table public.capabilities (
  key text primary key,
  description text not null,
  requires_mfa boolean not null default false,
  requires_two_person boolean not null default false,
  created_at timestamptz not null default now(),
  constraint capabilities_key_format check (key ~ '^[a-z][a-z0-9_.]{2,79}$'),
  constraint capabilities_two_person_requires_mfa check (
    not requires_two_person or requires_mfa
  )
);

create table public.role_capabilities (
  role_key text not null references public.app_roles (key) on delete restrict,
  capability_key text not null references public.capabilities (key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (role_key, capability_key)
);

create table public.role_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  role_key text not null references public.app_roles (key) on delete restrict,
  scope_type text not null default 'global',
  scope_id uuid,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  granted_by_person_id uuid references public.people (id) on delete restrict,
  grant_reason text not null,
  created_at timestamptz not null default now(),
  constraint role_assignments_scope_valid check (
    (scope_type = 'global' and scope_id is null)
    or (scope_type <> 'global' and scope_id is not null)
  ),
  constraint role_assignments_scope_type_format check (
    scope_type ~ '^[a-z][a-z0-9_]{2,39}$'
  ),
  constraint role_assignments_time_order check (
    ends_at is null or ends_at > starts_at
  ),
  constraint role_assignments_revocation_order check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint role_assignments_reason_present check (
    length(btrim(grant_reason)) between 3 and 500
  )
);

create unique index role_assignments_one_current_scope
  on public.role_assignments (
    person_id,
    role_key,
    scope_type,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

create index role_assignments_person_active_idx
  on public.role_assignments (person_id, role_key, starts_at, ends_at)
  where revoked_at is null;

create table public.capability_grants (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  capability_key text not null references public.capabilities (key) on delete restrict,
  required_role_key text not null references public.app_roles (key) on delete restrict,
  scope_type text not null default 'global',
  scope_id uuid,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  revoked_at timestamptz,
  granted_by_person_id uuid references public.people (id) on delete restrict,
  grant_reason text not null,
  created_at timestamptz not null default now(),
  constraint capability_grants_scope_valid check (
    (scope_type = 'global' and scope_id is null)
    or (scope_type <> 'global' and scope_id is not null)
  ),
  constraint capability_grants_scope_type_format check (
    scope_type ~ '^[a-z][a-z0-9_]{2,39}$'
  ),
  constraint capability_grants_time_order check (
    ends_at is null or ends_at > starts_at
  ),
  constraint capability_grants_revocation_order check (
    revoked_at is null or revoked_at >= created_at
  ),
  constraint capability_grants_reason_present check (
    length(btrim(grant_reason)) between 3 and 500
  )
);

create unique index capability_grants_one_current_scope
  on public.capability_grants (
    person_id,
    capability_key,
    required_role_key,
    scope_type,
    coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where revoked_at is null;

create index capability_grants_person_active_idx
  on public.capability_grants (person_id, capability_key, starts_at, ends_at)
  where revoked_at is null;

insert into public.app_roles (key, display_name, description, is_elevated)
values
  ('student', 'Student', 'Learner access governed by ownership and enrolment.', false),
  ('teacher', 'Teacher', 'Academic access limited by explicit teaching assignments.', false),
  ('sales', 'Sales', 'Assigned lead and enrolment-request work only.', false),
  ('ordinary_admin', 'Ordinary Admin', 'Operational administration without security authority.', false),
  ('elevated_admin', 'Elevated Admin', 'Security-sensitive administration requiring stronger assurance.', true);

insert into public.capabilities (key, description, requires_mfa, requires_two_person)
values
  ('lead.manage_assigned', 'Manage leads explicitly assigned to the current salesperson.', false, false),
  ('enrollment.request_review', 'Submit a lead or application for enrolment review.', false, false),
  ('enrollment.operate', 'Review duplicates, create/link students, approve enrolment, and issue unused activation packs.', false, false),
  ('student_recovery.assist', 'Perform approved assisted recovery for an activated student.', true, false),
  ('recovery_contact.replace', 'Replace an established recovery contact through exceptional recovery.', true, true),
  ('staff_role.grant', 'Grant or revoke non-elevated staff roles and scoped capabilities.', true, false),
  ('elevated_role.manage', 'Grant or remove Elevated Admin authority.', true, true),
  ('employee.suspend', 'Immediately suspend an employee and revoke current access.', true, false),
  ('employee.restore', 'Restore a previously suspended employee.', true, true),
  ('sensitive_data.export', 'Approve and execute a bulk export of sensitive data.', true, true),
  ('security_controls.change', 'Disable or materially weaken a security control.', true, true);

insert into public.role_capabilities (role_key, capability_key)
values
  ('sales', 'lead.manage_assigned'),
  ('sales', 'enrollment.request_review'),
  ('ordinary_admin', 'enrollment.request_review'),
  ('elevated_admin', 'enrollment.request_review'),
  ('elevated_admin', 'enrollment.operate'),
  ('elevated_admin', 'student_recovery.assist'),
  ('elevated_admin', 'recovery_contact.replace'),
  ('elevated_admin', 'staff_role.grant'),
  ('elevated_admin', 'elevated_role.manage'),
  ('elevated_admin', 'employee.suspend'),
  ('elevated_admin', 'employee.restore'),
  ('elevated_admin', 'sensitive_data.export'),
  ('elevated_admin', 'security_controls.change');

alter table public.app_roles enable row level security;
alter table public.capabilities enable row level security;
alter table public.role_capabilities enable row level security;
alter table public.role_assignments enable row level security;
alter table public.capability_grants enable row level security;

create or replace function public.current_person_has_active_employee_membership()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    exists (
      select 1
      from public.people p
      join public.memberships m on m.person_id = p.id
      where p.id = public.current_person_id()
        and p.status = 'active'
        and m.kind = 'employee'
        and m.status = 'active'
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    ),
    false
  )
$$;

create or replace function public.current_person_has_role(
  p_role_key text,
  p_scope_type text default 'global',
  p_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    public.current_person_has_active_employee_membership()
    and exists (
      select 1
      from public.role_assignments ra
      where ra.person_id = public.current_person_id()
        and ra.role_key = p_role_key
        and ra.scope_type = p_scope_type
        and ra.scope_id is not distinct from p_scope_id
        and ra.revoked_at is null
        and ra.starts_at <= now()
        and (ra.ends_at is null or ra.ends_at > now())
    )
$$;

create or replace function public.current_person_has_capability(
  p_capability_key text,
  p_scope_type text default 'global',
  p_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with requested_capability as (
    select key, requires_mfa
    from public.capabilities
    where key = p_capability_key
  ),
  role_allows as (
    select 1
    from public.role_assignments ra
    join public.role_capabilities rc on rc.role_key = ra.role_key
    where ra.person_id = public.current_person_id()
      and rc.capability_key = p_capability_key
      and ra.scope_type = p_scope_type
      and ra.scope_id is not distinct from p_scope_id
      and ra.revoked_at is null
      and ra.starts_at <= now()
      and (ra.ends_at is null or ra.ends_at > now())
  ),
  direct_grant_allows as (
    select 1
    from public.capability_grants cg
    join public.role_assignments ra
      on ra.person_id = cg.person_id
      and ra.role_key = cg.required_role_key
      and ra.scope_type = cg.scope_type
      and ra.scope_id is not distinct from cg.scope_id
      and ra.revoked_at is null
      and ra.starts_at <= now()
      and (ra.ends_at is null or ra.ends_at > now())
    where cg.person_id = public.current_person_id()
      and cg.capability_key = p_capability_key
      and cg.scope_type = p_scope_type
      and cg.scope_id is not distinct from p_scope_id
      and cg.revoked_at is null
      and cg.starts_at <= now()
      and (cg.ends_at is null or cg.ends_at > now())
  )
  select coalesce(
    public.current_person_has_active_employee_membership()
    and exists (select 1 from requested_capability)
    and (
      not (select requires_mfa from requested_capability)
      or coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    )
    and (
      exists (select 1 from role_allows)
      or exists (select 1 from direct_grant_allows)
    ),
    false
  )
$$;

create or replace function public.bootstrap_first_elevated_admin(p_person_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if exists (
    select 1
    from public.role_assignments
    where role_key = 'elevated_admin'
      and revoked_at is null
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
  ) then
    return false;
  end if;

  if not exists (
    select 1
    from public.people p
    join public.memberships m on m.person_id = p.id
    where p.id = p_person_id
      and p.status = 'active'
      and m.kind = 'employee'
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  ) then
    return false;
  end if;

  insert into public.role_assignments (
    person_id,
    role_key,
    grant_reason
  ) values (
    p_person_id,
    'elevated_admin',
    'one-time first Elevated Admin bootstrap'
  );

  insert into public.security_audit_events (
    subject_person_id,
    event_type,
    outcome,
    reason_code,
    metadata
  ) values (
    p_person_id,
    'first_elevated_admin_bootstrapped',
    'succeeded',
    'product_owner_approved_bootstrap',
    jsonb_build_object('procedure_disabled_by_existing_assignment', true)
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on table public.app_roles from anon, authenticated;
revoke all on table public.capabilities from anon, authenticated;
revoke all on table public.role_capabilities from anon, authenticated;
revoke all on table public.role_assignments from anon, authenticated;
revoke all on table public.capability_grants from anon, authenticated;

grant select on table public.app_roles to authenticated;
grant select on table public.capabilities to authenticated;
grant select on table public.role_capabilities to authenticated;
grant select on table public.role_assignments to authenticated;
grant select on table public.capability_grants to authenticated;

grant all on table public.app_roles to service_role;
grant all on table public.capabilities to service_role;
grant all on table public.role_capabilities to service_role;
grant all on table public.role_assignments to service_role;
grant all on table public.capability_grants to service_role;

revoke all on function public.current_person_has_active_employee_membership() from public, anon;
revoke all on function public.current_person_has_role(text, text, uuid) from public, anon;
revoke all on function public.current_person_has_capability(text, text, uuid) from public, anon;
grant execute on function public.current_person_has_active_employee_membership() to authenticated;
grant execute on function public.current_person_has_role(text, text, uuid) to authenticated;
grant execute on function public.current_person_has_capability(text, text, uuid) to authenticated;

revoke all on function public.bootstrap_first_elevated_admin(uuid) from public, anon, authenticated;
grant execute on function public.bootstrap_first_elevated_admin(uuid) to service_role;

create policy app_roles_select_active_employee
on public.app_roles
for select
to authenticated
using ((select public.current_person_has_active_employee_membership()));

create policy capabilities_select_active_employee
on public.capabilities
for select
to authenticated
using ((select public.current_person_has_active_employee_membership()));

create policy role_capabilities_select_active_employee
on public.role_capabilities
for select
to authenticated
using ((select public.current_person_has_active_employee_membership()));

create policy role_assignments_select_own_or_elevated
on public.role_assignments
for select
to authenticated
using (
  person_id = (select public.current_person_id())
  or (select public.current_person_has_role('elevated_admin'))
);

create policy capability_grants_select_own_or_elevated
on public.capability_grants
for select
to authenticated
using (
  person_id = (select public.current_person_id())
  or (select public.current_person_has_role('elevated_admin'))
);

comment on table public.capability_grants is
  'Explicit scoped capability grants. A grant is effective only while its required role assignment is also active.';
comment on function public.current_person_has_capability(text, text, uuid) is
  'Evaluates current person, employee membership, role/grant, scope, time, revocation, and required MFA state from current database/JWT assurance.';
comment on function public.bootstrap_first_elevated_admin(uuid) is
  'One-time service-role bootstrap. It refuses to run after any active Elevated Admin assignment exists.';

