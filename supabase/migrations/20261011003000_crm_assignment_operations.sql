create or replace function public.list_crm_assignment_queue(
  p_limit integer default 25,
  p_search text default null,
  p_queue text default 'unassigned'
)
returns table (
  id uuid,
  subject_name text,
  contact_relationship public.crm_contact_relationship,
  source text,
  interest_summary text,
  target_intake text,
  stage public.crm_enquiry_stage,
  current_owner_person_id uuid,
  current_owner_name text,
  owner_is_eligible boolean,
  follow_up_due_at timestamptz,
  created_at timestamptz
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
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'CRM assignment list limit must be between 1 and 100';
  end if;
  if search_term is not null and length(search_term) > 80 then
    raise exception using errcode = '22023', message = 'CRM assignment search is too long';
  end if;
  if p_queue not in ('unassigned', 'needs_reassignment') then
    raise exception using errcode = '22023', message = 'CRM assignment queue is invalid';
  end if;
  if not public.person_has_global_capability(public.current_person_id(), 'lead.assign') then
    raise exception using errcode = '42501', message = 'CRM assignment access denied';
  end if;

  return query
  select
    e.id,
    subject.display_name,
    e.contact_relationship,
    e.source,
    e.interest_summary,
    e.target_intake,
    e.stage,
    e.owner_person_id,
    owner.display_name,
    case
      when e.owner_person_id is null then false
      else public.person_has_global_capability(e.owner_person_id, 'lead.manage_assigned')
    end,
    follow_up.due_at,
    e.created_at
  from public.crm_enquiries e
  join public.people subject on subject.id = e.subject_person_id
  left join public.people owner on owner.id = e.owner_person_id
  left join lateral (
    select f.due_at
    from public.crm_follow_ups f
    where f.enquiry_id = e.id and f.status = 'open'
    limit 1
  ) follow_up on true
  where e.stage <> 'closed'
    and (
      (p_queue = 'unassigned' and e.owner_person_id is null)
      or (
        p_queue = 'needs_reassignment'
        and e.owner_person_id is not null
        and not public.person_has_global_capability(e.owner_person_id, 'lead.manage_assigned')
      )
    )
    and (
      search_term is null
      or position(lower(search_term) in lower(subject.display_name)) > 0
      or position(lower(search_term) in lower(e.interest_summary)) > 0
      or position(lower(search_term) in lower(coalesce(owner.display_name, ''))) > 0
    )
  order by
    case when follow_up.due_at < now() then 0 when follow_up.due_at is not null then 1 else 2 end,
    follow_up.due_at nulls last,
    e.created_at,
    e.id
  limit p_limit;
end;
$$;

create or replace function public.list_crm_eligible_owners(
  p_limit integer default 50,
  p_search text default null
)
returns table (
  person_id uuid,
  display_name text
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
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'CRM owner list limit must be between 1 and 100';
  end if;
  if search_term is not null and length(search_term) > 80 then
    raise exception using errcode = '22023', message = 'CRM owner search is too long';
  end if;
  if not public.person_has_global_capability(public.current_person_id(), 'lead.assign') then
    raise exception using errcode = '42501', message = 'CRM assignment access denied';
  end if;

  return query
  select p.id, p.display_name
  from public.people p
  where public.person_has_global_capability(p.id, 'lead.manage_assigned')
    and (
      search_term is null
      or position(lower(search_term) in lower(p.display_name)) > 0
    )
  order by lower(p.display_name), p.id
  limit p_limit;
end;
$$;

revoke all on function public.assign_crm_enquiry(uuid, uuid, text) from public, anon, authenticated;
drop function public.assign_crm_enquiry(uuid, uuid, text);

create function public.assign_crm_enquiry(
  p_enquiry_id uuid,
  p_owner_person_id uuid,
  p_reason text,
  p_expected_owner_person_id uuid,
  p_expect_unassigned boolean
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  prior_owner_id uuid;
  enquiry_stage public.crm_enquiry_stage;
  old_follow_up public.crm_follow_ups%rowtype;
  new_follow_up_id uuid;
begin
  if not public.person_has_global_capability(public.current_person_id(), 'lead.assign') then
    raise exception using errcode = '42501', message = 'CRM assignment denied';
  end if;
  if p_expect_unassigned is null
     or (p_expect_unassigned and p_expected_owner_person_id is not null)
     or (not p_expect_unassigned and p_expected_owner_person_id is null) then
    raise exception using errcode = '22023', message = 'expected CRM owner state is invalid';
  end if;
  if not public.person_has_global_capability(p_owner_person_id, 'lead.manage_assigned') then
    raise exception using errcode = '22023', message = 'target owner is not an active Sales owner';
  end if;
  if p_reason is null or btrim(p_reason) <> p_reason or length(p_reason) not between 3 and 240 then
    raise exception using errcode = '22023', message = 'assignment reason is invalid';
  end if;

  select e.owner_person_id, e.stage
  into strict prior_owner_id, enquiry_stage
  from public.crm_enquiries e
  where e.id = p_enquiry_id
  for update;

  if enquiry_stage = 'closed' then
    raise exception using errcode = '55000', message = 'closed enquiries cannot be assigned';
  end if;
  if (p_expect_unassigned and prior_owner_id is not null)
     or (not p_expect_unassigned and prior_owner_id is distinct from p_expected_owner_person_id) then
    raise exception using errcode = '40001', message = 'CRM enquiry ownership changed; refresh and try again';
  end if;
  if prior_owner_id is not distinct from p_owner_person_id then
    return;
  end if;

  select * into old_follow_up
  from public.crm_follow_ups
  where enquiry_id = p_enquiry_id and status = 'open'
  for update;

  if old_follow_up.id is not null then
    update public.crm_follow_ups
    set status = 'cancelled',
        disposition = 'Replaced after enquiry reassignment',
        completed_at = now()
    where id = old_follow_up.id;
  end if;

  update public.crm_enquiries
  set owner_person_id = p_owner_person_id, updated_at = now()
  where id = p_enquiry_id;

  insert into public.crm_enquiry_ownership_history (
    enquiry_id, from_owner_person_id, to_owner_person_id, assigned_by_person_id, reason
  ) values (
    p_enquiry_id, prior_owner_id, p_owner_person_id, public.current_person_id(), p_reason
  );

  if old_follow_up.id is not null then
    insert into public.crm_follow_ups (
      enquiry_id, assigned_to_person_id, due_at, created_by_person_id
    ) values (
      p_enquiry_id,
      p_owner_person_id,
      greatest(old_follow_up.due_at, now() + interval '5 minutes'),
      public.current_person_id()
    ) returning id into new_follow_up_id;

    update public.crm_follow_ups
    set status = 'replaced', replaced_by_follow_up_id = new_follow_up_id
    where id = old_follow_up.id;
  end if;
end;
$$;

revoke all on function public.list_crm_assignment_queue(integer, text, text) from public, anon;
revoke all on function public.list_crm_eligible_owners(integer, text) from public, anon;
revoke all on function public.assign_crm_enquiry(uuid, uuid, text, uuid, boolean) from public, anon;

grant execute on function public.list_crm_assignment_queue(integer, text, text) to authenticated;
grant execute on function public.list_crm_eligible_owners(integer, text) to authenticated;
grant execute on function public.assign_crm_enquiry(uuid, uuid, text, uuid, boolean) to authenticated;

comment on function public.list_crm_assignment_queue(integer, text, text) is
  'Capability-gated, bounded allocation queue for unassigned enquiries and enquiries whose recorded owner is no longer an active Sales owner.';
comment on function public.list_crm_eligible_owners(integer, text) is
  'Returns only stable ID and operational display name for active employees who currently hold assigned-lead authority.';
comment on function public.assign_crm_enquiry(uuid, uuid, text, uuid, boolean) is
  'Reason-required single-record assignment with current coordinator/target authorization, expected-owner concurrency protection, immutable history, and follow-up replacement.';
