-- Preserve existing approvals/holds and dates; active enquiries need lifecycle
-- timestamps when an already-approved erasure executes. No new retention delay.
create or replace function public.execute_approved_crm_erasure(p_case_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  target_case public.crm_privacy_cases%rowtype;
  target_enquiry public.crm_enquiries%rowtype;
  anonymized_contact text;
  anonymized_contact_point_id uuid;
  subject_is_protected boolean;
  contact_is_protected boolean;
begin
  select * into strict target_case from public.crm_privacy_cases where id = p_case_id for update;
  if target_case.status = 'completed'
     and exists (select 1 from public.crm_privacy_erasure_tombstones where case_id = p_case_id) then
    return;
  end if;
  if target_case.kind <> 'erasure' or target_case.status <> 'approved' then
    raise exception using errcode = '55000', message = 'privacy erasure is not approved';
  end if;
  if target_case.expires_at <= now() then
    update public.crm_privacy_cases set status = 'expired', updated_at = now() where id = p_case_id;
    raise exception using errcode = '55000', message = 'privacy case expired';
  end if;
  if not public.person_has_global_capability(target_case.proposed_by_person_id, 'privacy.manage')
     or not public.person_has_global_capability(target_case.approved_by_person_id, 'privacy.erase_approve') then
    raise exception using errcode = '42501', message = 'privacy authority changed before execution';
  end if;

  select * into strict target_enquiry from public.crm_enquiries
  where id = target_case.enquiry_id for update;
  if exists (
    select 1 from public.crm_privacy_holds hold
    where hold.enquiry_id = target_enquiry.id
      and hold.status = 'active'
      and hold.review_by > now()
  ) then
    raise exception using errcode = '55000', message = 'an active privacy hold prevents erasure';
  end if;

  subject_is_protected := exists (
    select 1 from public.memberships where person_id = target_enquiry.subject_person_id
  ) or exists (
    select 1 from public.auth_identities where person_id = target_enquiry.subject_person_id
  ) or exists (
    select 1 from public.people where id = target_enquiry.subject_person_id and member_id is not null
  );
  contact_is_protected := exists (
    select 1 from public.memberships where person_id = target_enquiry.primary_contact_person_id
  ) or exists (
    select 1 from public.auth_identities where person_id = target_enquiry.primary_contact_person_id
  ) or exists (
    select 1 from public.people where id = target_enquiry.primary_contact_person_id and member_id is not null
  );

  if not subject_is_protected and not exists (
    select 1 from public.crm_enquiries other
    where other.id <> target_enquiry.id
      and other.subject_person_id = target_enquiry.subject_person_id
      and other.privacy_state <> 'minimized'
  ) then
    update public.people set display_name = 'Erased CRM person', status = 'archived', updated_at = now()
    where id = target_enquiry.subject_person_id;
  end if;
  if target_enquiry.primary_contact_person_id <> target_enquiry.subject_person_id
     and not contact_is_protected and not exists (
       select 1 from public.crm_enquiries other
       where other.id <> target_enquiry.id
         and other.primary_contact_person_id = target_enquiry.primary_contact_person_id
         and other.privacy_state <> 'minimized'
     ) then
    update public.people set display_name = 'Erased CRM contact', status = 'archived', updated_at = now()
    where id = target_enquiry.primary_contact_person_id;
  end if;

  anonymized_contact := 'erased+' || replace(target_enquiry.primary_contact_point_id::text, '-', '') || '@example.invalid';
  if exists (
    select 1 from public.crm_enquiries other
    where other.id <> target_enquiry.id
      and other.primary_contact_point_id = target_enquiry.primary_contact_point_id
      and other.privacy_state <> 'minimized'
  ) then
    insert into public.crm_contact_points (
      person_id, kind, normalized_value, display_value, is_verified, source, created_by_person_id
    ) values (
      target_enquiry.primary_contact_person_id, 'email', anonymized_contact, anonymized_contact,
      false, 'privacy_erasure', target_case.approved_by_person_id
    ) returning id into anonymized_contact_point_id;
    update public.crm_enquiries
    set primary_contact_point_id = anonymized_contact_point_id
    where id = target_enquiry.id;
  else
    update public.crm_contact_points
    set kind = 'email', normalized_value = anonymized_contact,
        display_value = anonymized_contact, is_verified = false, source = 'privacy_erasure'
    where id = target_enquiry.primary_contact_point_id;
  end if;

  if target_enquiry.primary_contact_person_id <> target_enquiry.subject_person_id
     and not exists (
       select 1 from public.crm_enquiries other
       where other.id <> target_enquiry.id
         and other.privacy_state <> 'minimized'
         and other.subject_person_id = target_enquiry.subject_person_id
         and other.primary_contact_person_id = target_enquiry.primary_contact_person_id
     ) then
    delete from public.crm_person_relationships relationship
    where relationship.subject_person_id = target_enquiry.subject_person_id
      and relationship.related_person_id = target_enquiry.primary_contact_person_id;
  end if;

  update public.crm_activities set note = null where enquiry_id = target_enquiry.id;
  update public.crm_enquiry_transitions set note = null where enquiry_id = target_enquiry.id;
  update public.crm_enquiry_ownership_history
  set reason = 'Privacy minimized' where enquiry_id = target_enquiry.id;
  update public.crm_follow_ups
  set status = case when status = 'open' then 'cancelled'::public.crm_follow_up_status else status end,
      disposition = 'Privacy minimized',
      completed_at = coalesce(completed_at, now()),
      replaced_by_follow_up_id = case when status = 'open' then null else replaced_by_follow_up_id end
  where enquiry_id = target_enquiry.id;
  update public.crm_enrolment_review_requests
  set request_note = 'Privacy minimized',
      decision_reason = case when decision_reason is null then null else 'Privacy minimized' end
  where enquiry_id = target_enquiry.id;
  delete from public.crm_identity_candidates where enquiry_id = target_enquiry.id;
  update public.notifications
  set expires_at = greatest(created_at + interval '1 second', least(expires_at, now())),
      read_at = coalesce(read_at, now())
  where crm_enquiry_id = target_enquiry.id;

  update public.crm_enquiries
  set interest_summary = 'Erased CRM record', target_intake = null,
      closed_reason = case when stage = 'closed' then 'Privacy minimized' else null end,
      retention_anchor_at = coalesce(retention_anchor_at, now()),
      minimization_due_at = coalesce(minimization_due_at, now()),
      privacy_state = 'minimized', minimized_at = now(), updated_at = now()
  where id = target_enquiry.id;

  insert into public.crm_privacy_erasure_tombstones (
    case_id, enquiry_id, subject_person_id, contact_person_id, policy_version
  ) values (
    target_case.id, target_enquiry.id, target_enquiry.subject_person_id,
    target_enquiry.primary_contact_person_id, target_enquiry.privacy_policy_version
  );
  update public.crm_privacy_cases
  set status = 'completed', completed_at = now(), updated_at = now(),
      completion_summary = 'Approved CRM personal data was minimized; protected student and academic records were not changed.'
  where id = target_case.id;
end;
$$;
