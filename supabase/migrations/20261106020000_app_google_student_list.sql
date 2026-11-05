-- D-067/F056: Dexam App Google sign-in for listed full-course students only.
-- Separate from Dexam Mock Test: an App sign-in never creates a test-series candidate.
create table public.app_google_login_gate (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false
);
insert into public.app_google_login_gate(singleton,enabled) values(true,false);
alter table public.app_google_login_gate enable row level security;
revoke all on public.app_google_login_gate from public,anon,authenticated,service_role;

alter table public.approved_login_emails
  add column state text not null default 'approved' check (state in ('approved','revoked')),
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.people(id) on delete restrict,
  add column revoke_reason text,
  add constraint approved_login_revocation_consistent check (
    (state='approved' and revoked_at is null and revoked_by is null and revoke_reason is null)
    or (state='revoked' and revoked_at is not null and revoked_by is not null
      and length(btrim(revoke_reason)) between 3 and 500));

create table public.student_google_login_history (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  action text not null check (action in ('approved','revoked','restored')),
  email text not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  occurred_at timestamptz not null default clock_timestamp()
);
create index student_google_login_history_person_idx on public.student_google_login_history(person_id, occurred_at);
alter table public.student_google_login_history enable row level security;
revoke all on public.student_google_login_history from public,anon,authenticated;

insert into public.capabilities(key,description,requires_mfa) values
  ('student_login.approve','Add a current student''s Google email to the Dexam App sign-in list.',false),
  ('student_login.revoke','Revoke or restore a student''s Dexam App Google sign-in.',true);
-- Owner-directed role defaults (D-067): Sales and admins add; admins revoke.
insert into public.role_capabilities(role_key,capability_key) values
  ('sales','student_login.approve'),('elevated_admin','student_login.approve'),('elevated_admin','student_login.revoke');

create function public.current_person_can_approve_student_logins()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_capability('student_login.approve'),false)
$$;
create function public.current_person_can_revoke_student_logins()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_capability('student_login.revoke'),false)
$$;

create or replace function public.claim_approved_google_identity()
returns jsonb language plpgsql security definer set search_path='' set row_security=off
as $$ declare provider_user uuid:=auth.uid(); provider_email text; target public.approved_login_emails;
 mapped uuid; identity_kind public.auth_identity_kind; cutoff timestamptz;
