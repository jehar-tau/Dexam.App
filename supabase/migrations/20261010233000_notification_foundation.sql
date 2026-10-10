create type public.notification_audience as enum ('student', 'teacher');
create type public.notification_category as enum ('service', 'academic');

create table public.domain_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  actor_person_id uuid references public.people (id) on delete restrict,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  processed_at timestamptz,
  retry_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  constraint domain_events_key_format check (event_key ~ '^[a-z][a-z0-9_:.-]{2,199}$'),
  constraint domain_events_type_format check (event_type ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint domain_events_aggregate_format check (aggregate_type ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint domain_events_payload_bounded check (octet_length(payload::text) <= 4096),
  constraint domain_events_retry_bounded check (retry_count between 0 and 5),
  constraint domain_events_processing_consistent check (
    (processed_at is null)
    or (processed_at is not null and last_error is null)
  )
);

create table public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  audience public.notification_audience not null,
  category public.notification_category not null,
  version integer not null,
  title text not null,
  body text not null,
  destination_base_path text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint notification_templates_event_format check (event_type ~ '^[a-z][a-z0-9_]{2,79}$'),
  constraint notification_templates_version_positive check (version > 0),
  constraint notification_templates_title_bounded check (length(btrim(title)) between 3 and 100),
  constraint notification_templates_body_bounded check (length(btrim(body)) between 3 and 240),
  constraint notification_templates_destination_safe check (
    destination_base_path ~ '^/(student|staff)/[a-z0-9/_-]*$'
  ),
  constraint notification_templates_version_unique unique (event_type, audience, version)
);

create unique index notification_templates_one_active
  on public.notification_templates (event_type, audience)
  where active;

insert into public.notification_templates (
  event_type, audience, category, version, title, body, destination_base_path
)
values
  (
    'assignment_published', 'student', 'academic', 1,
    'New assignment available',
    'A new assignment is ready in your learning workspace.',
    '/student/assignments'
  ),
  (
    'submission_ready_for_review', 'teacher', 'academic', 1,
    'Submission ready for review',
    'A submitted assignment is waiting in your review queue.',
    '/staff/reviews'
  ),
  (
    'feedback_available', 'student', 'academic', 1,
    'Teacher feedback available',
    'Your teacher has published feedback for an assignment.',
    '/student/assignments'
  ),
  (
    'correction_requested', 'student', 'academic', 1,
    'Correction requested',
    'Your teacher has requested another attempt. Open the assignment for details.',
    '/student/assignments'
  );

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id bigint not null references public.domain_events (id) on delete restrict,
  recipient_person_id uuid not null references public.people (id) on delete restrict,
  template_id uuid not null references public.notification_templates (id) on delete restrict,
  audience public.notification_audience not null,
  category public.notification_category not null,
  assignment_instance_id uuid not null references public.student_assignment_instances (id) on delete restrict,
  title text not null,
  body text not null,
  destination_path text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  expires_at timestamptz not null default (now() + interval '12 months'),
  constraint notifications_event_recipient_unique unique (event_id, recipient_person_id),
  constraint notifications_title_bounded check (length(btrim(title)) between 3 and 100),
  constraint notifications_body_bounded check (length(btrim(body)) between 3 and 240),
  constraint notifications_destination_safe check (
    destination_path ~ '^/(student|staff)/[a-z0-9/_-]*(\?[a-z]+=[0-9a-f-]+)?$'
  ),
  constraint notifications_read_order check (read_at is null or read_at >= created_at),
  constraint notifications_expiry_order check (expires_at > created_at)
);

create index domain_events_pending_idx
  on public.domain_events (available_at, id)
  where processed_at is null and retry_count < 5;
create index notifications_recipient_created_idx
  on public.notifications (recipient_person_id, created_at desc);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_person_id, created_at desc)
  where read_at is null;
create index notifications_expiry_idx on public.notifications (expires_at);

create or replace function public.capture_assignment_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  mapped_event_type text;
begin
  mapped_event_type := case
    when new.reason_code = 'assignment_distributed' then 'assignment_published'
    when new.reason_code in ('attempt_submitted', 'attempt_submitted_late') then 'submission_ready_for_review'
    when new.reason_code = 'feedback_review_completed' then 'feedback_available'
    when new.reason_code in (
      'feedback_correction_requested', 'correction_requested', 'completed_review_reopened'
    ) then 'correction_requested'
    else null
  end;

  if mapped_event_type is null then return new; end if;

  insert into public.domain_events (
    event_key, event_type, aggregate_type, aggregate_id, actor_person_id, payload, occurred_at
  ) values (
    format('assignment_transition:%s:%s', new.id, mapped_event_type),
    mapped_event_type,
    'assignment_instance',
    new.assignment_instance_id,
    new.actor_person_id,
    jsonb_build_object('transition_id', new.id),
    new.occurred_at
  )
  on conflict (event_key) do nothing;

  return new;
