-- D-068/F057: Google sign-in for everyone, admin-managed courses and fees, a payment ledger,
-- and Dexam App access that opens only once a student's admission fee is recorded.

-- 1. Staff security. A live Google-authenticated session now satisfies every capability that
-- previously required live TOTP. Google accounts carry their own 2-Step Verification; Dexam
-- cannot enforce it for personal accounts, so staff are asked to turn it on (STAFF_SECURITY.md).
-- Password sessions keep the original TOTP rule, so a leaked Dexam password alone still cannot
-- reach a sensitive action.
create function public.current_session_is_google()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(exists(
    select 1 from auth.sessions session
    join auth.mfa_amr_claims amr on amr.session_id=session.id and amr.authentication_method='oauth'
    join auth.identities google on google.user_id=session.user_id and google.provider='google'
    where session.id=(case when (auth.jwt()->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (auth.jwt()->>'session_id')::uuid end)
      and session.user_id=(select auth.uid())
      and (session.not_after is null or session.not_after>now())
      and not exists(select 1 from public.auth_session_cutoffs cutoff
        where cutoff.auth_user_id=session.user_id and session.created_at<=cutoff.invalidated_before)
  ),false)
$$;
revoke all on function public.current_session_is_google() from public, anon;
grant execute on function public.current_session_is_google() to authenticated;

create or replace function public.current_session_has_live_mfa()
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(
    (
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
      )
    )
    -- D-068: Google sign-in replaces Dexam's own two-step verification.
    or public.current_session_is_google(),
    false
  )
$$;

-- 2. Courses: admins add courses and set length and fees.
alter table public.offerings
  add column duration_days integer check (duration_days between 1 and 1500),
  add column total_fee_paise bigint check (total_fee_paise between 0 and 100000000000),
  add column admission_fee_paise bigint check (admission_fee_paise between 0 and 100000000000),
  add column revision bigint not null default 1 check (revision > 0),
  add constraint offerings_admission_fee_within_total check (
    admission_fee_paise is null or total_fee_paise is null or admission_fee_paise <= total_fee_paise);

create table public.offering_change_history (
  id bigint generated always as identity primary key,
  offering_id uuid not null references public.offerings(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  action text not null check (action in ('created','updated')),
  prior_values jsonb,
  new_values jsonb not null,
  reason text not null check (length(btrim(reason)) between 3 and 500),
  created_at timestamptz not null default clock_timestamp()
);
alter table public.offering_change_history enable row level security;
revoke all on table public.offering_change_history from public, anon, authenticated;

insert into public.capabilities(key,description,requires_mfa) values
  ('course.manage','Add courses and set their length, status and fees.',true),
  ('payment.record','Record a student payment and see each student''s paid total.',false),
  ('payment.ledger.read','See the complete payment ledger with transaction details and receipts.',true),
  ('payment.correct','Correct a recorded payment and set a student''s agreed fee.',true);
insert into public.role_capabilities(role_key,capability_key) values
  ('elevated_admin','course.manage'),
  ('sales','payment.record'),('ordinary_admin','payment.record'),('elevated_admin','payment.record'),
  ('elevated_admin','payment.ledger.read'),
  ('elevated_admin','payment.correct');

create function public.current_person_can_manage_courses() returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_active_employee_membership() and public.current_person_has_capability('course.manage'),false) $$;
create function public.current_person_can_record_payments() returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_active_employee_membership() and public.current_person_has_capability('payment.record'),false) $$;
create function public.current_person_can_read_payment_ledger() returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_active_employee_membership() and public.current_person_has_capability('payment.ledger.read'),false) $$;
create function public.current_person_can_correct_payments() returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(public.current_person_has_active_employee_membership() and public.current_person_has_capability('payment.correct'),false) $$;

create function public.list_courses()
returns table(id uuid, code text, title text, status public.offering_status, duration_days integer,
  total_fee_paise bigint, admission_fee_paise bigint, revision bigint, open_enrolments bigint)
language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if not public.current_person_can_manage_courses() then
    raise exception using errcode='42501',message='course access denied'; end if;
  return query select o.id,o.code,o.title,o.status,o.duration_days,o.total_fee_paise,o.admission_fee_paise,o.revision,
      (select count(*) from public.enrollments e where e.offering_id=o.id and e.status in ('requested','approved','active'))
    from public.offerings o order by o.status='archived',o.title;
end $$;

create function public.save_course(p_request_key uuid, p_offering_id uuid, p_expected_revision bigint, p_code text,
  p_title text, p_status public.offering_status, p_duration_days integer, p_total_fee_paise bigint,
  p_admission_fee_paise bigint, p_reason text)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.offering_change_history; target public.offerings;
  request jsonb:=jsonb_build_object('offering',p_offering_id,'expectedRevision',p_expected_revision,'code',p_code,'title',p_title,
    'status',p_status,'durationDays',p_duration_days,'totalFee',p_total_fee_paise,'admissionFee',p_admission_fee_paise,'reason',p_reason);
