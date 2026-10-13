-- D-030: credentials delegate only the exact independently approved student reset.
create table public.student_recovery_throttles (
  identifier_hash text primary key check(identifier_hash ~ '^[0-9a-f]{64}$'),
  attempts integer not null check(attempts>=1),
  window_started_at timestamptz not null default now()
);
alter table public.student_recovery_throttles enable row level security;
revoke all on public.student_recovery_throttles from anon,authenticated;

create function public.student_recovery_actors_are_fresh(p_request_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce((select request.approver_person_id is not null
  and request.approver_person_id<>request.proposer_person_id and request.target_person_id not in (request.proposer_person_id,request.approver_person_id)
  and public.staff_security_actor_is_fresh(request.proposer_person_id,request.proposer_session_id)
  and public.staff_security_actor_is_fresh(request.approver_person_id,request.approver_session_id)
  and public.person_has_global_capability(request.proposer_person_id,'student_recovery.assist')
  and public.person_has_global_capability(request.approver_person_id,'student_recovery.assist')
  from public.student_recovery_requests request where request.id=p_request_id),false) $$;
revoke all on function public.student_recovery_actors_are_fresh(uuid) from public,anon,authenticated;

create function public.issue_student_recovery_pack(p_request_id uuid,p_actor_auth_id uuid,p_link_hash text,p_backup_hash text)
returns table(member_id text,expires_at timestamptz)
language plpgsql security definer set search_path='' set row_security=off
as $$ declare request public.student_recovery_requests; actor uuid; issued_token_id uuid; expiry timestamptz:=now()+interval '15 minutes';
begin
  select * into request from public.student_recovery_requests where id=p_request_id for update;
  if not found or request.status<>'approved' or request.expires_at<=now() then raise exception using errcode='55000',message='student recovery pack unavailable'; end if;
  select identity.person_id into actor from public.auth_identities identity where identity.auth_user_id=p_actor_auth_id and identity.kind='employee_email';
  if actor is null or actor not in (request.proposer_person_id,request.approver_person_id)
    or not public.student_recovery_actors_are_fresh(request.id) then raise exception using errcode='42501',message='student recovery issuer denied'; end if;
  if p_link_hash is null or p_backup_hash is null or p_link_hash !~ '^[0-9a-f]{64}$' or p_backup_hash !~ '^[0-9a-f]{64}$' or p_link_hash=p_backup_hash then
    raise exception using errcode='22023',message='student recovery proof invalid'; end if;
  perform 1 from public.people where id=request.target_person_id for update;
  if not public.student_recovery_target_is_eligible(request.target_person_id,request.target_auth_user_id) then
    raise exception using errcode='42501',message='student recovery target changed'; end if;
  update public.account_action_tokens set invalidated_at=now() where person_id=request.target_person_id and kind='recovery' and consumed_at is null and invalidated_at is null;
  insert into public.account_action_tokens(person_id,kind,link_token_hash,backup_code_hash,expires_at,created_by_person_id,max_attempts)
    values(request.target_person_id,'recovery',p_link_hash,p_backup_hash,expiry,actor,8) returning id into issued_token_id;
  update public.student_recovery_requests set status='issued',token_id=issued_token_id,issued_at=now() where id=request.id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.target_person_id,actor,'student_recovery_pack_issued','succeeded',request.reason_code,jsonb_build_object('request_id',request.id));
  return query select person.member_id,expiry from public.people person where person.id=request.target_person_id;
