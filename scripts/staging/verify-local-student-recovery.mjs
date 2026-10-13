// Fictional LOCAL accounts only. Never print credentials or provider payloads.
import { execFileSync, spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium } from '@playwright/test'
import { totp } from './local-totp.mjs'
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
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options)
const clients = Array.from({ length: 3 }, () =>
  createClient(config.API_URL, config.ANON_KEY, options),
)
const personIds = Array.from({ length: 3 }, () => randomUUID()),
  userIds = [],
  offeringId = randomUUID()
const memberId =
  'DXM-' +
  [...randomBytes(12)].map((value) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[value % 30]).join('')
const passwords = Array.from({ length: 4 }, () => randomBytes(32).toString('base64url'))
let phase = 'fixture creation',
  browser,
  frontend,
  requestId
async function must(result) {
  if (result.error) throw new Error('Fixture operation rejected.')
  return result.data
}
async function reject(result) {
  if (!result.error) throw new Error('Expected rejection.')
}
try {
  for (let index = 0; index < 3; index++) {
    const email =
      index === 2
        ? `${memberId.toLowerCase()}@members.dexam.invalid`
        : `student-reset-admin-${randomUUID()}@fixture.invalid`
    const created = await must(
      await admin.auth.admin.createUser({ email, password: passwords[index], email_confirm: true }),
    )
    userIds.push(created.user.id)
    await must(
      await admin.from('people').insert({
        id: personIds[index],
        display_name:
          index === 2 ? 'Disposable recovery student' : `Disposable recovery admin ${index + 1}`,
        member_id: index === 2 ? memberId : null,
      }),
    )
    await must(
      await admin.from('auth_identities').insert({
        person_id: personIds[index],
        auth_user_id: userIds[index],
        kind: index === 2 ? 'member_id' : 'employee_email',
      }),
    )
    await must(
      await admin.from('memberships').insert({
        person_id: personIds[index],
        kind: index === 2 ? 'student' : 'employee',
        status: 'active',
      }),
    )
    await must(await clients[index].auth.signInWithPassword({ email, password: passwords[index] }))
    if (index < 2) {
      await must(
        await admin.from('role_assignments').insert({
          person_id: personIds[index],
          role_key: 'elevated_admin',
          grant_reason: 'Disposable local independent student recovery verification',
        }),
      )
      const factor = await must(
        await clients[index].auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'Disposable local verification',
        }),
      )
      await must(
        await clients[index].auth.mfa.challengeAndVerify({
          factorId: factor.id,
          code: totp(factor.totp.secret),
        }),
      )
    }
  }
  await must(
    await admin.from('offerings').insert({
      id: offeringId,
      code: `REC_${randomBytes(6).toString('hex').toUpperCase()}`,
      title: 'Disposable recovery fixture',
      status: 'active',
    }),
  )
  await must(
    await admin.from('enrollments').insert({
      person_id: personIds[2],
      offering_id: offeringId,
      status: 'completed',
      source_type: 'manual',
    }),
  )
  const oldSession = (await must(await clients[2].auth.getSession())).session
  phase = 'independent approval'
  requestId = await must(
    await clients[0].rpc('propose_student_recovery', {
      p_person_id: personIds[2],
      p_reason_code: 'forgotten_password',
      p_identity_verified: true,
      p_enrollment_reviewed: true,
    }),
  )
  await reject(
    await clients[0].rpc('decide_student_recovery', {
      p_request_id: requestId,
      p_approve: true,
      p_identity_rechecked: true,
      p_enrollment_rechecked: true,
    }),
  )
  await reject(
    await clients[0].functions.invoke('staff-issue-student-recovery', { body: { requestId } }),
  )
  let pack
  if (process.argv.includes('--browser')) {
    phase = 'actual independent administrator browser approval'
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
    const staffContext = await browser.newContext()
    const staffSession = (await must(await clients[1].auth.getSession())).session
    await staffContext.addInitScript(
      ({ key, session }) => {
        localStorage.setItem(key, JSON.stringify(session))
      },
      {
        key: `sb-${new URL(config.API_URL).hostname.split('.')[0]}-auth-token`,
        session: staffSession,
      },
    )
    const staffPage = await staffContext.newPage()
    await staffPage.goto('http://127.0.0.1:5173/staff/student-recovery')
    phase = 'admin workspace authorization and queue rendering'
    await staffPage.getByRole('heading', { name: 'Recovery queue', exact: true }).waitFor()
    const entry = staffPage
      .locator('div')
      .filter({
        has: staffPage.getByRole('heading', {
          name: `Disposable recovery student · ${memberId}`,
          exact: true,
        }),
      })
      .filter({
        has: staffPage.getByRole('button', { name: 'Independently review evidence', exact: true }),
      })
      .last()
    phase = 'admin review controls'
    await entry.getByRole('button', { name: 'Independently review evidence', exact: true }).click()
    await entry.getByLabel('I independently rechecked established identity.').check()
    await entry.getByLabel('I independently rechecked admitted enrolment evidence.').check()
    phase = 'admin independent approval submission'
    await entry.getByRole('button', { name: 'Approve this recovery', exact: true }).click()
    phase = 'admin approved pack issuance'
    await staffPage
      .locator('div')
      .filter({
        has: staffPage.getByRole('heading', {
          name: `Disposable recovery student · ${memberId}`,
          exact: true,
        }),
      })
      .last()
      .getByRole('button', { name: 'Issue one-time recovery pack', exact: true })
      .click()
    // Read credentials into memory only. No trace, screenshot or provider response logging.
    phase = 'admin transient recovery pack rendering'
    const recoveryURL = await staffPage.getByLabel('One-time recovery link').inputValue()
    const backupCode = await staffPage.getByLabel('Backup code').inputValue()
    pack = { memberId, recoveryURL, backupCode }
    await staffPage.getByRole('button', { name: 'Handover complete — hide credentials' }).click()
    if (await staffPage.getByLabel('One-time recovery link').count())
      throw new Error('Pack remained visible after handover.')
    await staffPage.screenshot({
      path: 'test-results/f017-recovery/admin-desktop.png',
      fullPage: true,
    })
    await staffPage.setViewportSize({ width: 390, height: 844 })
    if (!(await staffPage.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
      throw new Error('Admin mobile overflow.')
    await staffPage.screenshot({
      path: 'test-results/f017-recovery/admin-mobile.png',
      fullPage: true,
    })
    await staffContext.close()
  } else {
    await must(
      await clients[1].rpc('decide_student_recovery', {
        p_request_id: requestId,
        p_approve: true,
        p_identity_rechecked: true,
        p_enrollment_rechecked: true,
      }),
    )
    phase = 'pack issuance'
    pack = await must(
      await clients[1].functions.invoke('staff-issue-student-recovery', { body: { requestId } }),
    )
  }
  if (pack.memberId !== memberId) throw new Error('Wrong canonical pack.')
  await reject(
    await clients[1].functions.invoke('staff-issue-student-recovery', { body: { requestId } }),
  )
  const publicClient = createClient(config.API_URL, config.ANON_KEY, options)
  await reject(
    await publicClient.functions.invoke('student-reset-password', {
      body: { memberId, credentialType: 'backup', proof: '2222222222', password: passwords[3] },
    }),
  )
  phase = 'password mutation'
  if (process.argv.includes('--browser')) {
    const context = await browser.newContext(),
      page = await context.newPage()
    // Never trace, record, or screenshot credentials/password fields.
    await page.goto(pack.recoveryURL)
    await page.getByLabel('New password', { exact: true }).waitFor()
    if (new URL(page.url()).hash || new URL(page.url()).search)
      throw new Error('Recovery proof retained in URL.')
    await page.getByLabel('New password', { exact: true }).fill(passwords[3])
    await page.getByLabel('Confirm password').fill(passwords[3])
    await page.getByRole('button', { name: 'Update password and block old sessions' }).click()
    await page.getByRole('heading', { name: 'Password updated', exact: true }).waitFor()
    await page.screenshot({
      path: 'test-results/f017-recovery/completed-desktop.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 390, height: 844 })
    if (!(await page.locator('body').evaluate((body) => body.scrollWidth <= body.clientWidth)))
      throw new Error('Mobile recovery overflow.')
    await page.screenshot({
      path: 'test-results/f017-recovery/completed-mobile.png',
      fullPage: true,
    })
    if (
      await page.evaluate(() =>
        Object.keys(localStorage).some((key) => key.endsWith('-auth-token')),
      )
    )
      throw new Error('Recovery session persisted.')
  } else
    await must(
      await publicClient.functions.invoke('student-reset-password', {
        body: {
          memberId,
          credentialType: 'backup',
          proof: pack.backupCode,
          password: passwords[3],
        },
      }),
    )
  phase = 'session and identity continuity'
  if ((await must(await clients[2].rpc('current_person_id'))) !== null)
    throw new Error('Old student session still resolves.')
  const refreshed = await clients[2].auth.refreshSession({
    refresh_token: oldSession.refresh_token,
  })
  if (!refreshed.error && (await must(await clients[2].rpc('current_person_id'))) !== null)
    throw new Error('Old refresh regained access.')
  await reject(
    await publicClient.functions.invoke('student-reset-password', {
      body: { memberId, credentialType: 'backup', proof: pack.backupCode, password: passwords[2] },
    }),
  )
  await reject(
    await publicClient.auth.signInWithPassword({
      email: `${memberId.toLowerCase()}@members.dexam.invalid`,
      password: passwords[2],
    }),
  )
  await must(
    await publicClient.auth.signInWithPassword({
      email: `${memberId.toLowerCase()}@members.dexam.invalid`,
      password: passwords[3],
    }),
  )
  if ((await must(await publicClient.rpc('current_person_id'))) !== personIds[2])
    throw new Error('New session canonical identity changed.')
  const person = await must(
    await admin.from('people').select('member_id').eq('id', personIds[2]).single(),
  )
  const enrolment = await must(
    await admin.from('enrollments').select('status').eq('person_id', personIds[2]).single(),
  )
  if (person.member_id !== memberId || enrolment.status !== 'completed')
    throw new Error('Canonical learning access changed.')
  // Supported direct provider password change must also deny the previous JWT.
  const stale = createClient(config.API_URL, config.ANON_KEY, options)
  await must(
    await stale.auth.signInWithPassword({
      email: `${memberId.toLowerCase()}@members.dexam.invalid`,
      password: passwords[3],
    }),
  )
  await must(
    await publicClient.auth.updateUser({ password: randomBytes(32).toString('base64url') }),
  )
  if ((await must(await stale.rpc('current_person_id'))) !== null)
    throw new Error('Direct provider password update bypassed session deletion.')
  console.log(
    'Local student recovery passed: independent approval, exact pack, wrong-proof/replay denial, password selection, old JWT/refresh denial, Member ID/history preserved, and direct-provider session deletion honored.',
  )
} catch {
  console.error(
    `Local student recovery failed during ${phase}; credentials and provider payloads withheld.`,
  )
  process.exitCode = 1
} finally {
  if (browser) await browser.close()
  try {
    if (frontend?.pid) process.kill(-frontend.pid, 'SIGTERM')
  } catch {
    /* Already stopped. */
  }
  let cleanupFailed = false
  for (const [table, column, ids] of [
    ['student_recovery_requests', 'target_person_id', [personIds[2]]],
    ['account_action_tokens', 'person_id', personIds],
    ['security_audit_events', 'subject_person_id', personIds],
    ['enrollments', 'person_id', personIds],
    ['role_assignments', 'person_id', personIds],
    ['memberships', 'person_id', personIds],
    ['auth_identities', 'person_id', personIds],
    ['people', 'id', personIds],
    ['offerings', 'id', [offeringId]],
  ]) {
    try {
      if ((await admin.from(table).delete().in(column, ids)).error) cleanupFailed = true
    } catch {
      cleanupFailed = true
    }
  }
  for (const id of userIds) {
    try {
      if ((await admin.auth.admin.deleteUser(id)).error) cleanupFailed = true
    } catch {
      cleanupFailed = true
    }
  }
  if (cleanupFailed) {
    console.error('Disposable student recovery cleanup needs inspection.')
    process.exitCode = 1
  } else
    console.log(
      'Disposable fictional accounts, people, enrolments, requests, tokens, audit and cutoffs removed. Bounded HMAC counters expire separately.',
    )
}
