begin;
select no_plan();

-- Fictional records, with deliberate ties in dates, names and person IDs.
create function pg_temp.fixture_id(kind integer, n integer) returns uuid
language sql immutable as $$
  select ('ad560000-0000-4000-' || lpad(kind::text, 4, '0') || '-' || lpad(n::text, 12, '0'))::uuid
$$;
insert into auth.users(id,instance_id,aud,role,email) values
  (pg_temp.fixture_id(1,1),'00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@history.fixture.invalid');
insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values
  (pg_temp.fixture_id(2,1),pg_temp.fixture_id(1,1),'totp','verified',now(),now());
insert into auth.sessions(id,user_id,factor_id,aal,created_at,updated_at) values
  (pg_temp.fixture_id(3,1),pg_temp.fixture_id(1,1),pg_temp.fixture_id(2,1),'aal2',now(),now());
insert into auth.mfa_amr_claims(id,session_id,authentication_method,created_at,updated_at) values
  (pg_temp.fixture_id(4,1),pg_temp.fixture_id(3,1),'totp',now(),now());
insert into public.people(id,display_name) values
  (pg_temp.fixture_id(5,1),'Fictional Admissions Admin'), (pg_temp.fixture_id(5,2),'Fictional History Student');
insert into public.auth_identities(person_id,auth_user_id,kind) values
  (pg_temp.fixture_id(5,1),pg_temp.fixture_id(1,1),'employee_email');
insert into public.memberships(person_id,kind,status) values
  (pg_temp.fixture_id(5,1),'employee','active');
insert into public.role_assignments(person_id,role_key,grant_reason) values
  (pg_temp.fixture_id(5,1),'elevated_admin','Fictional directory verification');
insert into public.offerings(id,code,title,status) values
  (pg_temp.fixture_id(6,1),'HISTORY_FIXTURE','Fictional History Course','active');
insert into public.cohorts(id,offering_id,code,name,status) values
  (pg_temp.fixture_id(7,1),pg_temp.fixture_id(6,1),'HISTORY_BATCH','Fictional History Batch','active');
insert into public.enrollments(id,person_id,offering_id,cohort_id,status,source_type)
select pg_temp.fixture_id(8,n),pg_temp.fixture_id(5,2),pg_temp.fixture_id(6,1),pg_temp.fixture_id(7,1),'cancelled','manual_admission'
from generate_series(101,1,-1) n;
insert into public.enrollment_access_windows(enrollment_id,starts_at,expires_at,updated_by)
select pg_temp.fixture_id(8,n),'2026-01-01T00:00:00Z','2026-11-19T18:30:00Z'::timestamptz + n * interval '1 day',pg_temp.fixture_id(5,1)
from generate_series(1,2) n;

-- Enrollment 1 has 26 changes and 25 receipts; 2 and 3 have only 26 and 25 receipts respectively.
insert into public.admission_change_history(enrollment_id,request_key,actor_person_id,action,reason,prior_values,new_values,occurred_at)
select pg_temp.fixture_id(8,1),pg_temp.fixture_id(9,n),pg_temp.fixture_id(5,1),'details','Fictional change ' || n,
  '{"name":"Old name","internal":"hidden"}','{"name":"New name","cohortId":null,"request":{"name":"private retry snapshot"}}',now()
from generate_series(1,26) n order by n;
insert into public.admission_receipts(id,request_key,person_id,enrollment_id,method,amount_paise,paid_at,reference,confirmed_by,confirmed_at,request_snapshot)
select pg_temp.fixture_id(10 + e,n), pg_temp.fixture_id(20 + e,n), pg_temp.fixture_id(5,2), pg_temp.fixture_id(8,e),
  'cash',n * 100,now(),'Fictional receipt ' || n, pg_temp.fixture_id(5,1),now(),'{"private":"snapshot"}'
from generate_series(1,3) e cross join generate_series(1,26) n
where e=2 or n<=25;

set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub',pg_temp.fixture_id(1,1),'session_id',pg_temp.fixture_id(3,1),
  'role','authenticated','aal','aal2')::text,true);