end $$;
revoke all on function public.issue_student_recovery_pack(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.issue_student_recovery_pack(uuid,uuid,text,text) to service_role;

create function public.claim_student_recovery(p_member_id text,p_proof_hash text,p_credential_type text,p_member_hash text,p_network_hash text)
returns table(request_id uuid,auth_user_id uuid,execution_key uuid)
language plpgsql security definer set search_path='' set row_security=off
as $$ declare request public.student_recovery_requests; token public.account_action_tokens; identifier text; count_attempts integer; allowed boolean:=true;
begin
  if p_member_hash is null or p_network_hash is null or p_member_hash !~ '^[0-9a-f]{64}$' or p_network_hash !~ '^[0-9a-f]{64}$' then return; end if;
  for identifier in select value from unnest(array[p_member_hash,p_network_hash]) value order by value loop
    insert into public.student_recovery_throttles(identifier_hash,attempts) values(identifier,1)
    on conflict(identifier_hash) do update set attempts=case when public.student_recovery_throttles.window_started_at<=now()-interval '1 hour' then 1 else public.student_recovery_throttles.attempts+1 end,
      window_started_at=case when public.student_recovery_throttles.window_started_at<=now()-interval '1 hour' then now() else public.student_recovery_throttles.window_started_at end
      returning attempts into count_attempts;
    if count_attempts>(case when identifier=p_member_hash then 20 else 100 end) then allowed:=false; end if;
  end loop;
  delete from public.student_recovery_throttles where window_started_at<now()-interval '72 hours';
  if not allowed or p_member_id is null or p_member_id !~ '^DXM-[2-9A-HJKMNP-Z]{12}$' or p_proof_hash is null or p_proof_hash !~ '^[0-9a-f]{64}$' or p_credential_type not in ('link','backup') or p_credential_type is null then return; end if;
  select request_row.* into request from public.student_recovery_requests request_row join public.people person on person.id=request_row.target_person_id
    where person.member_id=p_member_id and request_row.status='issued' order by request_row.created_at desc limit 1 for update of request_row;
  if not found then return; end if;
  perform 1 from public.people where id=request.target_person_id for update;
  select * into token from public.account_action_tokens where id=request.token_id for update;
  if not found or token.person_id<>request.target_person_id or token.kind<>'recovery' or token.expires_at<=now()
    or token.consumed_at is not null or token.invalidated_at is not null or token.attempt_count>=token.max_attempts
    or not public.student_recovery_actors_are_fresh(request.id)
    or not public.student_recovery_target_is_eligible(request.target_person_id,request.target_auth_user_id) then return; end if;
  if (case when p_credential_type='link' then token.link_token_hash else token.backup_code_hash end)<>p_proof_hash then
    update public.account_action_tokens set attempt_count=attempt_count+1 where id=token.id;
    return;
  end if;
  insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values(request.target_auth_user_id,clock_timestamp())
    on conflict on constraint auth_session_cutoffs_pkey do update set invalidated_before=greatest(public.auth_session_cutoffs.invalidated_before,excluded.invalidated_before),updated_at=clock_timestamp();
  update public.account_action_tokens set consumed_at=now() where id=token.id;
  update public.account_action_tokens set invalidated_at=now() where person_id=request.target_person_id and id<>token.id and consumed_at is null and invalidated_at is null;
  update public.student_recovery_requests set status='executing',execution_key=gen_random_uuid() where id=request.id returning * into request;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.target_person_id,request.target_person_id,'student_recovery_started','succeeded',request.reason_code,jsonb_build_object('request_id',request.id));
  return query select request.id,request.target_auth_user_id,request.execution_key;
end $$;
revoke all on function public.claim_student_recovery(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.claim_student_recovery(text,text,text,text,text) to service_role;

create function public.finish_student_recovery(p_request_id uuid,p_execution_key uuid,p_succeeded boolean)
returns boolean language plpgsql security definer set search_path='' set row_security=off
as $$ declare request public.student_recovery_requests;
begin
  select * into request from public.student_recovery_requests where id=p_request_id for update;
  if not found or request.status<>'executing' or p_execution_key is null or request.execution_key is distinct from p_execution_key or p_succeeded is null then
    raise exception using errcode='42501',message='student recovery outcome denied'; end if;
  if p_succeeded and (not public.student_recovery_target_is_eligible(request.target_person_id,request.target_auth_user_id)
    or not public.student_recovery_actors_are_fresh(request.id)) then p_succeeded:=false; end if;
  insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values(request.target_auth_user_id,clock_timestamp())
    on conflict on constraint auth_session_cutoffs_pkey do update set invalidated_before=greatest(public.auth_session_cutoffs.invalidated_before,excluded.invalidated_before),updated_at=clock_timestamp();
  update public.student_recovery_requests set status=case when p_succeeded then 'completed' else 'failed' end,
    completed_at=case when p_succeeded then now() else null end where id=request.id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.target_person_id,request.target_person_id,'student_recovery_finished',case when p_succeeded then 'succeeded' else 'failed' end,'sessions_blocked_identity_preserved',jsonb_build_object('request_id',request.id));
  return p_succeeded;
end $$;
revoke all on function public.finish_student_recovery(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.finish_student_recovery(uuid,uuid,boolean) to service_role;

-- Provider password changes delete old sessions. All identities must honor that deletion.
create or replace function public.current_person_id()
returns uuid language sql stable security definer set search_path='' set row_security=off
as $$ select identity.person_id from public.auth_identities identity
  where identity.auth_user_id=(select auth.uid())
    and not exists(select 1 from public.employee_password_recoveries recovery where recovery.auth_user_id=identity.auth_user_id and recovery.status='executing')
    and not exists(select 1 from public.student_recovery_requests recovery where recovery.target_auth_user_id=identity.auth_user_id and recovery.status='executing')
    and exists(select 1 from auth.sessions session where session.user_id=identity.auth_user_id
      and session.id=(select case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (auth.jwt()->>'session_id')::uuid else null::uuid end)
      and (session.not_after is null or session.not_after>now())
      and not exists(select 1 from public.auth_session_cutoffs cutoff where cutoff.auth_user_id=session.user_id and session.created_at<=cutoff.invalidated_before))
  limit 1 $$;
revoke all on function public.current_person_id() from public,anon;
grant execute on function public.current_person_id() to authenticated;
