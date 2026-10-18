-- D-050 B reuses separately granted content capabilities. Teacher role alone grants nothing.
create function public.get_content_offering_permissions()
returns table(offering_id uuid,can_edit boolean,can_publish boolean)
language sql stable security definer set search_path='' set row_security=off as $$
 select o.id,public.current_person_can_manage_content(o.id),public.current_person_can_publish_content(o.id)
 from public.offerings o where public.current_person_can_manage_content(o.id) or public.current_person_can_publish_content(o.id)
$$;
create or replace function public.current_person_can_open_content_workspace() returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
 select exists(select 1 from public.get_content_offering_permissions())
$$;
create function public.current_person_can_open_teacher_content() returns boolean
language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(public.current_person_has_active_employee_membership() and exists(
  select 1 from public.get_content_offering_permissions() p where public.current_person_has_role('teacher') or public.current_person_has_role('teacher','offering',p.offering_id)
 ),false)
$$;

-- Descriptions belong to references, not shared bytes. No browser writes.
create table public.content_file_labels (
 id uuid primary key default gen_random_uuid(),
 lesson_id uuid references public.curriculum_lessons(id) on delete cascade,
 asset_id uuid references public.lesson_file_assets(id),
 assignment_material_id uuid references public.assignment_materials(id) on delete cascade,
 label text not null check(length(btrim(label)) between 1 and 180 and label !~ '[[:cntrl:]]'),
 check((lesson_id is not null and asset_id is not null and assignment_material_id is null) or
       (lesson_id is null and asset_id is null and assignment_material_id is not null)),
 unique(lesson_id,asset_id),unique(assignment_material_id)
);
alter table public.content_file_labels enable row level security;
revoke all on public.content_file_labels from public,anon,authenticated;
grant select on public.content_file_labels to authenticated;
grant all on public.content_file_labels to service_role;
create policy content_labels_read on public.content_file_labels for select to authenticated using(
 (lesson_id is not null and public.can_read_lesson_material(lesson_id) and exists(select 1 from public.lesson_materials m where m.lesson_id=content_file_labels.lesson_id and m.asset_id=content_file_labels.asset_id))
 or (assignment_material_id is not null and exists(select 1 from public.assignment_materials m where m.id=assignment_material_id))
);

create function public.set_content_file_label(p_kind text,p_parent_id uuid,p_file_id uuid,p_label text)
returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions; av public.assignment_versions;
begin
 if p_label is null or length(btrim(p_label)) not between 1 and 180 or p_label ~ '[[:cntrl:]]' then raise exception using errcode='22023',message='attachment name must be 1 to 180 characters'; end if;
 if p_kind='lesson' then
  select * into v from public.curriculum_versions where id=public.lesson_version_id(p_parent_id) for update;
  if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(v.offering_id) or not exists(select 1 from public.lesson_materials where lesson_id=p_parent_id and asset_id=p_file_id) then raise exception using errcode='42501',message='draft attachment access denied'; end if;
  insert into public.content_file_labels(lesson_id,asset_id,label) values(p_parent_id,p_file_id,btrim(p_label)) on conflict(lesson_id,asset_id) do update set label=excluded.label;
 elsif p_kind='assignment' then
  select * into av from public.assignment_versions where id=p_parent_id for update;
  if av.id is null or av.status<>'draft' or not public.current_person_can_manage_content(public.assignment_version_offering_id(av.id)) or not exists(select 1 from public.assignment_materials where id=p_file_id and assignment_version_id=av.id) then raise exception using errcode='42501',message='draft attachment access denied'; end if;
  insert into public.content_file_labels(assignment_material_id,label) values(p_file_id,btrim(p_label)) on conflict(assignment_material_id) do update set label=excluded.label;
 else raise exception using errcode='22023',message='invalid attachment kind'; end if;
 insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata) values(public.current_person_id(),public.current_person_id(),'content_file_label_saved','succeeded','content_draft_change',jsonb_build_object('kind',p_kind,'parent_id',p_parent_id,'file_id',p_file_id));
end $$;

create function public.list_named_lesson_files(p_lesson_id uuid)
returns table(id uuid,file_name text,mime_type text,byte_size integer,display_name text)
language sql stable security definer set search_path='' set row_security=off as $$
 select f.id,f.file_name,f.mime_type,f.byte_size,coalesce(n.label,f.file_name)
 from public.list_lesson_files(p_lesson_id) f left join public.content_file_labels n on n.lesson_id=p_lesson_id and n.asset_id=f.id
