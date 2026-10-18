-- D-049 B. Submitted versions stay immutable; edits create a new snapshot head.
alter table public.submission_attempts
  add column logical_attempt_number integer,
  add column submission_version integer not null default 1 check (submission_version > 0),
  add column replaces_attempt_id uuid unique references public.submission_attempts(id) on delete restrict,
  add column superseded_by_attempt_id uuid unique references public.submission_attempts(id) on delete restrict;
-- No historical writes or closed-enrolment backfill. NULL is the backwards-
-- compatible equivalent of attempt_number on every existing row.
alter table public.submission_attempts add constraint logical_attempt_positive check(logical_attempt_number>0);
alter table public.submission_files drop constraint submission_files_object_path_key;
alter table public.submission_files add column purge_claimed_at timestamptz;
create index submission_files_object_path_idx on public.submission_files(object_path);

create or replace function public.enforce_submitted_attempt_immutability()
returns trigger language plpgsql set search_path='' as $$
begin
  if old.status='submitted' then
    if tg_op='UPDATE' and old.superseded_by_attempt_id is null and new.superseded_by_attempt_id is not null
      and (to_jsonb(new)-'superseded_by_attempt_id')=(to_jsonb(old)-'superseded_by_attempt_id')
      and exists(select 1 from public.submission_attempts a where a.id=new.superseded_by_attempt_id
        and a.replaces_attempt_id=old.id and a.assignment_instance_id=old.assignment_instance_id)
      and not exists(select 1 from public.feedback_revisions f where f.submission_attempt_id=old.id and f.status='published') then return new; end if;
    raise exception using errcode='55000',message='submitted attempts are immutable';
  end if;
  return new;
end $$;

