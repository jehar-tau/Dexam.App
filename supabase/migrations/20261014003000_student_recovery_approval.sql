-- D-030 Option B: every activated-student password reset requires independent approval.
update public.capabilities set requires_two_person=true where key='student_recovery.assist';
create table public.student_recovery_requests (
  id uuid primary key default gen_random_uuid(),
  target_person_id uuid not null references public.people(id),
  target_auth_user_id uuid not null references auth.users(id),
  proposer_person_id uuid not null references public.people(id),
  proposer_session_id uuid not null,
  approver_person_id uuid references public.people(id),
  approver_session_id uuid,
  reason_code text not null check(reason_code='forgotten_password'),
  evidence_categories text[] not null default array['established_identity','approved_enrolment_record']::text[],
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled','issued','executing','completed','failed')),
  token_id uuid unique references public.account_action_tokens(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '15 minutes',
  decided_at timestamptz,
  issued_at timestamptz,
  completed_at timestamptz,
  execution_key uuid,
  check(expires_at>created_at and expires_at<=created_at+interval '15 minutes'),
  check(evidence_categories=array['established_identity','approved_enrolment_record']::text[]),
  check(target_person_id<>proposer_person_id),
  check(approver_person_id is null or (approver_person_id<>proposer_person_id and approver_person_id<>target_person_id))
);
create unique index student_recovery_requests_active on public.student_recovery_requests(target_auth_user_id) where status in ('pending','approved','issued','executing');
create index student_recovery_requests_target_person on public.student_recovery_requests(target_person_id);
create index student_recovery_requests_target_auth on public.student_recovery_requests(target_auth_user_id);
create index student_recovery_requests_proposer on public.student_recovery_requests(proposer_person_id);
create index student_recovery_requests_approver on public.student_recovery_requests(approver_person_id);
alter table public.student_recovery_requests enable row level security;
revoke all on public.student_recovery_requests from anon,authenticated;

create function public.student_recovery_target_is_eligible(p_person_id uuid,p_auth_user_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.people person
  join public.auth_identities identity on identity.person_id=person.id and identity.kind='member_id' and identity.auth_user_id=p_auth_user_id
  join auth.users account on account.id=identity.auth_user_id and lower(account.email)=lower(person.member_id)||'@members.dexam.invalid'
    and account.email_confirmed_at is not null and coalesce(account.encrypted_password,'')<>'' and (account.banned_until is null or account.banned_until<=now())
  join public.memberships membership on membership.person_id=person.id and membership.kind='student' and membership.status='active'
  where person.id=p_person_id and person.status='active' and person.member_id is not null
    and (membership.starts_at is null or membership.starts_at<=now()) and (membership.ends_at is null or membership.ends_at>now())
    and exists(select 1 from public.enrollments enrollment where enrollment.person_id=person.id and enrollment.status in ('approved','active','completed','withdrawn','expired'))) $$;
revoke all on function public.student_recovery_target_is_eligible(uuid,uuid) from public,anon,authenticated;

create function public.current_person_can_assist_student_recovery()
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_can_manage_staff_security() and public.person_has_global_capability(public.current_person_id(),'student_recovery.assist') $$;
revoke all on function public.current_person_can_assist_student_recovery() from public,anon;
grant execute on function public.current_person_can_assist_student_recovery() to authenticated;

create function public.find_student_recovery_target(p_member_id text)
returns table(person_id uuid,member_id text,display_name text)
language plpgsql security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_assist_student_recovery() then raise exception using errcode='42501',message='student recovery access denied'; end if;
  if p_member_id is null or upper(btrim(p_member_id)) !~ '^DXM-[2-9A-HJKMNP-Z]{12}$' then return; end if;
  return query select person.id,person.member_id,person.display_name from public.people person
    join public.auth_identities identity on identity.person_id=person.id and identity.kind='member_id'
    where person.member_id=upper(btrim(p_member_id)) and person.id<>public.current_person_id()
      and public.student_recovery_target_is_eligible(person.id,identity.auth_user_id) limit 1;
end $$;
revoke all on function public.find_student_recovery_target(text) from public,anon;
grant execute on function public.find_student_recovery_target(text) to authenticated;

create function public.propose_student_recovery(p_person_id uuid,p_reason_code text,p_identity_verified boolean,p_enrollment_reviewed boolean)
returns uuid language plpgsql security definer set search_path='' set row_security=off
as $$ declare actor uuid:=public.current_person_id(); target_auth uuid; request_id uuid; old_request public.student_recovery_requests;
begin
  if not public.current_person_can_assist_student_recovery() or actor=p_person_id then raise exception using errcode='42501',message='student recovery proposal denied'; end if;
  if p_reason_code is distinct from 'forgotten_password' or p_identity_verified is distinct from true or p_enrollment_reviewed is distinct from true then
    raise exception using errcode='22023',message='independent identity and enrolment evidence required'; end if;
  perform 1 from public.people where id=p_person_id for update;
  select identity.auth_user_id into target_auth from public.auth_identities identity where identity.person_id=p_person_id and identity.kind='member_id';
  if target_auth is null or not public.student_recovery_target_is_eligible(p_person_id,target_auth) then
    raise exception using errcode='42501',message='student recovery target unavailable'; end if;
  -- Link expiry never proves an external password mutation stopped.
  if exists(select 1 from public.student_recovery_requests where target_auth_user_id=target_auth and status='executing') then
    raise exception using errcode='55000',message='uncertain recovery requires operational review'; end if;
  if exists(select 1 from public.student_recovery_requests where target_auth_user_id=target_auth and created_at>now()-interval '1 minute') then
    raise exception using errcode='54000',message='student recovery proposal throttled'; end if;
  for old_request in select * from public.student_recovery_requests where target_auth_user_id=target_auth and status in ('pending','approved','issued') for update loop
    if old_request.status='issued' and exists(select 1 from public.account_action_tokens token where token.id=old_request.token_id and token.expires_at>now() and token.invalidated_at is null and token.consumed_at is null)
      or old_request.status in ('pending','approved') and old_request.expires_at>now() then
      raise exception using errcode='55000',message='student recovery already pending'; end if;
    update public.student_recovery_requests set status='cancelled' where id=old_request.id;
    update public.account_action_tokens set invalidated_at=now() where id=old_request.token_id and consumed_at is null and invalidated_at is null;
  end loop;
  insert into public.student_recovery_requests(target_person_id,target_auth_user_id,proposer_person_id,proposer_session_id,reason_code)
    values(p_person_id,target_auth,actor,(auth.jwt()->>'session_id')::uuid,p_reason_code) returning id into request_id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(p_person_id,actor,'student_recovery_proposed','succeeded',p_reason_code,jsonb_build_object('request_id',request_id,'evidence_categories',array['established_identity','approved_enrolment_record']));
  return request_id;
end $$;
revoke all on function public.propose_student_recovery(uuid,text,boolean,boolean) from public,anon;
grant execute on function public.propose_student_recovery(uuid,text,boolean,boolean) to authenticated;

create function public.decide_student_recovery(p_request_id uuid,p_approve boolean,p_identity_rechecked boolean,p_enrollment_rechecked boolean)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$ declare actor uuid:=public.current_person_id(); request public.student_recovery_requests;
begin
  if not public.current_person_can_assist_student_recovery() then raise exception using errcode='42501',message='student recovery decision denied'; end if;
  select * into request from public.student_recovery_requests where id=p_request_id for update;
  if not found or request.status<>'pending' or request.expires_at<=now() then raise exception using errcode='55000',message='student recovery decision unavailable'; end if;
  if actor in (request.proposer_person_id,request.target_person_id) then raise exception using errcode='42501',message='independent student recovery review required'; end if;
  if p_approve is null or (p_approve and (p_identity_rechecked is distinct from true or p_enrollment_rechecked is distinct from true)) then
    raise exception using errcode='22023',message='independent evidence review required'; end if;
  if p_approve and (not public.staff_security_actor_is_fresh(request.proposer_person_id,request.proposer_session_id)
    or not public.person_has_global_capability(request.proposer_person_id,'student_recovery.assist')
    or not public.student_recovery_target_is_eligible(request.target_person_id,request.target_auth_user_id)) then
    raise exception using errcode='42501',message='student recovery authority changed'; end if;
  update public.student_recovery_requests set status=case when p_approve then 'approved' else 'rejected' end,
    approver_person_id=actor,approver_session_id=(auth.jwt()->>'session_id')::uuid,decided_at=now() where id=request.id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.target_person_id,actor,'student_recovery_decided',case when p_approve then 'succeeded' else 'denied' end,request.reason_code,jsonb_build_object('request_id',request.id,'approved',p_approve));
