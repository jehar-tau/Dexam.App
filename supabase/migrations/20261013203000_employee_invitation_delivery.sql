-- D-029: supported provider operations are bracketed by locked current-state checks.
alter table public.employee_invitations add column delivery_key uuid;
alter table public.employee_invitations add column proof_hash text check(proof_hash ~ '^[0-9a-f]{64}$');

create function public.employee_invitation_target_is_pending(p_person_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.people person join public.memberships membership on membership.person_id=person.id
  where person.id=p_person_id and person.status='active' and membership.kind='employee' and membership.status='pending'
  and (membership.starts_at is null or membership.starts_at<=now()) and (membership.ends_at is null or membership.ends_at>now())) $$;
revoke all on function public.employee_invitation_target_is_pending(uuid) from public, anon, authenticated;

create function public.claim_employee_invitation(p_request_id uuid,p_actor_auth_id uuid)
returns table(person_id uuid,email text,auth_user_id uuid,delivery_key uuid)
language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_invitations;
begin
  select * into request from public.employee_invitations where id=p_request_id for update;
  if not found or request.status not in ('pending','delivering') or request.expires_at<=now() then
    raise exception using errcode='55000',message='invitation is not deliverable'; end if;
  if not public.staff_security_actor_is_fresh(request.issuer_person_id,request.issuer_session_id)
    or not public.person_has_global_capability(request.issuer_person_id,'staff_role.grant')
    or not exists(select 1 from public.auth_identities identity where identity.person_id=request.issuer_person_id
      and identity.auth_user_id=p_actor_auth_id and identity.kind='employee_email') then
    raise exception using errcode='42501',message='invitation issuer authority changed'; end if;
  perform 1 from public.people where id=request.person_id for update;
  if not public.employee_invitation_target_is_pending(request.person_id) then
    raise exception using errcode='42501',message='invitation target changed'; end if;
  if request.auth_user_id is not null and (not exists(select 1 from auth.users account where account.id=request.auth_user_id and lower(account.email)=request.email)
    or exists(select 1 from public.auth_identities identity where identity.auth_user_id=request.auth_user_id
      and (identity.person_id<>request.person_id or identity.kind<>'employee_email'))) then
    raise exception using errcode='42501',message='invitation identity changed'; end if;
  if request.status='pending' then
    update public.employee_invitations set status='delivering',delivery_key=gen_random_uuid() where id=p_request_id returning * into request;
  end if;
  return query select request.person_id,request.email,request.auth_user_id,request.delivery_key;
