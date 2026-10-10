alter table public.notifications
  alter column assignment_instance_id drop not null,
  add column crm_enquiry_id uuid references public.crm_enquiries (id) on delete restrict;

alter table public.notifications
  add constraint notifications_source_consistent check (
    (
      audience in ('student', 'teacher')
      and assignment_instance_id is not null
      and crm_enquiry_id is null
    )
    or (
      audience = 'sales'
      and assignment_instance_id is null
      and crm_enquiry_id is not null
    )
  );

create index notifications_crm_enquiry_idx on public.notifications (crm_enquiry_id)
  where crm_enquiry_id is not null;

insert into public.notification_templates (
  event_type, audience, category, version, title, body, destination_base_path
)
values
  (
    'lead_assigned', 'sales', 'service', 1,
    'New enquiry assigned',
    'A prospective-student enquiry has been assigned to you.',
    '/staff/crm'
  ),
  (
    'lead_follow_up_due', 'sales', 'service', 1,
    'Lead follow-up due',
    'An assigned enquiry is ready for follow-up.',
    '/staff/crm'
  );

create or replace function public.capture_crm_ownership_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.domain_events (
    event_key, event_type, aggregate_type, aggregate_id, actor_person_id, payload, occurred_at
  ) values (
    format('crm_ownership:%s:lead_assigned', new.id),
    'lead_assigned',
    'crm_enquiry',
    new.enquiry_id,
    new.assigned_by_person_id,
    jsonb_build_object('ownership_id', new.id),
    new.assigned_at
  )
  on conflict (event_key) do nothing;
  return new;
end;
$$;

create trigger crm_ownership_notification_event
after insert on public.crm_enquiry_ownership_history
for each row execute function public.capture_crm_ownership_notification_event();

create or replace function public.capture_crm_follow_up_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  insert into public.domain_events (
    event_key, event_type, aggregate_type, aggregate_id, actor_person_id,
    payload, occurred_at, available_at
  ) values (
    format('crm_follow_up:%s:lead_follow_up_due', new.id),
    'lead_follow_up_due',
    'crm_follow_up',
    new.id,
    new.created_by_person_id,
    jsonb_build_object('enquiry_id', new.enquiry_id),
    new.created_at,
    new.due_at
  )
  on conflict (event_key) do nothing;
  return new;
end;
$$;

create trigger crm_follow_up_notification_event
after insert on public.crm_follow_ups
for each row execute function public.capture_crm_follow_up_notification_event();

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
  target_enquiry public.crm_enquiries%rowtype;
  target_follow_up public.crm_follow_ups%rowtype;
  target_ownership public.crm_enquiry_ownership_history%rowtype;
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
      if target_event.event_type in (
        'assignment_published', 'submission_ready_for_review',
        'feedback_available', 'correction_requested'
      ) then
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
      elsif target_event.event_type = 'lead_assigned' then
        select * into strict target_enquiry
        from public.crm_enquiries e where e.id = target_event.aggregate_id;
        select * into strict target_ownership
        from public.crm_enquiry_ownership_history h
        where h.id = (target_event.payload ->> 'ownership_id')::uuid;
        select * into strict target_template
        from public.notification_templates t
        where t.event_type = target_event.event_type
          and t.active
          and t.audience = 'sales';

        if target_enquiry.stage <> 'closed'
           and target_enquiry.owner_person_id = target_ownership.to_owner_person_id
           and public.person_has_global_capability(target_ownership.to_owner_person_id, 'lead.manage_assigned') then
          insert into public.notifications (
            event_id, recipient_person_id, template_id, audience, category,
            crm_enquiry_id, title, body, destination_path
          ) values (
            target_event.id, target_ownership.to_owner_person_id, target_template.id,
            target_template.audience, target_template.category, target_enquiry.id,
            target_template.title, target_template.body,
            target_template.destination_base_path || '?enquiry=' || target_enquiry.id::text
          )
          on conflict (event_id, recipient_person_id) do nothing;
        end if;
      elsif target_event.event_type = 'lead_follow_up_due' then
        select * into strict target_follow_up
        from public.crm_follow_ups f where f.id = target_event.aggregate_id;
        select * into strict target_enquiry
        from public.crm_enquiries e where e.id = target_follow_up.enquiry_id;
        select * into strict target_template
        from public.notification_templates t
        where t.event_type = target_event.event_type
          and t.active
          and t.audience = 'sales';

        if target_enquiry.stage <> 'closed'
           and target_follow_up.status = 'open'
           and target_follow_up.due_at <= now()
           and target_follow_up.assigned_to_person_id = target_enquiry.owner_person_id
           and public.person_has_global_capability(target_enquiry.owner_person_id, 'lead.manage_assigned') then
          insert into public.notifications (
            event_id, recipient_person_id, template_id, audience, category,
            crm_enquiry_id, title, body, destination_path
          ) values (
            target_event.id, target_enquiry.owner_person_id, target_template.id,
            target_template.audience, target_template.category, target_enquiry.id,
            target_template.title, target_template.body,
            target_template.destination_base_path || '?enquiry=' || target_enquiry.id::text
          )
          on conflict (event_id, recipient_person_id) do nothing;
        end if;
      else
        raise exception using errcode = '22023', message = 'unsupported notification event type';
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
        or (
          n.audience = 'sales'
          and public.current_person_can_manage_crm_enquiry(n.crm_enquiry_id)
          and exists (
            select 1
            from public.crm_enquiries e
            where e.id = n.crm_enquiry_id and e.stage <> 'closed'
          )
        )
      )
  ), false)
$$;

revoke all on function public.capture_crm_ownership_notification_event() from public, anon, authenticated;
revoke all on function public.capture_crm_follow_up_notification_event() from public, anon, authenticated;

comment on column public.notifications.crm_enquiry_id is
  'Protected source pointer for Sales notifications. Notification text never copies prospect contact details.';
