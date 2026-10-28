-- F049 commerce (R2), built for test mode. Plans grant time-limited entitlements to papers and
-- mocks. Orders are created by the signed-in student, a Razorpay order is attached by the
-- trusted function, and only a verified Razorpay webhook (service role) marks an order paid and
-- grants access, once per order. Every plan starts OFF SALE: public paid sales wait for the
-- legal view (D-054) and owner-approved prices, refunds and expiry. Prices below are drafts.

create table public.commerce_plans (
  key text primary key check (key ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  title text not null check (char_length(title) between 1 and 120),
  description text not null default '' check (char_length(description) <= 600),
  level text check (level in ('bdes', 'mdes')),
  price_paise integer not null check (price_paise between 100 and 10000000),
  currency text not null default 'INR' check (currency = 'INR'),
  -- {"slots": ["uceed", ...], "mocks": ["uceed-2026", ...]}
  grants jsonb not null check (jsonb_typeof(grants) = 'object'),
  validity_days integer not null check (validity_days between 1 and 730),
  on_sale boolean not null default false,
  position smallint not null default 0
);

create table public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people (id) on delete restrict,
  plan_key text not null references public.commerce_plans (key) on delete restrict,
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status text not null default 'created' check (status in ('created', 'paid', 'failed', 'refunded')),
  provider text not null default 'razorpay' check (provider = 'razorpay'),
  provider_order_id text unique check (provider_order_id ~ '^order_[A-Za-z0-9]{6,40}$'),
  provider_payment_id text check (provider_payment_id ~ '^pay_[A-Za-z0-9]{6,40}$'),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  constraint commerce_orders_paid check ((status = 'paid') = (paid_at is not null))
);
create index commerce_orders_person on public.commerce_orders (person_id, created_at desc);

-- Every webhook event once (idempotency), kept for reconciliation.
create table public.commerce_events (
  event_id text primary key check (char_length(event_id) between 1 and 120),
  provider_order_id text,
  outcome text not null,
  received_at timestamptz not null default now()
);

alter table public.commerce_plans enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_events enable row level security;
revoke all on public.commerce_plans, public.commerce_orders, public.commerce_events from public, anon, authenticated;
grant all on public.commerce_plans, public.commerce_orders, public.commerce_events to service_role;

insert into public.commerce_plans (key, title, description, level, price_paise, grants, validity_days, position)
values
  ('bdes-all-exams', 'B.Des all-exam pass', 'Every UCEED, NID B.Des and NIFT B.Des paper, plus UCEED and NIFT B.Des mocks, for a year.', 'bdes', 149900,
   '{"slots":["uceed","nid-bdes","nift-bdes"],"mocks":["uceed-2026","nift-bdes-2026"]}', 365, 1),
  ('mdes-all-exams', 'M.Des all-exam pass', 'Every CEED, NID M.Des and NIFT M.Des paper, plus CEED and NIFT M.Des mocks, for a year.', 'mdes', 149900,
   '{"slots":["ceed","nid-mdes","nift-mdes"],"mocks":["ceed-2026","nift-mdes-2026"]}', 365, 2),
  ('uceed-bundle', 'UCEED bundle', 'Every UCEED paper and unlimited UCEED mocks, for a year.', 'bdes', 69900,
   '{"slots":["uceed"],"mocks":["uceed-2026"]}', 365, 3),
  ('ceed-bundle', 'CEED bundle', 'Every CEED paper and unlimited CEED mocks, for a year.', 'mdes', 69900,
   '{"slots":["ceed"],"mocks":["ceed-2026"]}', 365, 4);

create function public.list_commerce_plans()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'key', p.key, 'title', p.title, 'description', p.description, 'level', p.level,
      'pricePaise', p.price_paise, 'currency', p.currency, 'validityDays', p.validity_days,
      'onSale', p.on_sale
    ) order by p.position)
    from public.commerce_plans p
  ), '[]'::jsonb);
end;
$$;

