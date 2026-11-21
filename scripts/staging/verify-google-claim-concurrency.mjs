// F054/F056: run only on a fresh disposable local DB. Fixtures persist until its owner removes it.
import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { createInterface } from 'node:readline'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'

const container = process.argv[2]
assert.match(container ?? '', /^supabase_db_dexam-f054-claims-[a-z0-9]+$/)
const psql = [
  'exec',
  '-i',
  container,
  'psql',
  '-XqAt',
  '-v',
  'ON_ERROR_STOP=1',
  '-U',
  'postgres',
  '-d',
  'postgres',
]
const exec = promisify(execFile)
const sql = async (statement) =>
  (await exec('docker', [...psql, '-c', statement], { timeout: 20000 })).stdout.trim()

assert.equal(
  await sql(`select not exists(select 1 from public.people)
  and not exists(select 1 from auth.users)
  and not exists(select 1 from public.assessment_questions)
  and not (select enabled from public.admissions_runtime_gate where singleton)
  and not (select enabled from public.app_google_login_gate where singleton)`),
  't',
  'Use an empty, owned local claims fixture database with both gates closed.',
)

const user = randomUUID(),
  student = randomUUID(),
  recorder = randomUUID(),
  course = randomUUID(),
  enrollment = randomUUID()
const sessionA = randomUUID(),
  sessionB = randomUUID()
const email = 'student@claim-race.fixture.invalid'
const member = 'DXM-T72Q9M4X6WKP'
const setupSession = (name, id) => `begin;
  set local application_name = '${name}';
  set local statement_timeout = '15s';
  set local idle_in_transaction_session_timeout = '20s';
  set local role authenticated;
  set local request.jwt.claims = '${JSON.stringify({ sub: user, session_id: id, role: 'authenticated', aal: 'aal1' })}';`

let locker, lockerExit, contender
try {
  await sql(`begin;
    insert into auth.users(id,instance_id,aud,role,email,email_confirmed_at)
      values ('${user}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${email}',now());
    insert into auth.identities(provider_id,user_id,identity_data,provider)
      values ('fixture-claim-race','${user}', jsonb_build_object('sub','fixture-claim-race','email','${email}','email_verified',true),'google');
    insert into auth.sessions(id,user_id,aal,created_at,updated_at)
      values ('${sessionA}','${user}','aal1',now(),now()),('${sessionB}','${user}','aal1',now(),now());
    insert into public.people(id,member_id,display_name) values
      ('${student}','${member}','Fictional claim student'),('${recorder}',null,'Fictional payment recorder');
    insert into public.memberships(person_id,kind,status) values ('${student}','student','active');
    insert into public.approved_login_emails(person_id,email,purpose,created_by)
      values ('${student}','${email}','student','${recorder}');
    insert into public.offerings(id,code,title,status) values ('${course}','CLAIM_RACE','Fictional course','active');
    insert into public.enrollments(id,person_id,offering_id,status,source_type)
      values ('${enrollment}','${student}','${course}','active','fixture');
    insert into public.student_payments(request_key,enrollment_id,person_id,kind,method,amount_paise,paid_on,collected_by_person_id,recorded_by_person_id)
      values (gen_random_uuid(),'${enrollment}','${student}','admission_fee','cash',500000,current_date,'${recorder}','${recorder}');
    update public.app_google_login_gate set enabled=true where singleton;
    commit;`)

  locker = spawn('docker', psql, { stdio: ['pipe', 'pipe', 'inherit'] })
  lockerExit = once(locker, 'close')
  const lines = createInterface({ input: locker.stdout })
  const ready = once(lines, 'line', { signal: AbortSignal.timeout(10000) })
  locker.stdin.write(
    setupSession('f054-app-claim', sessionA) +
      `
    select public.claim_app_google_login() = '{"allowed":true,"audience":"student"}'::jsonb;
  `,
  )
  assert.equal((await ready)[0], 't', 'App callback claimed the paid student before commit')

  // The second backend runs the actual Mock Test callback while the first still owns the claim.
  contender = sql(
    setupSession('f054-mock-claim', sessionB) +
      `
    select public.provision_google_candidate() = '{"created":false}'::jsonb;
    select public.current_person_id() = '${student}'::uuid;
    commit;`,
  )
  // Observe errors after releasing the first transaction, including on assertion failures.
  contender.catch(() => {})
  let blocked = false
  const deadline = Date.now() + 6000
  while (!blocked && Date.now() < deadline) {
    blocked =
      (await sql(`select exists(select 1 from pg_stat_activity second
      join pg_stat_activity first on first.pid = any(pg_blocking_pids(second.pid))
      where second.application_name='f054-mock-claim' and first.application_name='f054-app-claim'
        and second.wait_event_type='Lock')`)) === 't'
    if (!blocked) await delay(30)
  }
  assert.ok(blocked, 'The Mock Test callback waited for the actual uncommitted App claim')
  locker.stdin.end('commit;\n')
  assert.equal((await lockerExit)[0], 0)
  assert.equal(await contender, 't\nt', 'Mock Test reused the committed canonical student')

  assert.equal(
    await sql(`select (select count(*) from public.auth_identities)=1
    and exists(select 1 from public.auth_identities where auth_user_id='${user}' and person_id='${student}' and kind='oauth_google')
    and exists(select 1 from public.people where id='${student}' and member_id='${member}')
    and (select count(*) from public.people)=2
    and (select count(*) from public.memberships)=1 and not exists(select 1 from public.role_assignments)
    and (select count(*) from public.student_payments)=1`),
    't',
  )
  console.log(
    'Passed: concurrent App and Mock Test callbacks retained one student, binding, membership and payment.',
  )
} finally {
  if (locker && !locker.stdin.writableEnded) locker.stdin.end('rollback;\n')
  await Promise.allSettled([lockerExit, contender])
  await sql('update public.app_google_login_gate set enabled=false where singleton')
}
