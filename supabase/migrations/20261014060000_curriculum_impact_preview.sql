insert into public.capabilities(key,description) values('curriculum.upgrade_preview','Read-only curriculum differences and aggregate affected enrolments within an explicit offering grant.');
-- No automatic grant and no migration/write endpoint.
create function public.can_preview_curriculum_upgrade(p_offering_id uuid) returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(public.current_person_has_active_employee_membership()
 and public.current_person_can_publish_content(p_offering_id)
 and (public.current_person_has_capability('enrollment.operate') or public.current_person_has_capability('enrollment.operate','offering',p_offering_id))
 and public.current_person_has_capability('curriculum.upgrade_preview','offering',p_offering_id)
 and exists(select 1 from public.capability_grants g join public.role_assignments r on r.person_id=g.person_id and r.role_key=g.required_role_key and r.scope_type='offering' and r.scope_id=g.scope_id
  where g.person_id=public.current_person_id() and g.capability_key='curriculum.upgrade_preview' and g.scope_type='offering' and g.scope_id=p_offering_id
  and g.revoked_at is null and g.starts_at<=clock_timestamp() and (g.ends_at is null or g.ends_at>clock_timestamp())
  and r.revoked_at is null and r.starts_at<=clock_timestamp() and (r.ends_at is null or r.ends_at>clock_timestamp())),false)
$$;
revoke all on function public.can_preview_curriculum_upgrade(uuid) from public,anon;
grant execute on function public.can_preview_curriculum_upgrade(uuid) to authenticated;

create function public.list_curriculum_preview_context() returns jsonb language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'versions',
 (select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'number',v.version_number) order by v.version_number),'[]'::jsonb) from public.curriculum_versions v where v.offering_id=o.id and v.status='published')) order by o.title,o.id),'[]'::jsonb)
 from public.offerings o where o.status='active' and public.can_preview_curriculum_upgrade(o.id)
$$;
revoke all on function public.list_curriculum_preview_context() from public,anon;
grant execute on function public.list_curriculum_preview_context() to authenticated;

create function public.preview_curriculum_upgrade(p_offering_id uuid,p_source_id uuid,p_target_id uuid) returns jsonb language plpgsql security definer set search_path='' set row_security=off as $$
declare result jsonb;
begin
 if not public.can_preview_curriculum_upgrade(p_offering_id) then raise exception using errcode='42501',message='curriculum preview denied'; end if;
 if p_source_id is null or p_target_id is null or p_source_id=p_target_id or not exists(select 1 from public.offerings where id=p_offering_id and status='active')
 or (select count(*) from public.curriculum_versions where id in(p_source_id,p_target_id) and offering_id=p_offering_id and status='published')<>2 then raise exception using errcode='42501',message='curriculum preview unavailable'; end if;
 with entries as (
  select s.curriculum_version_id version_id,'topic'::text kind,s.code||'/'||t.code code,t.title title,
   jsonb_build_array(s.title,s.description,s.position,t.title,t.summary,t.position)::text signature
   from public.curriculum_sections s join public.curriculum_topics t on t.section_id=s.id where s.curriculum_version_id in(p_source_id,p_target_id)
  union all
  select s.curriculum_version_id,'lesson',s.code||'/'||t.code||'/'||l.code,l.title,
   jsonb_build_array(l.title,l.summary,l.body_markdown,l.position)::text
   from public.curriculum_sections s join public.curriculum_topics t on t.section_id=s.id join public.curriculum_lessons l on l.topic_id=t.id where s.curriculum_version_id in(p_source_id,p_target_id)
  union all
  select s.curriculum_version_id,'material',s.code||'/'||t.code||'/'||l.code,l.title,
   (select coalesce(jsonb_agg(m.asset_id order by m.asset_id),'[]'::jsonb)::text from public.lesson_materials m where m.lesson_id=l.id)
   from public.curriculum_sections s join public.curriculum_topics t on t.section_id=s.id join public.curriculum_lessons l on l.topic_id=t.id where s.curriculum_version_id in(p_source_id,p_target_id)
 ), source as(select * from entries where version_id=p_source_id), target as(select * from entries where version_id=p_target_id), differences as (
 select coalesce(t.kind,s.kind) kind,coalesce(t.code,s.code) code,coalesce(t.title,s.title) title,
 case when s.version_id is null then 'added' when t.version_id is null then 'removed' else 'changed' end change
 from source s full join target t on t.kind=s.kind and t.code=s.code
 where s.version_id is null or t.version_id is null or s.signature is distinct from t.signature
 -- Empty attachment lists on an added/removed lesson are not material changes.
 ), filtered as(select * from differences d where d.kind<>'material' or exists(select 1 from entries e where e.kind=d.kind and e.code=d.code and e.signature<>'[]')),
 affected as(
 select e.cohort_id from public.enrollments e left join public.cohorts c on c.id=e.cohort_id and c.offering_id=e.offering_id
 where e.offering_id=p_offering_id and e.status='active'
 and ((e.cohort_id is null and e.curriculum_version_id=p_source_id) or (e.cohort_id is not null and c.status='active' and c.curriculum_version_id=p_source_id))
 )
 select jsonb_build_object('sourceId',p_source_id,'targetId',p_target_id,
 'affected',jsonb_build_object('direct',(select count(*) from affected where cohort_id is null),'cohort',(select count(*) from affected where cohort_id is not null),'total',(select count(*) from affected)),
 'counts',jsonb_build_object('added',(select count(*) from filtered where change='added'),'removed',(select count(*) from filtered where change='removed'),'changed',(select count(*) from filtered where change='changed'),'total',(select count(*) from filtered)),
 'truncated',(select count(*)>100 from filtered),
 'differences',(select coalesce(jsonb_agg(to_jsonb(d) order by kind,code),'[]'::jsonb) from(select kind,code,title,change from filtered order by kind,code limit 100)d)) into result;
 if not public.can_preview_curriculum_upgrade(p_offering_id) then raise exception using errcode='42501',message='curriculum preview denied'; end if;
 if not exists(select 1 from public.offerings where id=p_offering_id and status='active') or (select count(*) from public.curriculum_versions where id in(p_source_id,p_target_id) and offering_id=p_offering_id and status='published')<>2 then raise exception using errcode='42501',message='curriculum preview unavailable'; end if;
 return result;
end $$;
revoke all on function public.preview_curriculum_upgrade(uuid,uuid,uuid) from public,anon;
grant execute on function public.preview_curriculum_upgrade(uuid,uuid,uuid) to authenticated;
