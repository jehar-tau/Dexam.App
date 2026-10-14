-- No recurring job is activated by applying this migration.
create extension if not exists pg_cron with schema pg_catalog;
alter table public.class_sessions add constraint class_sessions_cohort_offering_matches
  foreign key(cohort_id,offering_id) references public.cohorts(id,offering_id) on delete restrict;

create table public.inapp_worker_health (
  name text primary key check(name='inapp'),
  attempted_at timestamptz,
  completed_at timestamptz,
  last_success_at timestamptz,
  succeeded boolean,
  processed_count integer not null default 0,
  failed_count integer not null default 0,
  error_sqlstate text check(error_sqlstate is null or error_sqlstate ~ '^[A-Z0-9]{5}$')
);
alter table public.inapp_worker_health enable row level security;
revoke all on public.inapp_worker_health from anon,authenticated;
grant all on public.inapp_worker_health to service_role;
insert into public.inapp_worker_health(name) values('inapp');

create function public.run_inapp_notification_tick()
returns jsonb language plpgsql security definer set search_path='' set row_security=off
as $$ declare result record; outcome boolean; attempted timestamptz:=clock_timestamp(); begin
  -- At most one tick, without blocking a concurrent maintenance request indefinitely.
  if not pg_try_advisory_xact_lock(hashtextextended('dexam-inapp-worker',0)) then return jsonb_build_object('skipped',true); end if;
  begin
    select * into result from public.process_notification_outbox(100);
    perform public.purge_expired_notifications(500);
    perform public.purge_expired_class_sessions(100);
    perform public.purge_expired_student_topic_marks(500);
    -- Delete only logs belonging to this one controlled job, never another Cron job.
    delete from cron.job_run_details d using cron.job j where j.jobid=d.jobid
      and j.jobname='dexam-fictional-inapp-delivery' and coalesce(d.end_time,d.start_time)<clock_timestamp()-interval '7 days';
    outcome:=result.failed_count=0;
    update public.inapp_worker_health set attempted_at=attempted,completed_at=clock_timestamp(),succeeded=outcome,
      last_success_at=case when outcome then clock_timestamp() else last_success_at end,
      processed_count=result.processed_count,failed_count=result.failed_count,error_sqlstate=case when outcome then null else 'P0001' end where name='inapp';
    return jsonb_build_object('ok',outcome,'processedCount',result.processed_count,'failedCount',result.failed_count);
  exception when others then
    update public.inapp_worker_health set attempted_at=attempted,completed_at=clock_timestamp(),succeeded=false,
      processed_count=0,failed_count=0,error_sqlstate=sqlstate where name='inapp';
    return jsonb_build_object('ok',false);
  end;
end $$;
revoke all on function public.run_inapp_notification_tick() from public,anon,authenticated;
grant execute on function public.run_inapp_notification_tick() to service_role;

create function public.get_inapp_worker_health()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select to_jsonb(h) from public.inapp_worker_health h where name='inapp' $$;
revoke all on function public.get_inapp_worker_health() from public,anon,authenticated;
grant execute on function public.get_inapp_worker_health() to service_role;

create function public.configure_fictional_inapp_job(p_project_ref text)
returns bigint language plpgsql security definer set search_path='' set row_security=off
as $$ declare configured_job_id bigint; begin
  if p_project_ref is distinct from 'ienwcencjbgdsqxfyxmj'
    or not exists(select 1 from public.offerings where id='20000000-0000-4000-8000-000000000001' and code='STAGING_FOUNDATION')
    or not exists(select 1 from public.people where id='10000000-0000-4000-8000-000000000001' and member_id='DXM-STG22STUDENT')
    then raise exception using errcode='42501',message='fictional worker configuration refused'; end if;
  select cron.schedule('dexam-fictional-inapp-delivery','* * * * *',
    'SET statement_timeout=''30s''; SELECT public.run_inapp_notification_tick();') into configured_job_id;
  return configured_job_id;
end $$;
revoke all on function public.configure_fictional_inapp_job(text) from public,anon,authenticated;
grant execute on function public.configure_fictional_inapp_job(text) to service_role;

create function public.get_fictional_inapp_job_status()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select jsonb_build_object('scheduled',exists(select 1 from cron.job where jobname='dexam-fictional-inapp-delivery'
  and schedule='* * * * *' and active and username='postgres'
  and command='SET statement_timeout=''30s''; SELECT public.run_inapp_notification_tick();'),
  'healthy',coalesce((select succeeded and last_success_at >= now()-interval '3 minutes' from public.inapp_worker_health where name='inapp'),false),
  'health',(select public.get_inapp_worker_health())) $$;
revoke all on function public.get_fictional_inapp_job_status() from public,anon,authenticated;
grant execute on function public.get_fictional_inapp_job_status() to service_role;