begin
  if not public.current_person_can_manage_courses() then raise exception using errcode='42501',message='course access denied'; end if;
  if p_request_key is null or p_title is null or length(btrim(p_title)) not between 2 and 160 or p_status is null
    or p_reason is null or length(btrim(p_reason)) not between 3 and 500
    or (p_duration_days is not null and p_duration_days not between 1 and 1500)
    or (p_total_fee_paise is not null and p_total_fee_paise not between 0 and 100000000000)
    or (p_admission_fee_paise is not null and p_admission_fee_paise not between 0 and 100000000000)
    or (p_admission_fee_paise is not null and p_total_fee_paise is not null and p_admission_fee_paise>p_total_fee_paise) then
    raise exception using errcode='22023',message='course name, status, valid length and fees, and a reason are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-course-save:'||p_request_key::text,0));
  select * into previous from public.offering_change_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.new_values->'request' is distinct from request then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return previous.offering_id;
  end if;
  if p_offering_id is null then
    if p_expected_revision is not null or p_status='archived' or p_code is null or upper(btrim(p_code)) !~ '^[A-Z][A-Z0-9_-]{2,31}$' then
      raise exception using errcode='22023',message='new courses need a code of 3 to 32 letters, digits, _ or -'; end if;
    begin
      insert into public.offerings(code,title,status,duration_days,total_fee_paise,admission_fee_paise)
        values(upper(btrim(p_code)),btrim(p_title),p_status,p_duration_days,p_total_fee_paise,p_admission_fee_paise)
        returning * into target;
    exception when unique_violation then
      raise exception using errcode='23505',message='a course with that code already exists';
    end;
    insert into public.offering_change_history(offering_id,request_key,actor_person_id,action,new_values,reason)
      values(target.id,p_request_key,actor,'created',jsonb_build_object('request',request,'revision',target.revision),btrim(p_reason));
  else
    select * into target from public.offerings where id=p_offering_id for update;
    if not found then raise exception using errcode='42501',message='course unavailable'; end if;
    if target.revision is distinct from p_expected_revision then
      raise exception using errcode='40001',message='course changed; refresh and review'; end if;
    -- The code is a stable identifier used by batches and handoffs.
    if p_code is not null and upper(btrim(p_code))<>target.code then
      raise exception using errcode='22023',message='a course code cannot change'; end if;
    -- Students keep their course: an active course with open enrolments stays active.
    if target.status='active' and p_status<>'active' and exists(select 1 from public.enrollments e
        where e.offering_id=target.id and e.status in ('requested','approved','active')) then
      raise exception using errcode='55000',message='close or move every open enrolment before taking this course out of active'; end if;
    update public.offerings set title=btrim(p_title),status=p_status,duration_days=p_duration_days,total_fee_paise=p_total_fee_paise,
      admission_fee_paise=p_admission_fee_paise,revision=revision+1,updated_at=clock_timestamp() where id=target.id;
    insert into public.offering_change_history(offering_id,request_key,actor_person_id,action,prior_values,new_values,reason)
      values(target.id,p_request_key,actor,'updated',
        jsonb_build_object('title',target.title,'status',target.status,'durationDays',target.duration_days,
          'totalFee',target.total_fee_paise,'admissionFee',target.admission_fee_paise,'revision',target.revision),
        jsonb_build_object('request',request,'revision',target.revision+1),btrim(p_reason));
  end if;
  if not public.current_person_can_manage_courses() then raise exception using errcode='42501',message='course authority changed'; end if;
  return target.id;
end $$;

-- 3. Payment ledger. Append-only: a mistake is fixed by an admin correction entry, never an edit.
create table public.enrollment_fee_agreements (
  enrollment_id uuid primary key references public.enrollments(id) on delete restrict,
  agreed_fee_paise bigint not null check (agreed_fee_paise between 0 and 100000000000),
  reason text not null check (length(btrim(reason)) between 3 and 500),
  set_by_person_id uuid not null references public.people(id) on delete restrict,
  set_at timestamptz not null default clock_timestamp(),
  revision bigint not null default 1 check (revision > 0)
);
create table public.enrollment_fee_history (
  id bigint generated always as identity primary key,
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  request_key uuid not null unique,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  prior_fee_paise bigint,
  new_fee_paise bigint,
  reason text not null,
  created_at timestamptz not null default clock_timestamp()
);