begin
 if provider_user is null or not exists(
  select 1 from auth.sessions s where s.user_id=provider_user
  and s.id=(case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (auth.jwt()->>'session_id')::uuid end)
  and (s.not_after is null or s.not_after>clock_timestamp())
  and not exists(select 1 from public.auth_session_cutoffs c where c.auth_user_id=provider_user and s.created_at<=c.invalidated_before)
 ) then raise exception using errcode='42501',message='current Google session required'; end if;
 select person_id into mapped from public.auth_identities where auth_user_id=provider_user;
 if mapped is not null and not exists(select 1 from auth.identities where user_id=provider_user and provider='google') then
  if public.current_person_id() is distinct from mapped then raise exception using errcode='42501',message='current identity unavailable'; end if;
  return jsonb_build_object('claimed',false,'mapped',true);
 end if;
 -- identity_data is provider-owned, unlike raw_user_meta_data. Require the
 -- provider's verified email to agree with the confirmed Auth email as well.
 select lower(btrim(i.identity_data->>'email')) into provider_email
 from auth.identities i join auth.users u on u.id=i.user_id
 where i.user_id=provider_user and i.provider='google'
 and i.identity_data->>'email_verified'='true' and u.email_confirmed_at is not null
 and lower(btrim(u.email))=lower(btrim(i.identity_data->>'email'));
 if provider_email is null then raise exception using errcode='42501',message='verified Google identity required'; end if;
 perform pg_advisory_xact_lock(hashtextextended('dexam-login:'||provider_email,0));
 perform pg_advisory_xact_lock(hashtextextended('dexam-google-user:'||provider_user::text,0));
 -- D-067: a revoked reservation is treated exactly like no reservation.
 select * into target from public.approved_login_emails where email=provider_email and state='approved' for update;
 select person_id into mapped from public.auth_identities where auth_user_id=provider_user;
 if target.person_id is null then
  -- Existing mappings are still subject to canonical session/recovery fences.
  if mapped is not null and public.current_person_id() is distinct from mapped then
   raise exception using errcode='42501',message='current identity unavailable'; end if;
  return jsonb_build_object('claimed',false,'mapped',mapped is not null);
 end if;
 if mapped is not null and mapped<>target.person_id then
  raise exception using errcode='40001',message='existing account needs deliberate canonical identity resolution'; end if;
 if mapped is not null then
  if public.current_person_id() is distinct from mapped then raise exception using errcode='42501',message='current identity unavailable'; end if;
  return jsonb_build_object('claimed',true,'created',false);
 end if;
 if not ((select enabled from public.admissions_runtime_gate where singleton)
   or (select enabled from public.app_google_login_gate where singleton)) then
  raise exception using errcode='55000',message='Google admission integration is not enabled'; end if;
 perform 1 from public.people where id=target.person_id and status='active' for update;
 if not found then raise exception using errcode='42501',message='approved identity unavailable'; end if;
 if exists(select 1 from public.employee_password_recoveries r where r.person_id=target.person_id and r.status='executing')
 or exists(select 1 from public.student_recovery_requests r where r.target_person_id=target.person_id and r.status='executing') then
  raise exception using errcode='42501',message='identity recovery is unresolved'; end if;
 -- A second Google subject cannot replace an established Google binding.
 if exists(select 1 from public.auth_identities where person_id=target.person_id and kind='oauth_google') then
  raise exception using errcode='40001',message='Google binding already exists; verified resolution required'; end if;
 if target.purpose in ('employee','both') and exists(select 1 from public.memberships where person_id=target.person_id and kind='employee' and status='active') then
  -- A previously established employee Auth binding must be linked by the
  -- provider, not silently replaced with an additional privileged login.
  if exists(select 1 from public.auth_identities where person_id=target.person_id and kind='employee_email') then
   raise exception using errcode='40001',message='use verified provider linking for the established employee account'; end if;
  identity_kind:='employee_email';
 elsif target.purpose in ('student','both') and exists(select 1 from public.memberships where person_id=target.person_id and kind='student' and status='active') then
  identity_kind:='oauth_google';
 else raise exception using errcode='42501',message='approved active membership required'; end if;
 -- A newly linked Auth user inherits every existing canonical-person cutoff.
 select max(c.invalidated_before) into cutoff from public.auth_identities i
 join public.auth_session_cutoffs c on c.auth_user_id=i.auth_user_id where i.person_id=target.person_id;
 insert into public.auth_identities(person_id,auth_user_id,kind) values(target.person_id,provider_user,identity_kind);
 if cutoff is not null then
  insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values(provider_user,cutoff)
  on conflict(auth_user_id) do update set invalidated_before=greatest(auth_session_cutoffs.invalidated_before,excluded.invalidated_before);
 end if;
 if public.current_person_id() is distinct from target.person_id then raise exception using errcode='42501',message='sign in again with a current session'; end if;
 return jsonb_build_object('claimed',true,'created',false);
end $$;
revoke all on function public.claim_approved_google_identity() from public,anon,authenticated;

-- The App callback: claim a listed identity, then admit only listed students or current employees.
create function public.claim_app_google_login()
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare person uuid;
begin
  perform public.claim_approved_google_identity();
  person:=public.current_person_id();
  if person is not null and exists(select 1 from public.approved_login_emails a where a.person_id=person and a.state='approved'
      and a.purpose in ('student','both'))
    and exists(select 1 from public.memberships m where m.person_id=person and m.kind='student' and m.status='active') then
    return jsonb_build_object('allowed',true,'audience','student');
  end if;
  if person is not null and exists(select 1 from public.memberships m where m.person_id=person and m.kind='employee' and m.status='active') then
    return jsonb_build_object('allowed',true,'audience','employee');
  end if;
  return jsonb_build_object('allowed',false);
end $$;
revoke all on function public.claim_app_google_login() from public,anon;
grant execute on function public.claim_app_google_login() to authenticated;

