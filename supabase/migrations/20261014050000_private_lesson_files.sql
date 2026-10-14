create table public.lesson_file_assets (
 id uuid primary key default gen_random_uuid(),
 reserved_lesson_id uuid not null,
 creator_person_id uuid not null references public.people(id),
 object_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 180 and file_name !~ '[[:cntrl:]/\\]'),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 byte_size integer not null check(byte_size between 1 and 10485760),
 state text not null default 'reserved' check(state in ('reserved','abandoned','ready','deleting','deleted')),
 created_at timestamptz not null default now(),
 deleted_at timestamptz
);
create table public.lesson_materials (
 lesson_id uuid not null references public.curriculum_lessons(id) on delete cascade,
 asset_id uuid not null references public.lesson_file_assets(id),
 primary key(lesson_id,asset_id)
);
alter table public.lesson_file_assets enable row level security;
alter table public.lesson_materials enable row level security;
revoke all on public.lesson_file_assets,public.lesson_materials from anon,authenticated;
grant select(id,file_name,mime_type,byte_size,state) on public.lesson_file_assets to authenticated;
grant select on public.lesson_materials to authenticated;
grant all on public.lesson_file_assets,public.lesson_materials to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('lesson-materials','lesson-materials',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp']);
-- No browser Storage policy: all object operations use trusted handling.
create function public.lesson_version_id(p_lesson uuid) returns uuid
language sql stable security definer set search_path='' set row_security=off
as $$ select s.curriculum_version_id from public.curriculum_lessons l join public.curriculum_topics t on t.id=l.topic_id join public.curriculum_sections s on s.id=t.section_id where l.id=p_lesson $$;
create function public.can_read_lesson_material(p_lesson uuid) returns boolean
language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(public.current_person_can_read_curriculum(v.id) or public.current_person_can_manage_content(v.offering_id) or public.current_person_can_publish_content(v.offering_id),false) from public.curriculum_versions v where v.id=public.lesson_version_id(p_lesson) $$;
revoke all on function public.lesson_version_id(uuid),public.can_read_lesson_material(uuid) from public,anon;
revoke all on function public.lesson_version_id(uuid) from authenticated;
grant execute on function public.lesson_version_id(uuid) to service_role;
grant execute on function public.can_read_lesson_material(uuid) to authenticated,service_role;
create policy lesson_materials_read on public.lesson_materials for select to authenticated using(public.can_read_lesson_material(lesson_id));
create policy lesson_assets_read on public.lesson_file_assets for select to authenticated using(state='ready' and exists(select 1 from public.lesson_materials m where m.asset_id=id and public.can_read_lesson_material(m.lesson_id)));

create function public.guard_lesson_material() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions; a public.lesson_file_assets; target uuid;
begin
 target:=case when tg_op='DELETE' then old.lesson_id else new.lesson_id end;
 select * into v from public.curriculum_versions where id=public.lesson_version_id(target) for update;
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(v.offering_id) then raise exception using errcode='42501',message='draft lesson file access denied'; end if;
 if tg_op='DELETE' then return old; end if;
 if tg_op='UPDATE' then raise exception using errcode='55000',message='replace lesson file references deliberately'; end if;
 select * into a from public.lesson_file_assets where id=new.asset_id for share;
 if a.id is null or a.state<>'ready' then raise exception using errcode='55000',message='file unavailable'; end if;
 if not public.current_person_can_manage_content(v.offering_id) then raise exception using errcode='42501',message='draft access changed while waiting for file'; end if;
 if (select count(*) from public.lesson_materials where lesson_id=target)>=5 then raise exception using errcode='23514',message='lesson file limit reached'; end if;
 return new;
end $$;
revoke all on function public.guard_lesson_material() from public,anon,authenticated;
create trigger lesson_material_guard before insert or update or delete on public.lesson_materials for each row execute function public.guard_lesson_material();

create function public.reserve_lesson_file(p_lesson_id uuid,p_file_name text,p_mime_type text,p_byte_size integer)
returns table(file_id uuid,object_path text) language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions; a uuid:=gen_random_uuid(); path text;
begin
 select * into v from public.curriculum_versions where id=public.lesson_version_id(p_lesson_id) for update;
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(v.offering_id) then raise exception using errcode='42501',message='draft lesson file access denied'; end if;
 if (select count(*) from (select asset_id from public.lesson_materials where lesson_id=p_lesson_id union select id from public.lesson_file_assets where reserved_lesson_id=p_lesson_id and state in ('reserved','abandoned','ready') and created_at>now()-interval '30 days' and not exists(select 1 from public.lesson_materials where asset_id=lesson_file_assets.id)) slots)>=5 then raise exception using errcode='23514',message='lesson file limit reached'; end if;
 path:=a::text;
 insert into public.lesson_file_assets(id,reserved_lesson_id,creator_person_id,object_path,file_name,mime_type,byte_size) values(a,p_lesson_id,public.current_person_id(),path,p_file_name,p_mime_type,p_byte_size);
 return query select a,path;
end $$;
create function public.complete_lesson_upload(p_file_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
 update public.lesson_file_assets set state='ready' where id=p_file_id and state='reserved';
 if not found then raise exception using errcode='55000',message='upload unavailable'; end if;
end $$;
create function public.attach_lesson_file(p_file_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare a public.lesson_file_assets; v public.curriculum_versions;
begin
 select * into a from public.lesson_file_assets where id=p_file_id;
 select * into v from public.curriculum_versions where id=public.lesson_version_id(a.reserved_lesson_id) for update;
 if a.creator_person_id is distinct from public.current_person_id() or v.id is null or not public.current_person_can_manage_content(v.offering_id) or v.status<>'draft' then raise exception using errcode='42501',message='draft lesson file access denied'; end if;
 insert into public.lesson_materials(lesson_id,asset_id) values(a.reserved_lesson_id,a.id);
end $$;
create function public.remove_lesson_file(p_lesson_id uuid,p_file_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.curriculum_versions;
begin
 select * into v from public.curriculum_versions where id=public.lesson_version_id(p_lesson_id) for update;
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(v.offering_id) then raise exception using errcode='42501',message='draft lesson file access denied'; end if;
 delete from public.lesson_materials where lesson_id=p_lesson_id and asset_id=p_file_id;
end $$;
create function public.get_lesson_file(p_lesson_id uuid,p_file_id uuid) returns table(object_path text,file_name text) language sql stable security definer set search_path='' set row_security=off as $$
 select a.object_path,a.file_name from public.lesson_materials m join public.lesson_file_assets a on a.id=m.asset_id where m.lesson_id=p_lesson_id and m.asset_id=p_file_id and a.state='ready' and public.can_read_lesson_material(p_lesson_id)
$$;
revoke all on function public.reserve_lesson_file(uuid,text,text,integer),public.attach_lesson_file(uuid),public.remove_lesson_file(uuid,uuid),public.get_lesson_file(uuid,uuid) from public,anon;
grant execute on function public.reserve_lesson_file(uuid,text,text,integer),public.attach_lesson_file(uuid),public.remove_lesson_file(uuid,uuid),public.get_lesson_file(uuid,uuid) to authenticated;
revoke all on function public.complete_lesson_upload(uuid) from public,anon,authenticated;
grant execute on function public.complete_lesson_upload(uuid) to service_role;

create function public.list_lesson_files(p_lesson_id uuid) returns table(id uuid,file_name text,mime_type text,byte_size integer) language sql stable security definer set search_path='' set row_security=off as $$
 select a.id,a.file_name,a.mime_type,a.byte_size from public.lesson_materials m join public.lesson_file_assets a on a.id=m.asset_id where m.lesson_id=p_lesson_id and a.state='ready' and public.can_read_lesson_material(p_lesson_id) order by a.created_at,a.id
$$;
revoke all on function public.list_lesson_files(uuid) from public,anon;
grant execute on function public.list_lesson_files(uuid) to authenticated;
create function public.abandon_lesson_upload(p_file_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
 perform 1 from public.lesson_file_assets where id=p_file_id for update;
 if exists(select 1 from public.lesson_materials where asset_id=p_file_id) then return; end if;
 update public.lesson_file_assets set state=case when state='reserved' then 'abandoned' else 'deleting' end where id=p_file_id and state in ('reserved','ready');
end $$;
revoke all on function public.abandon_lesson_upload(uuid) from public,anon,authenticated;
grant execute on function public.abandon_lesson_upload(uuid) to service_role;

-- Clone references by stable section/topic/lesson codes, not filenames or object paths.
create function public.copy_lesson_material_references() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
declare source_lesson uuid; source_version uuid; source_offering uuid; target_offering uuid;
begin
 select v.source_curriculum_version_id,v.offering_id into source_version,target_offering from public.curriculum_versions v where v.id=public.lesson_version_id(new.id);
 if source_version is null then return new; end if;
 select offering_id into source_offering from public.curriculum_versions where id=source_version;
 if source_offering is distinct from target_offering then raise exception using errcode='23514',message='curriculum copy offering mismatch'; end if;
 select l.id into source_lesson from public.curriculum_lessons l join public.curriculum_topics t on t.id=l.topic_id join public.curriculum_sections s on s.id=t.section_id where s.curriculum_version_id=source_version and l.code=new.code and t.code=(select code from public.curriculum_topics where id=new.topic_id) and s.code=(select s2.code from public.curriculum_sections s2 join public.curriculum_topics t2 on t2.section_id=s2.id where t2.id=new.topic_id);
 if exists(select 1 from public.lesson_materials m join public.lesson_file_assets a on a.id=m.asset_id where m.lesson_id=source_lesson and a.state<>'ready') then raise exception using errcode='55000',message='source lesson files unavailable for exact copy'; end if;
 -- Copy every reference: the per-row guard locks/rechecks assets, so a concurrent purge
 -- cannot silently omit a reference between the precheck and this statement.
 insert into public.lesson_materials(lesson_id,asset_id) select new.id,m.asset_id from public.lesson_materials m where m.lesson_id=source_lesson;
 return new;
end $$;
revoke all on function public.copy_lesson_material_references() from public,anon,authenticated;
create trigger lesson_material_copy after insert on public.curriculum_lessons for each row execute function public.copy_lesson_material_references();

create function public.detach_deleted_draft_lesson_files() returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
begin
 -- Parent remains visible here, so the reference guard can verify draft scope before cascade.
 delete from public.lesson_materials where lesson_id=old.id;
 return old;
end $$;
revoke all on function public.detach_deleted_draft_lesson_files() from public,anon,authenticated;
create trigger lesson_files_before_delete before delete on public.curriculum_lessons for each row execute function public.detach_deleted_draft_lesson_files();

create function public.lesson_asset_due_for_purge(p_file_id uuid) returns boolean language plpgsql security definer set search_path='' set row_security=off as $$
declare f public.lesson_file_assets;
begin
 select * into f from public.lesson_file_assets where id=p_file_id;
 if f.id is null then return false; end if;
 if f.state='deleting' then return true; end if;
 if f.state not in ('reserved','abandoned','ready') then return false; end if;
 if not exists(select 1 from public.lesson_materials where asset_id=f.id) then return f.created_at<now()-interval '30 days'; end if;
 return not exists(
  select 1 from public.lesson_materials m join public.curriculum_versions v on v.id=public.lesson_version_id(m.lesson_id)
  where m.asset_id=f.id and (
   v.status<>'retired' or v.retired_at>now()-interval '12 months'
   or exists(select 1 from public.cohorts c where c.curriculum_version_id=v.id and c.status='active')
   or exists(select 1 from public.enrollments e left join public.cohorts c on c.id=e.cohort_id where e.status='active' and coalesce(e.curriculum_version_id,c.curriculum_version_id)=v.id)
  )
 );
end $$;
revoke all on function public.lesson_asset_due_for_purge(uuid) from public,anon,authenticated;
grant execute on function public.lesson_asset_due_for_purge(uuid) to service_role;
create function public.claim_lesson_files_for_purge(p_limit integer default 100) returns table(file_id uuid,object_path text) language plpgsql security definer set search_path='' set row_security=off as $$
declare a public.lesson_file_assets;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='23514',message='invalid purge limit'; end if;
 for a in select * from public.lesson_file_assets f where public.lesson_asset_due_for_purge(f.id) order by f.created_at limit p_limit for update skip locked loop
  -- Fresh statement after asset lock: a committed shared/draft reference changes eligibility.
  if not public.lesson_asset_due_for_purge(a.id) then continue; end if;
  update public.lesson_file_assets set state='deleting' where id=a.id;
  return query select a.id,a.object_path;
 end loop;
end $$;
create function public.complete_lesson_file_purge(p_file_id uuid) returns void language plpgsql security definer set search_path='' set row_security=off as $$
begin
 update public.lesson_file_assets set state='deleted',deleted_at=now() where id=p_file_id and state='deleting';
 if not found then raise exception using errcode='55000',message='purge unavailable'; end if;
end $$;
revoke all on function public.claim_lesson_files_for_purge(integer),public.complete_lesson_file_purge(uuid) from public,anon,authenticated;
grant execute on function public.claim_lesson_files_for_purge(integer),public.complete_lesson_file_purge(uuid) to service_role;
create index lesson_materials_asset_idx on public.lesson_materials(asset_id);
create index lesson_assets_creator_idx on public.lesson_file_assets(creator_person_id);
create index lesson_assets_reserved_idx on public.lesson_file_assets(reserved_lesson_id,state);

-- Existing D-015 scoped editors must pass the workspace entrance without a global grant.
-- This is only a boolean entry check; each data/action remains offering-scoped under RLS/RPC.
create function public.current_person_can_open_content_workspace() returns boolean language sql stable security definer set search_path='' set row_security=off as $$
 select coalesce(public.current_person_has_capability('content.manage_drafts') or exists(select 1 from public.offerings o where public.current_person_can_manage_content(o.id)),false)
$$;
revoke all on function public.current_person_can_open_content_workspace() from public,anon;
grant execute on function public.current_person_can_open_content_workspace() to authenticated;