create sequence public.student_payment_receipt_seq;
create table public.student_payments (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  receipt_number text not null unique default ('DXR-'||lpad(nextval('public.student_payment_receipt_seq')::text,6,'0')),
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  person_id uuid not null references public.people(id) on delete restrict,
  kind text not null check (kind in ('admission_fee','course_fee','other','correction')),
  method text check (method in ('cash','upi','card_machine','bank_transfer','cheque')),
  amount_paise bigint not null check (amount_paise<>0 and abs(amount_paise)<=100000000000),
  currency text not null default 'INR' check (currency='INR'),
  paid_on date not null check (paid_on>=date '2020-01-01'),
  transaction_id text check (transaction_id is null or length(btrim(transaction_id)) between 1 and 120),
  collected_by_person_id uuid references public.people(id) on delete restrict,
  recorded_by_person_id uuid not null references public.people(id) on delete restrict,
  recorded_at timestamptz not null default clock_timestamp(),
  note text check (note is null or length(btrim(note)) between 1 and 500),
  corrects_payment_id uuid references public.student_payments(id) on delete restrict,
  receipt_object text unique,
  receipt_attached_at timestamptz,
  constraint student_payments_shape check (
    case when kind='correction'
      then corrects_payment_id is not null and method is null and collected_by_person_id is null and note is not null
      else corrects_payment_id is null and amount_paise>0 and method is not null and collected_by_person_id is not null
        and (method='cash' or transaction_id is not null)
    end),
  constraint student_payments_receipt_pair check ((receipt_object is null)=(receipt_attached_at is null))
);
create index student_payments_enrollment_idx on public.student_payments(enrollment_id);
create index student_payments_person_idx on public.student_payments(person_id);

create function public.enforce_student_payment_append_only() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception using errcode='42501',message='payments cannot be deleted; record a correction'; end if;
  -- The only permitted change: attaching the receipt file once.
  if old.receipt_object is null and new.receipt_object is not null
    and (to_jsonb(new)-'receipt_object'-'receipt_attached_at')=(to_jsonb(old)-'receipt_object'-'receipt_attached_at') then
    return new; end if;
  raise exception using errcode='42501',message='payments cannot be edited; record a correction';
end $$;
create trigger student_payments_append_only before update or delete on public.student_payments
  for each row execute function public.enforce_student_payment_append_only();
revoke all on function public.enforce_student_payment_append_only() from public, anon, authenticated;

alter table public.enrollment_fee_agreements enable row level security;
alter table public.enrollment_fee_history enable row level security;
alter table public.student_payments enable row level security;
revoke all on table public.enrollment_fee_agreements, public.enrollment_fee_history, public.student_payments from public, anon, authenticated;
revoke all on sequence public.student_payment_receipt_seq from public, anon, authenticated;

-- Ledger entries plus the gated Admissions receipts (F054), so totals never miss a payment.
create function public.enrollment_paid_paise(p_enrollment_id uuid) returns bigint
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce((select sum(amount_paise) from public.student_payments where enrollment_id=p_enrollment_id),0)
    + coalesce((select sum(amount_paise) from public.admission_receipts where enrollment_id=p_enrollment_id),0)
$$;
create function public.enrollment_fee_paise(p_enrollment_id uuid) returns bigint
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce((select a.agreed_fee_paise from public.enrollment_fee_agreements a where a.enrollment_id=p_enrollment_id),
    (select o.total_fee_paise from public.enrollments e join public.offerings o on o.id=e.offering_id where e.id=p_enrollment_id))