create function public.list_student_google_logins(p_search text default '')
returns table(person_id uuid, member_id text, display_name text, email text, state text, linked boolean, revision bigint, revoked_at timestamptz)
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare needle text:=lower(btrim(coalesce(p_search,'')));
begin
  if not (public.current_person_can_approve_student_logins() or public.current_person_can_revoke_student_logins()) then
    raise exception using errcode='42501',message='student login list access denied'; end if;
  if length(needle)>120 then raise exception using errcode='22023',message='search is too long'; end if;
  return query select p.id,p.member_id,p.display_name,a.email,coalesce(a.state,'none'),
      exists(select 1 from public.auth_identities i where i.person_id=p.id and i.kind='oauth_google'),
      a.revision,a.revoked_at
    from public.people p
    join public.memberships m on m.person_id=p.id and m.kind='student' and m.status='active'
    left join public.approved_login_emails a on a.person_id=p.id
    -- Student-only entries; 'employee'/'both' logins are staff-managed and never revoked here.
    where p.status='active' and (a.purpose is null or a.purpose='student')
      and (needle='' or position(needle in lower(p.display_name))>0 or position(needle in lower(coalesce(p.member_id,'')))>0
        or position(needle in coalesce(a.email,''))>0)
    order by p.display_name,p.member_id limit 100;
end $$;

create function public.approve_student_google_login(p_request_key uuid, p_person_id uuid, p_email text, p_reason text)
returns bigint language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); login_email text; previous public.student_google_login_history;
  existing public.approved_login_emails; next_revision bigint; action_name text:='approved';
begin
  if not public.current_person_can_approve_student_logins() then
    raise exception using errcode='42501',message='student login approval denied'; end if;
  if p_request_key is null or p_person_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='student, Google email and reason required'; end if;
  login_email:=public.admission_normalized_email(p_email);
  perform pg_advisory_xact_lock(hashtextextended('dexam-student-login:'||p_request_key::text,0));
  select * into previous from public.student_google_login_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.person_id<>p_person_id or previous.email<>login_email
      or previous.action='revoked' or previous.reason<>btrim(p_reason) then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return (select revision from public.approved_login_emails where person_id=p_person_id);
  end if;
  -- Same lock order as admission and the Google claim: login email, then the reservation.
  perform pg_advisory_xact_lock(hashtextextended('dexam-login:'||login_email,0));
  if not exists(select 1 from public.people p join public.memberships m on m.person_id=p.id
      where p.id=p_person_id and p.status='active' and m.kind='student' and m.status='active') then
    raise exception using errcode='22023',message='only current students can be added'; end if;
  select * into existing from public.approved_login_emails where person_id=p_person_id for update;
  if found then
    if existing.purpose<>'student' then
      raise exception using errcode='22023',message='staff login emails are managed separately'; end if;
    if existing.state='approved' then
      if existing.email=login_email then return existing.revision; end if;
      raise exception using errcode='22023',message='student already has an approved Google email; an admin must revoke it first';
    end if;
    -- Restoring a revoked login is an admin decision, not a Sales override.
    if not public.current_person_can_revoke_student_logins() then
      raise exception using errcode='42501',message='only an admin can restore a revoked Google login'; end if;
    action_name:='restored';
    begin
      update public.approved_login_emails set email=login_email,state='approved',revoked_at=null,revoked_by=null,revoke_reason=null,
        revision=revision+1 where person_id=p_person_id returning revision into next_revision;
    exception when unique_violation then
      raise exception using errcode='23505',message='that Google email is already listed for another person';
    end;
  else
    begin
      insert into public.approved_login_emails(person_id,email,purpose,created_by) values(p_person_id,login_email,'student',actor)
        returning revision into next_revision;
    exception when unique_violation then
      raise exception using errcode='23505',message='that Google email is already listed for another person';
    end;
  end if;
  insert into public.student_google_login_history(person_id,request_key,actor_person_id,action,email,reason)
    values(p_person_id,p_request_key,actor,action_name,login_email,btrim(p_reason));
  if not public.current_person_can_approve_student_logins() then
    raise exception using errcode='42501',message='student login authority changed'; end if;
  return next_revision;
end $$;

create function public.revoke_student_google_login(p_request_key uuid, p_person_id uuid, p_expected_revision bigint, p_reason text)
returns bigint language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.student_google_login_history;
  existing public.approved_login_emails; google_user uuid; next_revision bigint;
