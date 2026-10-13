// Disposable fictional LOCAL acceptance; credentials remain in memory, never logs/traces.
import { execFileSync, spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { randomUUID, randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { totp } from './local-totp.mjs'
let config
try {
  config = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
  for (const value of [config.API_URL, config.MAILPIT_URL])
    if (!['127.0.0.1', 'localhost'].includes(new URL(value).hostname)) throw new Error('Nonlocal.')
} catch {
  console.error('Local recovery acceptance configuration rejected.')
  process.exit(1)
}
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const directProviderProbe = process.argv.includes('--direct-provider-probe')
const browserMode = process.argv.includes('--browser')
let browser, frontend
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const original = createClient(config.API_URL, config.ANON_KEY, options)
const recovery = createClient(config.API_URL, config.ANON_KEY, options)
const fresh = createClient(config.API_URL, config.ANON_KEY, options)
const email = `recovery-${randomUUID()}@fixture.invalid`,
  unknown = `unknown-${randomUUID()}@fixture.invalid`,
  personId = randomUUID()
let userId,
  phase = 'fixture creation',
  requestId
async function must(result) {
  if (result.error) throw new Error('Fixture operation failed.')
  return result.data
}
async function inboxFor(address) {
  const inbox = await fetch(`${config.MAILPIT_URL}/api/v1/messages`).then((r) => r.json())
  return inbox.messages.filter((item) => item.To.some((to) => to.Address === address))
}
try {
  const oldPassword = randomBytes(32).toString('base64url'),
    newPassword = randomBytes(32).toString('base64url')
  const created = await must(
    await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true }),
  )
  userId = created.user.id
  await must(
    await admin
      .from('people')
      .insert({ id: personId, display_name: 'Disposable recovery employee' }),
  )
  await must(
    await admin
      .from('auth_identities')
      .insert({ person_id: personId, auth_user_id: userId, kind: 'employee_email' }),
  )
  await must(
    await admin
      .from('memberships')
      .insert({ person_id: personId, kind: 'employee', status: 'active' }),
  )
  await must(
    await admin.from('role_assignments').insert({
      person_id: personId,
      role_key: directProviderProbe ? 'teacher' : 'elevated_admin',
      grant_reason: 'Disposable local recovery verification',
    }),
  )
  await must(await original.auth.signInWithPassword({ email, password: oldPassword }))
  const factor = directProviderProbe
    ? null
    : await must(
        await original.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Preserved recovery factor',
        }),
      )
  if (factor)
    await must(
      await original.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: totp(factor.totp.secret),
      }),
    )
  const oldSession = (await must(await original.auth.getSession())).session
  phase = 'generic request and capture'
  const publicRequest = await must(
    await fresh.functions.invoke('employee-request-password-recovery', { body: { email } }),
  )
  const unknownRequest = await must(
    await fresh.functions.invoke('employee-request-password-recovery', {
      body: { email: unknown },
    }),
  )
  if (JSON.stringify(publicRequest) !== JSON.stringify(unknownRequest))
    throw new Error('Account existence disclosed.')
  if ((await inboxFor(unknown)).length) throw new Error('Unknown account received recovery.')
  let records = []
  for (let attempt = 0; attempt < 100; attempt++) {
    records = await must(
      await admin
        .from('employee_password_recoveries')
        .select('id,status')
        .eq('auth_user_id', userId),
    )
    if (records[0]?.status === 'delivered') break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  if (records.length !== 1 || records[0].status !== 'delivered')
    throw new Error('Recovery delivery not confirmed.')
  requestId = records[0].id
  const messages = await inboxFor(email)
  if (messages.length !== 1) throw new Error('Expected one captured email.')
  const detail = await fetch(`${config.MAILPIT_URL}/api/v1/message/${messages[0].ID}`).then((r) =>
    r.json(),
  )
  const callback = new URL(detail.Text.match(/https?:[^\s"<>]+/g)?.[0])
  if (
    callback.origin !== 'http://127.0.0.1:5173' ||
    callback.pathname !== '/staff/recover' ||
    callback.search
  )
    throw new Error('Unsafe recovery callback.')
  const fields = new URLSearchParams(callback.hash.slice(1)),
    proof = fields.get('proof')
  if (fields.get('request') !== requestId || fields.get('type') !== 'recovery')
    throw new Error('Recovery request mismatch.')
  phase = 'owned email proof and trusted password mutation'
  if (!browserMode)
    await must(
      await recovery.auth.verifyOtp({ token_hash: fields.get('token_hash'), type: 'recovery' }),
    )
  phase = 'wrong application proof denial'
  phase = 'valid owned password recovery'
  if (browserMode) {
    phase = 'isolated actual browser recovery'
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
      if (frontend.exitCode !== null) throw new Error('Local frontend could not start.')
      try {
        ready = (await fetch('http://127.0.0.1:5173')).ok
      } catch {
        /* startup */
      }
      if (ready) break
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    if (!ready) throw new Error('Local frontend unavailable.')
    browser = await chromium.launch()
    const context = await browser.newContext()
    const page = await context.newPage()
    // No traces/video/screenshots of credential URLs or password fields.
    await page.goto(callback.toString())
    await page.getByRole('button', { name: 'Verify recovery link' }).waitFor()
    if (new URL(page.url()).hash) throw new Error('Browser retained recovery proof.')
    await page.getByRole('button', { name: 'Verify recovery link' }).click()
    await page.getByLabel('New password', { exact: true }).fill(newPassword)
    await page.getByLabel('Confirm password').fill(newPassword)
    await page.getByRole('button', { name: 'Update password and block previous sessions' }).click()
    await page.getByRole('heading', { name: 'Password updated', exact: true }).waitFor()
    await page.screenshot({
      path: 'test-results/f016-recovery/completed-desktop.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    if (!(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
      throw new Error('Recovery mobile overflow.')
    await page.screenshot({
      path: 'test-results/f016-recovery/completed-mobile.png',
      fullPage: true,
    })
    if (
      await page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.endsWith('-auth-token')),
      )
    )
      throw new Error('Recovery session persisted.')
    await browser.close()
    browser = null
  }
  if (directProviderProbe) {
    await must(await recovery.auth.updateUser({ password: newPassword }))
    const oldStillResolves = (await must(await original.rpc('current_person_id'))) === personId
    console.log(
      `Direct provider password-update probe: old application session still resolves = ${oldStillResolves}.`,
    )
    if (oldStillResolves)
      throw new Error('Direct provider recovery bypassed application session invalidation.')
    console.log('Direct provider recovery denied the old application session.')
  } else {
    if (!browserMode) {
      if (
        !(
          await recovery.functions.invoke('employee-reset-password', {
            body: { requestId, proof: '0'.repeat(64), password: newPassword },
          })
        ).error
      )
        throw new Error('Wrong application proof accepted.')
      if (
        !(
          await recovery.functions.invoke('employee-reset-password', {
            body: { requestId, proof, password: newPassword, userId: randomUUID() },
          })
        ).error
      ) {
        // Unknown userId is not authority: the trusted worker must recover only its verified owner.
        const own = await must(
          await admin
            .from('employee_password_recoveries')
            .select('status')
            .eq('id', requestId)
            .single(),
        )
        if (own.status !== 'completed') throw new Error('Recovery outcome wrong.')
      } else throw new Error('Valid owned recovery failed.')
    }
    phase = 'old sessions, refresh, MFA preservation and replay denial'
    if ((await must(await original.rpc('current_person_id'))) !== null)
      throw new Error('Old application session remained live.')
    const refresh = await original.auth.refreshSession({ refresh_token: oldSession.refresh_token })
    if (!refresh.error && (await must(await original.rpc('current_person_id'))) !== null)
      throw new Error('Refreshed old session regained access.')
    if (
      !(
        await recovery.functions.invoke('employee-reset-password', {
          body: { requestId, proof, password: randomBytes(32).toString('base64url') },
        })
      ).error
    )
      throw new Error('Recovery proof replay accepted.')
    if (!(await fresh.auth.signInWithPassword({ email, password: oldPassword })).error)
      throw new Error('Old password remained valid.')
    await must(await fresh.auth.signInWithPassword({ email, password: newPassword }))
    if ((await must(await fresh.rpc('current_person_id'))) !== personId)
      throw new Error('New session could not resolve own identity.')
    if ((await must(await fresh.rpc('current_person_can_invite_employees'))) !== false)
      throw new Error('Recovery bypassed sensitive MFA.')
    const factors = await must(await fresh.auth.mfa.listFactors())
    if (!factors.totp.some((value) => value.id === factor.id && value.status === 'verified'))
      throw new Error('Recovery removed MFA.')
    await must(
      await fresh.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: totp(factor.totp.secret),
      }),
    )
    if ((await must(await fresh.rpc('current_person_can_invite_employees'))) !== true)
      throw new Error('Preserved MFA could not be verified.')
    await must(
      await admin
        .from('memberships')
        .update({ status: 'suspended' })
        .eq('person_id', personId)
        .eq('kind', 'employee'),
    )
    const before = (await inboxFor(email)).length
    const suspended = await must(
      await fresh.functions.invoke('employee-request-password-recovery', { body: { email } }),
    )
    if (
      JSON.stringify(suspended) !== JSON.stringify(unknownRequest) ||
      (await inboxFor(email)).length !== before
    )
      throw new Error('Suspended recovery not denied generically.')
    console.log(
      'Local employee recovery passed: generic requests, exact owned proof, durable old/refresh-session denial, new password, preserved MFA, sensitive-access MFA gate, replay denial, and suspended-target denial.',
    )
  }
} catch {
  console.error(
    `Local recovery acceptance failed during ${phase}; credentials and provider payloads withheld.`,
  )
  process.exitCode = 1
} finally {
  let failed = false
  try {
    if (browser) await browser.close()
  } catch {
    failed = true
  }
  try {
    if (frontend?.pid) process.kill(-frontend.pid, 'SIGTERM')
  } catch {
    /* already stopped */
  }
  for (const [table, column, id] of [
    ['employee_password_recoveries', 'auth_user_id', userId],
    ['security_audit_events', 'subject_person_id', personId],
    ['role_assignments', 'person_id', personId],
    ['memberships', 'person_id', personId],
    ['auth_identities', 'person_id', personId],
    ['people', 'id', personId],
  ]) {
    try {
      if (id && (await admin.from(table).delete().eq(column, id)).error) failed = true
    } catch {
      failed = true
    }
  }
  try {
    if (userId && (await admin.auth.admin.deleteUser(userId)).error) failed = true
  } catch {
    failed = true
  }
  try {
    const messages = [...(await inboxFor(email)), ...(await inboxFor(unknown))],
      ids = messages.map((item) => item.ID)
    if (
      ids.length &&
      !(
        await fetch(`${config.MAILPIT_URL}/api/v1/messages`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ IDs: ids }),
        })
      ).ok
    )
      failed = true
  } catch {
    failed = true
  }
  if (failed) {
    console.error('Disposable local recovery cleanup failed.')
    process.exitCode = 1
  } else
    console.log(
      'Disposable recovery people, accounts, audit, request, cutoff, and captured mail removed; bounded HMAC throttle counters expire separately.',
    )
}