end $$;
revoke all on function public.claim_employee_invitation(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_employee_invitation(uuid,uuid) to service_role;

create function public.bind_employee_invitation_auth(p_request_id uuid,p_delivery_key uuid,p_auth_user_id uuid,p_proof_hash text)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_invitations;
begin
  select * into request from public.employee_invitations where id=p_request_id for update;
  if not found or request.status<>'delivering' or request.expires_at<=now() or request.delivery_key is distinct from p_delivery_key or p_delivery_key is null
    or p_proof_hash is null or p_proof_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode='55000',message='invitation binding no longer permitted'; end if;
  perform 1 from public.people where id=request.person_id for update;
  if not public.employee_invitation_target_is_pending(request.person_id)
    or not public.staff_security_actor_is_fresh(request.issuer_person_id,request.issuer_session_id)
    or not public.person_has_global_capability(request.issuer_person_id,'staff_role.grant') then
    raise exception using errcode='42501',message='invitation authority changed'; end if;
  if not exists(select 1 from auth.users account where account.id=p_auth_user_id and lower(account.email)=request.email)
    or (request.auth_user_id is not null and request.auth_user_id<>p_auth_user_id)
    or exists(select 1 from public.auth_identities identity where identity.auth_user_id=p_auth_user_id
      and (identity.person_id<>request.person_id or identity.kind<>'employee_email')) then
    raise exception using errcode='42501',message='invitation Auth ownership mismatch'; end if;
  if exists(select 1 from public.auth_identities identity where identity.person_id=request.person_id and identity.kind='employee_email' and identity.auth_user_id<>p_auth_user_id) then
    raise exception using errcode='42501',message='invitation cannot replace Auth link'; end if;
  -- Do not expose ANY canonical-person business data while activation is pending.
  -- The public Auth link is created atomically with acceptance, not delivery.
  update public.employee_invitations set auth_user_id=p_auth_user_id,proof_hash=p_proof_hash where id=p_request_id;
end $$;
revoke all on function public.bind_employee_invitation_auth(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.bind_employee_invitation_auth(uuid,uuid,uuid,text) to service_role;

create function public.finish_employee_invitation_delivery(p_request_id uuid,p_delivery_key uuid,p_succeeded boolean)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_invitations;
begin
  select * into request from public.employee_invitations where id=p_request_id for update;
  if not found or p_delivery_key is null or request.delivery_key is distinct from p_delivery_key or p_succeeded is null then
    raise exception using errcode='42501',message='invitation delivery outcome denied'; end if;
  if request.status in ('delivered','failed') then
    if (request.status='delivered')=p_succeeded then return; end if;
    raise exception using errcode='55000',message='invitation delivery outcome conflicts'; end if;
  if request.status<>'delivering' or request.expires_at<=now() then
    raise exception using errcode='55000',message='invitation delivery outcome no longer applicable'; end if;
  perform 1 from public.people where id=request.person_id for update;
  if p_succeeded and (request.auth_user_id is null or request.proof_hash is null or not public.employee_invitation_target_is_pending(request.person_id)
    or not public.staff_security_actor_is_fresh(request.issuer_person_id,request.issuer_session_id)
    or not public.person_has_global_capability(request.issuer_person_id,'staff_role.grant')) then
    raise exception using errcode='42501',message='invitation delivery authority changed'; end if;
  update public.employee_invitations set status=case when p_succeeded then 'delivered' else 'failed' end,
    delivered_at=case when p_succeeded then now() else null end where id=p_request_id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.person_id,request.issuer_person_id,'employee_invitation_delivery',case when p_succeeded then 'succeeded' else 'failed' end,'local_capture',jsonb_build_object('request_id',p_request_id));
end $$;
revoke all on function public.finish_employee_invitation_delivery(uuid,uuid,boolean) from public, anon, authenticated;
grant execute on function public.finish_employee_invitation_delivery(uuid,uuid,boolean) to service_role;

create function public.get_my_employee_activation_state()
returns table(status text,expires_at timestamptz)
language sql stable security definer set search_path='' set row_security=off
as $$ select request.status,request.expires_at from public.employee_invitations request
  join public.people person on person.id=request.person_id and person.status='active'
  join auth.users account on account.id=request.auth_user_id and lower(account.email)=request.email and account.email_confirmed_at is not null
  where request.auth_user_id=auth.uid() and exists(select 1 from auth.sessions session where session.user_id=auth.uid()
    and session.id=case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (auth.jwt()->>'session_id')::uuid else null end
    and (session.not_after is null or session.not_after>now()) and not exists(select 1 from public.auth_session_cutoffs cutoff
      where cutoff.auth_user_id=session.user_id and session.created_at<=cutoff.invalidated_before))
  order by request.created_at desc limit 1 $$;
revoke all on function public.get_my_employee_activation_state() from public, anon;
grant execute on function public.get_my_employee_activation_state() to authenticated;

create function public.finalize_employee_invitation(p_request_id uuid,p_auth_user_id uuid,p_session_id uuid,p_proof_hash text)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$
declare request public.employee_invitations;
begin
  select request_row.* into request from public.employee_invitations request_row
    where request_row.id=p_request_id for update;
  if not found or request.auth_user_id is distinct from p_auth_user_id or p_auth_user_id is null or p_session_id is null
    or p_proof_hash is null or request.proof_hash is distinct from p_proof_hash then
    raise exception using errcode='42501',message='employee activation denied'; end if;
  perform 1 from public.people where id=request.person_id and status='active' for update;
  if not found then raise exception using errcode='42501',message='employee activation denied'; end if;
  perform 1 from public.memberships where person_id=request.person_id and kind='employee' and status in ('pending','active','suspended') for update;
  if request.status<>'delivered' or request.expires_at<=now() or not public.employee_invitation_target_is_pending(request.person_id)
    or not public.person_has_global_capability(request.issuer_person_id,'staff_role.grant')
    or not exists(select 1 from public.role_assignments role where role.person_id=request.issuer_person_id and role.role_key='elevated_admin'
      and role.scope_type='global' and role.revoked_at is null and role.starts_at<=now() and (role.ends_at is null or role.ends_at>now())) then
    raise exception using errcode='42501',message='employee activation denied'; end if;
  if not exists(select 1 from auth.users account join auth.sessions session on session.user_id=account.id
    join auth.mfa_amr_claims proof on proof.session_id=session.id and proof.authentication_method='otp'
      and proof.updated_at>=request.created_at and proof.updated_at<=now()
    where account.id=p_auth_user_id and account.id=request.auth_user_id and lower(account.email)=request.email
      and account.email_confirmed_at is not null and coalesce(account.encrypted_password,'')<>''
      and session.id=p_session_id and session.created_at>=request.created_at and (session.not_after is null or session.not_after>now())
      and not exists(select 1 from public.auth_session_cutoffs cutoff where cutoff.auth_user_id=account.id and session.created_at<=cutoff.invalidated_before)) then
    raise exception using errcode='42501',message='employee activation denied'; end if;
  if exists(select 1 from public.auth_identities identity where identity.auth_user_id=p_auth_user_id
      and (identity.person_id<>request.person_id or identity.kind<>'employee_email'))
    or exists(select 1 from public.auth_identities identity where identity.person_id=request.person_id and identity.kind='employee_email' and identity.auth_user_id<>p_auth_user_id) then
    raise exception using errcode='42501',message='employee activation identity changed'; end if;
  insert into public.auth_identities(person_id,auth_user_id,kind) values(request.person_id,p_auth_user_id,'employee_email')
    on conflict(person_id,kind) do nothing;
  update public.memberships set status='active',starts_at=coalesce(starts_at,now()),updated_at=now()
    where person_id=request.person_id and kind='employee' and status='pending';
  update public.employee_invitations set status='accepted',accepted_at=now() where id=request.id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.person_id,request.person_id,'employee_invitation_accepted','succeeded','verified_email_and_password',jsonb_build_object('request_id',request.id));
