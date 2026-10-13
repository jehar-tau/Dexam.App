import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
import { totp } from './local-totp.mjs'

let config
try {
  if (process.env.STAGING_STAFF_SECURITY_ACCEPTANCE === 'true') {
    if (process.env.STAGING_SUPABASE_URL !== 'https://ienwcencjbgdsqxfyxmj.supabase.co')
      throw new Error('Wrong staging project.')
    config = {
      API_URL: process.env.STAGING_SUPABASE_URL,
      ANON_KEY: process.env.STAGING_PUBLIC_KEY,
      SERVICE_ROLE_KEY: process.env.STAGING_SERVICE_ROLE_KEY,
    }
    if (!config.ANON_KEY || !config.SERVICE_ROLE_KEY) throw new Error('Missing keys.')
  } else {
    config = JSON.parse(
      execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    )
    if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname))
      throw new Error('Nonlocal project.')
  }
} catch {
  console.error('Recovery acceptance configuration rejected. Credential payloads withheld.')
  process.exit(1)
}
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const fixtures = []
let phase = 'fixture creation'
async function inspectLocalRecoveryScreen(actor) {
  if (!['127.0.0.1', 'localhost'].includes(new URL(config.API_URL).hostname))
    throw new Error('Visual acceptance requires local Auth.')
  const server = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4187', '--strictPort'],
    {
      stdio: 'ignore',
      env: {
        ...process.env,
        VITE_SUPABASE_URL: config.API_URL,
        VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
        VITE_ENABLE_OPERATOR_PREVIEW: 'false',
      },
    },
  )
  let browser
  try {
    let ready = false
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error('Visual server failed.')
      try {
        ready = (await fetch('http://127.0.0.1:4187')).ok
      } catch {
        ready = false
      }
      if (ready) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    if (!ready) throw new Error('Visual server unavailable.')
    const { chromium } = await import('@playwright/test')
    browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const session = await must(await actor.client.auth.getSession())
    const storageKey = `sb-${new URL(config.API_URL).hostname.split('.')[0]}-auth-token`
    await context.addInitScript(
      ({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
      { key: storageKey, value: session.session },
    )
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4187/staff/security/recovery')
    await page.getByRole('button', { name: 'Execute approved reset' }).waitFor()
    await mkdir('test-results/f015-recovery', { recursive: true })
    await page.screenshot({ path: 'test-results/f015-recovery/desktop.png', fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: 'test-results/f015-recovery/mobile.png', fullPage: true })
    if (
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth > globalThis.innerWidth,
      )
    )
      throw new Error('Recovery screen overflows on mobile.')
    await page.getByLabel('Employee authenticator').focus()
    if (
      !(await page
        .getByLabel('Employee authenticator')
        .evaluate((element) => element === globalThis.document.activeElement))
    )
      throw new Error('Recovery control is not keyboard focusable.')
    console.log(
      'Authenticated local recovery screen accepted at desktop/mobile widths; screenshots contain fictional queue data only.',
    )
  } finally {
    await browser?.close()
    server.kill('SIGTERM')
  }
}
async function must(result) {
  if (result.error) throw new Error('Fixture operation failed.')
  return result.data
}
async function enroll(fixture, name) {
  const factor = await must(
    await fixture.client.auth.mfa.enroll({ factorType: 'totp', friendlyName: name }),
  )
  await must(
    await fixture.client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: totp(factor.totp.secret),
    }),
  )
  return factor.id
}
try {
  for (let index = 0; index < 3; index++) {
    const email = `recovery-probe-${randomUUID()}@fixture.invalid`
    const password = randomBytes(32).toString('base64url')
    const user = await must(
      await admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    const fixture = {
      authId: user.user.id,
      personId: randomUUID(),
      email,
      password,
      client: createClient(config.API_URL, config.ANON_KEY, options),
    }
    fixtures.push(fixture)
    await must(
      await admin
        .from('people')
        .insert({ id: fixture.personId, display_name: `Fictional recovery probe ${index + 1}` }),
    )
    await must(
      await admin.from('auth_identities').insert({
        person_id: fixture.personId,
        auth_user_id: fixture.authId,
        kind: 'employee_email',
      }),
    )
    await must(
      await admin
        .from('memberships')
        .insert({ person_id: fixture.personId, kind: 'employee', status: 'active' }),
    )
    await must(
      await admin.from('role_assignments').insert({
        person_id: fixture.personId,
        role_key: 'elevated_admin',
        grant_reason: 'Disposable fictional recovery acceptance',
      }),
    )
    await must(await fixture.client.auth.signInWithPassword({ email, password }))
    fixture.factorId = await enroll(fixture, 'Disposable primary')
  }
  const [proposer, approver, target] = fixtures
  phase = 'fresh actor verification'
  for (const actor of [proposer, approver])
    if ((await must(await actor.client.rpc('current_person_can_manage_staff_security'))) !== true)
      throw new Error('Actor lacks recent authority.')
  phase = 'proposal'
  const requestId = await must(
    await proposer.client.rpc('propose_staff_mfa_reset', {
      p_person_id: target.personId,
      p_factor_id: target.factorId,
      p_reason_code: 'lost_authenticator',
    }),
  )
  phase = 'self approval denial'
  const own = await proposer.client.rpc('decide_staff_mfa_reset', {
    p_request_id: requestId,
    p_approve: true,
  })
  if (own.error?.code !== '42501') throw new Error('Self approval was not denied.')
  phase = 'independent approval'
  await must(
    await approver.client.rpc('decide_staff_mfa_reset', {
      p_request_id: requestId,
      p_approve: true,
    }),
  )
  phase = 'trusted Edge execution'
  if (process.env.STAFF_SECURITY_UI_ACCEPTANCE === 'true') {
    phase = 'local authenticated visual acceptance'
    await inspectLocalRecoveryScreen(approver)
    phase = 'trusted Edge execution'
  }
  await must(await approver.client.functions.invoke('staff-reset-mfa', { body: { requestId } }))
  phase = 'completed outcome'
  const requests = await must(await approver.client.rpc('list_staff_mfa_reset_requests'))
  if (requests.find((row) => row.id === requestId)?.status !== 'completed')
    throw new Error('Recovery did not complete.')
  phase = 'stale target denial'
  if ((await must(await target.client.rpc('current_person_id'))) !== null)
    throw new Error('Old target session remains active.')
  phase = 'new target sign-in'
  await must(
    await target.client.auth.signInWithPassword({ email: target.email, password: target.password }),
  )
  if (
    (await must(await target.client.rpc('current_person_has_active_employee_membership'))) !== true
  )
    throw new Error('New sign-in cannot recover ordinary access.')
  if (
    (await must(
      await target.client.rpc('current_person_has_capability', {
        p_capability_key: 'employee.suspend',
      }),
    )) !== false
  )
    throw new Error('Sensitive access recovered before MFA.')
  phase = 'replacement enrolment'
  await enroll(target, 'Disposable replacement')
  if (
    (await must(
      await target.client.rpc('current_person_has_capability', {
        p_capability_key: 'employee.suspend',
      }),
    )) !== true
  )
    throw new Error('Replacement MFA did not restore assigned access.')
  console.log(
    'Fictional recovery acceptance passed: real TOTP, self-approval denial, independent approval, Edge execution, stale-session denial, new sign-in, and replacement MFA.',
  )
} catch {
  console.error(
    `Fictional recovery acceptance failed during ${phase}. Provider payloads withheld to protect credentials.`,
  )
  process.exitCode = 1
} finally {
  const ids = fixtures.map((fixture) => fixture.personId)
  let cleanupFailed = false
  if (ids.length) {
    for (const [table, column] of [
      ['staff_mfa_reset_requests', 'target_person_id'],
      ['security_audit_events', 'subject_person_id'],
      ['role_assignments', 'person_id'],
      ['memberships', 'person_id'],
      ['auth_identities', 'person_id'],
      ['people', 'id'],
    ]) {
      const result = await admin.from(table).delete().in(column, ids)
      if (result.error) cleanupFailed = true
    }
  }
  for (const fixture of fixtures) {
    const result = await admin.auth.admin.deleteUser(fixture.authId)
    if (result.error) cleanupFailed = true
  }
  if (cleanupFailed) {
    console.error('Disposable fictional recovery fixture cleanup failed.')
    process.exitCode = 1
  } else console.log('All disposable fictional recovery fixtures removed.')
}