-- The signed-in student starts an order for a plan that is on sale.
create function public.create_commerce_order(p_plan_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_plan public.commerce_plans;
  v_order public.commerce_orders;
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  select * into v_plan from public.commerce_plans where key = p_plan_key;
  if v_plan.key is null then
    raise exception 'Unknown plan.' using errcode = '22023';
  end if;
  if not v_plan.on_sale then
    raise exception 'This plan is not on sale yet.' using errcode = 'DX003';
  end if;
  insert into public.commerce_orders (person_id, plan_key, amount_paise, currency)
  values (public.current_person_id(), v_plan.key, v_plan.price_paise, v_plan.currency)
  returning * into v_order;
  return jsonb_build_object(
    'orderId', v_order.id, 'amountPaise', v_order.amount_paise, 'currency', v_order.currency,
    'planTitle', v_plan.title
  );
end;
$$;

-- Trusted function only: record the Razorpay order created for our order.
create function public.attach_commerce_provider_order(p_order_id uuid, p_provider_order_id text)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  update public.commerce_orders
    set provider_order_id = p_provider_order_id
    where id = p_order_id and status = 'created' and provider_order_id is null;
  if not found then
    raise exception 'Order cannot take a provider order.' using errcode = '55000';
  end if;
end;
$$;

-- Verified webhook only: mark the order paid once and grant the plan's entitlements.
-- Returns 'paid', 'duplicate', 'unknown-order' or 'mismatch'.
create function public.fulfil_commerce_order(
  p_event_id text,
  p_provider_order_id text,
  p_payment_id text,
  p_amount_paise integer,
  p_currency text
)
returns text
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  v_order public.commerce_orders;
  v_plan public.commerce_plans;
  v_until timestamptz;
  v_outcome text;
begin
  if exists (select 1 from public.commerce_events where event_id = p_event_id) then
    return 'duplicate';
  end if;
  select * into v_order from public.commerce_orders where provider_order_id = p_provider_order_id for update;
  if v_order.id is null then
    v_outcome := 'unknown-order';
  elsif v_order.status = 'paid' then
    v_outcome := 'duplicate';
  elsif v_order.amount_paise <> p_amount_paise or v_order.currency <> p_currency then
    v_outcome := 'mismatch';
  else
    select * into v_plan from public.commerce_plans where key = v_order.plan_key;
    v_until := now() + make_interval(days => v_plan.validity_days);
    update public.commerce_orders
      set status = 'paid', paid_at = now(), provider_payment_id = p_payment_id
      where id = v_order.id;

    insert into public.assessment_entitlements (person_id, source, paper_id, expires_at)
    select distinct v_order.person_id, 'purchase', p.paper_id, v_until
    from public.assessment_question_provenance p
    where public.assessment_free_slot(p.paper_id) in (
      select jsonb_array_elements_text(v_plan.grants -> 'slots')
    )
    on conflict (person_id, paper_id) do update
      set expires_at = case
        when public.assessment_entitlements.source = 'purchase'
          then greatest(public.assessment_entitlements.expires_at, excluded.expires_at)
        else public.assessment_entitlements.expires_at
      end;

    insert into public.assessment_entitlements (person_id, source, paper_id, expires_at)
    select v_order.person_id, 'purchase', 'mock-' || mock_key, v_until
    from jsonb_array_elements_text(coalesce(v_plan.grants -> 'mocks', '[]'::jsonb)) as mock_key
    on conflict (person_id, paper_id) do update
      set expires_at = greatest(public.assessment_entitlements.expires_at, excluded.expires_at);
    v_outcome := 'paid';
  end if;
  insert into public.commerce_events (event_id, provider_order_id, outcome)
  values (p_event_id, p_provider_order_id, v_outcome);
  return v_outcome;
end;
$$;

create function public.list_my_orders()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'orderId', o.id, 'planKey', o.plan_key, 'planTitle', p.title, 'amountPaise', o.amount_paise,
      'status', o.status, 'createdAt', o.created_at, 'paidAt', o.paid_at
    ) order by o.created_at desc)
    from public.commerce_orders o
    join public.commerce_plans p on p.key = o.plan_key
    where o.person_id = public.current_person_id()
  ), '[]'::jsonb);
end;
$$;

revoke all on function
  public.list_commerce_plans(),
  public.create_commerce_order(text),
  public.attach_commerce_provider_order(uuid, text),
  public.fulfil_commerce_order(text, text, text, integer, text),
  public.list_my_orders()
from public, anon;
revoke all on function
  public.attach_commerce_provider_order(uuid, text),
  public.fulfil_commerce_order(text, text, text, integer, text)
from authenticated;
grant execute on function
  public.list_commerce_plans(),
  public.create_commerce_order(text),
  public.list_my_orders()
to authenticated;
grant execute on function
  public.attach_commerce_provider_order(uuid, text),
  public.fulfil_commerce_order(text, text, text, integer, text)
to service_role;
