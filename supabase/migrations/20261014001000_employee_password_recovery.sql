-- D-029: unchanged-email employee recovery, local capture only at the worker boundary.
create table public.employee_password_recoveries (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null check(email=lower(email) and email ~ '^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$'),
  status text not null default 'pending' check(status in ('pending','delivered','executing','completed','failed','cancelled')),
  proof_hash text check(proof_hash ~ '^[0-9a-f]{64}$'),
  execution_key uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '1 hour',
  completed_at timestamptz,
  check(expires_at>created_at and expires_at<=created_at+interval '1 hour')
);
create index employee_password_recoveries_person_idx on public.employee_password_recoveries(person_id);
create index employee_password_recoveries_auth_idx on public.employee_password_recoveries(auth_user_id);
create unique index employee_password_recoveries_active on public.employee_password_recoveries(auth_user_id) where status in ('pending','delivered','executing');
alter table public.employee_password_recoveries enable row level security;
revoke all on public.employee_password_recoveries from anon,authenticated;

create table public.employee_recovery_throttles (
  identifier_hash text primary key check(identifier_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null check(attempts>=1),
  window_started_at timestamptz not null default now()
);
alter table public.employee_recovery_throttles enable row level security;
revoke all on public.employee_recovery_throttles from anon,authenticated;

create function public.employee_recovery_target_is_active(p_person_id uuid,p_auth_user_id uuid,p_email text)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.people person
  join public.memberships membership on membership.person_id=person.id and membership.kind='employee' and membership.status='active'
  join public.auth_identities identity on identity.person_id=person.id and identity.kind='employee_email' and identity.auth_user_id=p_auth_user_id
  join auth.users account on account.id=identity.auth_user_id and lower(account.email)=p_email and account.email_confirmed_at is not null
  where person.id=p_person_id and person.status='active'
  and (membership.starts_at is null or membership.starts_at<=now()) and (membership.ends_at is null or membership.ends_at>now())) $$;
revoke all on function public.employee_recovery_target_is_active(uuid,uuid,text) from public,anon,authenticated;

create function public.prepare_employee_password_recovery(p_email text,p_email_hash text,p_network_hash text)
returns table(id uuid,auth_user_id uuid,email text)
language plpgsql security definer set search_path='' set row_security=off
as $$
declare identifier text; count_attempts integer; target_person uuid; target_auth uuid; request_id uuid; normalized text:=lower(btrim(p_email)); allowed boolean:=true;
begin
  if p_email_hash is null or p_network_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' or p_network_hash !~ '^[0-9a-f]{64}$'
    or normalized is null or length(normalized)>254 or normalized !~ '^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$' then
    raise exception using errcode='22023',message='recovery request invalid'; end if;
  -- Hashes have separate HMAC domains; deterministic ordering prevents opposite lock order.
  for identifier in select value from unnest(array[p_email_hash,p_network_hash]) value order by value loop
    insert into public.employee_recovery_throttles(identifier_hash,attempts) values(identifier,1)
    on conflict(identifier_hash) do update set
      attempts=case when public.employee_recovery_throttles.window_started_at<=now()-interval '1 hour' then 1 else public.employee_recovery_throttles.attempts+1 end,
      window_started_at=case when public.employee_recovery_throttles.window_started_at<=now()-interval '1 hour' then now() else public.employee_recovery_throttles.window_started_at end
    returning attempts into count_attempts;
    if count_attempts>(case when identifier=p_email_hash then 5 else 100 end) then allowed:=false; end if;
  end loop;
  delete from public.employee_recovery_throttles where window_started_at<now()-interval '72 hours';
  if not allowed then return; end if;
  select identity.person_id,identity.auth_user_id into target_person,target_auth
    from public.auth_identities identity join auth.users account on account.id=identity.auth_user_id
    where identity.kind='employee_email' and lower(account.email)=normalized;
  if target_auth is null or not public.employee_recovery_target_is_active(target_person,target_auth,normalized) then return; end if;
  perform 1 from public.people where people.id=target_person for update;
  if not public.employee_recovery_target_is_active(target_person,target_auth,normalized) then return; end if;
  -- Never replace an in-flight password mutation; its cutoff remains durable even on failure.
  if exists(select 1 from public.employee_password_recoveries recovery where recovery.auth_user_id=target_auth and recovery.status='executing') then return; end if;
  if exists(select 1 from public.employee_password_recoveries recovery where recovery.auth_user_id=target_auth and recovery.created_at>now()-interval '1 minute') then return; end if;
  update public.employee_password_recoveries set status='cancelled' where employee_password_recoveries.auth_user_id=target_auth and status in ('pending','delivered');
  insert into public.employee_password_recoveries(person_id,auth_user_id,email) values(target_person,target_auth,normalized) returning employee_password_recoveries.id into request_id;
  return query select request_id,target_auth,normalized;
