begin;
select no_plan();

-- All accounts, CRM contacts, receipts, and the admissions gate are transaction-local fixtures.
create function pg_temp.fixture_id(n integer) returns uuid language sql immutable as $$
  select ('ad561000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
$$;
insert into auth.users(id,instance_id,aud,role,email) values
  (pg_temp.fixture_id(1),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@cross-course.fixture.invalid');
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values
  (pg_temp.fixture_id(2),pg_temp.fixture_id(1),'totp','verified',now(),now());
insert into auth.sessions(id,user_id,factor_id,aal,created_at,updated_at) values
  (pg_temp.fixture_id(3),pg_temp.fixture_id(1),pg_temp.fixture_id(2),'aal2',now(),now());
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values
  (pg_temp.fixture_id(4),pg_temp.fixture_id(3),'totp',now(),now());
insert into public.people(id,display_name) values
  (pg_temp.fixture_id(5),'Fictional Cross-Course Admin'),
  (pg_temp.fixture_id(6),'Fictional Two-Course Learner'),
  (pg_temp.fixture_id(7),'Fictional Guardian');
insert into public.auth_identities(person_id,auth_user_id,kind) values
  (pg_temp.fixture_id(5),pg_temp.fixture_id(1),'employee_email');
insert into public.memberships(person_id,kind,status) values (pg_temp.fixture_id(5),'employee','active');
insert into public.role_assignments(person_id,role_key,grant_reason) values
  (pg_temp.fixture_id(5),'elevated_admin','Cross-course admissions fixture');
insert into public.crm_person_relationships(subject_person_id,related_person_id,relationship,created_by_person_id) values
  (pg_temp.fixture_id(6),pg_temp.fixture_id(7),'guardian',pg_temp.fixture_id(5));
insert into public.crm_contact_points(person_id,kind,normalized_value,display_value,is_verified,created_by_person_id) values
  (pg_temp.fixture_id(7),'email','guardian@cross-course.fixture.invalid','guardian@cross-course.fixture.invalid',true,pg_temp.fixture_id(5));
insert into public.offerings(id,code,title,status) values
  (pg_temp.fixture_id(11),'CROSS_COURSE_A','Fictional Course A','active'),
  (pg_temp.fixture_id(12),'CROSS_COURSE_B','Fictional Course B','active');
update public.admissions_runtime_gate set enabled=true where singleton;

create function pg_temp.admit_course(course integer) returns jsonb language sql as $$
  select public.admit_student(
    p_request_key=>pg_temp.fixture_id(20 + course),p_existing_person=>pg_temp.fixture_id(6),
    p_email=>'student@cross-course.fixture.invalid',p_name=>'Fictional Two-Course Learner',
    p_offering=>pg_temp.fixture_id(10 + course),p_cohort=>null,
    p_start=>clock_timestamp() + interval '3 seconds',p_expiry=>now() + course * interval '30 days',
    p_method=>'cash',p_amount_paise=>course * 10000,p_paid_at=>now(),
    p_reference=>'Fictional receipt ' || course,p_confirmed=>true,p_reason=>'Reviewed existing learner'
  )
$$;
create function pg_temp.course_row(course integer) returns jsonb language sql stable as $$
  select public.list_admissions_directory('student@cross-course.fixture.invalid',p_offering=>pg_temp.fixture_id(10 + course))->0
$$;
-- Submit the exact enrolment and shared-person revisions previously returned by the directory.
create function pg_temp.edit(viewed jsonb, request_no integer, action text, new_name text default null, expiry timestamptz default null)
returns bigint language sql as $$
  select public.edit_admission(
    p_enrollment=>(viewed->>'enrollmentId')::uuid,p_expected_revision=>(viewed->>'revision')::bigint,
    p_expected_person_revision=>(viewed->>'loginRevision')::bigint,p_request_key=>pg_temp.fixture_id(request_no),
    p_action=>action,p_reason=>'Reviewed fictional ' || action,p_name=>new_name,p_expiry=>expiry
  )
$$;
create function pg_temp.course_history(course integer) returns jsonb language sql stable as $$
  select public.get_admission_history((pg_temp.course_row(course)->>'enrollmentId')::uuid)
$$;

set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fixture_id(1),'session_id',pg_temp.fixture_id(3),
  'role','authenticated','aal','aal2')::text,true);
select set_config('test.admission_a',pg_temp.admit_course(1)::text,true) is not null;
select set_config('test.admission_b',pg_temp.admit_course(2)::text,true) is not null;
select set_config('test.view_a',pg_temp.course_row(1)::text,true) is not null;
select set_config('test.view_b',pg_temp.course_row(2)::text,true) is not null;
select set_config('test.receipts_a',(pg_temp.course_history(1)->'receipts')::text,true) is not null;
select set_config('test.receipts_b',(pg_temp.course_history(2)->'receipts')::text,true) is not null;