$$;
create function public.copy_lesson_file_label() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
begin
 insert into public.content_file_labels(lesson_id,asset_id,label)
 select new.lesson_id,new.asset_id,n.label from public.curriculum_lessons target
 join public.curriculum_topics tt on tt.id=target.topic_id join public.curriculum_sections ts on ts.id=tt.section_id
 join public.curriculum_versions tv on tv.id=ts.curriculum_version_id
 join public.curriculum_sections ss on ss.curriculum_version_id=tv.source_curriculum_version_id and ss.code=ts.code
 join public.curriculum_topics st on st.section_id=ss.id and st.code=tt.code
 join public.curriculum_lessons source on source.topic_id=st.id and source.code=target.code
 join public.content_file_labels n on n.lesson_id=source.id and n.asset_id=new.asset_id
 where target.id=new.lesson_id on conflict(lesson_id,asset_id) do nothing;
 return new;
end $$;
create trigger lesson_file_label_copy after insert on public.lesson_materials for each row execute function public.copy_lesson_file_label();
create function public.detach_lesson_file_label() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
begin
 delete from public.content_file_labels where lesson_id=old.lesson_id and asset_id=old.asset_id;
 return old;
end $$;
create trigger lesson_file_label_detach after delete on public.lesson_materials for each row execute function public.detach_lesson_file_label();
revoke all on function public.detach_lesson_file_label() from public,anon,authenticated;

-- Topic-only attachments use a normal material lesson, visible in existing student coursework.
create function public.ensure_topic_material_lesson(p_topic_id uuid) returns uuid
language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions; result uuid;
begin
 select cv.* into v from public.curriculum_versions cv join public.curriculum_sections s on s.curriculum_version_id=cv.id join public.curriculum_topics t on t.section_id=s.id where t.id=p_topic_id for update of cv;
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(v.offering_id) then raise exception using errcode='42501',message='draft topic access denied'; end if;
 select id into result from public.curriculum_lessons where topic_id=p_topic_id and code='TOPIC_MATERIALS';
 if result is null then
  insert into public.curriculum_lessons(topic_id,code,title,position) select p_topic_id,'TOPIC_MATERIALS','Topic attachments',coalesce(max(position),0)+1 from public.curriculum_lessons where topic_id=p_topic_id returning id into result;
 end if;
 return result;
end $$;

create function public.preview_draft_topic_removal(p_topic_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions;
begin
 select cv.* into v from public.curriculum_versions cv join public.curriculum_sections s on s.curriculum_version_id=cv.id join public.curriculum_topics t on t.section_id=s.id where t.id=p_topic_id;
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(v.offering_id) then raise exception using errcode='42501',message='draft topic access denied'; end if;
 return jsonb_build_object('lessons',(select count(*) from public.curriculum_lessons where topic_id=p_topic_id),'files',(select count(*) from public.lesson_materials m join public.curriculum_lessons l on l.id=m.lesson_id where l.topic_id=p_topic_id),'linkedAssignments',(select count(*) from public.assignment_topic_links where topic_id=p_topic_id));
end $$;
create function public.unlink_draft_topic_assignment(p_topic_id uuid,p_assignment_version_id uuid) returns void
language plpgsql security definer set search_path='' set row_security=off as $$
declare av public.assignment_versions;
begin
 perform public.preview_draft_topic_removal(p_topic_id);
 select * into av from public.assignment_versions where id=p_assignment_version_id for update;
 if av.id is null or av.status<>'draft' or not public.current_person_can_manage_content(public.assignment_version_offering_id(av.id)) then raise exception using errcode='42501',message='draft assignment access denied'; end if;
 delete from public.assignment_topic_links where topic_id=p_topic_id and assignment_version_id=av.id;
 insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata) values(public.current_person_id(),public.current_person_id(),'draft_topic_assignment_unlinked','succeeded','content_draft_change',jsonb_build_object('topic_id',p_topic_id,'assignment_version_id',av.id));
