-- D-029 Option B: fictional invitation authority. No role grant or live delivery.
create table public.employee_invitations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id),
  email text not null check (email = lower(btrim(email)) and length(email) <= 254 and email ~ '^[a-z0-9][a-z0-9._+-]*@[a-z0-9.-]+\.invalid$'),
  issuer_person_id uuid not null references public.people(id),
  issuer_session_id uuid not null,
  auth_user_id uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','delivering','delivered','accepted','cancelled','failed')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '1 hour'),
  delivered_at timestamptz,
  accepted_at timestamptz,
  check (expires_at > created_at and expires_at <= created_at + interval '1 hour')
);
create unique index employee_invitation_active_person on public.employee_invitations(person_id) where status in ('pending','delivering','delivered');
create unique index employee_invitation_active_email on public.employee_invitations(email) where status in ('pending','delivering','delivered');
create index employee_invitation_issuer on public.employee_invitations(issuer_person_id);
create index employee_invitation_person on public.employee_invitations(person_id);
create index employee_invitation_auth on public.employee_invitations(auth_user_id);
create index employee_invitation_created on public.employee_invitations(created_at desc);
alter table public.employee_invitations enable row level security;
revoke all on public.employee_invitations from anon, authenticated;

create function public.current_person_can_invite_employees()
returns boolean language sql stable security definer set search_path = '' set row_security = off
as $$ select public.current_person_can_manage_staff_security()
  and public.current_person_has_capability('staff_role.grant') $$;
revoke all on function public.current_person_can_invite_employees() from public, anon;
grant execute on function public.current_person_can_invite_employees() to authenticated;

create function public.search_employee_invitation_people(p_search text)
returns table(person_id uuid, display_name text, has_employee_identity boolean, employee_status text)
language plpgsql security definer set search_path = '' set row_security = off
as $$
begin
  if not public.current_person_can_invite_employees() then raise exception using errcode='42501', message='employee invitation access denied'; end if;
  if p_search is null or length(btrim(p_search)) < 2 or length(p_search) > 120 then return; end if;
  return query select person.id, person.display_name,
    exists(select 1 from public.auth_identities identity where identity.person_id=person.id and identity.kind='employee_email'),
    (select membership.status::text from public.memberships membership where membership.person_id=person.id
      and membership.kind='employee' and membership.status in ('pending','active','suspended') limit 1)
  from public.people person where person.status='active' and position(lower(btrim(p_search)) in lower(coalesce(person.display_name,'')))>0
  order by person.display_name, person.id limit 50;
end $$;
revoke all on function public.search_employee_invitation_people(text) from public, anon;
grant execute on function public.search_employee_invitation_people(text) to authenticated;

create function public.prepare_employee_invitation(p_person_id uuid, p_display_name text, p_email text, p_duplicates_reviewed boolean)
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
    select 1 from public.auth_identities identity where identity.auth_user_id=account.id and identity.person_id=target and identity.kind='employee_email')) then
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

create function public.cancel_employee_invitation(p_request_id uuid)
returns void language plpgsql security definer set search_path = '' set row_security = off
as $$
declare request public.employee_invitations;
begin
  if not public.current_person_can_invite_employees() then raise exception using errcode='42501', message='employee invitation cancellation denied'; end if;
  select * into request from public.employee_invitations where id=p_request_id for update;
  if not found or request.status not in ('pending','delivering','delivered') then raise exception using errcode='55000', message='employee invitation is not cancellable'; end if;
  update public.employee_invitations set status='cancelled' where id=p_request_id;
  insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata)
    values(request.person_id,public.current_person_id(),'employee_invitation_cancelled','succeeded','administrator_cancelled',jsonb_build_object('request_id',p_request_id));
end $$;
revoke all on function public.cancel_employee_invitation(uuid) from public, anon;
grant execute on function public.cancel_employee_invitation(uuid) to authenticated;

create function public.list_employee_invitations()
returns table(id uuid, person_id uuid, display_name text, masked_email text, status text, expires_at timestamptz)
language plpgsql security definer set search_path = '' set row_security = off
as $$
begin
  if not public.current_person_can_invite_employees() then raise exception using errcode='42501', message='employee invitation queue denied'; end if;
  return query select request.id,request.person_id,person.display_name,
    left(request.email,2)||'…@'||split_part(request.email,'@',2),request.status,request.expires_at
  from public.employee_invitations request join public.people person on person.id=request.person_id order by request.created_at desc limit 100;
end $$;
revoke all on function public.list_employee_invitations() from public, anon;
grant execute on function public.list_employee_invitations() to authenticated;
