-- Explicit self-reported planning state, not attendance, grades or mastery evidence.
create table public.student_topic_marks (
  enrollment_id uuid not null references public.enrollments(id) on delete restrict,
  topic_id uuid not null references public.curriculum_topics(id) on delete restrict,
  marked_at timestamptz not null default clock_timestamp(),
  primary key(enrollment_id,topic_id)
);
create index student_topic_marks_topic_idx on public.student_topic_marks(topic_id);
alter table public.student_topic_marks enable row level security;
revoke all on public.student_topic_marks from anon,authenticated;
grant all on public.student_topic_marks to service_role;

create function public.current_person_can_edit_topic_checklist(p_enrollment_id uuid,p_topic_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_active_student_membership() and exists(
  select 1 from public.enrollments e join public.offerings o on o.id=e.offering_id
  left join public.cohorts c on c.id=e.cohort_id
  join public.curriculum_sections s on s.curriculum_version_id=coalesce(e.curriculum_version_id,c.curriculum_version_id)
  join public.curriculum_versions v on v.id=s.curriculum_version_id and v.offering_id=e.offering_id
  join public.curriculum_topics t on t.section_id=s.id
  where e.id=p_enrollment_id and e.person_id=public.current_person_id() and e.status='active' and e.ended_at is null
    and o.status='active' and (e.cohort_id is null or c.status='active') and v.status='published' and t.id=p_topic_id
) $$;
revoke all on function public.current_person_can_edit_topic_checklist(uuid,uuid) from public,anon;
grant execute on function public.current_person_can_edit_topic_checklist(uuid,uuid) to authenticated;

create function public.set_student_topic_mark(p_enrollment_id uuid,p_topic_id uuid,p_studied boolean)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$ begin
  if p_studied is null then raise exception using errcode='22023',message='explicit study choice required'; end if;
  -- Serializes with course closeout. Authorization is checked after acquiring the lock.
  perform 1 from public.enrollments where id=p_enrollment_id for share;
  if not public.current_person_can_edit_topic_checklist(p_enrollment_id,p_topic_id) then
    raise exception using errcode='42501',message='private study checklist unavailable'; end if;
  if p_studied then
    insert into public.student_topic_marks(enrollment_id,topic_id) values(p_enrollment_id,p_topic_id)
    on conflict(enrollment_id,topic_id) do nothing;
  else
    delete from public.student_topic_marks where enrollment_id=p_enrollment_id and topic_id=p_topic_id;
  end if;
end $$;
revoke all on function public.set_student_topic_mark(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_student_topic_mark(uuid,uuid,boolean) to authenticated;

create function public.list_student_topic_checklist()
returns jsonb language sql volatile security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(item order by title,enrollment),'[]'::jsonb) from (
  select o.title title,e.id enrollment,jsonb_build_object(
    'enrollmentId',e.id,'offeringTitle',o.title,'readOnly',e.status<>'active',
    'expiresAt',case when e.status<>'active' then e.ended_at+interval '12 months' else null end,
    'topics',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'sectionTitle',s.title,'markedAt',m.marked_at) order by s.position,t.position)
      from public.curriculum_sections s join public.curriculum_topics t on t.section_id=s.id
      left join public.student_topic_marks m on m.enrollment_id=e.id and m.topic_id=t.id
      where s.curriculum_version_id=v.id),'[]'::jsonb)) item
  from public.enrollments e join public.offerings o on o.id=e.offering_id
  left join public.cohorts c on c.id=e.cohort_id
  join public.curriculum_versions v on v.id=coalesce(e.curriculum_version_id,c.curriculum_version_id) and v.offering_id=e.offering_id
  where public.current_person_has_active_student_membership() and e.person_id=public.current_person_id()
    and ((e.status='active' and e.ended_at is null and o.status='active' and (e.cohort_id is null or c.status='active') and v.status='published')
      or public.current_person_can_read_work_archive(e.id))
) eligible $$;
revoke all on function public.list_student_topic_checklist() from public,anon;
grant execute on function public.list_student_topic_checklist() to authenticated;

create function public.purge_expired_student_topic_marks(p_limit integer default 500)
returns integer language plpgsql security definer set search_path='' set row_security=off
as $$ declare removed integer; begin
  if p_limit is null or p_limit<1 or p_limit>1000 then raise exception using errcode='22023',message='bounded purge limit required'; end if;
  with expired as(select m.enrollment_id,m.topic_id from public.student_topic_marks m join public.enrollments e on e.id=m.enrollment_id
    where e.status in ('completed','withdrawn') and e.ended_at+interval '12 months'<=clock_timestamp()
    order by e.ended_at,m.enrollment_id,m.topic_id limit p_limit for update of m skip locked)
  delete from public.student_topic_marks m using expired x where m.enrollment_id=x.enrollment_id and m.topic_id=x.topic_id;
  get diagnostics removed=row_count; return removed;
end $$;
revoke all on function public.purge_expired_student_topic_marks(integer) from public,anon,authenticated;
grant execute on function public.purge_expired_student_topic_marks(integer) to service_role;
comment on table public.student_topic_marks is 'Private explicit student self-report; unmark deletes current mark, no passive engagement history or academic achievement claim. Expired ended-course marks are purged.';
