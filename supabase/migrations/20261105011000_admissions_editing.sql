-- D-065: attributable, revision-aware edits; no email relinking or receipt mutation.
create function public.search_admission_identity(p_search text)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  if p_search is null or length(btrim(p_search)) not between 2 and 254 then return '[]'::jsonb; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('personId',id,'memberId',member_id,'name',display_name,
    'loginEmail',email,'state',status) order by id),'[]'::jsonb) from (
    select distinct p.id,p.member_id,p.display_name,p.status,l.email
    from public.people p left join public.approved_login_emails l on l.person_id=p.id
    where position(lower(btrim(p_search)) in lower(coalesce(p.display_name,'')||' '||coalesce(p.member_id,'')||' '||coalesce(l.email,'')))>0
      or exists(select 1 from public.auth_identities i join auth.users u on u.id=i.auth_user_id
        where i.person_id=p.id and lower(btrim(u.email))=lower(btrim(p_search)) and u.email_confirmed_at is not null)
    order by p.id limit 25
  ) matches);
end $$;

create function public.get_admission_choices()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  return jsonb_build_object('enabled',(select enabled from public.admissions_runtime_gate where singleton),'timezone','Asia/Kolkata',
    'offerings',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'batches',
      (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name) order by c.name),'[]'::jsonb)
        from public.cohorts c where c.offering_id=o.id and c.status='active')) order by o.title),'[]'::jsonb)
      from public.offerings o where o.status='active'));
end $$;

create function public.get_admission_history(p_enrollment uuid)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  return jsonb_build_object('changes',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'actorId',h.actor_person_id,'action',h.action,'reason',h.reason,'prior',h.prior_values,'next',h.new_values,'at',h.occurred_at) order by h.occurred_at,h.id),'[]'::jsonb)
      from public.admission_change_history h where h.enrollment_id=p_enrollment),
    'receipts',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'evidenceKind',r.evidence_kind,'method',r.method,'amountPaise',r.amount_paise,'currency',r.currency,'paidAt',r.paid_at,'reference',r.reference,'confirmedBy',r.confirmed_by,'confirmedAt',r.confirmed_at) order by r.confirmed_at,r.id),'[]'::jsonb)
      from public.admission_receipts r where r.enrollment_id=p_enrollment));
end $$;

create function public.edit_admission(p_enrollment uuid,p_expected_revision bigint,p_expected_person_revision bigint,p_request_key uuid,p_action text,p_reason text,p_name text default null,p_start timestamptz default null,p_expiry timestamptz default null,p_cohort uuid default null)
returns bigint language plpgsql security definer set search_path='' set row_security=off
as $$ declare actor uuid:=public.current_person_id(); target public.enrollments; access_record public.enrollment_access_windows;
  previous public.admission_change_history; prior jsonb; next jsonb; expected_curriculum uuid; new_curriculum uuid; person_revision bigint;
  request jsonb:=jsonb_build_object('expectedRevision',p_expected_revision,'expectedPersonRevision',p_expected_person_revision,'action',p_action,'reason',p_reason,'name',p_name,'start',p_start,'expiry',p_expiry,'cohort',p_cohort);
begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  if not (select enabled from public.admissions_runtime_gate where singleton) then raise exception using errcode='55000',message='admission integration is not enabled'; end if;
  if p_request_key is null or p_action is null or p_action not in ('details','dates','renewal','suspension','revocation','batch_transfer')
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then raise exception using errcode='22023',message='explicit edit and reason required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-admission-edit:'||p_request_key::text,0));
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admission authority changed'; end if;
  select * into previous from public.admission_change_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.enrollment_id<>p_enrollment or previous.new_values->'request' is distinct from request then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return (previous.new_values->>'revision')::bigint;
  end if;
  select * into target from public.enrollments where id=p_enrollment for update;
  if not found then raise exception using errcode='42501',message='enrolment unavailable'; end if;
  select * into access_record from public.enrollment_access_windows where enrollment_id=p_enrollment for update;
  if not found then raise exception using errcode='55000',message='legacy validity needs separate reviewed migration'; end if;
  if access_record.revision is distinct from p_expected_revision then raise exception using errcode='40001',message='student record changed; refresh and review'; end if;
  if target.status<>'active' or target.ended_at is not null or access_record.state='revoked' then raise exception using errcode='55000',message='ended or revoked access cannot be silently restored'; end if;
  select revision into person_revision from public.approved_login_emails where person_id=target.person_id for update;
  if person_revision is null or person_revision is distinct from p_expected_person_revision then
    raise exception using errcode='40001',message='student profile changed; refresh all enrolments before editing'; end if;
  -- Match admission/Google lock order: reservation before canonical person.
  perform 1 from public.people where id=target.person_id and status='active' for update;
  if not found then raise exception using errcode='42501',message='current student state changed'; end if;
  prior:=jsonb_build_object('startsAt',access_record.starts_at,'expiresAt',access_record.expires_at,'state',access_record.state,'cohortId',target.cohort_id,
    'name',(select display_name from public.people where id=target.person_id),'revision',access_record.revision);
  if p_action='details' then
    if p_name is null or length(btrim(p_name)) not between 1 and 120 or p_start is not null or p_expiry is not null or p_cohort is not null then
      raise exception using errcode='22023',message='only non-identity name editing is permitted here'; end if;
    update public.people set display_name=btrim(p_name),updated_at=clock_timestamp() where id=target.person_id;
  elsif p_action='dates' then
    if access_record.state<>'active' or p_name is not null or p_cohort is not null or p_start is null or p_expiry is null
      or not isfinite(p_start) or not isfinite(p_expiry) or p_expiry<=p_start
      or (p_start is distinct from access_record.starts_at and p_start<clock_timestamp()) then
      raise exception using errcode='22023',message='review both dates; backdating and implicit restoration are unavailable'; end if;
    access_record.starts_at:=p_start; access_record.expires_at:=p_expiry;
  elsif p_action='renewal' then
    if access_record.state<>'active' or p_start is not null or p_expiry is null or not isfinite(p_expiry)
      or p_expiry<=access_record.expires_at or p_expiry<=clock_timestamp() or p_name is not null or p_cohort is not null then
      raise exception using errcode='22023',message='renewal must explicitly extend unsuspended access'; end if;
    access_record.expires_at:=p_expiry;
  elsif p_action in ('suspension','revocation') then
    if p_start is not null or p_expiry is not null or p_name is not null or p_cohort is not null then raise exception using errcode='22023',message='access-state change cannot silently change other fields'; end if;
    access_record.state:=case when p_action='suspension' then 'suspended' else 'revoked' end;
  elsif p_action='batch_transfer' then
    if p_start is not null or p_expiry is not null or p_name is not null or p_cohort is null or p_cohort is not distinct from target.cohort_id then
      raise exception using errcode='22023',message='choose a different delivery batch without changing dates'; end if;
    select coalesce(c.curriculum_version_id,target.curriculum_version_id) into expected_curriculum
      from (select 1) base left join public.cohorts c on c.id=target.cohort_id;
    select curriculum_version_id into new_curriculum from public.cohorts where id=p_cohort and offering_id=target.offering_id and status='active' for share;
    if not found or new_curriculum is distinct from expected_curriculum then
      raise exception using errcode='22023',message='batch must preserve the pinned curriculum; curriculum migration is separate'; end if;
    update public.enrollments set cohort_id=p_cohort,updated_at=clock_timestamp() where id=target.id;
    -- Existing assignment instances/releases retain their immutable versions and enrolment reference.
  end if;
  update public.enrollment_access_windows set starts_at=access_record.starts_at,expires_at=access_record.expires_at,state=access_record.state,
    revision=revision+1,updated_by=actor,updated_at=clock_timestamp() where enrollment_id=p_enrollment returning revision into access_record.revision;
  update public.approved_login_emails set revision=revision+1 where person_id=target.person_id;
  next:=jsonb_build_object('startsAt',access_record.starts_at,'expiresAt',access_record.expires_at,'state',access_record.state,
    'cohortId',(select cohort_id from public.enrollments where id=p_enrollment),'name',(select display_name from public.people where id=target.person_id),
    'revision',access_record.revision,'request',request);
  insert into public.admission_change_history(enrollment_id,request_key,actor_person_id,action,reason,prior_values,new_values)
    values(p_enrollment,p_request_key,actor,p_action,btrim(p_reason),prior,next);
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admission authority changed'; end if;
  return access_record.revision;
end $$;
revoke all on function public.search_admission_identity(text),public.get_admission_choices(),public.get_admission_history(uuid),public.edit_admission(uuid,bigint,bigint,uuid,text,text,text,timestamptz,timestamptz,uuid) from public,anon;
grant execute on function public.search_admission_identity(text),public.get_admission_choices(),public.get_admission_history(uuid),public.edit_admission(uuid,bigint,bigint,uuid,text,text,text,timestamptz,timestamptz,uuid) to authenticated;