-- Snapshot a result once for several field assertions.
select set_config('test.history_first',public.get_admission_history_page(pg_temp.fixture_id(8,1),0)::text,true) is not null;
select set_config('test.history_second',public.get_admission_history_page(pg_temp.fixture_id(8,1),1)::text,true) is not null;
select is(jsonb_array_length(current_setting('test.history_first')::jsonb->'changes'),25,'first change page is bounded');
select is(jsonb_array_length(current_setting('test.history_first')::jsonb->'receipts'),25,'first receipt page is bounded');
select is(current_setting('test.history_first')::jsonb->'hasMore','true'::jsonb,'additional change makes another page available');
select is(current_setting('test.history_first')::jsonb#>>'{changes,0,reason}','Fictional change 26','equal change timestamps order by descending change ID');
select is(current_setting('test.history_first')::jsonb#>>'{changes,0,actorName}','Fictional Admissions Admin','change identifies its actor');
select is(current_setting('test.history_first')::jsonb#>'{changes,0,prior}','{"name":"Old name"}'::jsonb,'prior audit values use the approved fields');
select is(current_setting('test.history_first')::jsonb#>'{changes,0,next}','{"name":"New name","cohortId":null}'::jsonb,'public after-values preserve explicit nulls and omit private retry data');
select is(current_setting('test.history_first')::jsonb#>>'{receipts,0,reference}','Fictional receipt 25','equal receipt timestamps order by descending receipt ID');
select is(current_setting('test.history_first')::jsonb#>>'{receipts,0,confirmedByName}','Fictional Admissions Admin','receipt identifies its confirmer');
select is(current_setting('test.history_first')::jsonb#>'{receipts,0,amountPaise}','2500'::jsonb,'amount stays in integer paise');
select is(current_setting('test.history_second')::jsonb#>>'{changes,0,reason}','Fictional change 1','oldest change remains reachable on the next page');
select is(jsonb_array_length(current_setting('test.history_second')::jsonb->'changes'),1,'second page contains no repeated changes');
select is(current_setting('test.history_second')::jsonb->'receipts','[]'::jsonb,'second page contains no receipts from another enrolment');
select is(current_setting('test.history_second')::jsonb->'hasMore','false'::jsonb,'last page ends pagination');
select is(public.get_admission_history_page(pg_temp.fixture_id(8,2),0)->'hasMore','true'::jsonb,'additional receipt alone makes another page available');
select is(public.get_admission_history_page(pg_temp.fixture_id(8,2),1)#>>'{receipts,0,reference}','Fictional receipt 1','oldest receipt remains reachable');
select is(public.get_admission_history_page(pg_temp.fixture_id(8,3),0)->'hasMore','false'::jsonb,'exactly 25 entries is also a complete page');
select is(public.get_admission_history_page(pg_temp.fixture_id(8,4),0),'{"changes":[],"receipts":[],"hasMore":false}'::jsonb,'enrolment without evidence has empty history');
select is(public.get_admission_history_page(pg_temp.fixture_id(8,1),2147483647),'{"changes":[],"receipts":[],"hasMore":false}'::jsonb,'large page offset is overflow-safe');
select throws_ok($$select public.get_admission_history_page(pg_temp.fixture_id(8,1),-1)$$,'22023',null,'negative page rejected');
select throws_ok($$select public.get_admission_history_page(pg_temp.fixture_id(8,1),null)$$,'22023',null,'missing page rejected');
select throws_ok($$select public.get_admission_history_page(null,0)$$,'22023',null,'missing enrolment rejected');
select is(jsonb_array_length(public.get_admission_history(pg_temp.fixture_id(8,1))->'changes'),26,'existing admin history contract is preserved');

select is(
  (select array_agg((entry->>'enrollmentId')::uuid order by ord) from jsonb_array_elements(
    public.list_admissions_directory('Fictional History Student',pg_temp.fixture_id(6,1),pg_temp.fixture_id(7,1),'ended')
  ) with ordinality as entries(entry,ord)),
  (select array_agg(pg_temp.fixture_id(8,n) order by n) from generate_series(1,100) n),
  'directory returns 100 distinct enrolments in stable order when name and person match');
select is(public.list_admissions_directory('Fictional History Student',p_offset=>100)->0->>'enrollmentId',
  pg_temp.fixture_id(8,101)::text,'the next directory page starts with the remaining enrolment');
select is(jsonb_array_length(public.list_admissions_directory(p_offering=>pg_temp.fixture_id(6,1),
  p_cohort=>pg_temp.fixture_id(7,1),p_state=>'ended',p_expires_before=>'2026-11-20T18:30:00Z')),1,
  'combined course, batch, state, and expiry filters include the exact cutoff');
select throws_ok('select * from public.admission_receipts','42501',null,'browser cannot select private receipt snapshots directly');
select throws_ok('select * from public.admission_change_history','42501',null,'browser cannot select the raw history table');

-- An enrolment stays filterable after its batch finishes and its course is archived.
reset role;
update public.cohorts set status='completed' where id=pg_temp.fixture_id(7,1);
insert into public.cohorts(id,offering_id,code,name,status) values
  (pg_temp.fixture_id(7,2),pg_temp.fixture_id(6,1),'UNUSED_HISTORY','Unused History Batch','completed');
set local role authenticated;
select ok((public.get_admission_choices()->'offerings') @>
  jsonb_build_array(jsonb_build_object('id',pg_temp.fixture_id(6,1),'batches','[]'::jsonb)),
  'an active course remains a creation option after a batch ends');
select ok(not (public.get_admission_choices()->'offerings') @>
  jsonb_build_array(jsonb_build_object('id',pg_temp.fixture_id(6,1),'batches',
    jsonb_build_array(jsonb_build_object('id',pg_temp.fixture_id(7,1))))),
  'a completed batch cannot become a creation or transfer choice');
reset role;
update public.offerings set status='archived' where id=pg_temp.fixture_id(6,1);
set local role authenticated;
select ok(not (public.get_admission_choices()->'offerings') @>
  jsonb_build_array(jsonb_build_object('id',pg_temp.fixture_id(6,1))),
  'an archived course cannot become a creation choice');
select is((select o->'batches' from jsonb_array_elements(public.get_admission_choices()->'directoryOfferings') o
  where o->>'id'=pg_temp.fixture_id(6,1)::text),
  jsonb_build_array(jsonb_build_object('id',pg_temp.fixture_id(7,1),'name','Fictional History Batch')),
  'historic directory choices include the enrolled archived course and only its active or previously enrolled batches');

reset role;
update public.role_assignments set role_key='teacher' where person_id=pg_temp.fixture_id(5,1);
set local role authenticated;
select throws_ok($$select public.get_admission_history_page(pg_temp.fixture_id(8,1),0)$$,'42501',null,'teacher cannot open admissions history');
select throws_ok('select public.get_admission_choices()','42501',null,'teacher cannot enumerate historical courses and batches');
select throws_ok($$select public.get_admission_history_page(null,-1)$$,'42501',null,'authority is checked before input validation');
reset role;
set local role anon;
select throws_ok($$select public.get_admission_history_page(null,0)$$,'42501',null,'anonymous caller cannot execute the history RPC');
reset role;
select * from finish();
rollback;
