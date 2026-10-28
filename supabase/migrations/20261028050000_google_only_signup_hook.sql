-- D-058 A: public sign-up is open for Google only. Supabase Auth calls this before-user-created
-- hook for every new account it creates through sign-up, OAuth and invitation links. It allows:
--   * Google sign-ups (test-series candidates, F039);
--   * the email account behind a staff-approved employee invitation that is being delivered
--     right now (generateLink type "invite" triggers the hook, and its event cannot be told
--     apart from a public email sign-up, so the server-side invitation state is the proof).
-- Everything else (public email or phone sign-up, other providers) is rejected.
-- Admin createUser (student activation) does not trigger the hook; this was proven on a
-- throwaway local stack before staging (see docs/features/F039-F041-public-sign-in-and-free-papers.md).
-- The hook is switched on per environment in Auth settings (config.toml locally).

create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_provider text := coalesce(event -> 'user' -> 'app_metadata' ->> 'provider', '');
  v_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if v_provider = 'google' then
    return '{}'::jsonb;
  end if;
  if v_provider = 'email' and v_email <> '' and exists (
    select 1
    from public.employee_invitations invitation
    where invitation.email = v_email
      and invitation.status = 'delivering'
      and invitation.auth_user_id is null
      and invitation.expires_at > now()
  ) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'New Dexam accounts can only be created with Google.'
    )
  );
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;
