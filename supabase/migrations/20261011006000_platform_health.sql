create or replace function public.platform_health()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select 'ok'::text
$$;

revoke all on function public.platform_health() from public;
grant execute on function public.platform_health() to anon, authenticated, service_role;

comment on function public.platform_health() is
  'Returns a constant non-sensitive readiness signal for hosted environment checks.';
