-- D-044 B: only newly reserved paths are eligible. Never adopt legacy objects.
create table public.assignment_upload_reservations (
 id uuid primary key,
 assignment_version_id uuid not null references public.assignment_versions(id),
 creator_person_id uuid not null references public.people(id),
 object_path text not null unique,
 file_name text not null check(length(file_name) between 1 and 180 and file_name !~ '[[:cntrl:]/\\]'),
 mime_type text not null check(mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
 byte_size integer not null check(byte_size between 1 and 10485760),
 state text not null default 'reserved' check(state in ('reserved','attached','quarantined','deleting','deleted')),
 created_at timestamptz not null default now(),
 deleted_at timestamptz,
 last_checked_at timestamptz,
 cleanup_hold boolean not null default false
);
alter table public.assignment_upload_reservations enable row level security;
revoke all on public.assignment_upload_reservations from anon,authenticated;
grant all on public.assignment_upload_reservations to service_role;
create index assignment_upload_version_idx on public.assignment_upload_reservations(assignment_version_id);
create index assignment_upload_creator_idx on public.assignment_upload_reservations(creator_person_id);

create function public.reserve_assignment_upload(p_request_id uuid,p_version_id uuid,p_file_name text,p_mime_type text,p_byte_size integer)
returns table(upload_id uuid,object_path text,state text)
language plpgsql security definer set search_path='' set row_security=off as $$
declare v public.assignment_versions; r public.assignment_upload_reservations; offering uuid; ext text;
begin
 select * into v from public.assignment_versions where id=p_version_id for update;
 offering:=public.assignment_version_offering_id(p_version_id);
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(offering) then
  raise exception using errcode='42501',message='draft upload access denied';
 end if;
 select * into r from public.assignment_upload_reservations where id=p_request_id;
 if found then
  if r.creator_person_id is distinct from public.current_person_id() or r.assignment_version_id<>p_version_id
    or r.file_name<>p_file_name or r.mime_type<>p_mime_type or r.byte_size<>p_byte_size then
   raise exception using errcode='42501',message='upload request mismatch';
  end if;
  return query select r.id,r.object_path,r.state; return;
 end if;
 if p_request_id is null or p_file_name is null or p_mime_type is null or p_byte_size is null then
  raise exception using errcode='23514',message='invalid upload metadata';
 end if;
 ext:=case p_mime_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' end;
 if ext is null or not (lower(p_file_name) ~ case when ext='jpg' then '\.(jpg|jpeg)$' else '\.'||ext||'$' end) then
  raise exception using errcode='23514',message='invalid upload metadata';
 end if;
 if (select count(*) from public.assignment_materials where assignment_version_id=p_version_id)
  +(select count(*) from public.assignment_upload_reservations a where a.assignment_version_id=p_version_id and a.state in ('reserved','quarantined') and not exists(select 1 from public.assignment_materials m where m.object_path=a.object_path))>=5 then
  raise exception using errcode='23514',message='assignment file limit reached';
 end if;
 insert into public.assignment_upload_reservations(id,assignment_version_id,creator_person_id,object_path,file_name,mime_type,byte_size)
 values(p_request_id,p_version_id,public.current_person_id(),offering::text||'/'||p_version_id::text||'/'||p_request_id::text||'.'||ext,p_file_name,p_mime_type,p_byte_size)
 returning * into r;
 return query select r.id,r.object_path,r.state;
end $$;

-- The version lock serializes publication/slot allocation; the reservation lock
-- serializes all metadata attachments against a cleanup claim.
create function public.guard_tracked_assignment_material() returns trigger
language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.assignment_upload_reservations; v public.assignment_versions;
begin
 if tg_op='UPDATE' then raise exception using errcode='55000',message='assignment material replacement required'; end if;
 select * into v from public.assignment_versions where id=case when tg_op='DELETE' then old.assignment_version_id else new.assignment_version_id end for update;
 select * into r from public.assignment_upload_reservations where object_path=case when tg_op='DELETE' then old.object_path else new.object_path end for update;
 if v.id is null or v.status<>'draft' or not public.current_person_can_manage_content(public.assignment_version_offering_id(v.id)) then
  raise exception using errcode='42501',message='draft upload access denied';
 end if;
 if tg_op='DELETE' then
  if r.id is not null then update public.assignment_upload_reservations set state='quarantined' where id=r.id and state='attached'; end if;
  return old;
 end if;
 if r.id is null then raise exception using errcode='23514',message='assignment upload reservation required'; end if;
 if r.state<>'reserved' or r.creator_person_id is distinct from public.current_person_id()
  or not public.current_person_can_manage_content(public.assignment_version_offering_id(new.assignment_version_id))
  or r.assignment_version_id<>new.assignment_version_id or r.file_name<>new.original_file_name
  or r.mime_type<>new.mime_type or r.byte_size<>new.byte_size or r.creator_person_id<>new.created_by_person_id then
  raise exception using errcode='42501',message='assignment upload attachment denied';
 end if;
 if not exists(select 1 from storage.objects o where o.bucket_id='assignment-materials' and o.name=r.object_path
  and o.metadata->>'mimetype'=r.mime_type and (o.metadata->>'size')::bigint=r.byte_size) then
  raise exception using errcode='55000',message='assignment upload not confirmed';
 end if;
 update public.assignment_upload_reservations set state='attached' where id=r.id;
 return new;
end $$;
create trigger assignment_materials_reservation_guard before insert or update or delete on public.assignment_materials
for each row execute function public.guard_tracked_assignment_material();

create function public.attach_assignment_upload(p_upload_id uuid) returns uuid
language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.assignment_upload_reservations; v public.assignment_versions; result uuid; slot integer;
begin
 select * into r from public.assignment_upload_reservations where id=p_upload_id;
 select * into v from public.assignment_versions where id=r.assignment_version_id for update;
 select * into r from public.assignment_upload_reservations where id=p_upload_id for update;
 if r.id is null or r.creator_person_id is distinct from public.current_person_id() or v.status<>'draft'
  or not public.current_person_can_manage_content(public.assignment_version_offering_id(v.id)) then
  raise exception using errcode='42501',message='draft upload access denied';
 end if;
 select id into result from public.assignment_materials where object_path=r.object_path;
 if result is not null and r.state='attached' then return result; end if;
 if r.state<>'reserved' then raise exception using errcode='55000',message='upload no longer attachable'; end if;
 select s into slot from generate_series(1,5) s where not exists(select 1 from public.assignment_materials m where m.assignment_version_id=v.id and m.position=s) order by s limit 1;
 if slot is null then raise exception using errcode='23514',message='assignment file limit reached'; end if;
 insert into public.assignment_materials(assignment_version_id,object_path,original_file_name,mime_type,byte_size,position,created_by_person_id)
 values(v.id,r.object_path,r.file_name,r.mime_type,r.byte_size,slot,r.creator_person_id) returning id into result;
 return result;
end $$;

create or replace function public.current_person_can_insert_assignment_object(p_object_name text) returns boolean
language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.assignment_upload_reservations;
begin
 -- Lock retained through Storage metadata insertion; cleanup cannot overtake it.
 select * into r from public.assignment_upload_reservations where object_path=p_object_name for share;
 return coalesce(r.state='reserved' and r.creator_person_id=public.current_person_id()
  and public.current_person_can_mutate_assignment_object(p_object_name),false);
end $$;
drop policy assignment_material_objects_update_content_author on storage.objects;
drop policy assignment_material_objects_delete_content_author on storage.objects;
-- No direct overwrite/delete, including for legacy referenced or unknown paths.

create function public.claim_assignment_upload_cleanup(p_limit integer default 100,p_upload_ids uuid[] default null)
returns table(upload_id uuid,object_path text)
language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.assignment_upload_reservations;
begin
 if p_limit is null or p_limit not between 1 and 100 then raise exception using errcode='23514',message='invalid cleanup limit'; end if;
 for r in select * from public.assignment_upload_reservations a
  where not a.cleanup_hold and a.state in ('reserved','quarantined','deleting','deleted') and a.created_at<=now()-interval '30 days'
  and (p_upload_ids is null or a.id=any(p_upload_ids))
  order by a.last_checked_at nulls first,a.created_at,a.id limit p_limit for update skip locked loop
  -- Fresh statement after lock. All reference insertion paths lock this record.
  if exists(select 1 from public.assignment_materials m where m.object_path=r.object_path) then continue; end if;
  update public.assignment_upload_reservations set state='deleting',last_checked_at=now() where id=r.id;
  return query select r.id,r.object_path;
 end loop;
end $$;
create function public.complete_assignment_upload_cleanup(p_upload_id uuid) returns void
language plpgsql security definer set search_path='' set row_security=off as $$
declare r public.assignment_upload_reservations;
begin
 select * into r from public.assignment_upload_reservations where id=p_upload_id for update;
 if r.id is null or r.state<>'deleting' or r.cleanup_hold
  or exists(select 1 from public.assignment_materials where object_path=r.object_path)
  or exists(select 1 from storage.objects where bucket_id='assignment-materials' and name=r.object_path) then
  raise exception using errcode='55000',message='cleanup not confirmed';
 end if;
 update public.assignment_upload_reservations set state='deleted',deleted_at=coalesce(deleted_at,now()) where id=r.id;
end $$;
revoke all on function public.reserve_assignment_upload(uuid,uuid,text,text,integer),public.attach_assignment_upload(uuid) from public,anon;
grant execute on function public.reserve_assignment_upload(uuid,uuid,text,text,integer),public.attach_assignment_upload(uuid) to authenticated;
revoke all on function public.guard_tracked_assignment_material(),public.claim_assignment_upload_cleanup(integer,uuid[]),public.complete_assignment_upload_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.claim_assignment_upload_cleanup(integer,uuid[]),public.complete_assignment_upload_cleanup(uuid) to service_role;
-- No Cron, hosted worker or production activation. Deleted markers remain eligible
-- for bounded rechecks to catch late bytes from an already-started upload.
create function public.list_assignment_uploads(p_version_id uuid)
returns table(upload_id uuid,file_name text,state text,created_at timestamptz)
language sql stable security definer set search_path='' set row_security=off as $$
 select a.id,a.file_name,a.state,a.created_at from public.assignment_upload_reservations a
 where a.assignment_version_id=p_version_id
 and public.current_person_can_manage_content(public.assignment_version_offering_id(p_version_id))
 order by a.created_at desc,a.id limit 100
$$;
revoke all on function public.list_assignment_uploads(uuid) from public,anon;
grant execute on function public.list_assignment_uploads(uuid) to authenticated;
