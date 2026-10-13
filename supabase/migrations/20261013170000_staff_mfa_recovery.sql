-- D-027 / D-028: independent approval, recent live MFA, and durable denial
-- precede the supported provider administrator factor-deletion operation.
create table public.staff_mfa_reset_requests (
  id uuid primary key default gen_random_uuid(),
  target_person_id uuid not null references public.people(id),
  target_auth_user_id uuid not null references auth.users(id),
  factor_id uuid not null,
  proposer_person_id uuid not null references public.people(id),
  proposer_session_id uuid not null,
  approver_person_id uuid references public.people(id),
  approver_session_id uuid,
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_]{2,79}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'executing', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  decided_at timestamptz,
  finished_at timestamptz,
  execution_key uuid,
  check (expires_at > created_at and expires_at <= created_at + interval '15 minutes'),
  check (approver_person_id is null or approver_person_id <> proposer_person_id),
  check (target_person_id <> proposer_person_id),
  check (approver_person_id is null or target_person_id <> approver_person_id)
);
create unique index staff_mfa_reset_active_factor on public.staff_mfa_reset_requests(target_auth_user_id, factor_id)
where status in ('pending', 'approved', 'executing');
create index staff_mfa_reset_created_at on public.staff_mfa_reset_requests(created_at desc);
create index staff_mfa_reset_target_person on public.staff_mfa_reset_requests(target_person_id);
create index staff_mfa_reset_target_auth on public.staff_mfa_reset_requests(target_auth_user_id);
create index staff_mfa_reset_proposer on public.staff_mfa_reset_requests(proposer_person_id);
create index staff_mfa_reset_approver on public.staff_mfa_reset_requests(approver_person_id);
alter table public.staff_mfa_reset_requests enable row level security;
revoke all on public.staff_mfa_reset_requests from anon, authenticated;

create or replace function public.staff_security_actor_is_fresh(p_person_id uuid, p_session_id uuid)
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select coalesce(
    public.person_has_global_capability(p_person_id, 'security_controls.change')
    and exists (select 1 from public.role_assignments ra where ra.person_id = p_person_id
      and ra.role_key = 'elevated_admin' and ra.scope_type = 'global' and ra.scope_id is null
      and ra.revoked_at is null and ra.starts_at <= now() and (ra.ends_at is null or ra.ends_at > now()))
    and exists (
      select 1 from public.auth_identities identity
      join auth.sessions session on session.user_id = identity.auth_user_id
      join auth.mfa_factors factor on factor.id = session.factor_id and factor.user_id = session.user_id
      join auth.mfa_amr_claims amr on amr.session_id = session.id and amr.authentication_method = 'totp'
      where identity.person_id = p_person_id and identity.kind = 'employee_email'
        and session.id = p_session_id and session.aal = 'aal2'
        and (session.not_after is null or session.not_after > now())
        and factor.factor_type = 'totp' and factor.status = 'verified'
        and amr.updated_at >= now() - interval '15 minutes' and amr.updated_at <= now()
        and not exists (select 1 from public.auth_session_cutoffs cutoff where cutoff.auth_user_id = session.user_id
          and (session.created_at is null or session.created_at <= cutoff.invalidated_before))
    ), false)
$$;
revoke all on function public.staff_security_actor_is_fresh(uuid, uuid) from public, anon, authenticated;

create or replace function public.current_person_can_manage_staff_security()
returns boolean language sql stable security definer
set search_path = '' set row_security = off
as $$
  select coalesce((auth.jwt() ->> 'aal') = 'aal2'
    and public.staff_security_actor_is_fresh(public.current_person_id(), case
      when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then (auth.jwt() ->> 'session_id')::uuid else null end), false)
$$;
revoke all on function public.current_person_can_manage_staff_security() from public, anon;
grant execute on function public.current_person_can_manage_staff_security() to authenticated;

create or replace function public.list_staff_security_factors()
returns table(person_id uuid, display_name text, factor_id uuid, factor_name text)
language plpgsql security definer set search_path = '' set row_security = off
as $$
begin
  if not public.current_person_can_manage_staff_security() then
    raise exception using errcode = '42501', message = 'staff security access denied';
  end if;
  return query select person.id, person.display_name, factor.id, coalesce(factor.friendly_name, 'Authenticator')
  from public.people person
  join public.auth_identities identity on identity.person_id = person.id and identity.kind = 'employee_email'
  join auth.mfa_factors factor on factor.user_id = identity.auth_user_id and factor.factor_type = 'totp' and factor.status = 'verified'
  where person.status = 'active' and person.id <> public.current_person_id()
    and exists (select 1 from public.memberships m where m.person_id = person.id and m.kind = 'employee' and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now()) and (m.ends_at is null or m.ends_at > now()))
  order by person.display_name, factor.created_at limit 100;
end
$$;
revoke all on function public.list_staff_security_factors() from public, anon;
grant execute on function public.list_staff_security_factors() to authenticated;