select is(current_setting('test.admission_a')::jsonb->>'personId',pg_temp.fixture_id(6)::text,'first course uses the selected CRM student');
select is(current_setting('test.admission_b')::jsonb->>'personId',pg_temp.fixture_id(6)::text,'second course retains the same canonical student');
select matches(current_setting('test.admission_a')::jsonb->>'memberId','^DXM-[2-9A-HJKMNP-Z]{12}$','first admission assigns a valid Member ID');
select is(current_setting('test.admission_a')::jsonb->>'memberId',current_setting('test.admission_b')::jsonb->>'memberId','Member ID carries across courses');
select isnt(pg_temp.course_row(1)->>'enrollmentId',pg_temp.course_row(2)->>'enrollmentId','each course receives a distinct enrolment');
select is(jsonb_array_length(public.list_admissions_directory('student@cross-course.fixture.invalid')),2,'approved login finds both enrolments');
select is((pg_temp.course_row(1)->>'expiresAt')::timestamptz,now() + interval '30 days','first admission has its own expiry');
select is((pg_temp.course_row(2)->>'expiresAt')::timestamptz,now() + interval '60 days','second admission has a different expiry');
select is(pg_temp.course_history(1)#>>'{receipts,0,id}',current_setting('test.admission_a')::jsonb->>'receiptId','first history shows the first admission receipt');
select is(pg_temp.course_history(2)#>>'{receipts,0,id}',current_setting('test.admission_b')::jsonb->>'receiptId','second history shows the second admission receipt');
select is(pg_temp.course_history(1)#>>'{receipts,0,amountPaise}','10000','first receipt keeps its own amount');
select is(pg_temp.course_history(2)#>>'{receipts,0,amountPaise}','20000','second receipt keeps its own amount');

select is(pg_temp.edit(current_setting('test.view_a')::jsonb,31,'details','Fictional Revised Learner'),2::bigint,'course A editor updates the shared name');
select is(pg_temp.course_row(2)->>'name','Fictional Revised Learner','course B immediately displays the same canonical name');
select is(pg_temp.course_row(2)->>'revision',current_setting('test.view_b')::jsonb->>'revision','the course B access window itself is unchanged');
select throws_ok($$select pg_temp.edit(current_setting('test.view_b')::jsonb,32,'renewal',expiry=>now() + interval '180 days')$$,
  '40001','student profile changed; refresh all enrolments before editing','a stale course B editor must refresh after the shared name change');
select is(pg_temp.course_row(2)->>'expiresAt',current_setting('test.view_b')::jsonb->>'expiresAt','stale edit leaves course B expiry intact');
select is(pg_temp.edit(pg_temp.course_row(2),32,'renewal',expiry=>now() + interval '180 days'),2::bigint,'a refreshed course B editor can renew its own course');
select is((pg_temp.course_row(2)->>'expiresAt')::timestamptz,now() + interval '180 days','course B gets the approved extension');
select is(pg_temp.course_row(1)->>'expiresAt',current_setting('test.view_a')::jsonb->>'expiresAt','extending course B never changes course A expiry');
select is(pg_temp.edit(pg_temp.course_row(1),33,'suspension'),3::bigint,'course A can be suspended independently');
select is(pg_temp.course_row(1)->>'state','suspended','course A is suspended');

-- Admissions accept only future starts. Advance to the later recorded start without changing either window.
select pg_sleep_until(least(greatest((current_setting('test.view_a')::jsonb->>'startsAt')::timestamptz,
  (current_setting('test.view_b')::jsonb->>'startsAt')::timestamptz),clock_timestamp() + interval '3 seconds'));
select is(pg_temp.course_row(2)->>'state','active','course B remains active while course A is suspended');
select is(pg_temp.course_row(2)->>'startsAt',current_setting('test.view_b')::jsonb->>'startsAt','course B keeps its original start');
select is(pg_temp.course_history(1)->'receipts',current_setting('test.receipts_a')::jsonb,'course A receipt evidence remains identical after all edits');
select is(pg_temp.course_history(2)->'receipts',current_setting('test.receipts_b')::jsonb,'course B receipt evidence remains identical after all edits');
select is((select array_agg(entry->>'action' order by n) from jsonb_array_elements(pg_temp.course_history(1)->'changes') with ordinality as changes(entry,n)),
  array['admitted','details','suspension'],'course A history contains only its own successful edits');
select is((select array_agg(entry->>'action' order by n) from jsonb_array_elements(pg_temp.course_history(2)->'changes') with ordinality as changes(entry,n)),
  array['admitted','renewal'],'course B history excludes the refused edit and course A operations');
select is(public.search_admission_identity('guardian@cross-course.fixture.invalid'),'[]'::jsonb,'verified guardian contact does not become a login identity match');
select is(public.list_admissions_directory('guardian@cross-course.fixture.invalid'),'[]'::jsonb,'guardian email cannot locate the student in the admissions directory');
select is(jsonb_array_length(public.search_admission_identity('student@cross-course.fixture.invalid')),1,'approved login resolves only one canonical person');
select is(public.search_admission_identity('student@cross-course.fixture.invalid')->0->>'personId',pg_temp.fixture_id(6)::text,'admissions identity search still resolves the student login');

reset role;
select is((select count(*)::integer from public.memberships where person_id=pg_temp.fixture_id(6) and kind='student' and status='active'),1,
  'two courses share one active student membership');
select is((select count(*)::integer from public.approved_login_emails where person_id=pg_temp.fixture_id(7)),0,'guardian has no approved login reservation');
select is((select normalized_value from public.crm_contact_points where person_id=pg_temp.fixture_id(7)),'guardian@cross-course.fixture.invalid',
  'independent course operations preserve the guardian contact on the guardian person');
select * from finish();
rollback;