$$;
-- D-068: the admission fee unlocks the Dexam App. A course without a set admission fee needs any payment.
create function public.person_has_paid_admission_fee(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(exists(
    select 1 from public.enrollments e join public.offerings o on o.id=e.offering_id
    where e.person_id=p_person_id and e.status in ('approved','active') and e.ended_at is null
      and public.enrollment_paid_paise(e.id)>=greatest(coalesce(o.admission_fee_paise,0),1)
  ),false)
$$;
revoke all on function public.enrollment_paid_paise(uuid), public.enrollment_fee_paise(uuid),
  public.person_has_paid_admission_fee(uuid) from public, anon, authenticated;

create function public.payment_collector_is_eligible(p_person_id uuid) returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(exists(
    select 1 from public.people p
    join public.memberships m on m.person_id=p.id and m.kind='employee' and m.status='active'
    join public.role_assignments ra on ra.person_id=p.id and ra.role_key in ('sales','ordinary_admin','elevated_admin')
      and ra.revoked_at is null and ra.starts_at<=now() and (ra.ends_at is null or ra.ends_at>now())
    where p.id=p_person_id and p.status='active'
  ),false)
$$;
revoke all on function public.payment_collector_is_eligible(uuid) from public, anon, authenticated;

create function public.list_payment_collectors()
returns table(person_id uuid, display_name text)
language plpgsql stable security definer set search_path='' set row_security=off as $$
begin
  if not (public.current_person_can_record_payments() or public.current_person_can_read_payment_ledger()) then
    raise exception using errcode='42501',message='payment access denied'; end if;
  return query select p.id,p.display_name from public.people p
    where public.payment_collector_is_eligible(p.id) order by p.display_name;
end $$;

create function public.list_payment_students(p_search text default '')
returns table(enrollment_id uuid, person_id uuid, member_id text, display_name text, course_title text,
  enrollment_status public.enrollment_status, fee_paise bigint, agreed_fee boolean, admission_fee_paise bigint,
  paid_paise bigint, admission_paid boolean, fee_revision bigint)
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare needle text:=lower(btrim(coalesce(p_search,'')));
begin
  if not (public.current_person_can_record_payments() or public.current_person_can_read_payment_ledger()) then
    raise exception using errcode='42501',message='payment access denied'; end if;
  if length(needle)>120 then raise exception using errcode='22023',message='search is too long'; end if;
  return query select e.id,p.id,p.member_id,p.display_name,o.title,e.status,public.enrollment_fee_paise(e.id),
      exists(select 1 from public.enrollment_fee_agreements a where a.enrollment_id=e.id),o.admission_fee_paise,
      public.enrollment_paid_paise(e.id),
      public.enrollment_paid_paise(e.id)>=greatest(coalesce(o.admission_fee_paise,0),1),
      (select a.revision from public.enrollment_fee_agreements a where a.enrollment_id=e.id)
    from public.enrollments e join public.people p on p.id=e.person_id join public.offerings o on o.id=e.offering_id
    where e.status in ('requested','approved','active','completed') and p.status='active'
      and (needle='' or position(needle in lower(p.display_name))>0 or position(needle in lower(coalesce(p.member_id,'')))>0
        or position(needle in lower(o.title))>0)
    order by p.display_name,o.title limit 100;
end $$;

-- Admins see every detail. Sales see amounts and dates for everyone, and full details only for
-- payments they recorded themselves.
create function public.list_student_payments(p_enrollment_id uuid)
returns table(payment_id uuid, receipt_number text, kind text, method text, amount_paise bigint, paid_on date,
  transaction_id text, collected_by text, recorded_by text, recorded_at timestamptz, note text,
  corrects_receipt_number text, has_receipt boolean, receipt_object text, restricted boolean, source text)
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); ledger boolean:=public.current_person_can_read_payment_ledger();
begin
  if not (public.current_person_can_record_payments() or ledger) then
    raise exception using errcode='42501',message='payment access denied'; end if;
  return query
    select s.id,s.receipt_number,s.kind,s.method,s.amount_paise,s.paid_on,
      case when ledger or s.recorded_by_person_id=actor then s.transaction_id end,
      case when ledger or s.recorded_by_person_id=actor then collector.display_name end,
      case when ledger or s.recorded_by_person_id=actor then recorder.display_name end,
      s.recorded_at,
      case when ledger or s.recorded_by_person_id=actor then s.note end,
      corrected.receipt_number, s.receipt_object is not null,
      case when ledger or s.recorded_by_person_id=actor then s.receipt_object end,
      not (ledger or s.recorded_by_person_id=actor), 'ledger'::text
    from public.student_payments s
    join public.people recorder on recorder.id=s.recorded_by_person_id
    left join public.people collector on collector.id=s.collected_by_person_id
    left join public.student_payments corrected on corrected.id=s.corrects_payment_id
    where s.enrollment_id=p_enrollment_id
    union all
    select r.id,'ADM-'||upper(left(r.id::text,8)),'admission_fee'::text,
      case r.method when 'online_transfer' then 'bank_transfer' else r.method end,r.amount_paise,
      (r.paid_at at time zone 'Asia/Kolkata')::date,
      case when ledger or r.confirmed_by=actor then r.reference end,
      case when ledger or r.confirmed_by=actor then confirmer.display_name end,
      case when ledger or r.confirmed_by=actor then confirmer.display_name end,
      r.confirmed_at,null::text,null::text,false,null::text,not (ledger or r.confirmed_by=actor),'admission'::text
    from public.admission_receipts r join public.people confirmer on confirmer.id=r.confirmed_by
    where r.enrollment_id=p_enrollment_id
    order by 6 desc,10 desc;
end $$;

create function public.list_payment_ledger(p_search text default '', p_from date default null, p_to date default null)
returns table(payment_id uuid, receipt_number text, enrollment_id uuid, member_id text, display_name text, course_title text,
  kind text, method text, amount_paise bigint, paid_on date, transaction_id text, collected_by text, recorded_by text,
  recorded_at timestamptz, note text, has_receipt boolean, receipt_object text)
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare needle text:=lower(btrim(coalesce(p_search,'')));
begin
  if not public.current_person_can_read_payment_ledger() then
    raise exception using errcode='42501',message='payment ledger access denied'; end if;
  if length(needle)>120 then raise exception using errcode='22023',message='search is too long'; end if;
  return query select s.id,s.receipt_number,s.enrollment_id,p.member_id,p.display_name,o.title,s.kind,s.method,s.amount_paise,
      s.paid_on,s.transaction_id,collector.display_name,recorder.display_name,s.recorded_at,s.note,s.receipt_object is not null,s.receipt_object
    from public.student_payments s
    join public.enrollments e on e.id=s.enrollment_id join public.offerings o on o.id=e.offering_id
    join public.people p on p.id=s.person_id join public.people recorder on recorder.id=s.recorded_by_person_id
    left join public.people collector on collector.id=s.collected_by_person_id
    where (p_from is null or s.paid_on>=p_from) and (p_to is null or s.paid_on<=p_to)
      and (needle='' or position(needle in lower(p.display_name))>0 or position(needle in lower(coalesce(p.member_id,'')))>0
        or position(needle in lower(s.receipt_number))>0 or position(needle in lower(coalesce(s.transaction_id,'')))>0)
    order by s.paid_on desc,s.recorded_at desc limit 500;
