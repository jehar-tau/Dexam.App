-- Functions are executable by PUBLIC by default in PostgreSQL, and Supabase also
-- grants its API roles explicit defaults. Keep every future RPC deny-by-default;
-- each browser- or worker-facing function must receive a deliberate grant in the
-- migration that creates it.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Remove inherited/default anonymous access from the existing function set.
-- platform_health is the sole intentionally anonymous database function and is
-- re-granted below because it returns only a constant readiness signal.
revoke execute on all functions in schema public from public, anon;

-- This function is a trigger implementation, not an RPC. Trigger execution does
-- not require the row-changing caller to hold EXECUTE on the trigger function.
revoke execute on function public.sync_crm_privacy_lifecycle() from authenticated;

grant execute on function public.platform_health() to anon, authenticated, service_role;