create or replace function public.propose_staff_mfa_reset(p_person_id uuid, p_factor_id uuid, p_reason_code text)
returns uuid language plpgsql security definer set search_path = '' set row_security = off
as $$
declare target_user uuid; request_id uuid; actor uuid := public.current_person_id();
begin
  if not public.current_person_can_manage_staff_security() or actor = p_person_id then
    raise exception using errcode = '42501', message = 'staff recovery proposal denied';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{2,79}$' then
    raise exception using errcode = '22023', message = 'staff recovery reason invalid';
  end if;
  select identity.auth_user_id into target_user from public.auth_identities identity
  join public.people person on person.id = identity.person_id and person.status = 'active'
  join auth.mfa_factors factor on factor.user_id = identity.auth_user_id and factor.id = p_factor_id
    and factor.factor_type = 'totp' and factor.status = 'verified'
  where identity.person_id = p_person_id and identity.kind = 'employee_email'
    and exists (select 1 from public.memberships m where m.person_id = person.id and m.kind = 'employee' and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now()) and (m.ends_at is null or m.ends_at > now()));
  if target_user is null then raise exception using errcode = '42501', message = 'staff recovery target unavailable'; end if;
  -- Terminalize expired requests so an abandoned proposal cannot block a new one.
  with expired as (
    update public.staff_mfa_reset_requests set status = 'cancelled', finished_at = now()
    where target_auth_user_id = target_user and factor_id = p_factor_id and status in ('pending', 'approved') and expires_at <= now()
    returning *
  ) insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata)
    select expired.target_person_id, actor, 'staff_mfa_reset_expired', 'expired', expired.reason_code, jsonb_build_object('request_id', expired.id) from expired;
  insert into public.staff_mfa_reset_requests(target_person_id, target_auth_user_id, factor_id, proposer_person_id, proposer_session_id, reason_code)
  values (p_person_id, target_user, p_factor_id, actor, (auth.jwt() ->> 'session_id')::uuid, p_reason_code)
  returning id into request_id;
  insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata)
  values (p_person_id, actor, 'staff_mfa_reset_proposed', 'succeeded', p_reason_code, jsonb_build_object('request_id', request_id));
  return request_id;
end
$$;
revoke all on function public.propose_staff_mfa_reset(uuid, uuid, text) from public, anon;
grant execute on function public.propose_staff_mfa_reset(uuid, uuid, text) to authenticated;

create or replace function public.decide_staff_mfa_reset(p_request_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' set row_security = off
as $$
declare request public.staff_mfa_reset_requests; actor uuid := public.current_person_id();
begin
  if not public.current_person_can_manage_staff_security() or p_approve is null then
    raise exception using errcode = '42501', message = 'staff recovery decision denied';
  end if;
  select * into request from public.staff_mfa_reset_requests where id = p_request_id for update;
  if not found or actor = request.proposer_person_id or actor = request.target_person_id then
    raise exception using errcode = '42501', message = 'independent staff recovery decision required';
  end if;
  if request.status <> 'pending' or request.expires_at <= now() then
    raise exception using errcode = '55000', message = 'staff recovery request is not awaiting a decision';
  end if;
  if p_approve and not public.staff_security_actor_is_fresh(request.proposer_person_id, request.proposer_session_id) then
    raise exception using errcode = '42501', message = 'staff recovery proposer is no longer authorized';
  end if;
  update public.staff_mfa_reset_requests set status = case when p_approve then 'approved' else 'rejected' end,
    approver_person_id = actor, approver_session_id = (auth.jwt() ->> 'session_id')::uuid, decided_at = now()
  where id = p_request_id;
  insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata)
  values (request.target_person_id, actor, 'staff_mfa_reset_decided', case when p_approve then 'succeeded' else 'denied' end,
    request.reason_code, jsonb_build_object('request_id', p_request_id, 'approved', p_approve));
end
$$;
revoke all on function public.decide_staff_mfa_reset(uuid, boolean) from public, anon;
grant execute on function public.decide_staff_mfa_reset(uuid, boolean) to authenticated;

create or replace function public.list_staff_mfa_reset_requests()
returns table(id uuid, target_person_id uuid, target_name text, factor_id uuid, proposer_person_id uuid, reason_code text, status text, expires_at timestamptz)
language plpgsql security definer set search_path = '' set row_security = off
as $$
begin
  if not public.current_person_can_manage_staff_security() then raise exception using errcode = '42501', message = 'staff recovery queue denied'; end if;
  return query select request.id, request.target_person_id, person.display_name, request.factor_id,
    request.proposer_person_id, request.reason_code, request.status, request.expires_at
  from public.staff_mfa_reset_requests request join public.people person on person.id = request.target_person_id
  order by request.created_at desc limit 100;
end
$$;
revoke all on function public.list_staff_mfa_reset_requests() from public, anon;
grant execute on function public.list_staff_mfa_reset_requests() to authenticated;

