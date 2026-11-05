-- D-065: provider-verified reservation claim precedes public candidate creation.
-- Does not create employee membership, roles, teaching authority or an enrolment.
create function public.claim_approved_google_identity()
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
 select * into target from public.approved_login_emails where email=provider_email for update;
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
 if not (select enabled from public.admissions_runtime_gate where singleton) then
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

-- Keep the existing candidate implementation, private, behind the verified claim.
alter function public.provision_google_candidate() rename to provision_unreserved_google_candidate;
revoke all on function public.provision_unreserved_google_candidate() from public,anon,authenticated,service_role;
create function public.provision_google_candidate()
returns jsonb language plpgsql security definer set search_path='' set row_security=off
as $$ declare result jsonb; begin
 result:=public.claim_approved_google_identity();
 if (result->>'claimed')::boolean or (result->>'mapped')::boolean then
  return jsonb_build_object('created',false);
 end if;
 return public.provision_unreserved_google_candidate();
end $$;
revoke all on function public.provision_google_candidate() from public,anon;
grant execute on function public.provision_google_candidate() to authenticated;
