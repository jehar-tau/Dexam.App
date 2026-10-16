-- D-045 B: investigation only. No function here updates a recovery or Auth account.
create table public.recovery_incident_reviews (
 id uuid primary key default gen_random_uuid(),
 recovery_kind text not null check(recovery_kind in ('employee','student')),
 recovery_request_id uuid not null,
 target_person_id uuid not null references public.people(id),
 target_auth_user_id uuid not null references auth.users(id),
 execution_fingerprint text not null,
 proposer_person_id uuid not null references public.people(id),
 proposer_session_id uuid not null,
 reviewer_person_id uuid references public.people(id),
 reviewer_session_id uuid,
 reason_code text not null check(reason_code='uncertain_password_update'),
 status text not null default 'pending' check(status in ('pending','reviewed')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 unique(recovery_kind,recovery_request_id),
 check(target_person_id<>proposer_person_id),
 check(reviewer_person_id is null or reviewer_person_id not in (target_person_id,proposer_person_id)),
 check((status='pending' and reviewer_person_id is null and reviewer_session_id is null and reviewed_at is null)
  or (status='reviewed' and reviewer_person_id is not null and reviewer_session_id is not null and reviewed_at is not null))
);
create index recovery_incident_target_idx on public.recovery_incident_reviews(target_person_id);
create index recovery_incident_auth_idx on public.recovery_incident_reviews(target_auth_user_id);
create index recovery_incident_proposer_idx on public.recovery_incident_reviews(proposer_person_id);
create index recovery_incident_reviewer_idx on public.recovery_incident_reviews(reviewer_person_id);
alter table public.recovery_incident_reviews enable row level security;
revoke all on public.recovery_incident_reviews from anon,authenticated;
grant all on public.recovery_incident_reviews to service_role;

-- Internal fingerprint binds the exact executing attempt and canonical ownership.
-- Neither its inputs nor execution keys are returned to a browser or audit log.
create function public.recovery_incident_source(p_kind text,p_request uuid)
returns table(target_person_id uuid,target_auth_user_id uuid,fingerprint text,request_created_at timestamptz)
language sql stable security definer set search_path='' set row_security=off as $$
 select r.person_id,r.auth_user_id,encode(sha256(convert_to(jsonb_build_array(r.id,r.execution_key,r.person_id,r.auth_user_id,r.email)::text,'UTF8')),'hex'),r.created_at
 from public.employee_password_recoveries r
 where p_kind='employee' and r.id=p_request and r.status='executing' and r.execution_key is not null
 and public.employee_recovery_target_is_active(r.person_id,r.auth_user_id,r.email)
 union all
 select r.target_person_id,r.target_auth_user_id,encode(sha256(convert_to(jsonb_build_array(r.id,r.execution_key,r.target_person_id,r.target_auth_user_id)::text,'UTF8')),'hex'),r.created_at
 from public.student_recovery_requests r
 where p_kind='student' and r.id=p_request and r.status='executing' and r.execution_key is not null
 and public.student_recovery_target_is_eligible(r.target_person_id,r.target_auth_user_id)
$$;
create function public.lock_recovery_incident_source(p_kind text,p_request uuid) returns void
language plpgsql security definer set search_path='' set row_security=off as $$
declare target uuid;
begin
 if p_kind='employee' then
  select person_id into target from public.employee_password_recoveries where id=p_request for update;
 elsif p_kind='student' then
  select target_person_id into target from public.student_recovery_requests where id=p_request for update;
 else raise exception using errcode='22023',message='invalid recovery type'; end if;
 if target is null then raise exception using errcode='55000',message='incident source unavailable'; end if;
 perform 1 from public.people where id=target for update;
end $$;
create function public.current_person_can_review_recovery_incidents(p_kind text) returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(public.current_person_can_manage_staff_security()
 and (p_kind='employee' or (p_kind='student' and public.person_has_global_capability(public.current_person_id(),'student_recovery.assist'))),false)
$$;
create function public.open_recovery_incident(p_kind text,p_request_id uuid,p_reason_code text,p_fence_acknowledged boolean)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare src record; existing public.recovery_incident_reviews; result uuid; actor uuid;
begin
 if not public.current_person_can_review_recovery_incidents(p_kind) then raise exception using errcode='42501',message='incident access denied'; end if;
 if p_reason_code is distinct from 'uncertain_password_update' or p_fence_acknowledged is distinct from true then
  raise exception using errcode='22023',message='execution fence acknowledgment required'; end if;
 perform public.lock_recovery_incident_source(p_kind,p_request_id);
 select * into src from public.recovery_incident_source(p_kind,p_request_id);
 actor:=public.current_person_id();
 if not found or not public.current_person_can_review_recovery_incidents(p_kind) or actor=src.target_person_id then
  raise exception using errcode='42501',message='incident source or authority changed'; end if;
 select * into existing from public.recovery_incident_reviews where recovery_kind=p_kind and recovery_request_id=p_request_id for update;
 if found then
  if existing.proposer_person_id<>actor or existing.execution_fingerprint<>src.fingerprint then
   raise exception using errcode='42501',message='incident already belongs to another proposal'; end if;
  return existing.id;
 end if;
 insert into public.recovery_incident_reviews(recovery_kind,recovery_request_id,target_person_id,target_auth_user_id,execution_fingerprint,proposer_person_id,proposer_session_id,reason_code)
 values(p_kind,p_request_id,src.target_person_id,src.target_auth_user_id,src.fingerprint,actor,(auth.jwt()->>'session_id')::uuid,p_reason_code) returning id into result;
 insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
 values(src.target_person_id,actor,'recovery_incident_opened','succeeded',p_reason_code,jsonb_build_object('incident_id',result,'recovery_kind',p_kind,'request_id',p_request_id));
 return result;
end $$;
create function public.review_recovery_incident(p_incident_id uuid,p_fence_acknowledged boolean)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare incident public.recovery_incident_reviews; src record; actor uuid;
begin
 select * into incident from public.recovery_incident_reviews where id=p_incident_id;
 if incident.id is null or not public.current_person_can_review_recovery_incidents(incident.recovery_kind) then
  raise exception using errcode='42501',message='incident review denied'; end if;
 perform public.lock_recovery_incident_source(incident.recovery_kind,incident.recovery_request_id);
 select * into incident from public.recovery_incident_reviews where id=p_incident_id for update;
 select * into src from public.recovery_incident_source(incident.recovery_kind,incident.recovery_request_id);
 actor:=public.current_person_id();
 if not found or not public.current_person_can_review_recovery_incidents(incident.recovery_kind)
  or actor in (incident.target_person_id,incident.proposer_person_id)
  or src.target_person_id<>incident.target_person_id or src.target_auth_user_id<>incident.target_auth_user_id
  or src.fingerprint<>incident.execution_fingerprint
  or not public.staff_security_actor_is_fresh(incident.proposer_person_id,incident.proposer_session_id)
  or (incident.recovery_kind='student' and not public.person_has_global_capability(incident.proposer_person_id,'student_recovery.assist')) then
  raise exception using errcode='42501',message='independent incident authority or source changed'; end if;
 if p_fence_acknowledged is distinct from true then raise exception using errcode='22023',message='execution fence acknowledgment required'; end if;
 if incident.status='reviewed' then
  if incident.reviewer_person_id=actor then return; end if;
  raise exception using errcode='55000',message='incident already reviewed';
 end if;
 update public.recovery_incident_reviews set status='reviewed',reviewer_person_id=actor,reviewer_session_id=(auth.jwt()->>'session_id')::uuid,reviewed_at=now() where id=incident.id;
 insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
 values(incident.target_person_id,actor,'recovery_incident_reviewed','succeeded',incident.reason_code,jsonb_build_object('incident_id',incident.id,'recovery_kind',incident.recovery_kind,'request_id',incident.recovery_request_id,'execution_fence_retained',true));
end $$;
create function public.list_recovery_incidents()
returns table(recovery_kind text,request_id uuid,target_person_id uuid,display_name text,member_id text,request_created_at timestamptz,execution_started_at timestamptz,incident_id uuid,proposer_person_id uuid,reviewer_person_id uuid,incident_status text,review_is_current boolean)
language plpgsql security definer set search_path='' set row_security=off as $$
begin
 if not public.current_person_can_manage_staff_security() then raise exception using errcode='42501',message='incident queue denied'; end if;
 return query with sources as (
  select 'employee'::text kind,r.id rid,r.person_id pid from public.employee_password_recoveries r where r.status='executing'
  union all select 'student',r.id,r.target_person_id from public.student_recovery_requests r where r.status='executing'
 )
 select s.kind,s.rid,p.id,p.display_name,p.member_id,src.request_created_at,
 (select max(a.occurred_at) from public.security_audit_events a where a.subject_person_id=p.id and a.event_type=case when s.kind='employee' then 'employee_password_recovery_started' else 'student_recovery_started' end and a.metadata->>'request_id'=s.rid::text),
 i.id,i.proposer_person_id,i.reviewer_person_id,i.status,
 coalesce(i.execution_fingerprint=src.fingerprint and public.staff_security_actor_is_fresh(i.proposer_person_id,i.proposer_session_id)
  and (s.kind='employee' or public.person_has_global_capability(i.proposer_person_id,'student_recovery.assist'))
  and (i.status='pending' or (public.staff_security_actor_is_fresh(i.reviewer_person_id,i.reviewer_session_id)
   and (s.kind='employee' or public.person_has_global_capability(i.reviewer_person_id,'student_recovery.assist')))),false)
 from sources s cross join lateral public.recovery_incident_source(s.kind,s.rid) src
 join public.people p on p.id=src.target_person_id
 left join public.recovery_incident_reviews i on i.recovery_kind=s.kind and i.recovery_request_id=s.rid
 where public.current_person_can_review_recovery_incidents(s.kind) and p.id<>public.current_person_id()
 order by src.request_created_at,s.rid limit 100;
end $$;
revoke all on function public.recovery_incident_source(text,uuid),public.lock_recovery_incident_source(text,uuid) from public,anon,authenticated;
revoke all on function public.current_person_can_review_recovery_incidents(text),public.open_recovery_incident(text,uuid,text,boolean),public.review_recovery_incident(uuid,boolean),public.list_recovery_incidents() from public,anon;
grant execute on function public.current_person_can_review_recovery_incidents(text),public.open_recovery_incident(text,uuid,text,boolean),public.review_recovery_incident(uuid,boolean),public.list_recovery_incidents() to authenticated;
