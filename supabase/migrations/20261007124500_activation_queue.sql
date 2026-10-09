alter table public.people
  add column display_name text,
  add constraint people_display_name_format check (
    display_name is null
    or (
      display_name = btrim(display_name)
      and length(display_name) between 2 and 120
    )
  );

create index enrollments_activation_queue_idx
  on public.enrollments (approved_at, id)
  where status = 'approved';

create or replace function public.list_student_activation_queue(
  p_limit integer default 25,
  p_search text default null
)
returns table (
  enrollment_id uuid,
  member_id text,
  student_display_name text,
  offering_title text,
  cohort_name text,
  source_type text,
  requested_at timestamptz,
  approved_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  search_term text := nullif(btrim(p_search), '');
begin
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception 'activation queue limit must be between 1 and 50' using errcode = '22023';
  end if;

  if not public.current_person_has_capability('enrollment.operate') then
    raise exception 'activation queue access is not authorized' using errcode = '42501';
  end if;

  if search_term is not null and length(search_term) > 80 then
    raise exception 'activation queue search is too long' using errcode = '22023';
  end if;

  return query
  select
    e.id,
    p.member_id,
    p.display_name,
    o.title,
    c.name,
    e.source_type,
    e.requested_at,
    e.approved_at
  from public.enrollments e
  join public.people p on p.id = e.person_id
  join public.offerings o on o.id = e.offering_id
  left join public.cohorts c on c.id = e.cohort_id
  where e.status = 'approved'
    and e.approved_at is not null
    and p.status = 'active'
    and p.member_id is not null
    and p.display_name is not null
    and exists (
      select 1
      from public.memberships m
      where m.person_id = e.person_id
        and m.kind = 'student'
        and m.status = 'active'
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    )
    and o.status = 'active'
    and (o.available_from is null or o.available_from <= now())
    and (o.available_until is null or o.available_until > now())
    and (c.id is null or c.status = 'active')
    and not exists (
      select 1
      from public.auth_identities ai
      where ai.person_id = p.id
    )
    and (
      search_term is null
      or position(lower(search_term) in lower(p.display_name)) > 0
      or position(lower(search_term) in lower(p.member_id)) > 0
    )
  order by e.approved_at, e.id
  limit p_limit;
end;
$$;

revoke all on function public.list_student_activation_queue(integer, text) from public, anon;
grant execute on function public.list_student_activation_queue(integer, text) to authenticated;

comment on column public.people.display_name is
  'Everyday operational display name. It is not a verified legal-name field.';
comment on function public.list_student_activation_queue(integer, text) is
  'Returns the minimal currently eligible initial-activation queue after checking live Enrolment Operator authority. No service credential or unrestricted people read is exposed to the browser.';
