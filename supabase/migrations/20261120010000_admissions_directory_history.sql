-- F054: let the existing admissions administrators read one bounded page of evidence.
create index admission_history_enrollment_page
  on public.admission_change_history (enrollment_id, occurred_at desc, id desc);
create index admission_receipts_enrollment_page
  on public.admission_receipts (enrollment_id, confirmed_at desc, id desc);

create function public.get_admission_history_page(p_enrollment uuid, p_page integer)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$
declare
  page_size constant integer := 25;
  visible_fields constant text[] := array['name', 'startsAt', 'expiresAt', 'state', 'cohortId', 'revision', 'receiptId'];
  skip_rows bigint;
  changes jsonb;
  receipts jsonb;
begin
  if not public.current_person_can_manage_admissions() then
    raise exception using errcode='42501', message='admissions access denied';
  end if;
  if p_enrollment is null or p_page is null or p_page < 0 then
    raise exception using errcode='22023', message='invalid admission history page';
  end if;
  skip_rows := p_page::bigint * page_size;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', h.id, 'actorId', h.actor_person_id, 'actorName', actor.display_name,
    'action', h.action, 'reason', h.reason, 'at', h.occurred_at,
    'prior', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
              from jsonb_each(h.prior_values) where key = any(visible_fields)),
    'next', (select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
             from jsonb_each(h.new_values) where key = any(visible_fields))
  ) order by h.occurred_at desc, h.id desc), '[]'::jsonb)
  into changes
  from (
    select * from public.admission_change_history where enrollment_id = p_enrollment
    order by occurred_at desc, id desc limit (page_size + 1) offset skip_rows
  ) h
  join public.people actor on actor.id = h.actor_person_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'evidenceKind', r.evidence_kind, 'method', r.method,
    'amountPaise', r.amount_paise, 'currency', r.currency, 'paidAt', r.paid_at,
    'reference', r.reference, 'confirmedBy', r.confirmed_by,
    'confirmedByName', confirmer.display_name, 'confirmedAt', r.confirmed_at
  ) order by r.confirmed_at desc, r.id desc), '[]'::jsonb)
  into receipts
  from (
    select id, evidence_kind, method, amount_paise, currency, paid_at, reference, confirmed_by, confirmed_at
    from public.admission_receipts where enrollment_id = p_enrollment
    order by confirmed_at desc, id desc limit (page_size + 1) offset skip_rows
  ) r
  join public.people confirmer on confirmer.id = r.confirmed_by;

  -- Each array contains at most one lookahead row, at zero-based index page_size.
  return jsonb_build_object(
    'changes', changes - page_size, 'receipts', receipts - page_size,
    'hasMore', jsonb_array_length(changes) > page_size or jsonb_array_length(receipts) > page_size
  );
end $$;
revoke all on function public.get_admission_history_page(uuid,integer) from public, anon, authenticated, service_role;
grant execute on function public.get_admission_history_page(uuid,integer) to authenticated;

-- Stabilize the displayed order when a person has multiple enrolments on the same page.
create or replace function public.list_admissions_directory(p_search text default '',p_offering uuid default null,p_cohort uuid default null,p_state text default null,p_expires_before timestamptz default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  if length(coalesce(p_search,''))>254 or p_offset is null or p_offset<0 or p_offset>100000
    or (p_state is not null and p_state not in ('legacy','active','scheduled','expired','suspended','revoked','ended')) then
    raise exception using errcode='22023',message='invalid directory filter'; end if;
  return (select coalesce(jsonb_agg(item order by display_name,person_id,enrollment_id),'[]'::jsonb) from (
    select p.id person_id,p.display_name,e.id enrollment_id,jsonb_build_object('personId',p.id,'memberId',p.member_id,'name',p.display_name,
      'loginEmail',l.email,'loginRevision',l.revision,'enrollmentId',e.id,'offeringId',e.offering_id,'programme',o.title,
      'cohortId',e.cohort_id,'batch',c.name,'revision',w.revision,'startsAt',w.starts_at,'expiresAt',w.expires_at,
      'state',case when e.status<>'active' or e.ended_at is not null then 'ended' when w.enrollment_id is null then 'legacy'
        when w.state<>'active' then w.state when w.starts_at>clock_timestamp() then 'scheduled'
        when w.expires_at<=clock_timestamp() then 'expired' else 'active' end) item
    from public.people p join public.enrollments e on e.person_id=p.id join public.offerings o on o.id=e.offering_id
    left join public.cohorts c on c.id=e.cohort_id left join public.approved_login_emails l on l.person_id=p.id
    left join public.enrollment_access_windows w on w.enrollment_id=e.id
    where (p_search is null or p_search='' or position(lower(btrim(p_search)) in lower(coalesce(p.display_name,'')||' '||coalesce(p.member_id,'')||' '||coalesce(l.email,'')))>0)
      and (p_offering is null or e.offering_id=p_offering) and (p_cohort is null or e.cohort_id=p_cohort)
      and (p_expires_before is null or w.expires_at<=p_expires_before)
      and (p_state is null or p_state=case when e.status<>'active' or e.ended_at is not null then 'ended' when w.enrollment_id is null then 'legacy'
        when w.state<>'active' then w.state when w.starts_at>clock_timestamp() then 'scheduled' when w.expires_at<=clock_timestamp() then 'expired' else 'active' end)
    order by p.display_name,p.id,e.id limit 100 offset p_offset
  ) rows);
end $$;

-- The directory spans historic enrolments. Keep creation and transfer choices active-only.
create or replace function public.get_admission_choices()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$
begin
  if not public.current_person_can_manage_admissions() then
    raise exception using errcode='42501', message='admissions access denied';
  end if;

  return (
    select jsonb_build_object(
      'enabled', (select enabled from public.admissions_runtime_gate where singleton),
      'timezone', 'Asia/Kolkata',
      'offerings', coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title, 'batches', batches.active
      ) order by o.title, o.id) filter (where o.status = 'active'), '[]'::jsonb),
      'directoryOfferings', coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'title', o.title, 'batches', batches.directory
      ) order by o.title, o.id), '[]'::jsonb)
    )
    from public.offerings o
    cross join lateral (
      select
        coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name, c.id)
          filter (where c.status = 'active'), '[]'::jsonb) as active,
        coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name, c.id),
          '[]'::jsonb) as directory
      from public.cohorts c
      where c.offering_id = o.id and (c.status = 'active' or exists (
        select 1 from public.enrollments e where e.offering_id = o.id and e.cohort_id = c.id
      ))
    ) batches
    where o.status = 'active' or exists (select 1 from public.enrollments e where e.offering_id = o.id)
  );
end $$;