end $$;

create function public.record_student_payment(p_request_key uuid, p_enrollment_id uuid, p_kind text, p_method text,
  p_amount_paise bigint, p_paid_on date, p_transaction_id text, p_collected_by uuid, p_note text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.student_payments; target public.enrollments; saved public.student_payments;
  reference text:=nullif(btrim(coalesce(p_transaction_id,'')),''); remark text:=nullif(btrim(coalesce(p_note,'')),'');
begin
  if not (public.current_person_can_record_payments() or public.current_person_can_read_payment_ledger()) then
    raise exception using errcode='42501',message='payment access denied'; end if;
  if p_request_key is null or p_enrollment_id is null or p_kind not in ('admission_fee','course_fee','other')
    or p_method not in ('cash','upi','card_machine','bank_transfer','cheque')
    or p_amount_paise is null or p_amount_paise not between 1 and 100000000000 or p_paid_on is null
    or p_paid_on<date '2020-01-01' or p_paid_on>(clock_timestamp() at time zone 'Asia/Kolkata')::date
    or (p_method<>'cash' and reference is null) or length(coalesce(reference,''))>120 or length(coalesce(remark,''))>500
    or p_collected_by is null then
    raise exception using errcode='22023',message='amount, date (not in the future), method, who collected it and a transaction ID (except cash) are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-payment:'||p_request_key::text,0));
  select * into previous from public.student_payments where request_key=p_request_key;
  if found then
    if previous.recorded_by_person_id<>actor or previous.enrollment_id<>p_enrollment_id or previous.kind<>p_kind
      or previous.method<>p_method or previous.amount_paise<>p_amount_paise or previous.paid_on<>p_paid_on
      or previous.transaction_id is distinct from reference or previous.collected_by_person_id<>p_collected_by
      or previous.note is distinct from remark then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return jsonb_build_object('paymentId',previous.id,'receiptNumber',previous.receipt_number,'replayed',true);
  end if;
  select * into target from public.enrollments where id=p_enrollment_id for share;
  if not found or target.status not in ('requested','approved','active','completed') then
    raise exception using errcode='22023',message='payments are recorded against a current or completed enrolment'; end if;
  if not public.payment_collector_is_eligible(p_collected_by) then
    raise exception using errcode='22023',message='choose a current Sales or Admin team member as collector'; end if;
  insert into public.student_payments(request_key,enrollment_id,person_id,kind,method,amount_paise,paid_on,transaction_id,
      collected_by_person_id,recorded_by_person_id,note)
    values(p_request_key,target.id,target.person_id,p_kind,p_method,p_amount_paise,p_paid_on,reference,p_collected_by,actor,remark)
    returning * into saved;
  if not (public.current_person_can_record_payments() or public.current_person_can_read_payment_ledger()) then
    raise exception using errcode='42501',message='payment authority changed'; end if;
  return jsonb_build_object('paymentId',saved.id,'receiptNumber',saved.receipt_number,'replayed',false);
end $$;

create function public.correct_student_payment(p_request_key uuid, p_payment_id uuid, p_amount_paise bigint, p_note text)
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.student_payments; original public.student_payments; saved public.student_payments;
  remark text:=nullif(btrim(coalesce(p_note,'')),'');
begin
  if not public.current_person_can_correct_payments() then
    raise exception using errcode='42501',message='payment correction denied'; end if;
  if p_request_key is null or p_payment_id is null or p_amount_paise is null or p_amount_paise=0
    or abs(p_amount_paise)>100000000000 or remark is null or length(remark) not between 3 and 500 then
    raise exception using errcode='22023',message='a non-zero correction amount and a reason are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-payment:'||p_request_key::text,0));
  select * into previous from public.student_payments where request_key=p_request_key;
  if found then
    if previous.recorded_by_person_id<>actor or previous.corrects_payment_id is distinct from p_payment_id
      or previous.amount_paise<>p_amount_paise or previous.note is distinct from remark then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return jsonb_build_object('paymentId',previous.id,'receiptNumber',previous.receipt_number,'replayed',true);
  end if;
  select * into original from public.student_payments where id=p_payment_id and kind<>'correction' for update;
  if not found then raise exception using errcode='22023',message='choose an original payment to correct'; end if;
  -- A payment can be reduced to zero, never below.
  if original.amount_paise+coalesce((select sum(c.amount_paise) from public.student_payments c where c.corrects_payment_id=original.id),0)
      +p_amount_paise<0 then
    raise exception using errcode='22023',message='a correction cannot take a payment below zero'; end if;
  insert into public.student_payments(request_key,enrollment_id,person_id,kind,amount_paise,paid_on,recorded_by_person_id,note,corrects_payment_id)
    values(p_request_key,original.enrollment_id,original.person_id,'correction',p_amount_paise,
      (clock_timestamp() at time zone 'Asia/Kolkata')::date,actor,remark,original.id)
    returning * into saved;
  if not public.current_person_can_correct_payments() then
    raise exception using errcode='42501',message='payment authority changed'; end if;
  return jsonb_build_object('paymentId',saved.id,'receiptNumber',saved.receipt_number,'replayed',false);
