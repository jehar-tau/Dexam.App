// Exact disposable LOCAL acceptance; never print credentials, signed paths or provider payloads.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
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
const template = readFileSync('supabase/tests/00320_private_lesson_files.test.sql', 'utf8')
const mappings = new Map(
  [...template.matchAll(/d[0-9][0-9a-f]{6}-[0-9a-f-]{27}/g)].map((match) => [
    match[0],
    randomUUID(),
  ]),
)
const id = (kind, n = 1) => mappings.get(`d${kind}000000-0000-4000-8000-00000000000${n}`)
const personIds = [1, 2, 3, 4].map((n) => id(1, n)),
  users = []
let browser,
  frontend,
  writer,
  phase = 'fixture creation'
function sql(input) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_dexam-platform',
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
  if (result.error) throw new Error('Fictional operation rejected')
  return result.data
}
try {
  for (let n = 1; n <= 4; n++) {
    const email = `lesson-${randomUUID()}@fixture.invalid`,
      password = randomBytes(32).toString('base64url')
    const created = await must(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    users.push(created.user.id)
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
    .replaceAll('CONTENT_FOUNDATION', 'LF_' + randomBytes(5).toString('hex').toUpperCase())
    .replaceAll('CONTENT_OTHER', 'LO_' + randomBytes(5).toString('hex').toUpperCase())
  sql('begin;' + fixture + 'commit;')
  const lesson = id(6),
    curriculum = id(3),
    offering = id(2),
    enrollment = id(7),
    bytes = new TextEncoder().encode('%PDF-1.4\nfictional lesson\n')
  phase = 'signature rejection and real draft upload'
  const bad = new FormData()
  bad.set('lessonId', lesson)
  bad.set('file', new File(['not a PDF'], 'disguised.pdf', { type: 'application/pdf' }))
  if (!(await editor.functions.invoke('lesson-material-file', { body: bad })).error)
    throw new Error('Signature bypass')
  const form = new FormData()
  form.set('lessonId', lesson)
  form.set('file', new File([bytes], 'notes.pdf', { type: 'application/pdf' }))
  await must(await editor.functions.invoke('lesson-material-file', { body: form }))
  const files = await must(await editor.rpc('list_lesson_files', { p_lesson_id: lesson })),
    asset = files[0]?.id
  if (files.length !== 1 || !asset) throw new Error('Private draft file missing')
  if ((await must(await student.rpc('list_lesson_files', { p_lesson_id: lesson }))).length)
    throw new Error('Draft file visible')
  if (!(await editor.storage.from('lesson-materials').download(asset)).error)
    throw new Error('Direct Storage read bypass')
  phase = 'queued attachment revocation'
  const queued = (
    await must(
      await editor.rpc('reserve_lesson_file', {
        p_lesson_id: lesson,
        p_file_name: 'queued.pdf',
        p_mime_type: 'application/pdf',
        p_byte_size: bytes.length,
      }),
    )
  )[0]
  await must(
    await admin.storage
      .from('lesson-materials')
      .upload(queued.object_path, bytes, { contentType: 'application/pdf' }),
  )
  await must(await admin.rpc('complete_lesson_upload', { p_file_id: queued.file_id }))
  writer = spawn(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_dexam-platform',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
  let fileHeld = false
  writer.stdout.on('data', (data) => {
    if (String(data).includes('F023-file-held')) fileHeld = true
  })
  writer.stdin.write(
    `begin;select id from public.lesson_file_assets where id='${queued.file_id}' for update;select 'F023-file-held';\n`,
  )
  for (let n = 0; n < 100 && !fileHeld; n++) {
    if (writer.exitCode !== null) throw new Error('File lock transaction failed')
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!fileHeld) throw new Error('File lock not observed')
  const pending = editor
    .rpc('attach_lesson_file', { p_file_id: queued.file_id })
    .then((result) => result)
  let waiting = false
  for (let n = 0; n < 100; n++) {
    waiting =
      sql(
        "select count(*) from pg_stat_activity where query like '%attach_lesson_file%' and wait_event_type='Lock'",
      ) !== '0'
    if (waiting) break
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  if (!waiting) throw new Error('Attachment did not queue on file lock')
  await must(
    await admin.from('memberships').update({ status: 'suspended' }).eq('person_id', personIds[0]),
  )
  writer.stdin.end('commit;\n')
  await new Promise((resolve, reject) =>
    writer.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('File lock release failed')),
    ),
  )
  writer = null
  const denied = await pending
  if (denied.error?.code !== '42501')
    throw new Error('Queued attachment survived access revocation')
  await must(
    await admin.from('memberships').update({ status: 'active' }).eq('person_id', personIds[0]),
  )
  await must(await admin.rpc('abandon_lesson_upload', { p_file_id: queued.file_id }))
  phase = 'browser draft attachments'
  frontend = spawn(
    'pnpm',
    ['exec', 'vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      env: {
        ...process.env,
        VITE_SUPABASE_URL: config.API_URL,
        VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
      },
      stdio: 'ignore',
      detached: true,
    },
  )
  let ready = false
  for (let n = 0; n < 50; n++) {
    if (frontend.exitCode !== null) throw new Error('Frontend startup failed')
    try {
      ready = (await fetch('http://127.0.0.1:5173')).ok
    } catch {
      /* Local frontend is starting. */
    }
    if (ready) break
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!ready) throw new Error('Frontend unavailable')
  browser = await chromium.launch()
  const staffContext = await browser.newContext(),
    studentContext = await browser.newContext()
  async function bind(context, client) {
    const session = (await must(await client.auth.getSession())).session
    await context.addInitScript(
      ({ session, key }) => localStorage.setItem(key, JSON.stringify(session)),
      { session, key: 'sb-' + new URL(config.API_URL).hostname.split('.')[0] + '-auth-token' },
    )
  }
  await bind(staffContext, editor)
  await bind(studentContext, student)
  const staff = await staffContext.newPage()
  await staff.goto('http://127.0.0.1:5173/staff/content')
  await expect(staff.getByRole('button', { name: 'Download notes.pdf' })).toBeVisible()
  await staff
    .getByLabel('Attach lesson file')
    .setInputFiles({ name: 'second.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) })
  await expect(staff.getByRole('button', { name: 'Download second.pdf' })).toBeVisible()
  await staff.getByRole('button', { name: 'Remove second.pdf' }).click()
  await expect(staff.getByRole('button', { name: 'Download second.pdf' })).toHaveCount(0)
  await staff.screenshot({
    path: 'test-results/f023-lesson-files/staff-desktop.png',
    fullPage: true,
  })
  await staff.setViewportSize({ width: 390, height: 844 })
  if (!(await staff.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
    throw new Error('Staff overflow')
  await staff.screenshot({
    path: 'test-results/f023-lesson-files/staff-mobile.png',
    fullPage: true,
  })
  phase = 'published student access and download'
  await must(
    await admin
      .from('curriculum_versions')
      .update({
        status: 'published',
        published_by_person_id: personIds[1],
        published_at: new Date(Date.now() - 14 * 31 * 86400000).toISOString(),
        release_note: 'Disposable lesson release',
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
  const signed = await must(
    await student.functions.invoke('lesson-material-file', {
      body: { lessonId: lesson, fileId: asset },
    }),
  )
  const downloaded = await fetch(new URL(signed.path, config.API_URL))
  if (
    !downloaded.ok ||
    Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), Buffer.from(bytes)) !== 0
  )
    throw new Error('Private download mismatch')
  const page = await studentContext.newPage()
  await page.goto('http://127.0.0.1:5173/student/coursework')
  await expect(page.getByRole('button', { name: 'Download notes.pdf' })).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download notes.pdf' }).click()
  const actualDownload = await downloadPromise
  if (actualDownload.suggestedFilename() !== 'notes.pdf')
    throw new Error('Download filename mismatch')
  if (await page.getByLabel('Attach lesson file').count()) throw new Error('Student upload control')
  await page.screenshot({
    path: 'test-results/f023-lesson-files/student-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  if (!(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
    throw new Error('Student overflow')
  await page.screenshot({
    path: 'test-results/f023-lesson-files/student-mobile.png',
    fullPage: true,
  })
  if (!(await editor.rpc('remove_lesson_file', { p_lesson_id: lesson, p_file_id: asset })).error)
    throw new Error('Published mutation')
  phase = 'retention serialization and current access'
  await must(
    await admin
      .from('enrollments')
      .update({ status: 'completed', ended_at: new Date().toISOString() })
      .eq('id', enrollment),
  )
  if (
    !(
      await student.functions.invoke('lesson-material-file', {
        body: { lessonId: lesson, fileId: asset },
      })
    ).error
  )
    throw new Error('Closeout download bypass')
  await must(
    await admin
      .from('curriculum_versions')
      .update({
        status: 'retired',
        retired_at: new Date(Date.now() - 13 * 31 * 86400000).toISOString(),
      })
      .eq('id', curriculum),
  )
  const session = (await must(await editor.auth.getSession())).session,
    claims = JSON.parse(Buffer.from(session.access_token.split('.')[1], 'base64url'))
  writer = spawn(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_dexam-platform',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
  let held = false
  writer.stdout.on('data', (data) => {
    if (String(data).includes('F023-copy-held')) held = true
  })
  writer.stdin.write(
    `begin;set local role authenticated;set local request.jwt.claims='${JSON.stringify(claims)}';select public.clone_curriculum_version('${curriculum}','Disposable shared lesson copy');select 'F023-copy-held';\n`,
  )
  for (let n = 0; n < 100 && !held; n++) {
    if (writer.exitCode !== null) throw new Error('Copy transaction failed')
    await new Promise((r) => setTimeout(r, 50))
  }
  if (!held) throw new Error('Copy lock not observed')
  if (
    sql(
      `select count(*) from public.lesson_file_assets where creator_person_id not in ('${personIds.join("','")}') and public.lesson_asset_due_for_purge(id)`,
    ) !== '0'
  )
    throw new Error('Unrelated retention candidates exist; purge acceptance refused')
  const candidates = await must(await admin.rpc('claim_lesson_files_for_purge', { p_limit: 100 }))
  if (candidates.some((row) => row.file_id === asset))
    throw new Error('In-flight protected copy purged')
  writer.stdin.end('commit;\n')
  await new Promise((resolve, reject) =>
    writer.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Copy commit failed')),
    ),
  )
  writer = null
  if (
    (await must(await admin.rpc('claim_lesson_files_for_purge', { p_limit: 100 }))).some(
      (row) => row.file_id === asset,
    )
  )
    throw new Error('Committed draft copy purged')
  phase = 'actual unattached object retention'
  const orphan = await must(
    await admin
      .from('lesson_file_assets')
      .select('id,object_path')
      .eq('creator_person_id', personIds[0])
      .eq('file_name', 'second.pdf')
      .single(),
  )
  await must(
    await admin
      .from('lesson_file_assets')
      .update({ created_at: new Date(Date.now() - 31 * 86400000).toISOString() })
      .eq('id', orphan.id),
  )
  await must(await admin.functions.invoke('purge-lesson-materials', { body: {} }))
  if (!(await admin.storage.from('lesson-materials').download(orphan.object_path)).error)
    throw new Error('Expired unattached object retained')
  if (
    (
      await must(
        await admin.from('lesson_file_assets').select('state').eq('id', orphan.id).single(),
      )
    ).state !== 'deleted'
  )
    throw new Error('Object purge not finalized')
  console.log(
    'F023 actual SDK/Edge/browser acceptance passed: signature rejection, private upload/download, draft-only mutation, shared-copy retention serialization, closeout denial and responsive UI.',
  )
} catch (error) {
  console.error('Failure category:', error instanceof Error ? error.name : 'unknown')
  const ownPage = browser?.contexts()[0]?.pages()[0]
  if (ownPage)
    await ownPage.screenshot({ path: 'test-results/f023-lesson-files/failure.png', fullPage: true })
  console.error(
    'F023 acceptance failed during ' + phase + '; credentials/provider payloads withheld.',
  )
  process.exitCode = 1
} finally {
  writer?.kill('SIGTERM')
  if (browser) await browser.close()
  try {
    if (frontend?.pid) process.kill(-frontend.pid, 'SIGTERM')
  } catch {
    /* Own frontend already stopped. */
  }
  try {
    const assets = await must(
      await admin
        .from('lesson_file_assets')
        .select('id,object_path')
        .in('creator_person_id', personIds),
    )
    if (assets.length)
      await must(
        await admin.storage.from('lesson-materials').remove(assets.map((a) => a.object_path)),
      )
    const people = "('" + personIds.join("','") + "')",
      offerings = "('" + [id(2), id(2, 2)].join("','") + "')"
    const tables = [
      'lesson_materials',
      'lesson_file_assets',
      'curriculum_lessons',
      'curriculum_topics',
      'curriculum_sections',
      'curriculum_versions',
      'enrollment_transitions',
      'enrollments',
      'capability_grants',
      'role_assignments',
      'memberships',
      'auth_identities',
      'people',
      'offerings',
    ]
    const conditions = [
      `asset_id in(select id from public.lesson_file_assets where creator_person_id in ${people})`,
      `creator_person_id in ${people}`,
      `public.lesson_version_id(id) in(select id from public.curriculum_versions where offering_id in ${offerings})`,
      `section_id in(select id from public.curriculum_sections where curriculum_version_id in(select id from public.curriculum_versions where offering_id in ${offerings}))`,
      `curriculum_version_id in(select id from public.curriculum_versions where offering_id in ${offerings})`,
      `offering_id in ${offerings}`,
      `enrollment_id in(select id from public.enrollments where person_id in ${people})`,
      `person_id in ${people}`,
      `person_id in ${people}`,
      `person_id in ${people}`,
      `person_id in ${people}`,
      `person_id in ${people}`,
      `id in ${people}`,
      `id in ${offerings}`,
    ]
    // Exact own fictional fixtures only. FK/RLS remain enabled; unknown references abort transaction.
    sql(
      `begin;create temporary table fixture_trigger_flags on commit drop as select c.relname,t.tgname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and c.relname in ('${tables.join("','")}');do $$declare r record;begin for r in select * from fixture_trigger_flags loop execute format('alter table public.%I disable trigger %I',r.relname,r.tgname);end loop;end$$;delete from public.security_audit_events where subject_person_id in ${people};${[0, 1, 2, 3, 4, 6, 7, 5, 8, 9, 10, 11, 12, 13].map((i) => 'delete from public.' + tables[i] + ' where ' + conditions[i] + ';').join('')}do $$declare r record;begin for r in select * from fixture_trigger_flags where tgenabled<>'D' loop execute format('alter table public.%I enable %s trigger %I',r.relname,case r.tgenabled when 'A' then 'always' when 'R' then 'replica' else '' end,r.tgname);end loop;end$$;commit;`,
    )
    for (const user of users) await must(await admin.auth.admin.deleteUser(user))
    console.log(
      'F023 exact fictional objects/accounts/domain fixtures removed; original trigger flags restored.',
    )
  } catch (error) {
    const diagnostic = String(error?.stderr ?? '').match(/ERROR:[^\n]*/)?.[0]
    if (diagnostic) console.error(diagnostic.replace(/'[\s\S]*?'/g, '[withheld]'))
    console.error('F023 exact fixture cleanup requires inspection.')
    process.exitCode = 1
  }
}
