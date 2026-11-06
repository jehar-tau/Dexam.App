/** D-065/F054: real HTTP acceptance for per-request file retrieval on an OWNED disposable stack.
 * Usage: node scripts/staging/verify-protected-file-retrieval.mjs <workdir of a dexam-f054-* stack>
 * Creates fictional people and files, proves bytes arrive without any signed link, then expires
 * the same session's access and proves the next read is refused. Never print credentials.
 * Never point this at development, staging or a hosted database; reset only that stack after.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'

const workdir = process.argv[2]
const projectId = workdir
  ? /^project_id = "([^"]+)"/m.exec(
      readFileSync(join(workdir, 'supabase/config.toml'), 'utf8'),
    )?.[1]
  : undefined
if (!/^dexam-f054-[a-z0-9-]+$/.test(projectId ?? ''))
  throw new Error('Provide the workdir of an owned dexam-f054 disposable stack only.')
const container = `supabase_db_${projectId}`
const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--workdir', workdir, '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
)
if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname))
  throw new Error('Local API required')

const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  editor = createClient(config.API_URL, config.ANON_KEY, options),
  student = createClient(config.API_URL, config.ANON_KEY, options)

function sql(input) {
  return execFileSync(
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
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
}
async function must(result) {
  if (result.error) throw new Error(`Fictional operation rejected: ${phase}`)
  return result.data
}
async function bytesOf(blob) {
  return Buffer.from(await blob.arrayBuffer())
}

// Reuse the reviewed lesson fixture with fresh identifiers so reruns never collide.
const template = readFileSync('supabase/tests/00320_private_lesson_files.test.sql', 'utf8')
const mappings = new Map(
  [...template.matchAll(/d[0-9][0-9a-f]{6}-[0-9a-f-]{27}/g)].map((match) => [
    match[0],
    randomUUID(),
  ]),
)
const id = (kind, n = 1) => mappings.get(`d${kind}000000-0000-4000-8000-00000000000${n}`)
const personIds = [1, 2, 3, 4].map((n) => id(1, n))
let phase = 'fixture creation'

for (let n = 1; n <= 4; n++) {
  const email = `files-${randomUUID()}@fixture.invalid`,
    password = randomBytes(32).toString('base64url')
  const created = await must(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  )
  mappings.set(`d0000000-0000-4000-8000-00000000000${n}`, created.user.id)
  if (n === 1 || n === 4)
    await must(await (n === 1 ? editor : student).auth.signInWithPassword({ email, password }))
}
let fixture = template.slice(
  template.indexOf('insert into public.people'),
  template.indexOf('insert into auth.sessions'),
)
for (const [before, after] of mappings) fixture = fixture.replaceAll(before, after)
fixture = fixture
  .replaceAll(
    'DXM-DW3M9Q2RW5TY',
    'DXM-' + [...randomBytes(12)].map((v) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[v % 30]).join(''),
  )
  .replaceAll('CONTENT_FOUNDATION', 'PF_' + randomBytes(5).toString('hex').toUpperCase())
  .replaceAll('CONTENT_OTHER', 'PO_' + randomBytes(5).toString('hex').toUpperCase())
sql('begin;' + fixture + 'commit;')
const lesson = id(6),
  curriculum = id(3),
  offering = id(2),
  enrollment = id(7),
  pdf = Buffer.from('%PDF-1.4\nfictional protected lesson\n'),
  png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')

phase = 'lesson upload and publication'
const form = new FormData()
form.set('lessonId', lesson)
form.set('file', new File([pdf], 'notes.pdf', { type: 'application/pdf' }))
await must(await editor.functions.invoke('lesson-material-file', { body: form }))
const asset = (await must(await editor.rpc('list_lesson_files', { p_lesson_id: lesson })))[0]?.id
assert.ok(asset, 'uploaded lesson file is listed')
await must(
  await admin
    .from('curriculum_versions')
    .update({
      status: 'published',
      published_by_person_id: personIds[1],
      published_at: new Date().toISOString(),
      release_note: 'Disposable protected file release',
    })
    .eq('id', curriculum),
)
await must(
  await admin.from('enrollments').insert({
    id: enrollment,
    person_id: personIds[3],
    offering_id: offering,
    curriculum_version_id: curriculum,
    status: 'active',
    source_type: 'manual',
  }),
)
sql(`insert into public.enrollment_access_windows(enrollment_id,starts_at,expires_at,state,updated_by)
 values('${enrollment}',now()-interval '1 hour',now()+interval '1 day','active','${personIds[1]}');`)

phase = 'assessment figure fixture'
const question = randomUUID(),
  attempt = randomUUID(),
  figure = `f054-protected/${randomUUID()}.png`
sql(`insert into public.assessment_questions(id,external_key,version,content_hash,question_type,prompt,response_mode,publication_state,quarantine_reasons,licence,source_kind,visual_dependency)
 values('${question}','protected-${question}',1,repeat('a',64),'mcq','Fictional protected figure','auto','ready','{}','original','original',true);
insert into public.assessment_question_assets(question_id,role,storage_path,sha256,mime_type)
 values('${question}','figure','${figure}',repeat('b',64),'image/png');
insert into public.assessment_attempts(id,person_id,paper_id,exam,duration_minutes,objective_count,marking)
 values('${attempt}','${personIds[3]}','fiction-protected','uceed',60,1,'{}');
insert into public.assessment_attempt_questions(attempt_id,question_id,position) values('${attempt}','${question}',0);`)
await must(
  await admin.storage.from('assessment-media').upload(figure, png, { contentType: 'image/png' }),
)

phase = 'active access returns bytes, never a link'
const lessonRequest = { body: { lessonId: lesson, fileId: asset } }
const lessonFile = await student.functions.invoke('lesson-material-file', lessonRequest)
assert.equal(lessonFile.error, null, 'active student reads the lesson file')
assert.ok(lessonFile.data instanceof Blob, 'lesson function returns bytes, not JSON')
assert.deepEqual(await bytesOf(lessonFile.data), pdf, 'lesson bytes match the upload')
const headers = lessonFile.response.headers
assert.equal(headers.get('Content-Type'), 'application/octet-stream')
assert.equal(headers.get('X-Dexam-File-Type'), 'application/pdf')
assert.match(headers.get('Cache-Control') ?? '', /no-store/)
assert.equal(headers.get('X-Content-Type-Options'), 'nosniff')
const studentToken = (await student.auth.getSession()).data.session.access_token
const raw = await fetch(`${config.API_URL}/functions/v1/lesson-material-file`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${studentToken}`,
    apikey: config.ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(lessonRequest.body),
})
const rawText = await raw.text()
assert.ok(!/token=|object\/sign|"path"/.test(rawText), 'no signed path or token in the response')
const media = await student.storage
  .from('assessment-media')
  .download(figure, {}, { cache: 'no-store' })
assert.equal(media.error, null, 'active coaching session reads its attempt figure')
assert.deepEqual(await bytesOf(media.data), png, 'figure bytes match the upload')
const signed = await student.storage.from('assessment-media').createSignedUrl(figure, 60)
assert.ok(!signed.error, 'signing is still possible for an authorised session (old code path)')

phase = 'exact expiry with the same old session'
sql(
  `update public.enrollment_access_windows set expires_at=clock_timestamp() where enrollment_id='${enrollment}';`,
)
const expiredLesson = await student.functions.invoke('lesson-material-file', lessonRequest)
assert.ok(expiredLesson.error, 'expired student cannot read the lesson file')
assert.equal(expiredLesson.response?.status, 403, 'lesson function refuses with 403')
const expiredMedia = await student.storage
  .from('assessment-media')
  .download(figure, {}, { cache: 'no-store' })
assert.ok(expiredMedia.error, 'expired coaching session cannot read the attempt figure')
const replay = await fetch(new URL(signed.data.signedUrl))
console.log(
  `Legacy bearer link minted before expiry still answers ${replay.status} after expiry: ` +
    'issued links must drain before rollout (documented in F054).',
)

phase = 'suspension'
sql(
  `update public.enrollment_access_windows set expires_at=now()+interval '1 day',state='suspended' where enrollment_id='${enrollment}';`,
)
assert.ok(
  (await student.functions.invoke('lesson-material-file', lessonRequest)).error,
  'suspended access cannot read the lesson file',
)
assert.ok(
  (await student.storage.from('assessment-media').download(figure, {}, { cache: 'no-store' }))
    .error,
  'suspended access cannot read the attempt figure',
)
console.log('Protected file retrieval acceptance passed on', projectId)