end $$;
revoke all on function public.prepare_employee_password_recovery(text,text,text) from public,anon,authenticated;
grant execute on function public.prepare_employee_password_recovery(text,text,text) to service_role;

create function public.finish_employee_recovery_delivery(p_request_id uuid,p_proof_hash text,p_succeeded boolean)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_password_recoveries;
begin
  select * into request from public.employee_password_recoveries where id=p_request_id for update;
  if not found or request.status<>'pending' or request.expires_at<=now() or p_succeeded is null
    or (p_succeeded and (p_proof_hash is null or p_proof_hash !~ '^[0-9a-f]{64}$'
      or not public.employee_recovery_target_is_active(request.person_id,request.auth_user_id,request.email))) then
    raise exception using errcode='42501',message='recovery delivery denied'; end if;
  update public.employee_password_recoveries set status=case when p_succeeded then 'delivered' else 'failed' end,
    proof_hash=case when p_succeeded then p_proof_hash else null end where id=p_request_id;
end $$;
revoke all on function public.finish_employee_recovery_delivery(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.finish_employee_recovery_delivery(uuid,text,boolean) to service_role;

create function public.claim_employee_password_recovery(p_request_id uuid,p_auth_user_id uuid,p_session_id uuid,p_proof_hash text)
returns table(auth_user_id uuid,execution_key uuid)
language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_password_recoveries;
begin
  select * into request from public.employee_password_recoveries where id=p_request_id for update;
  if not found or request.status<>'delivered' or request.expires_at<=now() or p_proof_hash is null
    or request.proof_hash is distinct from p_proof_hash or request.auth_user_id is distinct from p_auth_user_id then
    raise exception using errcode='42501',message='recovery proof denied'; end if;
  perform 1 from public.people where id=request.person_id for update;
  if not public.employee_recovery_target_is_active(request.person_id,request.auth_user_id,request.email)
    or not exists(select 1 from auth.sessions session join auth.mfa_amr_claims proof on proof.session_id=session.id
      and proof.authentication_method='otp' and proof.updated_at>=request.created_at and proof.updated_at<=now()
      where session.id=p_session_id and session.user_id=p_auth_user_id and session.created_at>=request.created_at
      and (session.not_after is null or session.not_after>now())
      and not exists(select 1 from public.auth_session_cutoffs cutoff where cutoff.auth_user_id=p_auth_user_id and session.created_at<=cutoff.invalidated_before)) then
    raise exception using errcode='42501',message='recovery current state denied'; end if;
  insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values(p_auth_user_id,clock_timestamp())
    on conflict on constraint auth_session_cutoffs_pkey do update set invalidated_before=greatest(public.auth_session_cutoffs.invalidated_before,excluded.invalidated_before),updated_at=clock_timestamp();
  update public.employee_password_recoveries set status='executing',execution_key=gen_random_uuid() where id=p_request_id returning * into request;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.person_id,request.person_id,'employee_password_recovery_started','succeeded','verified_unchanged_email',jsonb_build_object('request_id',request.id));
  return query select request.auth_user_id,request.execution_key;
end $$;
revoke all on function public.claim_employee_password_recovery(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.claim_employee_password_recovery(uuid,uuid,uuid,text) to service_role;

create function public.finish_employee_password_recovery(p_request_id uuid,p_execution_key uuid,p_succeeded boolean)
returns boolean language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_password_recoveries;
begin
  select * into request from public.employee_password_recoveries where id=p_request_id for update;
  if not found or request.status<>'executing' or p_execution_key is null or request.execution_key is distinct from p_execution_key or p_succeeded is null then
    raise exception using errcode='42501',message='recovery completion denied'; end if;
  if p_succeeded and not public.employee_recovery_target_is_active(request.person_id,request.auth_user_id,request.email) then p_succeeded:=false; end if;
  -- Also deny old-password sessions created during the provider mutation window.
  insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values(request.auth_user_id,clock_timestamp())
    on conflict(auth_user_id) do update set invalidated_before=greatest(public.auth_session_cutoffs.invalidated_before,excluded.invalidated_before),updated_at=clock_timestamp();
  update public.employee_password_recoveries set status=case when p_succeeded then 'completed' else 'failed' end,
    completed_at=case when p_succeeded then now() else null end where id=request.id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.person_id,request.person_id,'employee_password_recovery_finished',case when p_succeeded then 'succeeded' else 'failed' end,'sessions_blocked_mfa_preserved',jsonb_build_object('request_id',request.id));
  return p_succeeded;
end $$;
revoke all on function public.finish_employee_password_recovery(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_employee_password_recovery(uuid,uuid,boolean) to service_role;