end $$;
revoke all on function public.unlink_draft_topic_assignment(uuid,uuid) from public,anon;
grant execute on function public.unlink_draft_topic_assignment(uuid,uuid) to authenticated;
create function public.remove_draft_topic(p_topic_id uuid,p_expected jsonb) returns void
language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions; impact jsonb;
begin
 select cv.* into v from public.curriculum_versions cv join public.curriculum_sections s on s.curriculum_version_id=cv.id join public.curriculum_topics t on t.section_id=s.id where t.id=p_topic_id for update of cv;
 impact:=public.preview_draft_topic_removal(p_topic_id);
 if impact is distinct from p_expected then raise exception using errcode='55000',message='topic changed; preview removal again'; end if;
 if (impact->>'linkedAssignments')::int<>0 then raise exception using errcode='23514',message='unlink assignments before removing topic'; end if;
 delete from public.lesson_materials m using public.curriculum_lessons l where m.lesson_id=l.id and l.topic_id=p_topic_id;
 delete from public.curriculum_lessons where topic_id=p_topic_id;
 delete from public.curriculum_topics where id=p_topic_id;
 insert into public.security_audit_events(subject_person_id,actor_person_id,event_type,outcome,reason_code,metadata) values(public.current_person_id(),public.current_person_id(),'draft_topic_removed','succeeded','content_draft_change',jsonb_build_object('topic_id',p_topic_id,'curriculum_version_id',v.id,'impact',impact));
end $$;
-- Serialize direct child edits/insertions with the impact check and publication.
create function public.lock_content_draft_parent() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
declare old_version uuid; new_version uuid;
begin
 if tg_table_name='curriculum_topics' then
  if tg_op<>'INSERT' then select curriculum_version_id into old_version from public.curriculum_sections where id=old.section_id; end if;
  if tg_op<>'DELETE' then select curriculum_version_id into new_version from public.curriculum_sections where id=new.section_id; end if;
 else
  if tg_op<>'INSERT' then select s.curriculum_version_id into old_version from public.curriculum_topics t join public.curriculum_sections s on s.id=t.section_id where t.id=old.topic_id; end if;
  if tg_op<>'DELETE' then select s.curriculum_version_id into new_version from public.curriculum_topics t join public.curriculum_sections s on s.id=t.section_id where t.id=new.topic_id; end if;
 end if;
 perform 1 from public.curriculum_versions where id in(old_version,new_version) order by id for update;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger aa_topic_parent_lock before insert or update or delete on public.curriculum_topics for each row execute function public.lock_content_draft_parent();
create trigger aa_lesson_parent_lock before insert or update or delete on public.curriculum_lessons for each row execute function public.lock_content_draft_parent();
revoke all on function public.lock_content_draft_parent() from public,anon,authenticated;
revoke all on function public.get_content_offering_permissions(),public.set_content_file_label(text,uuid,uuid,text),public.list_named_lesson_files(uuid),public.ensure_topic_material_lesson(uuid),public.preview_draft_topic_removal(uuid),public.remove_draft_topic(uuid,jsonb) from public,anon;
grant execute on function public.get_content_offering_permissions(),public.set_content_file_label(text,uuid,uuid,text),public.list_named_lesson_files(uuid),public.ensure_topic_material_lesson(uuid),public.preview_draft_topic_removal(uuid),public.remove_draft_topic(uuid,jsonb) to authenticated;
revoke all on function public.copy_lesson_file_label() from public,anon,authenticated;
revoke all on function public.current_person_can_open_teacher_content() from public,anon;
grant execute on function public.current_person_can_open_teacher_content() to authenticated;

-- Only attached references, under existing assigned-version authority, can be downloaded.
create or replace function public.current_person_can_read_assignment_object(p_object_name text)
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select exists(select 1 from public.assignment_materials m where m.object_path=p_object_name and (
  public.current_person_can_manage_content(public.assignment_version_offering_id(m.assignment_version_id))
  or public.current_person_can_publish_content(public.assignment_version_offering_id(m.assignment_version_id))
  or public.current_person_can_read_distributed_assignment_version(m.assignment_version_id)
 ))
$$;
create function public.list_assignment_reference_files(p_version_id uuid)
returns table(id uuid,file_name text,display_name text,object_path text)
language sql stable security definer set search_path='' set row_security=off as $$
 select m.id,m.original_file_name,coalesce(n.label,m.original_file_name),m.object_path
 from public.assignment_materials m left join public.content_file_labels n on n.assignment_material_id=m.id
 where m.assignment_version_id=p_version_id and public.current_person_can_read_assignment_object(m.object_path) order by m.position
$$;
create function public.assignment_reference_version_for_instance(p_instance_id uuid) returns uuid
language sql stable security definer set search_path='' set row_security=off as $$
 select r.assignment_version_id from public.student_assignment_instances i join public.assignment_releases r on r.id=i.assignment_release_id
 where i.id=p_instance_id and (public.current_person_can_access_assignment_instance(i.id) or public.current_person_can_review_assignment_instance(i.id))
$$;
revoke all on function public.list_assignment_reference_files(uuid),public.assignment_reference_version_for_instance(uuid) from public,anon;
grant execute on function public.list_assignment_reference_files(uuid),public.assignment_reference_version_for_instance(uuid) to authenticated;
