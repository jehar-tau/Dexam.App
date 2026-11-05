/** F054: fictional two-connection acceptance on an EMPTY disposable test stack only.
 * Leaves its fixtures in that isolated DB for inspection. Reset only that stack
 * afterwards. Never point this at development, staging or a hosted database.
 */
import { spawn, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const exec = promisify(execFile)
const container = process.argv[2]
if (!/^supabase_db_dexam-f054-[a-z0-9]+$/.test(container ?? ''))
  throw new Error(
    'Provide the exact owned dexam-f054 disposable database container, not a development database.',
  )
async function sql(source, tolerateFailure = false) {
  try {
    const { stdout } = await exec(
      'docker',
      [
        'exec',
        '-i',
        container,
        'psql',
        '-U',
        'postgres',
        '-d',
        'postgres',
        '-qAt',
        '-v',
        'ON_ERROR_STOP=1',
        '-v',
        'VERBOSITY=sqlstate',
        '-c',
        source,
      ],
      { maxBuffer: 1024 * 1024 },
    )
    return { ok: true, output: stdout.trim() }
  } catch (failure) {
    if (!tolerateFailure)
      throw new Error(`Isolated SQL acceptance failed: ${failure.stderr ?? 'psql failure'}`, {
        cause: failure,
      })
    return { ok: false, output: failure.stderr ?? '' }
  }
}
assert.equal(
  (await sql('select count(*) from public.people')).output,
  '0',
  'requires empty disposable people directory',
)
assert.equal(
  (await sql('select count(*) from public.assessment_questions')).output,
  '0',
  'requires empty disposable question bank',
)
assert.equal(
  (await sql('select enabled from public.admissions_runtime_gate')).output,
  'f',
  'integration must start disabled',
)
const fixture = await readFile(
  new URL('../../supabase/tests/00510_shared_admissions.test.sql', import.meta.url),
  'utf8',
)
const seed = fixture.slice(
  fixture.indexOf('insert into auth.users'),
  fixture.indexOf('select is(public.admission_normalized_email'),
)
assert.ok(seed.includes('Fictional Admin'))
const jwt = (user, session, aal) =>
  JSON.stringify({ sub: user, session_id: session, role: 'authenticated', aal })
const admin = jwt(
  'ab000000-0000-4000-8000-000000000001',
  'ab300000-0000-4000-8000-000000000001',
  'aal2',
)
const student = jwt(
  'ab000000-0000-4000-8000-000000000004',
  'ab300000-0000-4000-8000-000000000004',
  'aal1',
)
const asAdmin = (query) =>
  `begin; set local role authenticated; set local request.jwt.claims='${admin}'; ${query}; commit;`
const tomorrow = new Date(Date.now() + 86_400_000).toISOString()
const expiry = new Date(Date.now() + 31 * 86_400_000).toISOString()
const paid = new Date(Date.now() - 60_000).toISOString()
const admit = (key, email) =>
  asAdmin(
    `select public.admit_student('${key}',null,'${email}','Fictional Concurrent Learner','ab500000-0000-4000-8000-000000000001','ab600000-0000-4000-8000-000000000001','${tomorrow}','${expiry}','cash',250000,'${paid}','Fictional concurrency receipt',true,'Fictional duplicate race')`,
  )
let locker
try {
  await sql(`begin; ${seed} update public.admissions_runtime_gate set enabled=true; commit;`)
  const results = await Promise.all([
    sql(admit('ad700000-0000-4000-8000-000000000001', 'race@fixture.invalid'), true),
    sql(admit('ad700000-0000-4000-8000-000000000002', ' RACE@fixture.invalid '), true),
  ])
  assert.equal(results.filter((r) => r.ok).length, 1, 'exactly one concurrent admission succeeds')
  assert.match(
    results.find((r) => !r.ok).output,
    /40001/,
    'other caller gets recoverable identity conflict',
  )
  assert.equal((await sql('select count(*) from public.admission_receipts')).output, '1')
  assert.equal((await sql('select count(*) from public.approved_login_emails')).output, '1')
  const enrollment = (await sql('select enrollment_id from public.admission_receipts')).output
  const person = (await sql('select person_id from public.admission_receipts')).output
  assert.match(enrollment, /^[0-9a-f-]{36}$/)
  assert.match(person, /^[0-9a-f-]{36}$/)
  await sql(`begin;
   insert into auth.users(id,instance_id,aud,role,email) values('ab000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','queued@fixture.invalid');
   insert into public.auth_identities(person_id,auth_user_id,kind) values('${person}','ab000000-0000-4000-8000-000000000004','member_id');
   insert into auth.sessions(id,user_id,aal,created_at,updated_at) values('ab300000-0000-4000-8000-000000000004','ab000000-0000-4000-8000-000000000004','aal1',now(),now());
   update public.enrollment_access_windows set starts_at=clock_timestamp()-interval '1 day',expires_at=clock_timestamp()+interval '1 day' where enrollment_id='${enrollment}';
   set local request.jwt.claims='${student}';
   insert into public.assessment_attempts(id,person_id,paper_id,exam,duration_minutes,objective_count,marking)
    values('ad930000-0000-4000-8000-000000000001','${person}','uceed-queued-fiction','uceed',60,0,'{}');
   insert into public.assessment_entitlements(person_id,source,paper_id,expires_at) values('${person}','purchase','uceed-unrelated-fiction',now()+interval '1 month');
   commit;`)
  assert.equal(
    (
      await sql(
        "select basis from public.assessment_attempt_access_basis where attempt_id='ad930000-0000-4000-8000-000000000001'",
      )
    ).output,
    'coaching',
  )
  locker = spawn('docker', [
    'exec',
    '-i',
    container,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-qAt',
    '-v',
    'ON_ERROR_STOP=1',
  ])
  let lockOutput = ''
  const locked = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Row-lock handshake timed out')), 5000)
    locker.stdout.on('data', (chunk) => {
      lockOutput += chunk
      if (lockOutput.includes('F054_LOCKED')) {
        clearTimeout(timeout)
        resolve()
      }
    })
    locker.on('error', reject)
  })
  locker.stdin.write(
    "begin; select id from public.assessment_attempts where id='ad930000-0000-4000-8000-000000000001' for update; select 'F054_LOCKED';\n",
  )
  await locked
  const queued = sql(
    `begin; set local application_name='f054-queued-attempt'; set local role authenticated; set local request.jwt.claims='${student}'; select public.begin_assessment_attempt('ad930000-0000-4000-8000-000000000001'); commit;`,
    true,
  )
  let waiting = false
  for (let i = 0; i < 80; i++) {
    if (
      (
        await sql(
          "select exists(select 1 from pg_stat_activity where application_name='f054-queued-attempt' and wait_event_type='Lock')",
        )
      ).output === 't'
    ) {
      waiting = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  assert.ok(waiting, 'operation reached real row-lock wait after precheck')
  await sql(
    `update public.enrollment_access_windows set expires_at=clock_timestamp() where enrollment_id='${enrollment}'`,
  )
  locker.stdin.end('commit;\n')
  const denied = await queued
  assert.equal(denied.ok, false, 'queued mutation is denied after exact course expiry')
  assert.match(denied.output, /42501/)
  assert.equal(
    (
      await sql(
        "select status from public.assessment_attempts where id='ad930000-0000-4000-8000-000000000001'",
      )
    ).output,
    'open',
    'denied mutation leaves attempt unchanged',
  )
  console.log(
    'PASS: concurrent normalized duplicate, single receipt, exact-attempt post-lock expiry denial despite unrelated purchase.',
  )
} finally {
  locker?.stdin.end('rollback;\n')
  await sql('update public.admissions_runtime_gate set enabled=false', true)
}