end $$;
revoke all on function public.decide_student_recovery(uuid,boolean,boolean,boolean) from public,anon;
grant execute on function public.decide_student_recovery(uuid,boolean,boolean,boolean) to authenticated;

create function public.cancel_student_recovery(p_request_id uuid)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$ declare actor uuid:=public.current_person_id(); request public.student_recovery_requests;
begin
  if not public.current_person_can_assist_student_recovery() then raise exception using errcode='42501',message='student recovery cancellation denied'; end if;
  select * into request from public.student_recovery_requests where id=p_request_id for update;
  if not found or request.status not in ('pending','approved','issued') then raise exception using errcode='55000',message='student recovery cannot be cancelled'; end if;
  update public.student_recovery_requests set status='cancelled' where id=request.id;
  update public.account_action_tokens set invalidated_at=now() where id=request.token_id and consumed_at is null and invalidated_at is null;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.target_person_id,actor,'student_recovery_cancelled','succeeded',request.reason_code,jsonb_build_object('request_id',request.id));
end $$;
revoke all on function public.cancel_student_recovery(uuid) from public,anon;
grant execute on function public.cancel_student_recovery(uuid) to authenticated;

create function public.list_student_recovery_requests()
returns table(id uuid,target_person_id uuid,member_id text,display_name text,proposer_person_id uuid,status text,expires_at timestamptz,pack_expires_at timestamptz)
language plpgsql security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_assist_student_recovery() then raise exception using errcode='42501',message='student recovery queue denied'; end if;
  return query select request.id,request.target_person_id,person.member_id,person.display_name,request.proposer_person_id,request.status,request.expires_at,token.expires_at
    from public.student_recovery_requests request join public.people person on person.id=request.target_person_id
    left join public.account_action_tokens token on token.id=request.token_id order by request.created_at desc limit 100;
end $$;
revoke all on function public.list_student_recovery_requests() from public,anon;
grant execute on function public.list_student_recovery_requests() to authenticated;
