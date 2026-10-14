insert into public.capabilities(key,description) values('class.schedule','Manage one-off classes within an explicitly granted offering.');
-- No automatic role grant: a current Ordinary Admin needs an explicit scoped capability.
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  offering_id uuid not null references public.offerings(id) on delete restrict,
  cohort_id uuid references public.cohorts(id) on delete restrict,
  title text not null check(length(btrim(title)) between 2 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null check(ends_at>starts_at),
  timezone text not null,
  location text check(location is null or length(btrim(location)) between 1 and 240),
  revision integer not null default 1 check(revision>0),
  cancelled_at timestamptz,
  retention_until timestamptz not null
);
create index class_sessions_offering_idx on public.class_sessions(offering_id,starts_at);
create index class_sessions_cohort_idx on public.class_sessions(cohort_id) where cohort_id is not null;
create index class_sessions_retention_idx on public.class_sessions(retention_until);
create table public.class_session_revisions (
  session_id uuid not null references public.class_sessions(id) on delete restrict,
  revision integer not null,
  actor_person_id uuid not null references public.people(id) on delete restrict,
  request_key uuid not null unique,
  request_arguments jsonb not null,
  snapshot jsonb not null,
  changed_at timestamptz not null default clock_timestamp(),
  primary key(session_id,revision)
);
create index class_session_revisions_actor_idx on public.class_session_revisions(actor_person_id);
alter table public.class_sessions enable row level security;
alter table public.class_session_revisions enable row level security;
revoke all on public.class_sessions,public.class_session_revisions from anon,authenticated;
grant all on public.class_sessions,public.class_session_revisions to service_role;

create function public.current_person_can_schedule_classes(p_offering_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_employee_membership()
  and public.current_person_has_capability('class.schedule','offering',p_offering_id)
  and exists(select 1 from public.memberships m where m.person_id=public.current_person_id() and m.kind='employee' and m.status='active'
    and (m.starts_at is null or m.starts_at<=clock_timestamp()) and (m.ends_at is null or m.ends_at>clock_timestamp()))
  and exists(select 1 from public.capability_grants g join public.role_assignments r on r.person_id=g.person_id
    and r.role_key='ordinary_admin' and r.scope_type=g.scope_type and r.scope_id is not distinct from g.scope_id
    and r.revoked_at is null and r.starts_at<=clock_timestamp() and (r.ends_at is null or r.ends_at>clock_timestamp())
    where g.person_id=public.current_person_id()
    and g.capability_key='class.schedule' and g.required_role_key='ordinary_admin'
    and g.scope_type='offering' and g.scope_id=p_offering_id and g.revoked_at is null
    and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp())) $$;
revoke all on function public.current_person_can_schedule_classes(uuid) from public,anon;
grant execute on function public.current_person_can_schedule_classes(uuid) to authenticated;

