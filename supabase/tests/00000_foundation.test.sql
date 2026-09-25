begin;

select plan(1);

select is(
  (
    select count(*)::integer
    from pg_catalog.pg_tables
    where schemaname = 'public'
      and not rowsecurity
  ),
  0,
  'every table exposed through the public schema has Row Level Security enabled'
);

select * from finish();

rollback;
