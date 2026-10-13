-- D-028 Option B: an old aal2 JWT alone is not continuing authority.
-- Read provider-managed session/factor metadata; never alter Auth's tables.
create or replace function public.current_session_has_live_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(
    (select auth.jwt() ->> 'aal') = 'aal2'
    and exists (
      select 1
      from auth.sessions session
      join auth.mfa_factors factor on factor.id = session.factor_id
      where session.id = (
        select case
          when (auth.jwt() ->> 'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
          then (auth.jwt() ->> 'session_id')::uuid
          else null::uuid
        end
      )
        and session.user_id = (select auth.uid())
        and session.aal = 'aal2'
        and (session.not_after is null or session.not_after > now())
        and factor.user_id = session.user_id
        and factor.factor_type = 'totp'
        and factor.status = 'verified'
    ), false
  )
$$;

revoke all on function public.current_session_has_live_mfa() from public, anon;
grant execute on function public.current_session_has_live_mfa() to authenticated;

create or replace function public.current_person_has_capability(
  p_capability_key text,
  p_scope_type text default 'global',
  p_scope_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with requested_capability as (
    select key, requires_mfa
    from public.capabilities
    where key = p_capability_key
  ),
  role_allows as (
    select 1
    from public.role_assignments ra
    join public.role_capabilities rc on rc.role_key = ra.role_key
    where ra.person_id = public.current_person_id()
      and rc.capability_key = p_capability_key
      and ra.scope_type = p_scope_type
      and ra.scope_id is not distinct from p_scope_id
      and ra.revoked_at is null
      and ra.starts_at <= now()
      and (ra.ends_at is null or ra.ends_at > now())
  ),
  direct_grant_allows as (
    select 1
    from public.capability_grants cg
    join public.role_assignments ra
      on ra.person_id = cg.person_id
      and ra.role_key = cg.required_role_key
      and ra.scope_type = cg.scope_type
      and ra.scope_id is not distinct from cg.scope_id
      and ra.revoked_at is null
      and ra.starts_at <= now()
      and (ra.ends_at is null or ra.ends_at > now())
    where cg.person_id = public.current_person_id()
      and cg.capability_key = p_capability_key
      and cg.scope_type = p_scope_type
      and cg.scope_id is not distinct from p_scope_id
      and cg.revoked_at is null
      and cg.starts_at <= now()
      and (cg.ends_at is null or cg.ends_at > now())
  )
  select coalesce(
    public.current_person_has_active_employee_membership()
    and exists (select 1 from requested_capability)
    and (
      not (select requires_mfa from requested_capability)
      or public.current_session_has_live_mfa()
    )
    and (
      exists (select 1 from role_allows)
      or exists (select 1 from direct_grant_allows)
    ), false
  )
$$;

revoke all on function public.current_person_has_capability(text, text, uuid) from public, anon;
grant execute on function public.current_person_has_capability(text, text, uuid) to authenticated;
