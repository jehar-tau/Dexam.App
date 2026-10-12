begin;

select plan(12);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    where function_schema.nspname = 'public'
      and function_definition.prosecdef
      and pg_catalog.has_function_privilege('anon', function_definition.oid, 'EXECUTE')
  ),
  0,
  'anonymous clients cannot execute any SECURITY DEFINER function'
);

select is(
  pg_catalog.has_function_privilege('anon', 'public.current_person_id()', 'EXECUTE'),
  false,
  'anonymous clients cannot resolve an application person'
);

select is(
  pg_catalog.has_function_privilege('anon', 'public.current_person_is_active()', 'EXECUTE'),
  false,
  'anonymous clients cannot inspect application-person state'
);

select is(
  pg_catalog.has_function_privilege('anon', 'public.sync_crm_privacy_lifecycle()', 'EXECUTE'),
  false,
  'anonymous clients cannot execute the CRM lifecycle trigger function'
);

select is(
  pg_catalog.has_function_privilege('authenticated', 'public.sync_crm_privacy_lifecycle()', 'EXECUTE'),
  false,
  'signed-in clients cannot execute the CRM lifecycle trigger function directly'
);

select is(
  pg_catalog.has_function_privilege('authenticated', 'public.current_person_id()', 'EXECUTE'),
  true,
  'signed-in clients retain the guarded current-person helper'
);

select is(
  pg_catalog.has_function_privilege('authenticated', 'public.current_person_is_active()', 'EXECUTE'),
  true,
  'signed-in clients retain the guarded current-state helper'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    where function_schema.nspname = 'public'
      and function_definition.prosecdef
      and function_definition.prorettype = 'trigger'::regtype
      and pg_catalog.has_function_privilege('authenticated', function_definition.oid, 'EXECUTE')
  ),
  0,
  'signed-in clients cannot directly execute SECURITY DEFINER trigger functions'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_proc function_definition
    join pg_catalog.pg_namespace function_schema
      on function_schema.oid = function_definition.pronamespace
    where function_schema.nspname = 'public'
      and function_definition.prosecdef
      and not ('search_path=""' = any(coalesce(function_definition.proconfig, '{}')))
  ),
  0,
  'every SECURITY DEFINER function pins an empty search path'
);

select is(
  pg_catalog.has_function_privilege('anon', 'public.platform_health()', 'EXECUTE'),
  true,
  'the constant platform health operation remains intentionally anonymous'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_default_acl default_acl
    cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) privilege
    where default_acl.defaclrole = 'postgres'::regrole
      and default_acl.defaclnamespace = 'public'::regnamespace
      and default_acl.defaclobjtype = 'f'
      and privilege.privilege_type = 'EXECUTE'
      and privilege.grantee in (0, 'anon'::regrole)
  ),
  0,
  'future postgres-owned public functions are not anonymous by default'
);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_default_acl default_acl
    cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) privilege
    where default_acl.defaclrole = 'postgres'::regrole
      and default_acl.defaclnamespace = 'public'::regnamespace
      and default_acl.defaclobjtype = 'f'
      and privilege.privilege_type = 'EXECUTE'
      and privilege.grantee in (0, 'authenticated'::regrole)
  ),
  0,
  'future postgres-owned public functions require an explicit authenticated grant'
);

select * from finish();

rollback;