end;
$$;

create trigger student_assignment_transitions_notification_event
after insert on public.student_assignment_transitions
for each row execute function public.capture_assignment_notification_event();

create or replace function public.person_can_receive_teacher_notification(
  p_person_id uuid,
  p_offering_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with active_teacher_scope as (
    select ra.role_key, ra.scope_type, ra.scope_id
    from public.role_assignments ra
    where ra.person_id = p_person_id
      and ra.role_key = 'teacher'
      and (
        (ra.scope_type = 'global' and ra.scope_id is null)
        or (ra.scope_type = 'offering' and ra.scope_id = p_offering_id)
      )
      and ra.revoked_at is null
      and ra.starts_at <= now()
      and (ra.ends_at is null or ra.ends_at > now())
  )
  select coalesce(
    exists (
      select 1
      from public.people p
      join public.memberships m on m.person_id = p.id
      where p.id = p_person_id
        and p.status = 'active'
        and m.kind = 'employee'
        and m.status = 'active'
        and (m.starts_at is null or m.starts_at <= now())
        and (m.ends_at is null or m.ends_at > now())
    )
    and exists (select 1 from active_teacher_scope)
    and (
      exists (
        select 1
        from active_teacher_scope ats
        join public.role_capabilities rc on rc.role_key = ats.role_key
        where rc.capability_key = 'feedback.review'
      )
      or exists (
        select 1
        from public.capability_grants cg
        join active_teacher_scope ats
          on ats.role_key = cg.required_role_key
          and ats.scope_type = cg.scope_type
          and ats.scope_id is not distinct from cg.scope_id
        where cg.person_id = p_person_id
          and cg.capability_key = 'feedback.review'
          and cg.revoked_at is null
          and cg.starts_at <= now()
          and (cg.ends_at is null or cg.ends_at > now())
      )
    ),
    false
  )
$$;

create or replace function public.process_notification_outbox(p_limit integer default 100)
returns table (processed_count integer, failed_count integer)
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_event public.domain_events%rowtype;
  target_template public.notification_templates%rowtype;
  target_instance public.student_assignment_instances%rowtype;
  target_offering_id uuid;
  processed_total integer := 0;
  failed_total integer := 0;
begin
  if p_limit not between 1 and 500 then
    raise exception using errcode = '22023', message = 'notification worker limit must be between 1 and 500';
  end if;

  for target_event in
    select e.*
    from public.domain_events e
    where e.processed_at is null
      and e.retry_count < 5
      and e.available_at <= now()
    order by e.id
    limit p_limit
    for update skip locked
  loop
    begin
      select * into strict target_instance
      from public.student_assignment_instances i
      where i.id = target_event.aggregate_id;

      select r.offering_id into strict target_offering_id
      from public.assignment_releases r
      where r.id = target_instance.assignment_release_id;

      select * into strict target_template
      from public.notification_templates t
      where t.event_type = target_event.event_type
        and t.active
        and t.audience = case
          when target_event.event_type = 'submission_ready_for_review'
            then 'teacher'::public.notification_audience
          else 'student'::public.notification_audience
        end;

      if target_template.audience = 'student' then
        insert into public.notifications (
          event_id, recipient_person_id, template_id, audience, category,
          assignment_instance_id, title, body, destination_path
        )
        select
          target_event.id, e.person_id, target_template.id, target_template.audience,
          target_template.category, target_instance.id, target_template.title,
          target_template.body,
          target_template.destination_base_path || '?assignment=' || target_instance.id::text
        from public.enrollments e
        join public.people p on p.id = e.person_id and p.status = 'active'
        where e.id = target_instance.enrollment_id
          and e.status = 'active'
          and exists (
            select 1 from public.memberships m
            where m.person_id = e.person_id
              and m.kind = 'student'
              and m.status = 'active'
              and (m.starts_at is null or m.starts_at <= now())
              and (m.ends_at is null or m.ends_at > now())
          )
        on conflict (event_id, recipient_person_id) do nothing;
      else
        insert into public.notifications (
          event_id, recipient_person_id, template_id, audience, category,
          assignment_instance_id, title, body, destination_path
        )
        select distinct
          target_event.id, p.id, target_template.id, target_template.audience,
          target_template.category, target_instance.id, target_template.title,
          target_template.body,
          target_template.destination_base_path || '?instance=' || target_instance.id::text
        from public.people p
        where public.person_can_receive_teacher_notification(p.id, target_offering_id)
        on conflict (event_id, recipient_person_id) do nothing;
      end if;

      update public.domain_events
      set processed_at = now(), last_error = null
      where id = target_event.id;
      processed_total := processed_total + 1;
    exception when others then
      update public.domain_events
      set retry_count = retry_count + 1,
          last_error = left(sqlstate || ':' || sqlerrm, 500),
          available_at = now() + interval '5 minutes'
      where id = target_event.id;
      failed_total := failed_total + 1;
    end;
  end loop;

  return query select processed_total, failed_total;
end;
$$;

create or replace function public.current_person_can_read_notification(p_notification_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(exists (
    select 1
    from public.notifications n
    where n.id = p_notification_id
      and n.recipient_person_id = public.current_person_id()
      and n.expires_at > now()
      and (
        (
          n.audience = 'student'
          and public.current_person_can_access_assignment_instance(n.assignment_instance_id)
        )
        or (
          n.audience = 'teacher'
          and public.current_person_can_review_feedback_instance(n.assignment_instance_id)
        )
      )
  ), false)
$$;

create or replace function public.list_my_notifications(p_limit integer default 50)
returns table (
  id uuid,
  event_type text,
  category public.notification_category,
  title text,
  body text,
  destination_path text,
  created_at timestamptz,
  read_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
begin
  if p_limit not between 1 and 100 then
    raise exception using errcode = '22023', message = 'notification list limit must be between 1 and 100';
  end if;

  return query
  select
    n.id, e.event_type, n.category, n.title, n.body,
    n.destination_path, n.created_at, n.read_at
  from public.notifications n
  join public.domain_events e on e.id = n.event_id
  where n.recipient_person_id = public.current_person_id()
    and n.expires_at > now()
    and public.current_person_can_read_notification(n.id)
  order by n.created_at desc, n.id desc
  limit p_limit;
end;
$$;

create or replace function public.get_my_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select count(*)::integer
  from public.notifications n
  where n.recipient_person_id = public.current_person_id()
    and n.read_at is null
    and n.expires_at > now()
    and public.current_person_can_read_notification(n.id)
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if not public.current_person_can_read_notification(p_notification_id) then
    raise exception using errcode = '42501', message = 'notification access denied';
  end if;

  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  updated_count integer;
begin
  update public.notifications n
  set read_at = now()
  where n.recipient_person_id = public.current_person_id()
    and n.read_at is null
    and n.expires_at > now()
    and public.current_person_can_read_notification(n.id);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.purge_expired_notifications(p_limit integer default 500)
returns integer
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  purged_count integer;
begin
  if p_limit not between 1 and 5000 then
    raise exception using errcode = '22023', message = 'notification purge limit must be between 1 and 5000';
  end if;

  with expired as (
    select id
    from public.notifications
    where expires_at <= now()
    order by expires_at, id
    limit p_limit
    for update skip locked
  )
  delete from public.notifications n
  using expired e
  where n.id = e.id;
  get diagnostics purged_count = row_count;
  return purged_count;
end;
$$;

alter table public.domain_events enable row level security;
alter table public.notification_templates enable row level security;
alter table public.notifications enable row level security;

revoke all on table public.domain_events from anon, authenticated;
revoke all on sequence public.domain_events_id_seq from anon, authenticated;
revoke all on table public.notification_templates from anon, authenticated;
revoke all on table public.notifications from anon, authenticated;

grant all on table public.domain_events to service_role;
grant all on sequence public.domain_events_id_seq to service_role;
grant all on table public.notification_templates to service_role;
grant all on table public.notifications to service_role;

revoke all on function public.capture_assignment_notification_event() from public, anon, authenticated;
revoke all on function public.person_can_receive_teacher_notification(uuid, uuid) from public, anon, authenticated;
revoke all on function public.process_notification_outbox(integer) from public, anon, authenticated;
revoke all on function public.current_person_can_read_notification(uuid) from public, anon;
revoke all on function public.list_my_notifications(integer) from public, anon;
revoke all on function public.get_my_unread_notification_count() from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;
revoke all on function public.purge_expired_notifications(integer) from public, anon, authenticated;

grant execute on function public.process_notification_outbox(integer) to service_role;
grant execute on function public.current_person_can_read_notification(uuid) to authenticated;
grant execute on function public.list_my_notifications(integer) to authenticated;
grant execute on function public.get_my_unread_notification_count() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.purge_expired_notifications(integer) to service_role;

comment on table public.domain_events is
  'Transactional notification outbox. Events contain bounded identifiers only and remain channel-neutral.';
comment on table public.notification_templates is
  'Versioned safe-summary templates. First milestone templates are code-controlled and in-app only.';
comment on table public.notifications is
  'Recipient-specific in-app notifications retained for 12 months and re-authorized on every read.';
