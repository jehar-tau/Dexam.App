// Disposable LOCAL fictional acceptance. No credentials, URLs or provider payloads logged.
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
)
if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname))
  throw new Error('Local API required.')
const names = [
  'operator',
  'student',
  'offering',
  'otherOffering',
  'enrollment',
  'otherEnrollment',
  'curriculum',
  'section',
  'topic',
  'definition',
  'version',
  'release',
  'instance',
  'otherRelease',
  'otherInstance',
]
const ids = Object.fromEntries(names.map((name) => [name, randomUUID()]))
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  operator = createClient(config.API_URL, config.ANON_KEY, options),
  student = createClient(config.API_URL, config.ANON_KEY, options)
const memberId =
  'DXM-' +
  [...randomBytes(12)].map((value) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[value % 30]).join('')
const users = [],
  attempts = [],
  filePaths = []
let browser,
  frontend,
  writer,
  phase = 'fixture creation'
async function must(result) {
  if (result.error) {
    console.error(
      'Rejected operation status:',
      result.error.context?.status ?? result.error.code ?? 'unavailable',
    )
    throw new Error('Fixture operation rejected.')
  }
  return result.data
}
async function insert(table, row) {
  return must(await admin.from(table).insert(row))
}
const bytes = new TextEncoder().encode('%PDF-1.4\nfictional local work\n'.padEnd(32, ' '))
try {
  for (const [person, kind] of [
    [ids.operator, 'employee'],
    [ids.student, 'student'],
  ]) {
    const email =
      kind === 'student'
        ? memberId.toLowerCase() + '@members.dexam.invalid'
        : `closeout-${randomUUID()}@fixture.invalid`
    const password = randomBytes(32).toString('base64url')
    const created = await must(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    users.push(created.user.id)
    await insert('people', {
      id: person,
      display_name:
        kind === 'student' ? 'Disposable closeout student' : 'Disposable closeout operator',
      member_id: kind === 'student' ? memberId : null,
    })
    await insert('auth_identities', {
      person_id: person,
      auth_user_id: created.user.id,
      kind: kind === 'student' ? 'member_id' : 'employee_email',
    })
    await insert('memberships', { person_id: person, kind, status: 'active' })
    await must(
      await (kind === 'student' ? student : operator).auth.signInWithPassword({ email, password }),
    )
  }
  await insert('offerings', [
    {
      id: ids.offering,
      code: 'CLOSE_' + randomBytes(5).toString('hex').toUpperCase(),
      title: 'Disposable closeout course',
      status: 'active',
    },
    {
      id: ids.otherOffering,
      code: 'KEEP_' + randomBytes(5).toString('hex').toUpperCase(),
      title: 'Disposable continuing course',
      status: 'active',
    },
  ])
  await insert('role_assignments', [
    {
      person_id: ids.operator,
      role_key: 'ordinary_admin',
      scope_type: 'offering',
      scope_id: ids.offering,
      grant_reason: 'Disposable scoped closeout operator',
    },
    {
      person_id: ids.operator,
      role_key: 'teacher',
      scope_type: 'offering',
      scope_id: ids.offering,
      grant_reason: 'Disposable current review authority',
    },
  ])
  await insert('capability_grants', [
    {
      person_id: ids.operator,
      capability_key: 'enrollment.operate',
      required_role_key: 'ordinary_admin',
      scope_type: 'offering',
      scope_id: ids.offering,
      grant_reason: 'Disposable closeout scope',
    },
    {
      person_id: ids.operator,
      capability_key: 'feedback.review',
      required_role_key: 'teacher',
      scope_type: 'offering',
      scope_id: ids.offering,
      grant_reason: 'Disposable teacher review scope',
    },
  ])
  await insert('enrollments', [
    {
      id: ids.enrollment,
      person_id: ids.student,
      offering_id: ids.offering,
      status: 'active',
      source_type: 'manual',
    },
    {
      id: ids.otherEnrollment,
      person_id: ids.student,
      offering_id: ids.otherOffering,
      status: 'active',
      source_type: 'manual',
    },
  ])
  await insert('curriculum_versions', {
    id: ids.curriculum,
    offering_id: ids.offering,
    version_number: 1,
    title: 'Disposable curriculum',
    created_by_person_id: ids.operator,
  })
  await insert('curriculum_sections', {
    id: ids.section,
    curriculum_version_id: ids.curriculum,
    code: 'DRAWING',
    title: 'Drawing',
    position: 1,
  })
  await insert('curriculum_topics', {
    id: ids.topic,
    section_id: ids.section,
    code: 'PERSPECTIVE',
    title: 'Perspective',
    position: 1,
  })
  await must(
    await admin
      .from('curriculum_versions')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by_person_id: ids.operator,
        release_note: 'Disposable curriculum release',
      })
      .eq('id', ids.curriculum),
  )
  await insert('assignment_definitions', {
    id: ids.definition,
    offering_id: ids.offering,
    code: 'CLOSEOUT_DRAWING',
    created_by_person_id: ids.operator,
  })
  await insert('assignment_versions', {
    id: ids.version,
    assignment_definition_id: ids.definition,
    version_number: 1,
    group_name: 'Drawing',
    title: 'Disposable perspective drawing',
    instructions: 'Fictional drawing task.',
    evaluation_rubric: 'Fictional line and composition guide.',
    created_by_person_id: ids.operator,
  })
  await insert('assignment_topic_links', {
    assignment_version_id: ids.version,
    topic_id: ids.topic,
  })
  await must(
    await admin
      .from('assignment_versions')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        published_by_person_id: ids.operator,
        release_note: 'Disposable assignment release',
      })
      .eq('id', ids.version),
  )
  for (const [release, instance] of [
    [ids.release, ids.instance],
    [ids.otherRelease, ids.otherInstance],
  ]) {
    await insert('assignment_releases', {
      id: release,
      assignment_version_id: ids.version,
      offering_id: ids.offering,
      target_kind: 'selected',
      release_note: 'Disposable selected release',
      request_key: randomUUID(),
      released_by_person_id: ids.operator,
    })
    await insert('student_assignment_instances', {
      id: instance,
      assignment_release_id: release,
      enrollment_id: ids.enrollment,
    })
  }
  phase = 'student attempt start'
  const attempt = await must(
    await student.rpc('start_assignment_attempt', { p_assignment_instance_id: ids.instance }),
  )
  attempts.push(attempt)
  const form = new FormData()
  form.set('attemptId', attempt)
  form.set('originalFileName', 'Fictional drawing.pdf')
  form.set('originalByteSize', String(bytes.length))
  form.set('wasCompressed', 'false')
  form.set('file', new File([bytes], 'fictional.pdf', { type: 'application/pdf' }))
  phase = 'student file upload'
  const uploaded = await must(
    await student.functions.invoke('student-submission-file', { body: form }),
  )
  phase = 'student attempt finalization'
  await must(await student.rpc('finalize_submission_attempt', { p_submission_attempt_id: attempt }))
  phase = 'teacher feedback draft'
  const revision = await must(
    await operator.rpc('start_feedback_draft', { p_submission_attempt_id: attempt }),
  )
  await must(
    await operator.rpc('save_feedback_draft', {
      p_feedback_revision_id: revision,
      p_written_text: 'Published fictional drawing feedback.',
      p_source_kind: 'human',
      p_voice_equivalent_confirmed: false,
    }),
  )
  await must(
    await operator.rpc('publish_feedback_revision', {
      p_feedback_revision_id: revision,
      p_outcome: 'review_completed',
      p_correction_reason: null,
    }),
  )
  const draft = await must(
    await student.rpc('start_assignment_attempt', { p_assignment_instance_id: ids.otherInstance }),
  )
  attempts.push(draft)
  phase = 'protected frontend startup'
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
    if (frontend.exitCode !== null) throw new Error('Frontend startup failed.')
    try {
      ready = (await fetch('http://127.0.0.1:5173')).ok
    } catch {
      /* Startup. */
    }
    if (ready) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (!ready) throw new Error('Frontend unavailable.')
  browser = await chromium.launch()
  const staffContext = await browser.newContext(),
    staffPage = await staffContext.newPage(),
    studentContext = await browser.newContext()
  async function bind(context, client) {
    const session = (await must(await client.auth.getSession())).session
    await context.addInitScript(
      ({ session, key }) => {
        localStorage.setItem(key, JSON.stringify(session))
      },
      { session, key: 'sb-' + new URL(config.API_URL).hostname.split('.')[0] + '-auth-token' },
    )
    return session
  }
  await bind(staffContext, operator)
  const studentSession = await bind(studentContext, student)
  await staffPage.goto('http://127.0.0.1:5173/staff/enrolment-closeout')
  await staffPage.getByLabel('Search Member ID or name').fill(memberId)
  await staffPage.getByRole('button', { name: 'Review course closeout' }).click()
  await staffPage
    .getByLabel('I checked this student and course and confirm the stated access change.')
    .check()
  phase = 'concurrent reservation versus browser closeout'
  const jwt = JSON.parse(
    Buffer.from(studentSession.access_token.split('.')[1], 'base64url').toString(),
  )
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
      '-v',
      'ON_ERROR_STOP=1',
      '-At',
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  )
  let output = ''
  const reserved = new Promise((resolve, reject) => {
    writer.stdout.on('data', (chunk) => {
      output += chunk
      if (output.includes('RESERVATION_HELD')) resolve()
    })
    writer.on('exit', (code) => {
      if (code !== 0 || !output.includes('RESERVATION_HELD'))
        reject(new Error('Reservation transaction failed.'))
    })
  })
  const finished = new Promise((resolve, reject) =>
    writer.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Reservation transaction failed.')),
    ),
  )
  writer.stdin.end(
    `begin;set local role authenticated;set local request.jwt.claims='${JSON.stringify({ sub: users[1], session_id: jwt.session_id, role: 'authenticated', aal: 'aal1' })}';select * from public.reserve_submission_file('${draft}','Concurrent fictional.pdf','application/pdf',32,32,false,null,null);select 'RESERVATION_HELD';select pg_sleep(2);commit;`,
  )
  await reserved
  const started = Date.now()
  await staffPage.getByRole('button', { name: 'Close this enrolment', exact: true }).click()
  await staffPage.getByRole('status').filter({ hasText: 'Course closed.' }).waitFor()
  if (Date.now() - started < 1400)
    throw new Error('Closeout did not wait for the in-flight reservation.')
  await finished
  await staffPage.screenshot({
    path: 'test-results/f019-closeout/staff-desktop.png',
    fullPage: true,
  })
  await staffPage.setViewportSize({ width: 390, height: 844 })
  if (!(await staffPage.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
    throw new Error('Staff mobile overflow.')
  await staffPage.screenshot({
    path: 'test-results/f019-closeout/staff-mobile.png',
    fullPage: true,
  })
  const pending = await must(
    await admin
      .from('submission_files')
      .select('id,object_path')
      .eq('submission_attempt_id', draft)
      .single(),
  )
  await must(
    await admin.storage
      .from('student-submissions')
      .upload(pending.object_path, bytes, { contentType: 'application/pdf' }),
  )
  filePaths.push(pending.object_path)
  const completion = await admin.rpc('complete_submission_file_upload', {
    p_submission_file_id: pending.id,
  })
  if (!completion.error || completion.error.code !== '42501')
    throw new Error('Late upload completion not fenced.')
  if (!(await student.rpc('finalize_submission_attempt', { p_submission_attempt_id: draft })).error)
    throw new Error('Post-closeout finalization accepted.')
  phase = 'own read-only archive and real file retrieval'
  const page = await studentContext.newPage()
  await page.goto('http://127.0.0.1:5173/student/archive')
  await page.getByText('Published fictional drawing feedback.', { exact: true }).waitFor()
  await page
    .getByRole('button', { name: 'Prepare download: Fictional drawing.pdf', exact: true })
    .click()
  const link = page.getByRole('link', { name: 'Download retained file', exact: true })
  await link.waitFor()
  const signedURL = await link.getAttribute('href')
  const downloaded = await fetch(signedURL)
  if (
    !downloaded.ok ||
    Buffer.compare(Buffer.from(await downloaded.arrayBuffer()), Buffer.from(bytes)) !== 0
  )
    throw new Error('Retained file download failed.')
  const signed = await must(
    await student.functions.invoke('student-work-archive-file', {
      body: { fileId: uploaded.file.id, kind: 'submission' },
    }),
  )
  if (Date.parse(signed.expiresAt) - Date.now() > 61000)
    throw new Error('Download TTL exceeds bound.')
  await page.screenshot({ path: 'test-results/f019-closeout/archive-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  if (!(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
    throw new Error('Archive mobile overflow.')
  await page.screenshot({ path: 'test-results/f019-closeout/archive-mobile.png', fullPage: true })
  const other = await must(
    await admin.from('enrollments').select('status').eq('id', ids.otherEnrollment).single(),
  )
  if (
    other.status !== 'active' ||
    (await must(await student.rpc('current_person_id'))) !== ids.student
  )
    throw new Error('Other course or canonical identity changed.')
  await must(
    await admin.from('memberships').update({ status: 'suspended' }).eq('person_id', ids.student),
  )
  if (
    !(
      await student.functions.invoke('student-work-archive-file', {
        body: { fileId: uploaded.file.id, kind: 'submission' },
      })
    ).error
  )
    throw new Error('Suspension bypassed archive.')
  console.log(
    'F019 local provider/browser acceptance passed: scoped closeout, reservation serialization, late completion/finalization denial, private finalized/published archive, actual short-lived download, identity/other-course invariance, suspension denial and responsive UI.',
  )
} catch {
  console.error(
    `F019 local acceptance failed during ${phase}; credentials/provider payloads withheld.`,
  )
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  try {
    if (frontend?.pid) process.kill(-frontend.pid, 'SIGTERM')
  } catch {
    /* Already stopped. */
  }
  try {
    writer?.kill('SIGTERM')
  } catch {
    /* Already stopped. */
  }
  let failed = false
  try {
    if (attempts.length) {
      const files = await must(
        await admin
          .from('submission_files')
          .select('object_path')
          .in('submission_attempt_id', attempts),
      )
      filePaths.push(...files.map((row) => row.object_path))
    }
    if (filePaths.length)
      await must(await admin.storage.from('student-submissions').remove([...new Set(filePaths)]))
    // Test-only immutable fixture cleanup in one LOCAL transaction. FK/RLS are NOT disabled;
    // unknown references abort cleanup. Restore every original user-trigger flag before commit.
    const tables = [
      'notifications',
      'domain_events',
      'feedback_revisions',
      'submission_files',
      'submission_attempts',
      'student_assignment_transitions',
      'student_assignment_instances',
      'assignment_releases',
      'assignment_topic_links',
      'assignment_versions',
      'assignment_definitions',
      'curriculum_topics',
      'curriculum_sections',
      'curriculum_versions',
      'enrollment_closeouts',
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
      `recipient_person_id in ('${ids.operator}','${ids.student}')`,
      `actor_person_id in ('${ids.operator}','${ids.student}')`,
      `submission_attempt_id in ('${attempts.join("','") || randomUUID()}')`,
      `submission_attempt_id in ('${attempts.join("','") || randomUUID()}')`,
      `assignment_instance_id in ('${ids.instance}','${ids.otherInstance}')`,
      `assignment_instance_id in ('${ids.instance}','${ids.otherInstance}')`,
      `id in ('${ids.instance}','${ids.otherInstance}')`,
      `id in ('${ids.release}','${ids.otherRelease}')`,
      `assignment_version_id='${ids.version}'`,
      `id='${ids.version}'`,
      `id='${ids.definition}'`,
      `id='${ids.topic}'`,
      `id='${ids.section}'`,
      `id='${ids.curriculum}'`,
      `enrollment_id='${ids.enrollment}'`,
      `enrollment_id in ('${ids.enrollment}','${ids.otherEnrollment}')`,
      `id in ('${ids.enrollment}','${ids.otherEnrollment}')`,
      `person_id='${ids.operator}'`,
      `person_id='${ids.operator}'`,
      `person_id in ('${ids.operator}','${ids.student}')`,
      `person_id in ('${ids.operator}','${ids.student}')`,
      `id in ('${ids.operator}','${ids.student}')`,
      `id in ('${ids.offering}','${ids.otherOffering}')`,
    ]
    const sql = `begin;create temporary table fixture_trigger_flags on commit drop as select c.relname,t.tgname,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and c.relname in ('${tables.join("','")}');do $$declare r record;begin for r in select * from fixture_trigger_flags loop execute format('alter table public.%I disable trigger %I',r.relname,r.tgname);end loop;end$$;delete from public.security_audit_events where subject_person_id in ('${ids.operator}','${ids.student}');${tables.map((table, index) => 'delete from public.' + table + ' where ' + conditions[index] + ';').join('')}do $$declare r record;begin for r in select * from fixture_trigger_flags where tgenabled<>'D' loop execute format('alter table public.%I enable %s trigger %I',r.relname,case r.tgenabled when 'A' then 'always' when 'R' then 'replica' else '' end,r.tgname);end loop;end$$;commit;`
    execFileSync(
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
        '-v',
        'ON_ERROR_STOP=1',
      ],
      { input: sql, stdio: ['pipe', 'pipe', 'pipe'] },
    )
  } catch (error) {
    const diagnostic = String(error?.stderr ?? '').match(/ERROR:[^\n]*/)?.[0]
    if (diagnostic) console.error(diagnostic.replace(/'[\s\S]*?'/g, '[withheld]'))
    failed = true
  }
  for (const id of users) {
    try {
      if ((await admin.auth.admin.deleteUser(id)).error) failed = true
    } catch {
      failed = true
    }
  }
  if (failed) {
    console.error('F019 disposable cleanup requires inspection.')
    process.exitCode = 1
  } else
    console.log(
      'F019 fictional accounts, domain fixtures, private objects and audit removed; original trigger flags restored.',
    )
}