create function public.edit_assignment_attempt(p_submission_attempt_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare a public.submission_attempts; i public.student_assignment_instances; next_id uuid:=gen_random_uuid(); physical_number integer;
begin
  select * into a from public.submission_attempts where id=p_submission_attempt_id for update;
  select * into i from public.student_assignment_instances where id=a.assignment_instance_id for update;
  if a.id is null or not public.current_person_can_access_assignment_instance(i.id)
    or i.status in ('closed','voided') or not exists(select 1 from public.assignment_releases r where r.id=i.assignment_release_id and r.status='active') then
    raise exception using errcode='42501',message='submission editing access denied'; end if;
  if a.superseded_by_attempt_id is not null then return a.superseded_by_attempt_id; end if;
  if a.status<>'submitted' or exists(select 1 from public.feedback_revisions f where f.submission_attempt_id=a.id and f.status='published') then
    raise exception using errcode='55000',message='reviewed attempts cannot be edited'; end if;
  if exists(select 1 from public.submission_attempts d where d.assignment_instance_id=i.id and d.status='draft') then
    raise exception using errcode='55000',message='finish the current draft before editing another attempt'; end if;
  select coalesce(max(attempt_number),0)+1 into physical_number from public.submission_attempts where assignment_instance_id=i.id;
  insert into public.submission_attempts(id,assignment_instance_id,attempt_number,logical_attempt_number,submission_version,replaces_attempt_id,created_by_person_id)
    values(next_id,i.id,physical_number,coalesce(a.logical_attempt_number,a.attempt_number),a.submission_version+1,a.id,public.current_person_id());
  if exists(select 1 from public.submission_files where submission_attempt_id=a.id and purge_claimed_at is not null) then
    raise exception using errcode='55000',message='submission files are undergoing cleanup'; end if;
  insert into public.submission_files(submission_attempt_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,was_compressed,pixel_width,pixel_height,position,status,ready_at)
    select next_id,object_path,original_file_name,mime_type,byte_size,original_byte_size,was_compressed,pixel_width,pixel_height,position,status,ready_at
    from public.submission_files where submission_attempt_id=a.id and status='ready' and purged_at is null;
  update public.submission_attempts set superseded_by_attempt_id=next_id where id=a.id;
  if i.status<>'in_progress' then
    insert into public.student_assignment_transitions(assignment_instance_id,from_status,to_status,actor_person_id,reason_code)
      values(i.id,i.status,'in_progress',public.current_person_id(),'unreviewed_attempt_edit_started');
    update public.student_assignment_instances set status='in_progress',updated_at=now() where id=i.id;
  end if;
  return next_id;
end $$;
revoke all on function public.edit_assignment_attempt(uuid) from public,anon;
grant execute on function public.edit_assignment_attempt(uuid) to authenticated;

-- No public path listing: a receipt is returned only after current owner checks.
create table public.submission_file_removal_receipts(
  file_id uuid primary key, assignment_instance_id uuid not null references public.student_assignment_instances(id),
  actor_person_id uuid not null references public.people(id), object_path text not null,
  delete_object boolean not null, removed_at timestamptz not null default now()
);
alter table public.submission_file_removal_receipts enable row level security;
revoke all on public.submission_file_removal_receipts from public,anon,authenticated;
grant all on public.submission_file_removal_receipts to service_role;
create function public.remove_draft_submission_file(p_file_id uuid)
returns table(object_path text,delete_object boolean) language plpgsql security definer set search_path='' set row_security=off as $$
declare f public.submission_files; a public.submission_attempts; receipt public.submission_file_removal_receipts; instance_id uuid; remove_bytes boolean;
begin
  select * into receipt from public.submission_file_removal_receipts where file_id=p_file_id;
  if found then
    if receipt.actor_person_id is distinct from public.current_person_id() or not public.current_person_can_access_assignment_instance(receipt.assignment_instance_id) then
      raise exception using errcode='42501',message='file removal denied'; end if;
    return query select receipt.object_path,receipt.delete_object; return;
  end if;
  select * into f from public.submission_files where id=p_file_id;
  select * into a from public.submission_attempts where id=f.submission_attempt_id for update;
  instance_id:=a.assignment_instance_id;
  perform 1 from public.student_assignment_instances where id=instance_id for update;
  if a.id is null or a.status<>'draft' or not public.current_person_can_access_assignment_instance(instance_id)
    or not exists(select 1 from public.student_assignment_instances i join public.assignment_releases r on r.id=i.assignment_release_id where i.id=instance_id and r.status='active' and i.status not in ('closed','voided')) then
    raise exception using errcode='42501',message='file removal denied'; end if;
  -- Re-read after acquiring the same attempt lock used by finalization.
  select * into f from public.submission_files where id=p_file_id;
  if f.id is null then raise exception using errcode='40001',message='file changed; retry removal'; end if;
  select not exists(select 1 from public.submission_files other where other.object_path=f.object_path and other.id<>f.id and other.purged_at is null) into remove_bytes;
  insert into public.submission_file_removal_receipts(file_id,assignment_instance_id,actor_person_id,object_path,delete_object)
    values(f.id,instance_id,public.current_person_id(),f.object_path,remove_bytes);
  delete from public.submission_files where id=f.id;
  return query select f.object_path,remove_bytes;
end $$;
revoke all on function public.remove_draft_submission_file(uuid) from public,anon;
grant execute on function public.remove_draft_submission_file(uuid) to authenticated;

create or replace function public.start_assignment_attempt(p_assignment_instance_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare i public.student_assignment_instances; draft_id uuid; next_id uuid; physical_number integer; logical_number integer;
begin
  select * into i from public.student_assignment_instances where id=p_assignment_instance_id for update;
  if i.id is null or not public.current_person_can_access_assignment_instance(i.id) then
    raise exception using errcode='42501',message='assignment attempt access denied'; end if;
  if not exists(select 1 from public.assignment_releases r where r.id=i.assignment_release_id and r.status='active') then
    raise exception using errcode='23514',message='this assignment is not accepting submissions'; end if;
  select id into draft_id from public.submission_attempts where assignment_instance_id=i.id and status='draft';
  if draft_id is not null then return draft_id; end if;
  if i.status not in ('assigned','submitted','correction_requested','review_completed') then
    raise exception using errcode='23514',message='a new attempt is not currently authorized'; end if;
  select coalesce(max(attempt_number),0)+1,coalesce(max(coalesce(logical_attempt_number,attempt_number)),0)+1
    into physical_number,logical_number from public.submission_attempts where assignment_instance_id=i.id;
  insert into public.submission_attempts(assignment_instance_id,attempt_number,logical_attempt_number,created_by_person_id)
    values(i.id,physical_number,logical_number,public.current_person_id()) returning id into next_id;
  insert into public.student_assignment_transitions(assignment_instance_id,from_status,to_status,actor_person_id,reason_code)
    values(i.id,i.status,'in_progress',public.current_person_id(),case when logical_number=1 then 'initial_attempt_started' else 'revision_attempt_started' end);
  update public.student_assignment_instances set status='in_progress',updated_at=now() where id=i.id;
  return next_id;
end $$;

-- Preserve the verified upload rules; reuse a vacant slot after a removal.
CREATE OR REPLACE FUNCTION public.reserve_submission_file(p_submission_attempt_id uuid, p_original_file_name text, p_mime_type text, p_byte_size bigint, p_original_byte_size bigint, p_was_compressed boolean, p_pixel_width integer, p_pixel_height integer)
 RETURNS TABLE(file_id uuid, object_path text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  target_attempt public.submission_attempts%rowtype;
  target_instance_id uuid;
  release_status public.assignment_release_status;
  extension text;
  next_position integer;
  existing_total bigint;
  new_file_id uuid := gen_random_uuid();
  new_object_path text;
begin
  select * into target_attempt from public.submission_attempts
  where id = p_submission_attempt_id for update;
  target_instance_id := target_attempt.assignment_instance_id;

  select r.status into release_status
  from public.student_assignment_instances i
  join public.assignment_releases r on r.id = i.assignment_release_id
  where i.id = target_instance_id;

  if target_attempt.id is null
    or target_attempt.status <> 'draft'
    or release_status <> 'active'
    or not public.current_person_can_access_assignment_instance(target_instance_id)
  then
    raise exception using errcode = '42501', message = 'submission file access denied';
  end if;

  if length(btrim(coalesce(p_original_file_name, ''))) not between 1 and 180
    or p_byte_size not between 1 and 10485760
    or p_original_byte_size not between 1 and 52428800
    or (p_was_compressed and p_original_byte_size <= p_byte_size)
  then
    raise exception using errcode = '22023', message = 'submission file metadata is invalid';
  end if;

  extension := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    else null
  end;
  if extension is null then
    raise exception using errcode = '22023', message = 'submission file type is not allowed';
  end if;
  if p_mime_type = 'application/pdf' and (p_pixel_width is not null or p_pixel_height is not null) then
    raise exception using errcode = '22023', message = 'PDF files cannot include image dimensions';
  end if;
  if p_mime_type <> 'application/pdf'
    and (p_pixel_width not between 1 and 3200 or p_pixel_height not between 1 and 3200)
  then
    raise exception using errcode = '22023', message = 'image dimensions are invalid';
  end if;

  select (select min(slot) from generate_series(1,10) slot where not exists(select 1 from public.submission_files used where used.submission_attempt_id=target_attempt.id and used.position=slot)), coalesce(sum(byte_size), 0)
  into next_position, existing_total
  from public.submission_files
  where submission_attempt_id = target_attempt.id and purged_at is null;

  if next_position is null or next_position > 10 or existing_total + p_byte_size > 52428800 then
    raise exception using errcode = '23514', message = 'submission file count or total size limit exceeded';
  end if;

  new_object_path := target_instance_id::text || '/' || target_attempt.id::text || '/' || new_file_id::text || '.' || extension;

  insert into public.submission_files (
    id, submission_attempt_id, object_path, original_file_name, mime_type,
    byte_size, original_byte_size, was_compressed, pixel_width, pixel_height, position
  ) values (
    new_file_id, target_attempt.id, new_object_path, btrim(p_original_file_name), p_mime_type,
    p_byte_size, p_original_byte_size, p_was_compressed, p_pixel_width, p_pixel_height, next_position
  );

  return query select new_file_id, new_object_path;
end;
$function$;

-- Same queue shape plus explicit attempt/version labels. Every pending current
-- attempt remains reviewable, independent of another attempt's summary state.
drop function public.list_feedback_review_queue();
create function public.list_feedback_review_queue()
returns table(assignment_instance_id uuid,submission_attempt_id uuid,member_id text,display_name text,
  assignment_title text,assignment_group text,submitted_at timestamptz,submission_file_count bigint,
  feedback_revision_id uuid,feedback_status public.feedback_revision_status,written_text text,
  source_kind public.feedback_source_kind,voice_equivalent_confirmed boolean,ai_assisted boolean,published_at timestamptz,
  attempt_number integer,submission_version integer,previous_feedback_text text)
language sql stable security definer set search_path='' set row_security=off as $$
  select i.id,a.id,p.member_id,p.display_name,v.title,v.group_name,a.submitted_at,
    (select count(*) from public.submission_files sf where sf.submission_attempt_id=a.id and sf.purged_at is null),
    f.id,f.status,f.written_text,f.source_kind,f.voice_equivalent_confirmed,f.ai_assisted,f.published_at,
    coalesce(a.logical_attempt_number,a.attempt_number),a.submission_version,
    (select prior.written_text from public.feedback_revisions prior where prior.submission_attempt_id=a.replaces_attempt_id and prior.status='draft' order by prior.revision_number desc limit 1)
  from public.submission_attempts a
  join public.student_assignment_instances i on i.id=a.assignment_instance_id
  join public.assignment_releases r on r.id=i.assignment_release_id
  join public.assignment_versions v on v.id=r.assignment_version_id
  join public.enrollments e on e.id=i.enrollment_id
  join public.people p on p.id=e.person_id
  left join lateral(select fr.* from public.feedback_revisions fr where fr.submission_attempt_id=a.id order by fr.revision_number desc limit 1) f on true
  where a.status='submitted' and a.superseded_by_attempt_id is null
    and i.status not in ('closed','voided')
    and not exists(select 1 from public.feedback_revisions done where done.submission_attempt_id=a.id and done.status='published')
    and public.current_person_can_review_feedback_instance(i.id)
  order by a.submitted_at,p.member_id,a.attempt_number
$$;
revoke all on function public.list_feedback_review_queue() from public,anon;
grant execute on function public.list_feedback_review_queue() to authenticated;

create or replace function public.start_feedback_draft(p_submission_attempt_id uuid)
returns uuid language plpgsql security definer set search_path='' set row_security=off as $$
declare a public.submission_attempts; i public.student_assignment_instances; draft_id uuid; next_revision integer; next_id uuid;
begin
  select * into a from public.submission_attempts where id=p_submission_attempt_id for update;
  select * into i from public.student_assignment_instances where id=a.assignment_instance_id for update;
  if a.id is null or a.status<>'submitted' or a.superseded_by_attempt_id is not null
    or i.status in ('closed','voided') or not public.current_person_can_review_feedback_instance(i.id)
    or exists(select 1 from public.feedback_revisions f where f.submission_attempt_id=a.id and f.status='published') then
    raise exception using errcode='42501',message='feedback review access denied'; end if;
  select id into draft_id from public.feedback_revisions where submission_attempt_id=a.id and status='draft';
  if draft_id is not null then return draft_id; end if;
  select coalesce(max(revision_number),0)+1 into next_revision from public.feedback_revisions where submission_attempt_id=a.id;
  insert into public.feedback_revisions(submission_attempt_id,assignment_version_id,revision_number,created_by_person_id,updated_by_person_id)
    select a.id,r.assignment_version_id,next_revision,public.current_person_id(),public.current_person_id()
    from public.assignment_releases r where r.id=i.assignment_release_id returning id into next_id;
  return next_id;
end $$;

-- Retain existing validation, voice-equivalent, audit and notification handling.
-- All replacements are asserted against the reviewed original definition.
CREATE OR REPLACE FUNCTION public.publish_feedback_revision(p_feedback_revision_id uuid, p_outcome feedback_outcome, p_correction_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  target_revision public.feedback_revisions%rowtype;
  target_attempt public.submission_attempts%rowtype;
  target_instance public.student_assignment_instances%rowtype;
  actor_id uuid := public.current_person_id();
  published_at_value timestamptz := now();
begin
  select * into target_revision from public.feedback_revisions where id=p_feedback_revision_id;
  select * into target_attempt from public.submission_attempts where id=target_revision.submission_attempt_id for update;
  select * into target_instance from public.student_assignment_instances where id=target_attempt.assignment_instance_id for update;
  select * into target_revision from public.feedback_revisions where id=p_feedback_revision_id for update;

  if target_revision.id is null
    or target_revision.status <> 'draft'
    or not public.current_person_can_review_feedback_revision(target_revision.id)
  then
    raise exception using errcode = '42501', message = 'feedback publication access denied';
  end if;
  if target_attempt.status <> 'submitted' or target_attempt.superseded_by_attempt_id is not null
    or target_instance.status in ('closed','voided')
    or exists(select 1 from public.feedback_revisions prior where prior.submission_attempt_id=target_attempt.id and prior.status='published') then
    raise exception using errcode = '23514', message = 'submission changed or already reviewed; reload the current version';
  end if;
  if length(btrim(target_revision.written_text)) not between 3 and 10000 then
    raise exception using errcode = '23514', message = 'student-visible writing is required before publication';
  end if;
  if exists (
    select 1 from public.feedback_audio_files af
    where af.feedback_revision_id = target_revision.id
      and af.kind = 'voice_note' and af.purged_at is null
      and af.status <> 'ready'
  ) then
    raise exception using errcode = '23514', message = 'the voice note must finish uploading before publication';
  end if;
  if exists (
    select 1 from public.feedback_audio_files af
    where af.feedback_revision_id = target_revision.id
      and af.kind = 'voice_note' and af.status = 'ready' and af.purged_at is null
  ) and not target_revision.voice_equivalent_confirmed then
    raise exception using errcode = '23514', message = 'confirm the accessible written equivalent before publishing audio';
  end if;
  if p_outcome = 'correction_requested'
    and length(btrim(coalesce(p_correction_reason, ''))) not between 3 and 500
  then
    raise exception using errcode = '22023', message = 'a correction reason between 3 and 500 characters is required';
  end if;
  if p_outcome = 'review_completed' and p_correction_reason is not null then
    raise exception using errcode = '22023', message = 'completed feedback cannot include a correction reason';
  end if;

  update public.feedback_revisions
  set status = 'published', outcome = p_outcome,
      correction_reason = case when p_outcome = 'correction_requested' then btrim(p_correction_reason) else null end,
      published_by_person_id = actor_id, published_at = published_at_value,
      updated_by_person_id = actor_id, updated_at = published_at_value
  where id = target_revision.id;

  if not exists(select 1 from public.submission_attempts newer where newer.assignment_instance_id=target_instance.id and newer.superseded_by_attempt_id is null and coalesce(newer.logical_attempt_number,newer.attempt_number)>coalesce(target_attempt.logical_attempt_number,target_attempt.attempt_number)) and target_instance.status<>p_outcome::text::public.student_assignment_status then
  insert into public.student_assignment_transitions (
    assignment_instance_id, from_status, to_status, actor_person_id, reason_code, reason_detail
  ) values (
    target_instance.id,
    target_instance.status,
    p_outcome::text::public.student_assignment_status,
    actor_id,
    case when p_outcome = 'correction_requested' then 'feedback_correction_requested' else 'feedback_review_completed' end,
    case when p_outcome = 'correction_requested' then btrim(p_correction_reason) else null end
  );

  update public.student_assignment_instances
  set status = p_outcome::text::public.student_assignment_status, updated_at = published_at_value
  where id = target_instance.id;
  else
    -- Older-attempt feedback still deserves its existing in-app notice, without
    -- rewriting the latest attempt's assignment summary or inventing a transition.
    insert into public.domain_events(event_key,event_type,aggregate_type,aggregate_id,actor_person_id,payload,occurred_at)
      values('feedback_revision:'||target_revision.id::text,
        case when p_outcome='correction_requested' then 'correction_requested' else 'feedback_available' end,
        'assignment_instance',target_instance.id,actor_id,
        jsonb_build_object('feedback_revision_id',target_revision.id,'submission_attempt_id',target_attempt.id),published_at_value)
      on conflict(event_key) do nothing;
  end if;
  insert into public.security_audit_events (
    subject_person_id, actor_person_id, event_type, outcome, reason_code, metadata
  )
  select e.person_id, actor_id, 'feedback_published', 'succeeded', p_outcome::text,
    jsonb_build_object(
      'feedback_revision_id', target_revision.id,
      'submission_attempt_id', target_attempt.id,
      'assignment_instance_id', target_instance.id,
      'ai_assisted', target_revision.ai_assisted
    )
  from public.enrollments e where e.id = target_instance.enrollment_id;
end;
$function$;

-- A draft copy must never make a still-referenced submitted snapshot purgeable.
-- Claim before external Storage deletion; finalization checks the durable fence.
create function public.guard_submission_purge_claim()
returns trigger language plpgsql security definer set search_path='' set row_security=off as $$
begin
  if new.status='submitted' and old.status='draft' and exists(select 1 from public.submission_files f where f.submission_attempt_id=new.id and f.purge_claimed_at is not null) then
    raise exception using errcode='55000',message='submission files are undergoing cleanup; refresh before submitting'; end if;
  return new;
end $$;
revoke all on function public.guard_submission_purge_claim() from public,anon,authenticated;
create trigger submission_attempt_purge_guard before update on public.submission_attempts for each row execute function public.guard_submission_purge_claim();

create function public.submission_file_is_purge_eligible(p_file_id uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off as $$
  select coalesce(exists(select 1 from public.submission_files f
    join public.submission_attempts a on a.id=f.submission_attempt_id
    join public.student_assignment_instances i on i.id=a.assignment_instance_id
    join public.enrollments e on e.id=i.enrollment_id
    where f.id=p_file_id and f.purged_at is null and
      ((a.status='draft' and f.created_at<=now()-interval '30 days') or (e.ended_at is not null and e.ended_at<=now()-interval '12 months'))),false)
$$;
revoke all on function public.submission_file_is_purge_eligible(uuid) from public,anon,authenticated;

-- The existing file guard permits exactly the trusted marker update on submitted
-- files, while retaining its original metadata/byte immutability and purge rules.
CREATE OR REPLACE FUNCTION public.enforce_submission_file_draft()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  target_attempt_id uuid;
  target_status public.submission_attempt_status;
begin
  target_attempt_id := case when tg_op = 'DELETE' then old.submission_attempt_id else new.submission_attempt_id end;
  select status into target_status from public.submission_attempts where id = target_attempt_id;

  if target_status is distinct from 'draft'::public.submission_attempt_status then
    if tg_op='UPDATE' and old.purge_claimed_at is null and new.purge_claimed_at is not null and
      (to_jsonb(new)-'purge_claimed_at')=(to_jsonb(old)-'purge_claimed_at') then return new; end if;
    if tg_op = 'UPDATE'
      and old.purged_at is null
      and new.purged_at is not null
      and new.original_file_name = '[purged]'
      and row(
        new.id, new.submission_attempt_id, new.object_path, new.mime_type,
        new.byte_size, new.original_byte_size, new.was_compressed,
        new.pixel_width, new.pixel_height, new.position, new.status,
        new.created_at, new.ready_at
      ) is not distinct from row(
        old.id, old.submission_attempt_id, old.object_path, old.mime_type,
        old.byte_size, old.original_byte_size, old.was_compressed,
        old.pixel_width, old.pixel_height, old.position, old.status,
        old.created_at, old.ready_at
      )
    then
      return new;
    end if;
    raise exception using errcode = '55000', message = 'files on submitted attempts are immutable';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.guard_closed_enrollment_submission_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$ declare target_enrollment_id uuid; enrollment_state public.enrollment_status;
begin
  if tg_table_name='submission_files' then
    if tg_op='UPDATE' and old.purge_claimed_at is null and new.purge_claimed_at is not null and
      (to_jsonb(new)-'purge_claimed_at')=(to_jsonb(old)-'purge_claimed_at') and public.submission_file_is_purge_eligible(old.id) then return new; end if;
    if tg_op='UPDATE' and auth.role()='service_role' and old.purged_at is null and new.purged_at is not null and new.original_file_name='[purged]'
      and (to_jsonb(new)-'purged_at'-'original_file_name')=(to_jsonb(old)-'purged_at'-'original_file_name') then return new; end if;
    select i.enrollment_id into target_enrollment_id from public.submission_attempts a join public.student_assignment_instances i on i.id=a.assignment_instance_id where a.id=new.submission_attempt_id;
  else
    select i.enrollment_id into target_enrollment_id from public.student_assignment_instances i where i.id=new.assignment_instance_id;
  end if;
  select e.status into enrollment_state from public.enrollments e where e.id=target_enrollment_id for share;
  if enrollment_state<>'active' and exists(select 1 from public.enrollment_closeouts closed where closed.enrollment_id=target_enrollment_id) then
    raise exception using errcode='42501',message='ended enrolment is read only'; end if;
  return new;
end $function$;

create or replace function public.list_submission_files_due_for_purge(p_limit integer default 100)
returns table(file_id uuid,object_path text) language plpgsql security definer set search_path='' set row_security=off as $$
declare candidate record; claimed public.submission_files;
begin
  for candidate in
  select f.id,f.object_path from public.submission_files f
  join public.submission_attempts a on a.id=f.submission_attempt_id
  join public.student_assignment_instances i on i.id=a.assignment_instance_id
  join public.enrollments e on e.id=i.enrollment_id
  where f.purged_at is null and ((a.status='draft' and f.created_at<=now()-interval '30 days') or (e.ended_at is not null and e.ended_at<=now()-interval '12 months'))
    and not exists(select 1 from public.submission_files other
      join public.submission_attempts oa on oa.id=other.submission_attempt_id
      join public.student_assignment_instances oi on oi.id=oa.assignment_instance_id
      join public.enrollments oe on oe.id=oi.enrollment_id
      where other.object_path=f.object_path and other.id<>f.id and other.purged_at is null
        and not coalesce((oa.status='draft' and other.created_at<=now()-interval '30 days') or (oe.ended_at is not null and oe.ended_at<=now()-interval '12 months'),false))
  order by f.created_at limit greatest(1,least(coalesce(p_limit,100),500))
  loop
    -- Same row-lock order as finalization/edit: attempt, then instance, then file.
    perform 1 from public.submission_attempts a join public.submission_files f on f.submission_attempt_id=a.id where f.id=candidate.id for update of a;
    select * into claimed from public.submission_files where id=candidate.id for update;
    if not found or not public.submission_file_is_purge_eligible(claimed.id) then continue; end if;
    if exists(select 1 from public.submission_files other where other.object_path=claimed.object_path and other.id<>claimed.id and other.purged_at is null and not public.submission_file_is_purge_eligible(other.id)) then continue; end if;
    update public.submission_files set purge_claimed_at=coalesce(purge_claimed_at,now()) where id=claimed.id;
    file_id:=claimed.id; object_path:=claimed.object_path; return next;
  end loop;
end
$$;

create or replace function public.list_student_work_archive()
returns jsonb language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(jsonb_agg(item order by ended desc),'[]'::jsonb) from (
  select e.ended_at ended,jsonb_build_object('enrollmentId',e.id,'offeringTitle',o.title,'status',e.status,'endedAt',e.ended_at,'expiresAt',e.ended_at+interval '12 months',
    'attempts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'assignmentTitle',v.title,'attemptNumber',coalesce(a.logical_attempt_number,a.attempt_number),'submittedAt',a.submitted_at,
      'files',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'name',f.original_file_name,'mimeType',f.mime_type,'byteSize',f.byte_size) order by f.position)
        from public.submission_files f where f.submission_attempt_id=a.id and f.status='ready' and f.purged_at is null),'[]'::jsonb),
      'feedback',coalesce((select jsonb_agg(jsonb_build_object('id',feedback.id,'text',feedback.written_text,'nextStep',feedback.correction_reason,'publishedAt',feedback.published_at,'aiAssisted',feedback.ai_assisted,
        'voiceIds',coalesce((select jsonb_agg(audio.id) from public.feedback_audio_files audio where audio.feedback_revision_id=feedback.id and audio.kind='voice_note' and audio.status='ready' and audio.purged_at is null),'[]'::jsonb)) order by feedback.published_at)
        from public.feedback_revisions feedback where feedback.submission_attempt_id=a.id and feedback.status='published'),'[]'::jsonb)) order by a.submitted_at desc,a.id)
      from public.student_assignment_instances i join public.submission_attempts a on a.assignment_instance_id=i.id
      join public.assignment_releases r on r.id=i.assignment_release_id join public.assignment_versions v on v.id=r.assignment_version_id
      where i.enrollment_id=e.id and a.status='submitted' and a.submitted_at is not null and a.submitted_at<=e.ended_at
        and not exists(select 1 from public.submission_attempts newer where newer.assignment_instance_id=a.assignment_instance_id
          and coalesce(newer.logical_attempt_number,newer.attempt_number)=coalesce(a.logical_attempt_number,a.attempt_number)
          and newer.submission_version>a.submission_version and newer.status='submitted' and newer.submitted_at<=e.ended_at)),'[]'::jsonb)) item
  from public.enrollments e join public.offerings o on o.id=e.offering_id where public.current_person_can_read_work_archive(e.id)
) archive $$;
