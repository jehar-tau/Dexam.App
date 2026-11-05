-- D-065: exact-attempt checks on Storage policies and student history readers.
CREATE OR REPLACE FUNCTION public.current_person_can_read_part_b_object(p_object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
  select coalesce(
    public.current_person_can_evaluate_part_b()
    or exists (
      select 1
      from public.assessment_part_b_uploads upload
      join public.assessment_attempts attempt on attempt.id = upload.attempt_id
      where upload.storage_path = p_object_name and public.current_person_can_access_assessment_attempt(attempt.id)
    ),
    false
  )
$function$
;

CREATE OR REPLACE FUNCTION public.current_person_can_upload_part_b(p_object_name text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_parts text[] := string_to_array(p_object_name, '/');
  v_attempt public.assessment_attempts;
  v_status text;
begin
  if cardinality(v_parts) <> 3
    or v_parts[1] !~ '^[0-9a-f-]{36}$'
    or v_parts[2] !~ '^[0-9a-f-]{36}$'
    or v_parts[3] !~ '^[0-9a-f-]{36}\.(jpe?g|png|pdf)$' then
    return false;
  end if;
  select * into v_attempt from public.assessment_attempts
    where id = v_parts[1]::uuid and person_id = public.current_person_id();
  if v_attempt.id is null or not public.current_person_can_access_assessment_attempt(v_attempt.id) then
    return false;
  end if;
  v_status := public.assessment_part_b_effective_status(v_attempt);
  return v_status in ('drawing', 'uploading')
    and exists (
      select 1 from public.assessment_attempt_tasks
      where attempt_id = v_attempt.id and question_id = v_parts[2]::uuid
    )
    and (
      select count(*) from public.assessment_part_b_uploads
      where attempt_id = v_attempt.id and question_id = v_parts[2]::uuid
    ) < 5;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_assessment_progress()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
declare
  v_person uuid := public.current_person_id();
begin
  if not public.current_person_can_take_tests() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'attempts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attemptId', a.id,
        'kind', a.kind,
        'title', a.title,
        'paperId', a.paper_id,
        'exam', a.exam,
        'submittedAt', a.submitted_at,
        'score', a.score,
        'maxScore', a.max_score,
        'questionCount', (select count(*) from public.assessment_attempt_questions aq where aq.attempt_id = a.id)
      ) order by a.submitted_at)
      from public.assessment_attempts a
      where public.current_person_can_access_assessment_attempt(a.id) and a.status = 'submitted' and a.kind <> 'drawing'
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object('slug', topic.slug, 'name', topic.name, 'total', topic.total, 'scored', topic.scored)
        order by topic.scored::numeric / topic.total, topic.total desc)
      from (
        select t.slug, t.name,
          count(*)::integer as total,
          (count(*) filter (where aq.outcome in ('correct', 'partial', 'full_marks')))::integer as scored
        from public.assessment_attempt_questions aq
        join public.assessment_attempts a on a.id = aq.attempt_id
        join public.assessment_questions q on q.id = aq.question_id
        join public.assessment_topics t on t.id = q.topic_id
        where public.current_person_can_access_assessment_attempt(a.id) and a.status = 'submitted' and aq.outcome <> 'dropped'
        group by t.slug, t.name
      ) topic
    ), '[]'::jsonb)
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_assessment_attempts()
 RETURNS TABLE(attempt_id uuid, paper_id text, status text, started_at timestamp with time zone, submitted_at timestamp with time zone, score numeric, max_score numeric, question_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if not public.current_person_can_take_tests() then
    raise exception 'An active student membership is required.' using errcode = '42501';
  end if;
  return query
    select a.id, a.paper_id, a.status, a.started_at, a.submitted_at, a.score, a.max_score,
      (select count(*)::integer from public.assessment_attempt_questions aq where aq.attempt_id = a.id)
    from public.assessment_attempts a
    where public.current_person_can_access_assessment_attempt(a.id) and a.kind <> 'drawing'
    order by a.opened_at desc
    limit 200;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_my_part_b()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
 SET row_security TO 'off'
AS $function$
begin
  if not public.current_person_can_take_tests() then
    raise exception 'Test-series access is required.' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(public.get_part_b(a.id) order by a.part_b_started_at desc)
    from public.assessment_attempts a
    where public.current_person_can_access_assessment_attempt(a.id) and a.part_b_status <> 'none'
  ), '[]'::jsonb);
end;
$function$
;
