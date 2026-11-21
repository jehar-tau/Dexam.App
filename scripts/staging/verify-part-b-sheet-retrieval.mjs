// Run `node scripts/staging/verify-part-b-sheet-retrieval.mjs <workdir>` with a newly started,
// empty dexam-f054-sheet-* project with Auth, REST and Storage. The test creates a fictional
// student and a submitted drawing. Stop that disposable project with --no-backup afterward.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const workdir = process.argv[2]
assert.ok(workdir, 'Supply the workdir of a fresh local sheet-retrieval project.')
const project = /^project_id = "(dexam-f054-sheet-[a-z0-9]+)"$/m.exec(
  readFileSync(join(workdir, 'supabase/config.toml'), 'utf8'),
)?.[1]
assert.ok(project, 'Use a disposable sheet-retrieval project.')
const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--workdir', workdir, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
)
const api = new URL(config.API_URL)
assert.ok(api.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(api.hostname))
const ports = JSON.parse(
  execFileSync(
    'docker',
    [
      'inspect',
      '--format',
      '{{json (index .NetworkSettings.Ports "8000/tcp")}}',
      'supabase_kong_' + project,
    ],
    { encoding: 'utf8' },
  ),
)
assert.ok(
  ports?.some(({ HostPort }) => HostPort === api.port),
  'API port must belong to the same named project gateway.',
)

function sql(input) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_' + project,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
}
assert.equal(
  sql(
    'select (select count(*) from public.people) + (select count(*) from auth.users) + (select count(*) from public.assessment_questions);',
  ),
  '0',
  'An empty disposable local database is required.',
)
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(api.href, config.SERVICE_ROLE_KEY, options)
const student = createClient(api.href, config.ANON_KEY, options)
function checked({ data, error }, operation) {
  if (error)
    throw new Error(`Fictional ${operation} failed: ${error.code ?? error.status ?? 'error'}`)
  return data
}
const email = `partb-${randomUUID()}@fixture.invalid`
const password = randomBytes(32).toString('base64url')
const user = checked(
  await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  'student setup',
).user
assert.match(user.id, /^[a-f0-9-]{36}$/)
const session = checked(
  await student.auth.signInWithPassword({ email, password }),
  'student sign-in',
).session
const person = randomUUID()
const course = randomUUID()
const enrollment = randomUUID()
sql(`
  begin;
  insert into public.people(id,member_id,display_name) values('${person}','DXM-PARTBSTA2AAA','Fictional sheet owner');
  insert into public.auth_identities(person_id,auth_user_id,kind) values('${person}','${user.id}','member_id');
  insert into public.memberships(person_id,kind,status,starts_at) values('${person}','student','active',now()-interval '1 day');
  insert into public.offerings(id,code,title,status) values('${course}','F054_SHEET','Fictional sheet course','active');
  insert into public.enrollments(id,person_id,offering_id,status,source_type) values('${enrollment}','${person}','${course}','active','test_fixture');
  insert into public.enrollment_access_windows(enrollment_id,starts_at,expires_at,updated_by)
    values('${enrollment}',now()-interval '1 day',now()+interval '1 day','${person}');
  commit;
`)
const fixture = readFileSync(
  new URL('../../supabase/tests/00440_part_b_uploads_evaluation.test.sql', import.meta.url),
  'utf8',
)
// Reuse the fictional CEED paper and its drawing tasks from the Part B pgTAP suite.
const paperStart = fixture.indexOf('insert into public.assessment_questions')
const paperEnd = fixture.indexOf('select is((select public from storage.buckets', paperStart)
assert.ok(paperStart >= 0 && paperEnd > paperStart, 'The fictional CEED fixture must be present.')
sql('begin;\n' + fixture.slice(paperStart, paperEnd) + '\ncommit;')

const attempt = checked(
  await student.rpc('open_assessment_attempt', { p_paper_id: 'ceed-2093' }),
  'Part A open',
).attemptId
const args = { p_attempt_id: attempt }
checked(await student.rpc('begin_assessment_attempt', args), 'Part A begin')
checked(
  await student.rpc('submit_assessment_attempt', { ...args, p_responses: {} }),
  'Part A submission',
)
const task = checked(await student.rpc('begin_part_b', args), 'drawing begin').tasks[0].id
const sheet = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMwar8IAAJ5AYtGC/zdAAAAAElFTkSuQmCC',
  'base64',
)
const path = `${attempt}/${task}/${randomUUID()}.png`
checked(
  await student.storage
    .from('assessment-part-b')
    .upload(path, sheet, { contentType: 'image/png', upsert: false }),
  'sheet upload',
)
checked(
  await student.rpc('register_part_b_upload', {
    ...args,
    p_question_id: task,
    p_storage_path: path,
    p_mime_type: 'image/png',
    p_byte_size: sheet.length,
  }),
  'sheet registration',
)
checked(await student.rpc('start_part_b_upload', args), 'finish drawing')
checked(await student.rpc('submit_part_b', args), 'sheet submission')

const url = new URL('/storage/v1/object/authenticated/assessment-part-b/' + path, api)
async function readSheet(label, allowed) {
  const response = await fetch(url, {
    headers: { apikey: config.ANON_KEY, Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
    redirect: 'error',
  })
  if (allowed) {
    assert.equal(response.status, 200, label)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), sheet, label)
    console.log(`${label}: HTTP 200, ${sheet.length} matching bytes`)
  } else {
    assert.ok([400, 401, 403, 404].includes(response.status), `${label}: HTTP ${response.status}`)
    assert.notDeepEqual(Buffer.from(await response.arrayBuffer()), sheet, label)
    console.log(`${label}: HTTP ${response.status}, sheet withheld`)
  }
}

await readSheet('Active coaching', true)
sql(
  `update public.enrollment_access_windows set expires_at=statement_timestamp() where enrollment_id='${enrollment}';`,
)
await readSheet('Expired coaching', false)
sql(
  `insert into public.assessment_entitlements(person_id,source,paper_id,expires_at) values('${person}','purchase','ceed-other-fixture',now()+interval '1 day');`,
)
assert.equal(
  checked(
    await student.rpc('current_person_can_open_paper', { p_paper_id: 'ceed-other-fixture' }),
    'other paper access',
  ),
  true,
)
await readSheet('Purchase for another paper', false)
sql(
  `insert into public.assessment_entitlements(person_id,source,paper_id,expires_at) values('${person}','purchase','ceed-2093',now()+interval '1 day');`,
)
await readSheet('Purchase for this paper', true)
console.log('Original sheet SHA-256', createHash('sha256').update(sheet).digest('hex'))