end $$;

create function public.set_enrollment_fee(p_request_key uuid, p_enrollment_id uuid, p_expected_revision bigint,
  p_agreed_fee_paise bigint, p_reason text)
returns bigint language plpgsql security definer set search_path='' set row_security=off as $$
declare actor uuid:=public.current_person_id(); previous public.enrollment_fee_history; existing public.enrollment_fee_agreements;
  next_revision bigint;
begin
  if not public.current_person_can_correct_payments() then
    raise exception using errcode='42501',message='fee change denied'; end if;
  if p_request_key is null or p_enrollment_id is null or p_agreed_fee_paise is null
    or p_agreed_fee_paise not between 0 and 100000000000 or p_reason is null or length(btrim(p_reason)) not between 3 and 500 then
    raise exception using errcode='22023',message='an agreed fee and a reason are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('dexam-fee:'||p_request_key::text,0));
  select * into previous from public.enrollment_fee_history where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.enrollment_id<>p_enrollment_id or previous.new_fee_paise<>p_agreed_fee_paise
      or previous.reason<>btrim(p_reason) then
      raise exception using errcode='40001',message='request already used; refresh and review'; end if;
    return (select revision from public.enrollment_fee_agreements where enrollment_id=p_enrollment_id);
  end if;
  if not exists(select 1 from public.enrollments where id=p_enrollment_id) then
    raise exception using errcode='22023',message='enrolment unavailable'; end if;
  -- Serialise first-time agreements too, so a stale editor can never overwrite a concurrent one.
  perform pg_advisory_xact_lock(hashtextextended('dexam-fee-enrollment:'||p_enrollment_id::text,0));
  select * into existing from public.enrollment_fee_agreements where enrollment_id=p_enrollment_id for update;
  if existing.revision is distinct from p_expected_revision then
    raise exception using errcode='40001',message='fee changed; refresh and review'; end if;
  insert into public.enrollment_fee_agreements(enrollment_id,agreed_fee_paise,reason,set_by_person_id)
    values(p_enrollment_id,p_agreed_fee_paise,btrim(p_reason),actor)
    on conflict(enrollment_id) do update set agreed_fee_paise=excluded.agreed_fee_paise,reason=excluded.reason,
      set_by_person_id=excluded.set_by_person_id,set_at=clock_timestamp(),revision=enrollment_fee_agreements.revision+1
    returning revision into next_revision;
  insert into public.enrollment_fee_history(enrollment_id,request_key,actor_person_id,prior_fee_paise,new_fee_paise,reason)
    values(p_enrollment_id,p_request_key,actor,existing.agreed_fee_paise,p_agreed_fee_paise,btrim(p_reason));
  return next_revision;
end $$;

-- Receipt files: private bucket, uploaded by the recorder (or an admin) within a day, attached once.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('payment-receipts','payment-receipts',false,5242880,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create function public.current_person_can_upload_payment_receipt(p_object_name text) returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(
    p_object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/receipt-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png|webp)$'
    and exists(select 1 from public.student_payments s
      where s.id=split_part(p_object_name,'/',1)::uuid and s.kind<>'correction' and s.receipt_object is null
        and s.recorded_at>now()-interval '1 day'
        and (s.recorded_by_person_id=public.current_person_id() and public.current_person_can_record_payments()
          or public.current_person_can_read_payment_ledger()))
    and (select count(*) from storage.objects o where o.bucket_id='payment-receipts'
      and o.name like split_part(p_object_name,'/',1)||'/%')<3,
    false)
$$;
create function public.current_person_can_read_payment_receipt(p_object_name text) returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(exists(select 1 from public.student_payments s where s.receipt_object=p_object_name
    and (public.current_person_can_read_payment_ledger()
      or (s.recorded_by_person_id=public.current_person_id() and public.current_person_can_record_payments()))),false)
$$;
create policy payment_receipts_insert on storage.objects for insert to authenticated
  with check (bucket_id='payment-receipts' and (select public.current_person_can_upload_payment_receipt(name)));
create policy payment_receipts_read on storage.objects for select to authenticated
  using (bucket_id='payment-receipts' and (select public.current_person_can_read_payment_receipt(name)));

