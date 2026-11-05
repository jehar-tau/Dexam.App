-- D-065/F054. Local foundation: admission mutations remain disabled until integration acceptance.
create table public.admissions_runtime_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into public.admissions_runtime_gate(singleton,enabled) values(true,false);
alter table public.admissions_runtime_gate enable row level security;
revoke all on public.admissions_runtime_gate from public,anon,authenticated,service_role;

-- Deliberate login reservation, never copied from guardian/billing/CRM contacts.
create table public.approved_login_emails (
  person_id uuid primary key references public.people(id) on delete restrict,
  email text not null unique,
  purpose text not null check(purpose in ('student','employee','both')),
  created_by uuid not null references public.people(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  revision bigint not null default 1 check(revision>0),
  constraint approved_login_email_canonical check(
    email=lower(btrim(email)) and length(email) between 3 and 254
    and email ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    and email not like '%..%' and email not like '.%' and split_part(email,'@',1) not like '%.'
  )
);
create table public.enrollment_access_windows (
  enrollment_id uuid primary key references public.enrollments(id) on delete restrict,
  starts_at timestamptz not null,
  expires_at timestamptz not null,
  state text not null default 'active' check(state in ('active','suspended','revoked')),
  revision bigint not null default 1 check(revision>0),
  updated_by uuid not null references public.people(id) on delete restrict,
  updated_at timestamptz not null default clock_timestamp(),
  check(expires_at>starts_at and isfinite(starts_at) and isfinite(expires_at))
);
create table public.admission_receipts (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  person_id uuid not null references public.people(id) on delete restrict,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  evidence_kind text not null default 'manual' check(evidence_kind='manual'),
  method text not null check(method in ('cash','online_transfer','card_machine')),
  amount_paise bigint not null check(amount_paise>=0 and amount_paise<=9007199254740991),
  currency text not null default 'INR' check(currency='INR'),
  paid_at timestamptz not null check(isfinite(paid_at)),
  reference text not null check(length(btrim(reference)) between 1 and 160),
  confirmed_by uuid not null references public.people(id) on delete restrict,
  confirmed_at timestamptz not null default clock_timestamp(),
  -- Exact private request snapshot prevents a reused key from approving another admission.
  request_snapshot jsonb not null
);
create table public.admission_change_history (
  id bigint generated always as identity primary key,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  action text not null check(action in ('admitted','details','dates','renewal','suspension','revocation','batch_transfer')),
  reason text not null check(length(btrim(reason)) between 3 and 500),
  prior_values jsonb not null,
  new_values jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table public.approved_login_emails enable row level security;
alter table public.enrollment_access_windows enable row level security;
alter table public.admission_receipts enable row level security;
alter table public.admission_change_history enable row level security;
revoke all on public.approved_login_emails,public.enrollment_access_windows,public.admission_receipts,public.admission_change_history from public,anon,authenticated,service_role;
revoke all on sequence public.admission_change_history_id_seq from public,anon,authenticated,service_role;

-- Even future privileged writers must append a correction, never rewrite evidence.
create function public.guard_admission_evidence()
returns trigger language plpgsql set search_path=''
as $$ begin
  raise exception using errcode='55000',message='admission evidence is append-only';
end $$;
revoke all on function public.guard_admission_evidence() from public,anon,authenticated,service_role;
create trigger admission_receipts_append_only before update or delete on public.admission_receipts
for each row execute function public.guard_admission_evidence();
create trigger admission_history_append_only before update or delete on public.admission_change_history
for each row execute function public.guard_admission_evidence();

create function public.admission_normalized_email(p_email text)
returns text language plpgsql immutable set search_path=''
as $$ declare value text:=lower(btrim(p_email));
begin
  if value is null or length(value) not between 3 and 254
    or value !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    or value like '%..%' or value like '.%' or split_part(value,'@',1) like '%.' then
    raise exception using errcode='22023',message='valid dedicated login email required';
  end if;
  return value;
end $$;
create function public.admission_preset_expiry(p_start timestamptz,p_preset integer)
returns timestamptz language plpgsql immutable set search_path=''
as $$ declare expiry timestamptz; begin
  if p_start is null or not isfinite(p_start) or extract(year from p_start at time zone 'UTC') not between 1000 and 9999 then
    raise exception using errcode='22023',message='explicit finite access start required'; end if;
  if p_preset not in (12,24,48,30) or p_preset is null then
    raise exception using errcode='22023',message='invalid access duration'; end if;
  expiry:=case when p_preset=30 then p_start+interval '720 hours'
    else ((p_start at time zone 'Asia/Kolkata')+make_interval(months=>p_preset)) at time zone 'Asia/Kolkata' end;
  if extract(year from expiry at time zone 'UTC') not between 1000 and 9999 then
    raise exception using errcode='22023',message='access expiry is outside supported dates'; end if;
  return expiry;
end $$;
create function public.current_person_can_manage_admissions()
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_can_manage_staff_security()
  and public.current_person_has_capability('enrollment.operate') $$;
create function public.enrollment_has_current_access(p_enrollment_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.enrollments e
  join public.people p on p.id=e.person_id
  left join public.enrollment_access_windows w on w.enrollment_id=e.id
  where e.id=p_enrollment_id and e.status='active' and e.ended_at is null and p.status='active'
    and (w.enrollment_id is null or (w.state='active' and w.starts_at<=clock_timestamp() and w.expires_at>clock_timestamp()))) $$;

-- Minimal protected directory, paginated/capped. No guardian/billing/CRM contacts are joined.
create function public.list_admissions_directory(p_search text default '',p_offering uuid default null,p_cohort uuid default null,p_state text default null,p_expires_before timestamptz default null,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$ begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  if length(coalesce(p_search,''))>254 or p_offset is null or p_offset<0 or p_offset>100000
    or (p_state is not null and p_state not in ('legacy','active','scheduled','expired','suspended','revoked','ended')) then
    raise exception using errcode='22023',message='invalid directory filter'; end if;
  return (select coalesce(jsonb_agg(item order by display_name,person_id),'[]'::jsonb) from (
    select p.id person_id,p.display_name,jsonb_build_object('personId',p.id,'memberId',p.member_id,'name',p.display_name,
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

create function public.admit_student(p_request_key uuid,p_existing_person uuid,p_email text,p_name text,p_offering uuid,p_cohort uuid,p_start timestamptz,p_expiry timestamptz,p_method text,p_amount_paise bigint,p_paid_at timestamptz,p_reference text,p_confirmed boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off
as $$ declare actor uuid:=public.current_person_id(); login_email text; target uuid; member text; enrollment uuid;
  snapshot jsonb; prior public.admission_receipts; reserved public.approved_login_emails; matches uuid[];
begin
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admissions access denied'; end if;
  if not (select enabled from public.admissions_runtime_gate where singleton) then
    raise exception using errcode='55000',message='admission integration is not enabled'; end if;
  login_email:=public.admission_normalized_email(p_email);
  snapshot:=jsonb_build_object('person',p_existing_person,'email',login_email,'name',p_name,'offering',p_offering,'cohort',p_cohort,
    'start',p_start,'expiry',p_expiry,'method',p_method,'amount',p_amount_paise,'paidAt',p_paid_at,'reference',p_reference,'confirmed',p_confirmed,'reason',p_reason);
  if p_request_key is null then raise exception using errcode='22023',message='request identity required'; end if;
  -- All same-email admissions and claims take this lock before any identity/receipt writes.
  perform pg_advisory_xact_lock(hashtextextended('dexam-login:'||login_email,0));
  perform pg_advisory_xact_lock(hashtextextended('dexam-admission-request:'||p_request_key::text,0));
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admission authority changed'; end if;
  select * into prior from public.admission_receipts where request_key=p_request_key;
  if found then
    if prior.confirmed_by<>actor or prior.request_snapshot<>snapshot then
      raise exception using errcode='40001',message='request identity already used; refresh'; end if;
    return jsonb_build_object('personId',prior.person_id,'enrollmentId',prior.enrollment_id,'receiptId',prior.id,'replayed',true);
  end if;
  if p_confirmed is distinct from true or p_name is null or length(btrim(p_name)) not between 1 and 120
    or p_start is null or p_expiry is null or not isfinite(p_start) or not isfinite(p_expiry) or p_expiry<=p_start
    or p_start<clock_timestamp() or p_method is null or p_method not in ('cash','online_transfer','card_machine')
    or p_amount_paise is null or p_amount_paise<=0 or p_amount_paise>9007199254740991
    or p_paid_at is null or not isfinite(p_paid_at) or p_paid_at>clock_timestamp()
    or p_reference is null or length(btrim(p_reference)) not between 1 and 160
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='review explicit dates, amount and manual confirmation'; end if;
  perform 1 from public.offerings where id=p_offering and status='active' for share;
  if not found then raise exception using errcode='22023',message='active programme required'; end if;
  if p_cohort is not null then
    perform 1 from public.cohorts where id=p_cohort and offering_id=p_offering and status='active' for share;
    if not found then raise exception using errcode='22023',message='active batch in this programme required'; end if;
  end if;
  select * into reserved from public.approved_login_emails where approved_login_emails.email=login_email for update;
  -- Existing trusted Auth mappings are candidate hints requiring deliberate selection, never automatic merges.
  select array_agg(distinct i.person_id) into matches from public.auth_identities i join auth.users u on u.id=i.auth_user_id
    where lower(btrim(u.email))=login_email and u.email_confirmed_at is not null;
  if (reserved.person_id is not null and p_existing_person is distinct from reserved.person_id)
    or (matches is not null and (cardinality(matches)<>1 or p_existing_person is distinct from matches[1])) then
    raise exception using errcode='40001',message='existing login found; deliberately resolve the canonical student before admission'; end if;
  if p_existing_person is null then
    member:=public.generate_dexam_member_id();
    insert into public.people(member_id,display_name) values(member,btrim(p_name)) returning id into target;
  else
    select id,member_id into target,member from public.people where id=p_existing_person and status='active' for update;
    if target is null then raise exception using errcode='42501',message='selected canonical person unavailable'; end if;
    if member is null then member:=public.generate_dexam_member_id(); update public.people set member_id=member,updated_at=clock_timestamp() where id=target; end if;
    if exists(select 1 from public.approved_login_emails l where l.person_id=target and l.email<>login_email) then
      raise exception using errcode='42501',message='login email replacement requires verified relinking'; end if;
  end if;
  insert into public.approved_login_emails(person_id,email,purpose,created_by) values(target,login_email,'student',actor)
    on conflict(person_id) do update set purpose=case when approved_login_emails.purpose='employee' then 'both' else approved_login_emails.purpose end;
  if exists(select 1 from public.memberships where person_id=target and kind='student' and status in ('suspended','ended')) then
    raise exception using errcode='42501',message='membership restoration requires separate authority'; end if;
  insert into public.memberships(person_id,kind,status,starts_at)
    select target,'student','active',clock_timestamp() where not exists(select 1 from public.memberships where person_id=target and kind='student' and status in ('pending','active','suspended'));
  -- A pending legacy membership is not silently restored/activated.
  if not exists(select 1 from public.memberships where person_id=target and kind='student' and status='active') then
    raise exception using errcode='42501',message='existing membership requires deliberate activation'; end if;
  insert into public.enrollments(person_id,offering_id,cohort_id,status,source_type,requested_by_person_id,approved_by_person_id,approved_at,activated_at)
    values(target,p_offering,p_cohort,'active','manual_admission',actor,actor,clock_timestamp(),clock_timestamp()) returning id into enrollment;
  insert into public.enrollment_access_windows(enrollment_id,starts_at,expires_at,updated_by) values(enrollment,p_start,p_expiry,actor);
  insert into public.admission_receipts(request_key,person_id,enrollment_id,method,amount_paise,paid_at,reference,confirmed_by,request_snapshot)
    values(p_request_key,target,enrollment,p_method,p_amount_paise,p_paid_at,btrim(p_reference),actor,snapshot) returning * into prior;
  insert into public.admission_change_history(enrollment_id,request_key,actor_person_id,action,reason,prior_values,new_values)
    values(enrollment,p_request_key,actor,'admitted',btrim(p_reason),'{}',jsonb_build_object('startsAt',p_start,'expiresAt',p_expiry,'cohortId',p_cohort,'receiptId',prior.id));
  insert into public.enrollment_transitions(enrollment_id,from_status,to_status,actor_person_id,reason_code)
    values(enrollment,null,'active',actor,'manual_admission_confirmed');
  if not public.current_person_can_manage_admissions() then raise exception using errcode='42501',message='admission authority changed'; end if;
  return jsonb_build_object('personId',target,'memberId',member,'enrollmentId',enrollment,'receiptId',prior.id,'replayed',false);
end $$;

revoke all on function public.admission_normalized_email(text),public.admission_preset_expiry(timestamptz,integer),public.current_person_can_manage_admissions(),public.enrollment_has_current_access(uuid),public.list_admissions_directory(text,uuid,uuid,text,timestamptz,integer),public.admit_student(uuid,uuid,text,text,uuid,uuid,timestamptz,timestamptz,text,bigint,timestamptz,text,boolean,text) from public,anon,authenticated;
grant execute on function public.current_person_can_manage_admissions(),public.list_admissions_directory(text,uuid,uuid,text,timestamptz,integer),public.admit_student(uuid,uuid,text,text,uuid,uuid,timestamptz,timestamptz,text,bigint,timestamptz,text,boolean,text) to authenticated;
-- No browser access to private base tables, receipts, login reservations or the feature gate.
