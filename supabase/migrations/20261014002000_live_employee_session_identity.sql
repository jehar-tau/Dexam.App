-- D-004/D-028: provider deletion must deny ordinary employee access, not only MFA actions.
-- Auth password updates revoke other provider sessions; a still-valid JWT is not authority.
create or replace function public.current_person_id()
returns uuid language sql stable security definer set search_path='' set row_security=off
as $$
  select identity.person_id from public.auth_identities identity
  where identity.auth_user_id=(select auth.uid())
    and not exists(select 1 from public.employee_password_recoveries recovery where recovery.auth_user_id=identity.auth_user_id and recovery.status='executing')
    and (identity.kind<>'employee_email' or exists(
      select 1 from auth.sessions session where session.user_id=identity.auth_user_id
        and session.id=(select case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (auth.jwt()->>'session_id')::uuid else null::uuid end)
        and (session.not_after is null or session.not_after>now())
    ))
    and (not exists(select 1 from public.auth_session_cutoffs cutoff where cutoff.auth_user_id=identity.auth_user_id)
      or exists(select 1 from auth.sessions session join public.auth_session_cutoffs cutoff on cutoff.auth_user_id=session.user_id
        where session.user_id=identity.auth_user_id and session.id=(select case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (auth.jwt()->>'session_id')::uuid else null::uuid end)
        and session.created_at>cutoff.invalidated_before and (session.not_after is null or session.not_after>now())))
  limit 1
$$;
revoke all on function public.current_person_id() from public,anon;
grant execute on function public.current_person_id() to authenticated;