create function public.current_person_can_read_class(p_session_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_student_membership() and exists(
  select 1 from public.class_sessions s join public.offerings o on o.id=s.offering_id
  join public.enrollments e on e.offering_id=s.offering_id and e.person_id=public.current_person_id()
  left join public.cohorts c on c.id=e.cohort_id
  where s.id=p_session_id and s.retention_until>clock_timestamp() and o.status='active'
    and e.status='active' and e.ended_at is null and (e.cohort_id is null or c.status='active')
    and (s.cohort_id is null or s.cohort_id=e.cohort_id)
) $$;
revoke all on function public.current_person_can_read_class(uuid) from public,anon;
grant execute on function public.current_person_can_read_class(uuid) to authenticated;

create function public.save_class_session(p_session_id uuid,p_offering_id uuid,p_cohort_id uuid,
 p_title text,p_starts_at timestamptz,p_ends_at timestamptz,p_timezone text,p_location text,
 p_expected_revision integer,p_cancel boolean,p_confirmed boolean,p_request_key uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off
as $$ declare target public.class_sessions%rowtype; previous public.class_session_revisions%rowtype;
 actor uuid; arguments jsonb; action text; effective_id uuid; begin
  if not public.current_person_can_schedule_classes(p_offering_id) then raise exception using errcode='42501',message='scheduling authority unavailable'; end if;
  actor:=public.current_person_id();
  if p_request_key is null or p_cancel is null or p_confirmed is distinct from true then raise exception using errcode='22023',message='explicit confirmed request required'; end if;
  arguments:=case when p_cancel then jsonb_build_array(p_session_id,p_offering_id,p_cohort_id,p_expected_revision,true)
    else jsonb_build_array(p_session_id,p_offering_id,p_cohort_id,p_title,p_starts_at,p_ends_at,p_timezone,p_location,p_expected_revision,false) end;
  -- Exact requests serialize before replay lookup, without exposing other actors' requests.
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text,0));
  if not public.current_person_can_schedule_classes(p_offering_id) then raise exception using errcode='42501',message='scheduling authority unavailable'; end if;
  select * into previous from public.class_session_revisions where request_key=p_request_key;
  if found then
    if previous.actor_person_id<>actor or previous.request_arguments<>arguments then raise exception using errcode='55000',message='request key cannot be reused'; end if;
    return previous.session_id;
  end if;
  if p_session_id is not null then
    select * into target from public.class_sessions where id=p_session_id for update;
    if not public.current_person_can_schedule_classes(p_offering_id) then raise exception using errcode='42501',message='scheduling authority unavailable'; end if;
    if not found or target.offering_id<>p_offering_id then raise exception using errcode='42501',message='class unavailable'; end if;
    if target.cancelled_at is not null or target.revision is distinct from p_expected_revision or target.ends_at<=clock_timestamp() then raise exception using errcode='55000',message='class changed or is no longer editable'; end if;
    if target.cohort_id is distinct from p_cohort_id then raise exception using errcode='22023',message='class audience cannot be reassigned'; end if;
  elsif p_expected_revision<>0 or p_expected_revision is null or p_cancel then raise exception using errcode='22023',message='new class request invalid'; end if;
  if not exists(select 1 from public.offerings where id=p_offering_id and status='active')
    or (p_cohort_id is not null and not exists(select 1 from public.cohorts where id=p_cohort_id and offering_id=p_offering_id and status='active'))
    then raise exception using errcode='42501',message='active audience unavailable'; end if;
  if not p_cancel and (p_title is null or length(btrim(p_title)) not between 2 and 160
    or p_starts_at is null or p_ends_at is null or p_starts_at<=clock_timestamp() or p_ends_at<=p_starts_at
    or not exists(select 1 from pg_timezone_names where name=p_timezone)
    or (p_location is not null and (length(btrim(p_location)) not between 1 and 240 or p_location ~* '(https?://|www\.)')))
    then raise exception using errcode='22023',message='future time, timezone, title and plain-text location required'; end if;
  if p_session_id is null then
    insert into public.class_sessions(offering_id,cohort_id,title,starts_at,ends_at,timezone,location,retention_until)
    values(p_offering_id,p_cohort_id,btrim(p_title),p_starts_at,p_ends_at,p_timezone,p_location,p_ends_at+interval '12 months') returning * into target;
    action:='class_scheduled';
  elsif p_cancel then
    update public.class_sessions set revision=revision+1,cancelled_at=clock_timestamp(),retention_until=greatest(ends_at,clock_timestamp())+interval '12 months'
    where id=p_session_id returning * into target;
    action:='class_cancelled';
  else
    update public.class_sessions set title=btrim(p_title),starts_at=p_starts_at,ends_at=p_ends_at,timezone=p_timezone,location=p_location,revision=revision+1,
      retention_until=p_ends_at+interval '12 months' where id=p_session_id returning * into target;
    action:='class_rescheduled';
  end if;
  effective_id:=target.id;
  insert into public.class_session_revisions(session_id,revision,actor_person_id,request_key,request_arguments,snapshot)
    values(target.id,target.revision,actor,p_request_key,arguments,to_jsonb(target));
  insert into public.domain_events(event_key,event_type,aggregate_type,aggregate_id,actor_person_id,payload)
    values('class:'||target.id||':'||target.revision,action,'class_session',target.id,actor,jsonb_build_object('revision',target.revision));
  return effective_id;
end $$;
revoke all on function public.save_class_session(uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,integer,boolean,boolean,uuid) from public,anon;
grant execute on function public.save_class_session(uuid,uuid,uuid,text,timestamptz,timestamptz,text,text,integer,boolean,boolean,uuid) to authenticated;

create function public.list_my_class_agenda()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(to_jsonb(s) order by s.starts_at),'[]'::jsonb) from public.class_sessions s
where public.current_person_can_read_class(s.id) $$;
revoke all on function public.list_my_class_agenda() from public,anon;
grant execute on function public.list_my_class_agenda() to authenticated;

create function public.list_class_scheduling_context()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,
  'cohorts',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name)) from public.cohorts c where c.offering_id=o.id and c.status='active'),'[]'::jsonb),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.starts_at) from public.class_sessions s where s.offering_id=o.id and s.retention_until>clock_timestamp()),'[]'::jsonb)
) order by o.title),'[]'::jsonb) from public.offerings o where o.status='active' and public.current_person_can_schedule_classes(o.id) $$;
revoke all on function public.list_class_scheduling_context() from public,anon;
grant execute on function public.list_class_scheduling_context() to authenticated;