begin
  if not public.current_person_can_revoke_student_logins() then
    raise exception using errcode='42501',message='student login revocation denied'; end if;
  if p_request_key is null or p_person_id is null or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='student and reason required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-student-login:'||p_request_key::text,0));
  select * into previous from public.student_google_login_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.person_id<>p_person_id or previous.action<>'revoked'
      or previous.reason<>btrim(p_reason) then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return (select revision from public.approved_login_emails where person_id=p_person_id);
  end if;
  select * into existing from public.approved_login_emails where person_id=p_person_id;
  if not found or existing.purpose<>'student' or existing.state<>'approved' then
    raise exception using errcode='22023',message='no approved student Google login to revoke'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-login:'||existing.email,0));
  select * into existing from public.approved_login_emails where person_id=p_person_id for update;
  if existing.state<>'approved' or existing.revision is distinct from p_expected_revision then
    raise exception using errcode='40001',message='student login changed; refresh and review'; end if;
  update public.approved_login_emails set state='revoked',revoked_at=clock_timestamp(),revoked_by=actor,revoke_reason=btrim(p_reason),
    revision=revision+1 where person_id=p_person_id returning revision into next_revision;
  -- Unlink the Google account and end its sessions now; Member ID sign-in and course access are untouched.
  for google_user in select auth_user_id from public.auth_identities where person_id=p_person_id and kind='oauth_google' for update loop
    insert into public.auth_session_cutoffs(auth_user_id,invalidated_before) values(google_user,clock_timestamp())
      on conflict(auth_user_id) do update set invalidated_before=greatest(auth_session_cutoffs.invalidated_before,excluded.invalidated_before),updated_at=now();
    delete from public.auth_identities where auth_user_id=google_user and kind='oauth_google';
  end loop;
  insert into public.student_google_login_history(person_id,request_key,actor_person_id,action,email,reason)
    values(p_person_id,p_request_key,actor,'revoked',existing.email,btrim(p_reason));
  if not public.current_person_can_revoke_student_logins() then
    raise exception using errcode='42501',message='student login authority changed'; end if;
  return next_revision;
end $$;

revoke all on function public.current_person_can_approve_student_logins(), public.current_person_can_revoke_student_logins(),
  public.list_student_google_logins(text), public.approve_student_google_login(uuid,uuid,text,text),
  public.revoke_student_google_login(uuid,uuid,bigint,text) from public,anon;
grant execute on function public.current_person_can_approve_student_logins(), public.current_person_can_revoke_student_logins(),
  public.list_student_google_logins(text), public.approve_student_google_login(uuid,uuid,text,text),
  public.revoke_student_google_login(uuid,uuid,bigint,text) to authenticated;

-- Navigation flags only; the RPCs above enforce every operation.
create or replace function public.get_my_navigation_access()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare
 student boolean := public.current_person_has_active_student_membership();
 employee boolean := public.current_person_has_active_employee_membership();
begin
 return jsonb_build_object(
  'student',coalesce(student,false),'employee',coalesce(employee,false),
  'crm',employee and public.current_person_has_capability('lead.manage_assigned'),
  'crmAssignments',employee and public.current_person_has_capability('lead.assign'),
  'privacy',employee and public.current_person_has_capability('privacy.manage'),
  'enrolments',employee and public.current_person_has_capability('enrollment.operate'),
  'content',employee and public.current_person_can_open_content_workspace(),
  'distribution',employee and public.current_person_can_open_assignment_distribution(),
  'reviews',employee and public.current_person_can_open_feedback_workspace(),
  'closeout',employee and exists(select 1 from public.offerings o where public.current_person_can_close_enrollment(o.id)),
  'classes',employee and exists(select 1 from public.offerings o where o.status='active' and public.current_person_can_schedule_classes(o.id)),
  'curriculumImpact',employee and exists(select 1 from public.offerings o where o.status='active' and public.can_preview_curriculum_upgrade(o.id)),
  'batches',employee and public.current_person_can_manage_batches(),
  -- Teacher-portal placement link: teachers only. Sales place students from their own Batches page.
  'batchAssign',employee and exists(select 1 from public.offerings o where o.status='active'
    and public.current_person_is_assignment_teacher(o.id) and public.current_person_can_assign_batches(o.id)),
  'studentLogins',employee and public.current_person_can_approve_student_logins(),
  'studentLoginRevoke',employee and public.current_person_can_revoke_student_logins(),
  'employees',employee and public.current_person_can_invite_employees(),
  'studentRecovery',employee and public.current_person_can_assist_student_recovery(),
  'staffRecovery',employee and public.current_person_can_manage_staff_security()
 );
end $$;
