// LOCAL fictional initial onboarding; real secrets never enter logs or artifacts.
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
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  operator = createClient(config.API_URL, config.ANON_KEY, options),
  student = createClient(config.API_URL, config.ANON_KEY, options)
const operatorPerson = randomUUID(),
  studentPerson = randomUUID(),
  offeringId = randomUUID(),
  enrollmentId = randomUUID()
const memberId =
  'DXM-' +
  [...randomBytes(12)].map((value) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[value % 30]).join('')
let operatorAuth,
  studentAuth,
  frontend,
  browser,
  phase = 'fixture creation'
async function must(result) {
  if (result.error) throw new Error('Fixture operation rejected.')
  return result.data
}
try {
  const email = `activation-operator-${randomUUID()}@fixture.invalid`,
    password = randomBytes(32).toString('base64url')
  const created = await must(
    await admin.auth.admin.createUser({ email, password, email_confirm: true }),
  )
  operatorAuth = created.user.id
  await must(
    await admin.from('people').insert([
      { id: operatorPerson, display_name: 'Disposable activation operator' },
      { id: studentPerson, display_name: 'Disposable activation student', member_id: memberId },
    ]),
  )
  await must(
    await admin
      .from('auth_identities')
      .insert({ person_id: operatorPerson, auth_user_id: operatorAuth, kind: 'employee_email' }),
  )
  await must(
    await admin.from('memberships').insert([
      { person_id: operatorPerson, kind: 'employee', status: 'active' },
      { person_id: studentPerson, kind: 'student', status: 'active' },
    ]),
  )
  await must(
    await admin.from('role_assignments').insert({
      person_id: operatorPerson,
      role_key: 'ordinary_admin',
      grant_reason: 'Disposable initial activation link verification',
    }),
  )
  await must(
    await admin.from('capability_grants').insert({
      person_id: operatorPerson,
      capability_key: 'enrollment.operate',
      required_role_key: 'ordinary_admin',
      grant_reason: 'Disposable least-authority activation operator',
    }),
  )
  await must(
    await admin.from('offerings').insert({
      id: offeringId,
      code: `ACT_${randomBytes(6).toString('hex').toUpperCase()}`,
      title: 'Disposable activation fixture',
      status: 'active',
    }),
  )
  await must(
    await admin.from('enrollments').insert({
      id: enrollmentId,
      person_id: studentPerson,
      offering_id: offeringId,
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by_person_id: operatorPerson,
      source_type: 'manual',
    }),
  )
  await must(await operator.auth.signInWithPassword({ email, password }))
  phase = 'trusted activation pack issuance'
  const pack = await must(
    await operator.functions.invoke('staff-issue-activation', {
      body: { enrollmentId, reasonCode: 'initial_activation_pack' },
    }),
  )
  const callback = new URL(pack.activationUrl),
    params = new URLSearchParams(callback.hash.slice(1))
  if (
    callback.origin !== 'http://127.0.0.1:5173' ||
    callback.pathname !== '/activate' ||
    callback.search ||
    params.get('memberId') !== memberId ||
    !params.get('token')
  )
    throw new Error('Unsafe activation callback.')
  if (process.argv.includes('--legacy-query')) {
    callback.search = callback.hash.slice(1)
    callback.hash = ''
  }
  phase = 'actual browser activation'
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
  for (let attempt = 0; attempt < 50; attempt++) {
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
  const context = await browser.newContext(),
    page = await context.newPage()
  // Never trace/screenshot a credential URL, loaded proof or password fields.
  await page.goto(callback.toString())
  await page.getByText('One-time activation link loaded securely', { exact: false }).waitFor()
  if (new URL(page.url()).search || new URL(page.url()).hash)
    throw new Error('Proof retained in URL.')
  if (await page.getByLabel('One-time activation code').count())
    throw new Error('Link flow still requires backup code.')
  const studentPassword = randomBytes(32).toString('base64url')
  await page.getByLabel('Create password').fill(studentPassword)
  await page.getByLabel('Confirm password').fill(studentPassword)
  await page.getByRole('button', { name: 'Activate account', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'Your Dexam account is ready.' }).waitFor()
  await page.screenshot({
    path: 'test-results/student-activation/completed-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  if (!(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
    throw new Error('Mobile activation overflow.')
  await page.screenshot({
    path: 'test-results/student-activation/completed-mobile.png',
    fullPage: true,
  })
  phase = 'canonical signin and replay denial'
  const linked = await must(
    await admin
      .from('auth_identities')
      .select('auth_user_id')
      .eq('person_id', studentPerson)
      .single(),
  )
  studentAuth = linked.auth_user_id
  await must(
    await student.auth.signInWithPassword({
      email: `${memberId.toLowerCase()}@members.dexam.invalid`,
      password: studentPassword,
    }),
  )
  if ((await must(await student.rpc('current_person_id'))) !== studentPerson)
    throw new Error('Canonical identity wrong.')
  if (
    !(
      await student.functions.invoke('student-activate', {
        body: {
          memberId,
          credential: params.get('token'),
          credentialType: 'link',
          password: studentPassword,
        },
      })
    ).error
  )
    throw new Error('Link replay accepted.')
  if (
    !(
      await student.functions.invoke('student-activate', {
        body: {
          memberId,
          credential: pack.backupCode,
          credentialType: 'backup',
          password: studentPassword,
        },
      })
    ).error
  )
    throw new Error('Consumed pack backup replay accepted.')
  console.log(
    'Local initial student activation link passed: secure URL clearing, link authority, private password, canonical signin, link/backup replay denial, desktop/mobile and cleanup.',
  )
} catch {
  console.error(
    `Local student activation link failed during ${phase}; credentials and provider payloads withheld.`,
  )
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  try {
    if (frontend?.pid) process.kill(-frontend.pid, 'SIGTERM')
  } catch {
    /* Already stopped. */
  }
  let failed = false
  // Recover a created fixture account ID even if the browser failed after mutation.
  try {
    const linked = await admin
      .from('auth_identities')
      .select('auth_user_id')
      .eq('person_id', studentPerson)
      .maybeSingle()
    studentAuth ??= linked.data?.auth_user_id
  } catch {
    failed = true
  }
  for (const [table, column, ids] of [
    ['account_action_tokens', 'person_id', [studentPerson]],
    ['security_audit_events', 'subject_person_id', [operatorPerson, studentPerson]],
    ['enrollment_transitions', 'enrollment_id', [enrollmentId]],
    ['enrollments', 'id', [enrollmentId]],
    ['capability_grants', 'person_id', [operatorPerson]],
    ['role_assignments', 'person_id', [operatorPerson]],
    ['memberships', 'person_id', [operatorPerson, studentPerson]],
    ['auth_identities', 'person_id', [operatorPerson, studentPerson]],
    ['people', 'id', [operatorPerson, studentPerson]],
    ['offerings', 'id', [offeringId]],
  ]) {
    try {
      if ((await admin.from(table).delete().in(column, ids)).error) failed = true
    } catch {
      failed = true
    }
  }
  for (const id of [operatorAuth, studentAuth].filter(Boolean)) {
    try {
      if ((await admin.auth.admin.deleteUser(id)).error) failed = true
    } catch {
      failed = true
    }
  }
  if (failed) {
    console.error('Disposable activation cleanup needs inspection.')
    process.exitCode = 1
  } else
    console.log(
      'Disposable fictional activation people, accounts, enrolment, pack, transition and audit removed.',
    )
}
