create or replace function public.finalize_student_activation(
  p_person_id uuid,
  p_auth_user_id uuid,
  p_token_id uuid,
  p_token_hash text,
  p_credential_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  consumed_token_id uuid;
begin
  if p_credential_type not in ('link', 'backup') then
    return false;
  end if;

  if not exists (
    select 1
    from public.people p
    join public.memberships m on m.person_id = p.id
    where p.id = p_person_id
      and p.status = 'active'
      and m.kind = 'student'
      and m.status = 'active'
      and (m.starts_at is null or m.starts_at <= now())
      and (m.ends_at is null or m.ends_at > now())
  ) then
    return false;
  end if;

  update public.account_action_tokens
  set consumed_at = now()
  where id = p_token_id
    and person_id = p_person_id
    and kind = 'activation'
    and consumed_at is null
    and invalidated_at is null
    and expires_at > now()
    and attempt_count < max_attempts
    and (
      (p_credential_type = 'link' and link_token_hash = p_token_hash)
      or (p_credential_type = 'backup' and backup_code_hash = p_token_hash)
    )
  returning id into consumed_token_id;

  if consumed_token_id is null then
    return false;
  end if;

  insert into public.auth_identities (person_id, auth_user_id, kind)
  values (p_person_id, p_auth_user_id, 'member_id');

  update public.account_action_tokens
  set invalidated_at = now()
  where person_id = p_person_id
    and id <> consumed_token_id
    and consumed_at is null
    and invalidated_at is null;

  insert into public.security_audit_events (
    subject_person_id,
    event_type,
    outcome,
    metadata
  ) values (
    p_person_id,
    'activation_completed',
    'succeeded',
    jsonb_build_object('credential_type', p_credential_type)
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$$;

revoke all on function public.finalize_student_activation(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.finalize_student_activation(uuid, uuid, uuid, text, text) to service_role;

comment on function public.finalize_student_activation(uuid, uuid, uuid, text, text) is
  'Atomically consumes a valid one-time activation token, links the Auth user, invalidates other action tokens, and audits completion. Trusted service-role use only.';
