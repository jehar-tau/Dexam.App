-- Every existing entry/resume path uses this single payload boundary, including
-- legacy mock/live entrypoints that return early before their start checks.
alter function public.assessment_attempt_payload(uuid) rename to assemble_assessment_attempt_payload;
revoke all on function public.assemble_assessment_attempt_payload(uuid) from public,anon,authenticated,service_role;
create function public.assessment_attempt_payload(p_attempt_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' set row_security=off
as $$ begin
 if not public.current_person_can_access_assessment_attempt(p_attempt_id) then
  raise exception using errcode='42501',message='current access to this exact attempt is required'; end if;
 return public.assemble_assessment_attempt_payload(p_attempt_id);
end $$;
revoke all on function public.assessment_attempt_payload(uuid) from public,anon,authenticated;
grant execute on function public.assessment_attempt_payload(uuid) to service_role;