create function public.attach_payment_receipt(p_payment_id uuid, p_object_name text)
returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if p_payment_id is null or p_object_name is null or split_part(p_object_name,'/',1)<>p_payment_id::text
    or not public.current_person_can_upload_payment_receipt(p_object_name) then
    raise exception using errcode='42501',message='receipt upload denied'; end if;
  if not exists(select 1 from storage.objects where bucket_id='payment-receipts' and name=p_object_name) then
    raise exception using errcode='22023',message='upload the receipt file first'; end if;
  update public.student_payments set receipt_object=p_object_name,receipt_attached_at=clock_timestamp()
    where id=p_payment_id and receipt_object is null;
  return found;
end $$;

-- 4. Dexam App access: a listed student signs in with Google only after the admission fee.
create or replace function public.claim_app_google_login()
returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare person uuid; provider_email text;
begin
  -- Refuse before linking: an unpaid student's Google account is never bound to the student.
  -- The Mock Test keeps its own access rules (provision_google_candidate is unchanged).
  select lower(btrim(i.identity_data->>'email')) into provider_email
  from auth.identities i join auth.users u on u.id=i.user_id
  where i.user_id=auth.uid() and i.provider='google'
    and i.identity_data->>'email_verified'='true' and u.email_confirmed_at is not null
    and lower(btrim(u.email))=lower(btrim(i.identity_data->>'email'));
  if provider_email is not null and exists(select 1 from public.approved_login_emails a
      where a.email=provider_email and a.state='approved' and a.purpose='student'
        -- Staff persons fall through to the claim, which refuses them outright.
        and not exists(select 1 from public.memberships e where e.person_id=a.person_id and e.kind='employee')
        and not exists(select 1 from public.auth_identities i where i.person_id=a.person_id and i.kind='employee_email')
        and not public.person_has_paid_admission_fee(a.person_id)) then
    return jsonb_build_object('allowed',false,'reason','admission_fee_pending'); end if;
  perform public.claim_approved_google_identity();
  person:=public.current_person_id();
  if person is not null and exists(select 1 from public.approved_login_emails a where a.person_id=person and a.state='approved'
      and a.purpose in ('student','both'))
    and exists(select 1 from public.memberships m where m.person_id=person and m.kind='student' and m.status='active') then
    if not public.person_has_paid_admission_fee(person) then
      return jsonb_build_object('allowed',false,'reason','admission_fee_pending'); end if;
    return jsonb_build_object('allowed',true,'audience','student');
  end if;
  if person is not null and exists(select 1 from public.memberships m where m.person_id=person and m.kind='employee' and m.status='active') then
    return jsonb_build_object('allowed',true,'audience','employee');
  end if;
  return jsonb_build_object('allowed',false);
end $$;

drop function public.list_student_google_logins(text);
create function public.list_student_google_logins(p_search text default '')
returns table(person_id uuid, member_id text, display_name text, email text, state text, linked boolean, revision bigint,
  revoked_at timestamptz, admission_paid boolean)
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare needle text:=lower(btrim(coalesce(p_search,'')));
begin
  if not (public.current_person_can_approve_student_logins() or public.current_person_can_revoke_student_logins()) then
    raise exception using errcode='42501',message='student login list access denied'; end if;
  if length(needle)>120 then raise exception using errcode='22023',message='search is too long'; end if;
  return query select p.id,p.member_id,p.display_name,a.email,coalesce(a.state,'none'),
      exists(select 1 from public.auth_identities i where i.person_id=p.id and i.kind='oauth_google'),
      a.revision,a.revoked_at,public.person_has_paid_admission_fee(p.id)
    from public.people p
    join public.memberships m on m.person_id=p.id and m.kind='student' and m.status='active'
    left join public.approved_login_emails a on a.person_id=p.id
    -- Student-only entries; 'employee'/'both' logins are staff-managed and never revoked here.
    where p.status='active' and (a.purpose is null or a.purpose='student')
      and not exists(select 1 from public.memberships e where e.person_id=p.id and e.kind='employee')
      and not exists(select 1 from public.auth_identities i where i.person_id=p.id and i.kind='employee_email')
      and (needle='' or position(needle in lower(p.display_name))>0 or position(needle in lower(coalesce(p.member_id,'')))>0
        or position(needle in coalesce(a.email,''))>0)
    order by p.display_name,p.member_id limit 100;
end $$;