create or replace function public.claim_staff_mfa_reset(p_request_id uuid)
returns table(target_auth_user_id uuid, factor_id uuid, execution_key uuid)
language plpgsql security definer set search_path = '' set row_security = off
as $$
declare request public.staff_mfa_reset_requests;
begin
  select * into request from public.staff_mfa_reset_requests where id = p_request_id for update;
  if not found or request.status not in ('approved', 'executing') or request.expires_at <= now() then
    raise exception using errcode = '55000', message = 'staff recovery is not executable';
  end if;
  if not public.staff_security_actor_is_fresh(request.proposer_person_id, request.proposer_session_id)
    or not public.staff_security_actor_is_fresh(request.approver_person_id, request.approver_session_id) then
    raise exception using errcode = '42501', message = 'staff recovery authorization changed';
  end if;
  if not exists (select 1 from public.auth_identities identity join public.people person on person.id = identity.person_id
    join public.memberships m on m.person_id = person.id
    where person.id = request.target_person_id and person.status = 'active' and identity.kind = 'employee_email'
      and identity.auth_user_id = request.target_auth_user_id and m.kind = 'employee' and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now()) and (m.ends_at is null or m.ends_at > now())) then
    raise exception using errcode = '42501', message = 'staff recovery target changed';
  end if;
  if request.status = 'approved' then
    insert into public.auth_session_cutoffs(auth_user_id, invalidated_before)
    values (request.target_auth_user_id, clock_timestamp()) on conflict (auth_user_id) do update
      set invalidated_before = greatest(public.auth_session_cutoffs.invalidated_before, excluded.invalidated_before), updated_at = clock_timestamp();
    update public.staff_mfa_reset_requests set status = 'executing', execution_key = gen_random_uuid() where id = p_request_id
    returning * into request;
    insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata)
    values (request.target_person_id, request.approver_person_id, 'staff_mfa_reset_started', 'succeeded', request.reason_code, jsonb_build_object('request_id', p_request_id));
  end if;
  return query select request.target_auth_user_id, request.factor_id, request.execution_key;
end
$$;
revoke all on function public.claim_staff_mfa_reset(uuid) from public, anon, authenticated;
grant execute on function public.claim_staff_mfa_reset(uuid) to service_role;

create or replace function public.finish_staff_mfa_reset(p_request_id uuid, p_execution_key uuid, p_succeeded boolean)
returns void language plpgsql security definer set search_path = '' set row_security = off
as $$
declare request public.staff_mfa_reset_requests;
begin
  select * into request from public.staff_mfa_reset_requests where id = p_request_id for update;
  if not found or request.execution_key is distinct from p_execution_key or p_execution_key is null or p_succeeded is null then
    raise exception using errcode = '42501', message = 'staff recovery completion denied';
  end if;
  if request.status in ('completed', 'failed') then
    if (request.status = 'completed') = p_succeeded then return; end if;
    raise exception using errcode = '55000', message = 'staff recovery terminal outcome differs';
  end if;
  if request.status <> 'executing' then raise exception using errcode = '55000', message = 'staff recovery is not executing'; end if;
  if p_succeeded and exists (select 1 from auth.mfa_factors factor where factor.id = request.factor_id and factor.user_id = request.target_auth_user_id) then
    raise exception using errcode = '55000', message = 'staff recovery factor is still enrolled';
  end if;
  update public.staff_mfa_reset_requests set status = case when p_succeeded then 'completed' else 'failed' end, finished_at = now() where id = p_request_id;
  insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata)
  values (request.target_person_id, request.approver_person_id, 'staff_mfa_reset_finished', case when p_succeeded then 'succeeded' else 'failed' end,
    request.reason_code, jsonb_build_object('request_id', p_request_id));
end
$$;
revoke all on function public.finish_staff_mfa_reset(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.finish_staff_mfa_reset(uuid, uuid, boolean) to service_role;

create or replace function public.cancel_staff_mfa_reset(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' set row_security = off
as $$
declare request public.staff_mfa_reset_requests;
begin
  if not public.current_person_can_manage_staff_security() then raise exception using errcode = '42501', message = 'staff recovery cancellation denied'; end if;
  select * into request from public.staff_mfa_reset_requests where id = p_request_id for update;
  if not found or request.proposer_person_id <> public.current_person_id() then raise exception using errcode = '42501', message = 'staff recovery cancellation denied'; end if;
  if request.status not in ('pending', 'approved') then raise exception using errcode = '55000', message = 'staff recovery cannot be cancelled'; end if;
  update public.staff_mfa_reset_requests set status = 'cancelled', finished_at = now() where id = p_request_id;
  insert into public.security_audit_events(subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata)
  values (request.target_person_id, request.proposer_person_id, 'staff_mfa_reset_cancelled', 'invalidated', request.reason_code, jsonb_build_object('request_id', p_request_id));
end
$$;
revoke all on function public.cancel_staff_mfa_reset(uuid) from public, anon;
grant execute on function public.cancel_staff_mfa_reset(uuid) to authenticated;
