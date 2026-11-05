-- Preserve the same recent TOTP/elevated-authority requirements across login methods.
CREATE OR REPLACE FUNCTION public.staff_security_actor_is_fresh(p_person_id uuid, p_session_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce(
    public.person_has_global_capability(p_person_id, 'security_controls.change')
    and exists (select 1 from public.role_assignments ra where ra.person_id = p_person_id
      and ra.role_key = 'elevated_admin' and ra.scope_type = 'global' and ra.scope_id is null
      and ra.revoked_at is null and ra.starts_at <= now() and (ra.ends_at is null or ra.ends_at > now()))
    and exists (
      select 1 from public.auth_identities identity
      join auth.sessions session on session.user_id = identity.auth_user_id
      join auth.mfa_factors factor on factor.id = session.factor_id and factor.user_id = session.user_id
      join auth.mfa_amr_claims amr on amr.session_id = session.id and amr.authentication_method = 'totp'
      where identity.person_id = p_person_id and identity.kind = 'employee_email'
        and session.id = p_session_id and session.aal = 'aal2'
        and (session.not_after is null or session.not_after > now())
        and factor.factor_type = 'totp' and factor.status = 'verified'
        and amr.updated_at >= now() - interval '15 minutes' and amr.updated_at <= now()
        and not exists (select 1 from public.auth_identities linked join public.auth_session_cutoffs cutoff on cutoff.auth_user_id = linked.auth_user_id where linked.person_id = p_person_id
          and (session.created_at is null or session.created_at <= cutoff.invalidated_before))
    ), false)
$function$
;