-- 5. Batches pre-fill their end date from the course length when the admin has set one.
create or replace function public.get_batch_workspace()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare can_manage boolean:=public.current_person_can_manage_batches(); visible uuid[];
begin
  select coalesce(array_agg(o.id),'{}') into visible from public.offerings o
    where o.status='active' and (can_manage or public.current_person_can_assign_batches(o.id));
  if not public.current_person_has_active_employee_membership() or (not can_manage and cardinality(visible)=0) then
    raise exception using errcode='42501',message='batch access denied'; end if;
  return jsonb_build_object(
    'canManage',can_manage,
    'serviceTypes',(select coalesce(jsonb_agg(jsonb_build_object('key',t.key,'label',t.label,'defaultDurationDays',t.default_duration_days) order by t.position),'[]'::jsonb)
      from public.batch_service_types t),
    'offerings',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'canAssign',public.current_person_can_assign_batches(o.id),
        'durationDays',o.duration_days) order by o.title),'[]'::jsonb)
      from public.offerings o where o.id=any(visible)),
    'batches',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'offeringId',c.offering_id,'code',c.code,'name',c.name,
        'serviceType',c.service_type,'status',c.status,'startsAt',c.starts_at,'endsAt',c.ends_at,'revision',c.revision,
        'studentCount',(select count(*) from public.enrollments e where e.cohort_id=c.id and e.status in ('approved','active')))
        order by c.starts_at nulls last,c.name),'[]'::jsonb)
      from public.cohorts c where c.offering_id=any(visible)));
end $$;

revoke all on function public.current_person_can_manage_courses(), public.current_person_can_record_payments(),
  public.current_person_can_read_payment_ledger(), public.current_person_can_correct_payments(),
  public.list_courses(), public.save_course(uuid,uuid,bigint,text,text,public.offering_status,integer,bigint,bigint,text),
  public.list_payment_collectors(), public.list_payment_students(text), public.list_student_payments(uuid),
  public.list_payment_ledger(text,date,date),
  public.record_student_payment(uuid,uuid,text,text,bigint,date,text,uuid,text),
  public.correct_student_payment(uuid,uuid,bigint,text), public.set_enrollment_fee(uuid,uuid,bigint,bigint,text),
  public.current_person_can_upload_payment_receipt(text), public.current_person_can_read_payment_receipt(text),
  public.attach_payment_receipt(uuid,text), public.list_student_google_logins(text) from public, anon;
grant execute on function public.current_person_can_manage_courses(), public.current_person_can_record_payments(),
  public.current_person_can_read_payment_ledger(), public.current_person_can_correct_payments(),
  public.list_courses(), public.save_course(uuid,uuid,bigint,text,text,public.offering_status,integer,bigint,bigint,text),
  public.list_payment_collectors(), public.list_payment_students(text), public.list_student_payments(uuid),
  public.list_payment_ledger(text,date,date),
  public.record_student_payment(uuid,uuid,text,text,bigint,date,text,uuid,text),
  public.correct_student_payment(uuid,uuid,bigint,text), public.set_enrollment_fee(uuid,uuid,bigint,bigint,text),
  public.current_person_can_upload_payment_receipt(text), public.current_person_can_read_payment_receipt(text),
  public.attach_payment_receipt(uuid,text), public.list_student_google_logins(text) to authenticated;

-- Navigation flags only; every operation is enforced by the RPCs above.
create or replace function public.get_my_navigation_access()
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off as $$
declare
 student boolean := public.current_person_has_active_student_membership();
 employee boolean := public.current_person_has_active_employee_membership();
begin
 return jsonb_build_object(
  'student',coalesce(student,false),'employee',coalesce(employee,false),
  'crm',employee and public.current_person_has_capability('lead.manage_assigned'),
  'crmAssignments',employee and public.current_person_has_capability('lead.assign'),
  'privacy',employee and public.current_person_has_capability('privacy.manage'),
  'enrolments',employee and public.current_person_has_capability('enrollment.operate'),
  'content',employee and public.current_person_can_open_content_workspace(),
  'distribution',employee and public.current_person_can_open_assignment_distribution(),
  'reviews',employee and public.current_person_can_open_feedback_workspace(),
  'closeout',employee and exists(select 1 from public.offerings o where public.current_person_can_close_enrollment(o.id)),
  'classes',employee and exists(select 1 from public.offerings o where o.status='active' and public.current_person_can_schedule_classes(o.id)),
  'curriculumImpact',employee and exists(select 1 from public.offerings o where o.status='active' and public.can_preview_curriculum_upgrade(o.id)),
  'batches',employee and public.current_person_can_manage_batches(),
  -- Teacher-portal placement link: teachers only. Sales place students from their own Batches page.
  'batchAssign',employee and exists(select 1 from public.offerings o where o.status='active'
    and public.current_person_is_assignment_teacher(o.id) and public.current_person_can_assign_batches(o.id)),
  'studentLogins',employee and public.current_person_can_approve_student_logins(),
  'studentLoginRevoke',employee and public.current_person_can_revoke_student_logins(),
  'courses',employee and public.current_person_can_manage_courses(),
  'payments',employee and public.current_person_can_record_payments(),
  'paymentLedger',employee and public.current_person_can_read_payment_ledger(),
  'employees',employee and public.current_person_can_invite_employees(),
  'studentRecovery',employee and public.current_person_can_assist_student_recovery(),
  'staffRecovery',employee and public.current_person_can_manage_staff_security()
 );
end $$;