end $$;
revoke all on function public.finalize_employee_invitation(uuid,uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finalize_employee_invitation(uuid,uuid,uuid,text) to service_role;

create or replace function public.prepare_employee_invitation(p_person_id uuid, p_display_name text, p_email text, p_duplicates_reviewed boolean)
returns uuid language plpgsql security definer set search_path = '' set row_security = off
as $$
declare target uuid := p_person_id; actor uuid := public.current_person_id(); request_id uuid; linked_user uuid; normalized text := lower(btrim(p_email));
begin
  if not public.current_person_can_invite_employees() then raise exception using errcode='42501', message='employee invitation denied'; end if;
  if p_duplicates_reviewed is distinct from true or normalized is null or length(normalized)>254
    or normalized !~ '^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$' or position('..' in normalized)>0 then
    raise exception using errcode='22023', message='fictional invitation details invalid';
  end if;
  -- Refuse unknown/existing provider identities instead of silently overwriting them.
  if exists(select 1 from auth.users account where lower(account.email)=normalized and not exists(
    select 1 from public.auth_identities identity where identity.auth_user_id=account.id and identity.person_id=target and identity.kind='employee_email')
    and not exists(select 1 from public.employee_invitations prior where prior.person_id=target and prior.auth_user_id=account.id and prior.email=normalized)) then
    raise exception using errcode='42501', message='employee identity requires review';
  end if;
  if target is null then
    if p_display_name is null or length(btrim(p_display_name))<2 or length(btrim(p_display_name))>120 then
      raise exception using errcode='22023', message='employee display name invalid'; end if;
    insert into public.people(display_name) values(btrim(p_display_name)) returning id into target;
  else
    perform 1 from public.people where id=target and status='active' for update;
    if not found then raise exception using errcode='42501', message='employee person unavailable'; end if;
  end if;
  if target=actor or exists(select 1 from public.memberships membership where membership.person_id=target and membership.kind='employee'
    and membership.status in ('active','suspended','ended')) then
    raise exception using errcode='42501', message='existing employee state cannot be restored by invitation';
  end if;
  select identity.auth_user_id into linked_user from public.auth_identities identity where identity.person_id=target and identity.kind='employee_email';
  if linked_user is null then
    select prior.auth_user_id into linked_user from public.employee_invitations prior
      where prior.person_id=target and prior.auth_user_id is not null order by prior.created_at desc limit 1;
  end if;
  if linked_user is not null and not exists(select 1 from auth.users account where account.id=linked_user and lower(account.email)=normalized) then
    raise exception using errcode='42501', message='established employee email cannot change'; end if;
  if exists(select 1 from public.employee_invitations where person_id=target and created_at>now()-interval '1 minute') then
    raise exception using errcode='54000', message='invitation reissue throttled'; end if;
  update public.employee_invitations set status='cancelled' where person_id=target and status in ('pending','delivered') and expires_at<=now();
  insert into public.memberships(person_id,kind,status) values(target,'employee','pending')
    on conflict (person_id,kind) where status in ('pending','active','suspended') do nothing;
  insert into public.employee_invitations(person_id,email,issuer_person_id,issuer_session_id,auth_user_id)
    values(target,normalized,actor,(auth.jwt()->>'session_id')::uuid,linked_user) returning id into request_id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(target,actor,'employee_invitation_prepared','succeeded','duplicates_reviewed',jsonb_build_object('request_id',request_id));
  return request_id;
end $$;
revoke all on function public.prepare_employee_invitation(uuid,text,text,boolean) from public, anon;
grant execute on function public.prepare_employee_invitation(uuid,text,text,boolean) to authenticated;
