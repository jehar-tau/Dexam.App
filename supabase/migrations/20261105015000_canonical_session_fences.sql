-- Multiple login methods must share recovery and session invalidation fences.
-- No provider user/session mutation, role grant or recovery-rule relaxation.
create or replace function public.current_person_id()
returns uuid language sql stable security definer set search_path='' set row_security=off
as $$ select identity.person_id from public.auth_identities identity
 where identity.auth_user_id=(select auth.uid())
 and not exists(select 1 from public.employee_password_recoveries r where r.person_id=identity.person_id and r.status='executing')
 and not exists(select 1 from public.student_recovery_requests r where r.target_person_id=identity.person_id and r.status='executing')
 and exists(select 1 from auth.sessions s where s.user_id=identity.auth_user_id
  and s.id=(case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then (auth.jwt()->>'session_id')::uuid end)
  and (s.not_after is null or s.not_after>now())
  and not exists(select 1 from public.auth_identities linked
   join public.auth_session_cutoffs cutoff on cutoff.auth_user_id=linked.auth_user_id
   where linked.person_id=identity.person_id and (s.created_at is null or s.created_at<=cutoff.invalidated_before)))
 limit 1 $$;
