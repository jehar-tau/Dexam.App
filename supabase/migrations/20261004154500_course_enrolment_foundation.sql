create type public.offering_status as enum ('draft', 'active', 'archived');
create type public.cohort_status as enum ('planned', 'active', 'completed', 'cancelled');
create type public.enrollment_status as enum (
  'requested',
  'approved',
  'active',
  'completed',
  'rejected',
  'cancelled',
  'withdrawn',
  'expired'
);

create table public.offerings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  offering_type text not null default 'course',
  status public.offering_status not null default 'draft',
  available_from timestamptz,
  available_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offerings_code_format check (code ~ '^[A-Z][A-Z0-9_-]{2,31}$'),
  constraint offerings_title_present check (length(btrim(title)) between 2 and 160),
  constraint offerings_type_format check (offering_type ~ '^[a-z][a-z0-9_]{2,39}$'),
  constraint offerings_date_order check (
    available_until is null or available_from is null or available_until > available_from
  )
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings (id) on delete restrict,
  code text not null,
  name text not null,
  status public.cohort_status not null default 'planned',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cohorts_code_format check (code ~ '^[A-Z][A-Z0-9_-]{2,31}$'),
  constraint cohorts_name_present check (length(btrim(name)) between 2 and 160),
  constraint cohorts_date_order check (
    ends_at is null or starts_at is null or ends_at > starts_at
  ),
  constraint cohorts_offering_code_unique unique (offering_id, code),
  constraint cohorts_id_offering_unique unique (id, offering_id)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  offering_id uuid not null references public.offerings (id) on delete restrict,
  cohort_id uuid,
  status public.enrollment_status not null default 'requested',
  source_type text not null,
  source_reference text,
  requested_by_person_id uuid references public.people (id) on delete restrict,
  approved_by_person_id uuid references public.people (id) on delete restrict,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  activated_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_cohort_matches_offering foreign key (cohort_id, offering_id)
    references public.cohorts (id, offering_id) on delete restrict,
  constraint enrollments_source_type_format check (source_type ~ '^[a-z][a-z0-9_]{2,39}$'),
  constraint enrollments_source_reference_length check (
    source_reference is null or length(source_reference) between 1 and 160
  ),
  constraint enrollments_approval_consistent check (
    (approved_at is null and approved_by_person_id is null)
    or (approved_at is not null and approved_by_person_id is not null)
  ),
  constraint enrollments_activation_after_approval check (
    activated_at is null or (approved_at is not null and activated_at >= approved_at)
  ),
  constraint enrollments_end_after_request check (
    ended_at is null or ended_at >= requested_at
  )
);

create unique index enrollments_one_open_context
  on public.enrollments (
    person_id,
    offering_id,
    coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where status in ('requested', 'approved', 'active');

create index enrollments_person_idx on public.enrollments (person_id, created_at desc);
create index enrollments_offering_cohort_idx on public.enrollments (offering_id, cohort_id, status);

create table public.enrollment_transitions (
  id bigint generated always as identity primary key,
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  from_status public.enrollment_status,
  to_status public.enrollment_status not null,
  actor_person_id uuid references public.people (id) on delete restrict,
  reason_code text not null,
  occurred_at timestamptz not null default now(),
  constraint enrollment_transitions_reason_format check (
    reason_code ~ '^[a-z][a-z0-9_]{2,79}$'
  ),
  constraint enrollment_transitions_actual_change check (
    from_status is null or from_status <> to_status
  )
);

create index enrollment_transitions_enrollment_idx
  on public.enrollment_transitions (enrollment_id, occurred_at);

create or replace function public.enrollment_can_issue_activation(p_enrollment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.enrollments e
    join public.people p on p.id = e.person_id
    join public.memberships m on m.person_id = e.person_id
    join public.offerings o on o.id = e.offering_id
    left join public.cohorts c on c.id = e.cohort_id
    where e.id = p_enrollment_id
      and e.status = 'active'
      and e.approved_at is not null
      and e.activated_at is not null
      and p.status = 'active'
      and p.member_id is not null
      and m.kind = 'student'
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
      and o.status = 'active'
      and (o.available_from is null or o.available_from <= now())
      and (o.available_until is null or o.available_until > now())
      and (c.id is null or c.status = 'active')
  ), false)
$$;

alter table public.offerings enable row level security;
alter table public.cohorts enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_transitions enable row level security;

revoke all on table public.offerings from anon, authenticated;
revoke all on table public.cohorts from anon, authenticated;
revoke all on table public.enrollments from anon, authenticated;
revoke all on table public.enrollment_transitions from anon, authenticated;
revoke all on sequence public.enrollment_transitions_id_seq from anon, authenticated;

grant select on table public.offerings to authenticated;
grant select on table public.cohorts to authenticated;
grant select on table public.enrollments to authenticated;
grant select on table public.enrollment_transitions to authenticated;

grant all on table public.offerings to service_role;
grant all on table public.cohorts to service_role;
grant all on table public.enrollments to service_role;
grant all on table public.enrollment_transitions to service_role;
grant usage, select on sequence public.enrollment_transitions_id_seq to service_role;

revoke all on function public.enrollment_can_issue_activation(uuid) from public, anon, authenticated;
grant execute on function public.enrollment_can_issue_activation(uuid) to service_role;

create policy offerings_select_through_own_enrollment_or_operator
on public.offerings
for select
to authenticated
using (
  (select public.current_person_is_active())
  and (
    exists (
      select 1 from public.enrollments e
      where e.offering_id = offerings.id
        and e.person_id = (select public.current_person_id())
    )
    or (select public.current_person_has_capability('enrollment.operate'))
  )
);

create policy cohorts_select_through_own_enrollment_or_operator
on public.cohorts
for select
to authenticated
using (
  (select public.current_person_is_active())
  and (
    exists (
      select 1 from public.enrollments e
      where e.cohort_id = cohorts.id
        and e.person_id = (select public.current_person_id())
    )
    or (select public.current_person_has_capability('enrollment.operate'))
  )
);

create policy enrollments_select_own_or_operator
on public.enrollments
for select
to authenticated
using (
  (
    person_id = (select public.current_person_id())
    and (select public.current_person_is_active())
  )
  or (select public.current_person_has_capability('enrollment.operate'))
);

create policy enrollment_transitions_select_own_or_operator
on public.enrollment_transitions
for select
to authenticated
using (
  exists (
    select 1
    from public.enrollments e
    where e.id = enrollment_transitions.enrollment_id
      and (
        (
          e.person_id = (select public.current_person_id())
          and (select public.current_person_is_active())
        )
        or (select public.current_person_has_capability('enrollment.operate'))
      )
  )
);

comment on table public.offerings is
  'Reusable learning products. An offering is independent of any one delivery batch or learner.';
comment on table public.cohorts is
  'Optional delivery groups within an offering, such as a named batch.';
comment on table public.enrollments is
  'Time-bound relationship between a canonical person and an offering, optionally within a cohort.';
comment on function public.enrollment_can_issue_activation(uuid) is
  'Trusted-server eligibility check. True only for a currently active, approved enrolment and active student identity context.';
