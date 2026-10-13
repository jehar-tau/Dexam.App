// Actual local Edge/OTP integration. Disposable fictional people only; no secrets logged.
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
  console.error('Local invitation acceptance configuration rejected.')
  process.exit(1)
}
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const issuer = createClient(config.API_URL, config.ANON_KEY, options)
const employee = createClient(config.API_URL, config.ANON_KEY, options)
const actorEmail = `invite-actor-${randomUUID()}@fixture.invalid`
const employeeEmail = `invite-employee-${randomUUID()}@fixture.invalid`
const actorPerson = randomUUID()
const requestIds = []
const personIds = [actorPerson]
const userIds = []
let phase = 'fixture creation'
let browser
let frontend
const browserMode = process.argv.includes('--browser')
async function must(result) {
  if (result.error) throw new Error('Fixture operation failed.')
  return result.data
}
async function capturedLink() {
  const inbox = await fetch(`${config.MAILPIT_URL}/api/v1/messages`).then((r) => r.json())
  const found = inbox.messages.find((item) => item.To.some((to) => to.Address === employeeEmail))
  if (!found) throw new Error('No captured email.')
  const detail = await fetch(`${config.MAILPIT_URL}/api/v1/message/${found.ID}`).then((r) =>
    r.json(),
  )
  const raw = (detail.Text ?? '').match(/https?:[^\s"<>]+/g)?.[0]
  const url = new URL(raw)
  if (
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.pathname !== '/staff/activate' ||
    url.search
  )
    throw new Error('Unsafe capture link.')
  const fields = new URLSearchParams(url.hash.slice(1))
  return {
    requestId: fields.get('request'),
    proof: fields.get('proof'),
    token_hash: fields.get('token_hash'),
    type: fields.get('type'),
  }
}
async function verify(proof) {
  return must(await employee.auth.verifyOtp({ token_hash: proof.token_hash, type: proof.type }))
}
async function activate(proof, requestId = proof.requestId) {
  return employee.functions.invoke('employee-activate', { body: { requestId, proof: proof.proof } })
}
try {
  const password = randomBytes(32).toString('base64url')
  const account = await must(
    await admin.auth.admin.createUser({ email: actorEmail, password, email_confirm: true }),
  )
  userIds.push(account.user.id)
  await must(
    await admin
      .from('people')
      .insert({ id: actorPerson, display_name: 'Fictional invitation issuer' }),
  )
  await must(
    await admin
      .from('auth_identities')
      .insert({ person_id: actorPerson, auth_user_id: account.user.id, kind: 'employee_email' }),
  )
  await must(
    await admin
      .from('memberships')
      .insert({ person_id: actorPerson, kind: 'employee', status: 'active' }),
  )
  await must(
    await admin.from('role_assignments').insert({
      person_id: actorPerson,
      role_key: 'elevated_admin',
      grant_reason: 'Disposable local invitation acceptance',
    }),
  )
  await must(await issuer.auth.signInWithPassword({ email: actorEmail, password }))
  const factor = await must(
    await issuer.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Disposable issuer' }),
  )
  await must(
    await issuer.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: totp(factor.totp.secret),
    }),
  )
  phase = 'preparation'
  const requestId = await must(
    await issuer.rpc('prepare_employee_invitation', {
      p_person_id: null,
      p_display_name: 'Fictional employee acceptance',
      p_email: employeeEmail,
      p_duplicates_reviewed: true,
    }),
  )
  requestIds.push(requestId)
  const row = await must(
    await admin.from('employee_invitations').select('person_id').eq('id', requestId).single(),
  )
  personIds.push(row.person_id)
  phase = 'trusted delivery'
  await must(await issuer.functions.invoke('staff-employee-invite', { body: { requestId } }))
  const delivered = await must(
    await admin
      .from('employee_invitations')
      .select('auth_user_id,status')
      .eq('id', requestId)
      .single(),
  )
  if (delivered.status !== 'delivered' || !delivered.auth_user_id)
    throw new Error('Delivery not confirmed.')
  userIds.push(delivered.auth_user_id)
  phase = 'cancellation'
  const cancelledProof = await capturedLink()
  await must(await issuer.rpc('cancel_employee_invitation', { p_request_id: requestId }))
  phase = 'deliberate reissue'
  // Move only the disposable cancelled row outside the cooldown without waiting.
  await must(
    await admin
      .from('employee_invitations')
      .update({
        created_at: new Date(Date.now() - 120_000).toISOString(),
        expires_at: new Date(Date.now() + 1_800_000).toISOString(),
      })
      .eq('id', requestId),
  )
  const next = await must(
    await issuer.rpc('prepare_employee_invitation', {
      p_person_id: row.person_id,
      p_display_name: null,
      p_email: employeeEmail,
      p_duplicates_reviewed: true,
    }),
  )
  requestIds.push(next)
  // Exact review regression: consume A after B is prepared, before B delivery.
  phase = 'cancelled proof consumed after replacement preparation'
  await verify(cancelledProof)
  if ((await must(await employee.rpc('current_person_id'))) !== null)
    throw new Error('Pending invitation exposed canonical identity before acceptance.')
  await must(await employee.auth.updateUser({ password: randomBytes(32).toString('base64url') }))
  if (!(await activate(cancelledProof)).error)
    throw new Error('Cancelled invitation activated access.')
  if ((await must(await employee.rpc('current_person_has_active_employee_membership'))) !== false)
    throw new Error('Cancelled person gained access.')
  await must(await issuer.functions.invoke('staff-employee-invite', { body: { requestId: next } }))
  const nextRow = await must(
    await admin.from('employee_invitations').select('auth_user_id').eq('id', next).single(),
  )
  if (nextRow.auth_user_id !== delivered.auth_user_id)
    throw new Error('Reissue duplicated Auth identity.')
  phase = 'fresh email proof and finalization'
  const beforeProof = await activate(cancelledProof, next)
  if (!beforeProof.error) throw new Error('Cancelled A proof activated replacement B.')
  const proof = await capturedLink()
  if (browserMode) {
    phase = 'isolated browser activation'
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
    const context = await browser.newContext() // No traces, video, or token-bearing screenshots.
    const page = await context.newPage()
    const fragment = new URLSearchParams({
      request: proof.requestId,
      proof: proof.proof,
      token_hash: proof.token_hash,
      type: proof.type,
    })
    await page.goto(`http://127.0.0.1:5173/staff/activate#${fragment}`)
    await page.getByRole('button', { name: 'Verify invitation' }).waitFor()
    if (new URL(page.url()).hash) throw new Error('Browser retained invitation credentials.')
    await page.getByRole('button', { name: 'Verify invitation' }).click()
    await page.getByLabel('New password', { exact: true }).waitFor()
    const chosenPassword = randomBytes(32).toString('base64url')
    await page.getByLabel('New password', { exact: true }).fill(chosenPassword)
    await page.getByLabel('Confirm password').fill(chosenPassword)
    await page.getByRole('button', { name: 'Activate employee account' }).click()
    await page.getByRole('heading', { name: 'Account activated', exact: true }).waitFor()
    if (
      await page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.endsWith('-auth-token')),
      )
    )
      throw new Error('Invitation session persisted in browser storage.')
    await must(
      await employee.auth.signInWithPassword({ email: employeeEmail, password: chosenPassword }),
    )
    await browser.close()
    browser = null
  } else {
    await verify(proof)
    if ((await must(await employee.rpc('current_person_id'))) !== null)
      throw new Error('Delivered invitation exposed canonical identity before acceptance.')
    await must(await employee.auth.updateUser({ password: randomBytes(32).toString('base64url') }))
    await must(await activate(proof))
  }
  if ((await must(await employee.rpc('current_person_has_active_employee_membership'))) !== true)
    throw new Error('Employee did not activate.')
  if (
    (await must(
      await employee.rpc('current_person_has_capability', { p_capability_key: 'staff_role.grant' }),
    )) !== false
  )
    throw new Error('Invitation granted authority.')
  if (!(await employee.auth.verifyOtp({ token_hash: proof.token_hash, type: proof.type })).error)
    throw new Error('Email proof replay accepted.')
  if (!(await activate(proof)).error) throw new Error('Application proof replay accepted.')
  console.log(
    'Local employee invitation acceptance passed: real issuer MFA, Edge capture, cancelled-link denial, canonical reissue, fresh OTP requirement, activation without role grants, and replay denial.',
  )
} catch {
  console.error(
    `Local invitation acceptance failed during ${phase}; credentials and provider payloads withheld.`,
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
  // Resolve only our random reserved addresses if a provider response failed mid-operation.
  try {
    const users = await must(await admin.auth.admin.listUsers({ perPage: 1000 }))
    for (const user of users.users)
      if ([actorEmail, employeeEmail].includes(user.email) && !userIds.includes(user.id))
        userIds.push(user.id)
  } catch {
    failed = true
  }
  for (const [table, column, ids] of [
    ['employee_invitations', 'id', requestIds],
    ['security_audit_events', 'subject_person_id', personIds],
    ['role_assignments', 'person_id', personIds],
    ['memberships', 'person_id', personIds],
    ['auth_identities', 'person_id', personIds],
    ['people', 'id', personIds],
  ]) {
    try {
      if (ids.length && (await admin.from(table).delete().in(column, ids)).error) failed = true
    } catch {
      failed = true
    }
  }
  for (const id of userIds) {
    try {
      if ((await admin.auth.admin.deleteUser(id)).error) failed = true
    } catch {
      failed = true
    }
  }
  try {
    const inbox = await fetch(`${config.MAILPIT_URL}/api/v1/messages`).then((r) => r.json())
    const ids = inbox.messages
      .filter((item) => item.To.some((to) => [actorEmail, employeeEmail].includes(to.Address)))
      .map((item) => item.ID)
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
    console.error('Disposable local invitation cleanup failed.')
    process.exitCode = 1
  } else console.log('Disposable local invitation people, accounts, and captured emails removed.')
}
