-- Coaching rights expire per canonical enrolment. Purchases/free candidate rights
-- remain separate. No legacy people/windows/attempts are rewritten or inferred.
create function public.person_has_current_coaching_access(p_person uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select exists(select 1 from public.people p join public.memberships m on m.person_id=p.id
 where p.id=p_person and p.status='active' and m.kind='student' and m.status='active'
 and (m.starts_at is null or m.starts_at<=clock_timestamp()) and (m.ends_at is null or m.ends_at>clock_timestamp()))
 and (
  -- Explicit compatibility boundary: existing un-migrated identities keep their
  -- previous rights. A managed person never falls back after course closeout.
  not exists(select 1 from public.enrollment_access_windows w join public.enrollments e on e.id=w.enrollment_id where e.person_id=p_person)
  or exists(select 1 from public.enrollments e join public.offerings o on o.id=e.offering_id
   left join public.cohorts c on c.id=e.cohort_id
   where e.person_id=p_person and public.enrollment_has_current_access(e.id)
   and o.status='active' and (e.cohort_id is null or c.status='active'))
 ) $$;
create function public.current_person_has_current_coaching_access()
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.person_has_current_coaching_access(public.current_person_id()) $$;
revoke all on function public.person_has_current_coaching_access(uuid),public.current_person_has_current_coaching_access() from public,anon,authenticated;

create or replace function public.current_person_can_take_tests()
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_current_coaching_access()
 or public.current_person_has_active_candidate_membership()
 or (public.current_person_has_active_student_membership() and exists(
  select 1 from public.assessment_entitlements e where e.person_id=public.current_person_id()
  and (e.expires_at is null or e.expires_at>clock_timestamp()))) $$;

create or replace function public.current_person_can_open_paper(p_paper_id text)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_has_current_coaching_access()
 or (public.current_person_can_take_tests() and exists(select 1 from public.assessment_entitlements e
  where e.person_id=public.current_person_id() and e.paper_id=p_paper_id
  and (e.expires_at is null or e.expires_at>clock_timestamp())))
 or (public.current_person_has_active_candidate_membership()
  and public.assessment_free_slot(p_paper_id)=any(public.assessment_level_slots((select level from public.candidate_profiles where person_id=public.current_person_id())))
  and not exists(select 1 from public.assessment_entitlements e where e.person_id=public.current_person_id() and e.free_slot=public.assessment_free_slot(p_paper_id))) $$;

create or replace function public.assessment_claim_paper(p_paper_id text)
returns void language plpgsql security definer set search_path='' set row_security=off
as $$ declare person uuid:=public.current_person_id(); begin
 perform pg_advisory_xact_lock(hashtextextended('dexam-paper-claim:'||person::text,0));
 if not public.current_person_can_open_paper(p_paper_id) then raise exception using errcode='42501',message='current paper entitlement required'; end if;
 if public.current_person_has_current_coaching_access() or exists(select 1 from public.assessment_entitlements e
  where e.person_id=person and e.paper_id=p_paper_id and (e.expires_at is null or e.expires_at>clock_timestamp())) then return; end if;
 if not public.current_person_has_active_candidate_membership() then raise exception using errcode='42501',message='candidate free-paper authority required'; end if;
 insert into public.assessment_entitlements(person_id,source,paper_id,free_slot)
 values(person,'free-onboarding',p_paper_id,public.assessment_free_slot(p_paper_id));
end $$;

-- Creation-time basis stops an old coaching attempt being relabelled as a free
-- candidate attempt when coaching later expires. This ledger grants no access.
create table public.assessment_attempt_access_basis (
 attempt_id uuid primary key references public.assessment_attempts(id) on delete cascade,
 basis text not null check(basis in ('coaching','entitlement','candidate_policy','unclassified')),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.assessment_attempt_access_basis enable row level security;
revoke all on public.assessment_attempt_access_basis from public,anon,authenticated,service_role;
create function public.record_assessment_attempt_access_basis()
returns trigger language plpgsql security definer set search_path='' set row_security=off
as $$ begin
 insert into public.assessment_attempt_access_basis(attempt_id,basis) values(new.id,
 case when public.current_person_id()=new.person_id and public.current_person_has_current_coaching_access() then 'coaching'
 when public.current_person_id()=new.person_id and exists(select 1 from public.assessment_entitlements e where e.person_id=new.person_id and e.paper_id=new.paper_id and (e.expires_at is null or e.expires_at>clock_timestamp())) then 'entitlement'
 when public.current_person_id()=new.person_id and public.current_person_has_active_candidate_membership() then 'candidate_policy'
 else 'unclassified' end);
 return new;
end $$;
revoke all on function public.record_assessment_attempt_access_basis() from public,anon,authenticated,service_role;
create trigger record_assessment_attempt_access after insert on public.assessment_attempts
for each row execute function public.record_assessment_attempt_access_basis();

create function public.current_person_can_access_assessment_attempt(p_attempt uuid)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select public.current_person_can_take_tests() and exists(select 1 from public.assessment_attempts a
 left join public.assessment_attempt_access_basis b on b.attempt_id=a.id
 where a.id=p_attempt and a.person_id=public.current_person_id() and (
  public.current_person_has_current_coaching_access()
  or exists(select 1 from public.assessment_entitlements e where e.person_id=a.person_id and e.paper_id=a.paper_id and (e.expires_at is null or e.expires_at>clock_timestamp()))
  or (public.current_person_has_active_candidate_membership() and b.basis='candidate_policy')
  -- Preserve existing candidate attempts; managed coaching attempts never qualify.
  or (public.current_person_has_active_candidate_membership() and b.attempt_id is null
   and not exists(select 1 from public.enrollments e join public.enrollment_access_windows w on w.enrollment_id=e.id where e.person_id=a.person_id))
 )) $$;
revoke all on function public.current_person_can_access_assessment_attempt(uuid) from public,anon,authenticated;

create or replace function public.current_person_can_read_assessment_media(p_object_name text)
returns boolean language sql stable security definer set search_path='' set row_security=off
as $$ select coalesce(public.current_person_has_capability('assessment.bank.read')
 or public.current_person_can_evaluate_part_b()
 or exists(select 1 from public.assessment_question_assets asset
 where asset.storage_path=p_object_name and asset.role in ('figure','option') and (
  exists(select 1 from public.assessment_attempt_questions q where q.question_id=asset.question_id and public.current_person_can_access_assessment_attempt(q.attempt_id))
  or exists(select 1 from public.assessment_attempt_tasks t where t.question_id=asset.question_id and public.current_person_can_access_assessment_attempt(t.attempt_id))
 )),false) $$;
