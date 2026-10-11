begin;

select plan(3);

select has_function('public', 'platform_health', array[]::text[], 'safe platform health operation exists');

set local role anon;

select is(public.platform_health(), 'ok', 'anonymous clients receive only the constant health signal');

reset role;
set local role authenticated;

select is(public.platform_health(), 'ok', 'authenticated clients receive the same non-sensitive signal');

reset role;

select * from finish();

rollback;
