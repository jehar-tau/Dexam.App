create or replace function public.process_assignment_crm_outbox(p_limit integer default 100)
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
      and e.aggregate_type <> 'class_session'
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

revoke all on function public.process_assignment_crm_outbox(integer) from public,anon,authenticated;
grant execute on function public.process_assignment_crm_outbox(integer) to service_role;
alter table public.notifications add column class_session_id uuid references public.class_sessions(id) on delete restrict, add column class_revision integer;
create index notifications_class_session_idx on public.notifications(class_session_id) where class_session_id is not null;
alter table public.notifications drop constraint notifications_source_consistent;
alter table public.notifications add constraint notifications_source_consistent check(
 (audience in ('student','teacher') and assignment_instance_id is not null and crm_enquiry_id is null and class_session_id is null and class_revision is null)
 or (audience='sales' and assignment_instance_id is null and crm_enquiry_id is not null and class_session_id is null and class_revision is null)
 or (audience='student' and assignment_instance_id is null and crm_enquiry_id is null and class_session_id is not null and class_revision is not null and class_revision>0)
);
insert into public.notification_templates(event_type,audience,category,version,title,body,destination_base_path)
values
 ('class_scheduled','student','academic',1,'Class scheduled','Your class schedule has changed. Open your agenda for current details.','/student/agenda'),
 ('class_rescheduled','student','academic',1,'Class rescheduled','Your class schedule has changed. Open your agenda for current details.','/student/agenda'),
 ('class_cancelled','student','academic',1,'Class cancelled','Your class schedule has changed. Open your agenda for current details.','/student/agenda');

create or replace function public.process_notification_outbox(p_limit integer default 100)
returns table(processed_count integer,failed_count integer)
language plpgsql security definer set search_path='' set row_security=off
as $$ declare ev public.domain_events%rowtype; s public.class_sessions%rowtype; template public.notification_templates%rowtype;
done integer:=0; failed integer:=0; old_result record; class_budget integer; begin
 if p_limit is null or p_limit not between 1 and 500 then raise exception using errcode='22023',message='notification worker limit must be between 1 and 500'; end if;
 class_budget:=greatest(1,p_limit/2);
 if not exists(select 1 from public.domain_events where aggregate_type<>'class_session' and processed_at is null and retry_count<5 and available_at<=now()) then class_budget:=p_limit; end if;
 if p_limit=1 then
   select case when aggregate_type='class_session' then 1 else 0 end into class_budget from public.domain_events
   where processed_at is null and retry_count<5 and available_at<=now() order by id limit 1;
   class_budget:=coalesce(class_budget,0);
 end if;
 for ev in select * from public.domain_events where aggregate_type='class_session' and processed_at is null and retry_count<5 and available_at<=now()
 order by id limit class_budget for update skip locked loop
  begin
   select * into s from public.class_sessions where id=ev.aggregate_id for share nowait;
   if found and s.retention_until>clock_timestamp() and s.revision=(ev.payload->>'revision')::integer then
    select * into strict template from public.notification_templates where event_type=ev.event_type and audience='student' and active;
    insert into public.notifications(event_id,recipient_person_id,template_id,audience,category,class_session_id,class_revision,title,body,destination_path)
    select distinct ev.id,e.person_id,template.id,'student'::public.notification_audience,'academic'::public.notification_category,s.id,s.revision,template.title,template.body,template.destination_base_path
    from public.enrollments e join public.offerings o on o.id=e.offering_id and o.status='active'
    join public.people p on p.id=e.person_id and p.status='active'
    left join public.cohorts c on c.id=e.cohort_id
    where e.offering_id=s.offering_id and e.status='active' and e.ended_at is null
     and (e.cohort_id is null or c.status='active') and (s.cohort_id is null or e.cohort_id=s.cohort_id)
     and exists(select 1 from public.memberships m where m.person_id=e.person_id and m.kind='student' and m.status='active'
       and (m.starts_at is null or m.starts_at<=now()) and (m.ends_at is null or m.ends_at>now()))
    on conflict(event_id,recipient_person_id) do nothing;
   end if;
   update public.domain_events set processed_at=clock_timestamp(),last_error=null where id=ev.id;
   done:=done+1;
  exception when others then
   update public.domain_events set retry_count=retry_count+1,last_error=sqlstate,available_at=now()+interval '5 minutes' where id=ev.id;
   failed:=failed+1;
  end;
 end loop;
 if p_limit>done+failed then
  select * into old_result from public.process_assignment_crm_outbox(p_limit-done-failed);
  done:=done+old_result.processed_count;failed:=failed+old_result.failed_count;
 end if;
 return query select done,failed;
end $$;

create or replace function public.current_person_can_read_notification(p_notification_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.notifications n where n.id=p_notification_id and n.recipient_person_id=public.current_person_id() and n.expires_at>now()
 and ((n.audience='student' and n.assignment_instance_id is not null and public.current_person_can_access_assignment_instance(n.assignment_instance_id))
 or (n.audience='teacher' and public.current_person_can_review_feedback_instance(n.assignment_instance_id))
 or (n.audience='sales' and public.current_person_can_manage_crm_enquiry(n.crm_enquiry_id)
   and exists(select 1 from public.crm_enquiries e where e.id=n.crm_enquiry_id and e.stage<>'closed'))
 or (n.audience='student' and public.current_person_can_read_class(n.class_session_id)
   and exists(select 1 from public.class_sessions s where s.id=n.class_session_id and s.revision=n.class_revision)))) $$;

create function public.purge_expired_class_sessions(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' set row_security=off
as $$ declare s record; removed integer:=0; begin
 if p_limit is null or p_limit not between 1 and 500 then raise exception using errcode='22023',message='bounded purge required'; end if;
 for s in select id from public.class_sessions where retention_until<=clock_timestamp() order by retention_until limit p_limit for update skip locked loop
  delete from public.notifications where class_session_id=s.id;
  delete from public.domain_events where aggregate_type='class_session' and aggregate_id=s.id;
  delete from public.class_session_revisions where session_id=s.id;
  delete from public.class_sessions where id=s.id;
  removed:=removed+1;
 end loop;
 return removed;
end $$;
revoke all on function public.purge_expired_class_sessions(integer) from public,anon,authenticated;
grant execute on function public.purge_expired_class_sessions(integer) to service_role;

