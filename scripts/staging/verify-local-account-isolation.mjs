// Actual same-browser LOCAL account-switch acceptance. No credentials or private URLs logged.
import { execFileSync, spawn } from 'node:child_process'
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
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})
const fixtures = [],
  users = []
let frontend,
  browser,
  releaseRead,
  phase = 'fixture creation'
async function must(result) {
  if (result.error) throw new Error('Disposable operation rejected')
  return result.data
}
try {
  for (const name of ['First', 'Second']) {
    const person = randomUUID(),
      password = randomBytes(32).toString('base64url'),
      member =
        'DXM-' +
        [...randomBytes(12)].map((v) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[v % 30]).join(''),
      display = `Disposable ${name} pilot student`
    const created = await must(
      await admin.auth.admin.createUser({
        email: member.toLowerCase() + '@members.dexam.invalid',
        password,
        email_confirm: true,
      }),
    )
    users.push(created.user.id)
    fixtures.push({ person, password, member, display })
    await must(
      await admin.from('people').insert({ id: person, member_id: member, display_name: display }),
    )
    await must(
      await admin
        .from('auth_identities')
        .insert({ person_id: person, auth_user_id: created.user.id, kind: 'member_id' }),
    )
    await must(
      await admin
        .from('memberships')
        .insert({ person_id: person, kind: 'student', status: 'active' }),
    )
  }
  frontend = spawn(
    'pnpm',
    ['exec', 'vite', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
    {
      env: {
        ...process.env,
        VITE_SUPABASE_URL: config.API_URL,
        VITE_SUPABASE_ANON_KEY: config.ANON_KEY,
        VITE_ENABLE_OPERATOR_PREVIEW: 'false',
        VITE_ENABLE_STUDENT_PREVIEW: 'false',
      },
      stdio: 'ignore',
      detached: true,
    },
  )
  let ready = false
  for (let n = 0; n < 50; n++) {
    if (frontend.exitCode !== null) throw new Error('Own frontend failed')
    try {
      ready = (await fetch('http://127.0.0.1:5173')).ok
    } catch {
      /* Starting. */
    }
    if (ready) break
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!ready) throw new Error('Own frontend unavailable')
  browser = await chromium.launch()
  const context = await browser.newContext(),
    page = await context.newPage()
  await page.goto('http://127.0.0.1:5173/student')
  async function signIn(fixture) {
    await page.getByLabel('Dexam Member ID').fill(fixture.member)
    await page.getByLabel('Password', { exact: true }).fill(fixture.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  }
  phase = 'first actual student sign-in'
  await signIn(fixtures[0])
  await expect(page.getByText(fixtures[0].member, { exact: true })).toBeVisible()
  phase = 'same-browser sign-out and delayed second account query'
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Student sign in' })).toBeVisible()
  await expect(page.getByText(fixtures[0].member, { exact: true })).toHaveCount(0)
  let observeRead
  const observed = new Promise((resolve) => {
    observeRead = resolve
  })
  const held = new Promise((resolve) => {
    releaseRead = resolve
  })
  await page.route('**/rest/v1/people?**', async (route) => {
    observeRead()
    await held
    await route.continue()
  })
  await signIn(fixtures[1])
  await Promise.race([
    observed,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Second private read not observed')), 10000),
    ),
  ])
  await expect(page.getByText(fixtures[0].member, { exact: true })).toHaveCount(0)
  await expect(page.getByText(fixtures[0].display, { exact: true })).toHaveCount(0)
  releaseRead()
  await expect(page.getByText(fixtures[1].member, { exact: true })).toBeVisible()
  await expect(page.getByText(fixtures[0].member, { exact: true })).toHaveCount(0)
  phase = 'open-page membership revocation'
  await must(
    await admin
      .from('memberships')
      .update({ status: 'suspended' })
      .eq('person_id', fixtures[1].person),
  )
  await expect(
    page.getByRole('heading', { name: 'This student workspace is not available.' }),
  ).toBeVisible({ timeout: 40000 })
  await expect(page.getByText(fixtures[1].member, { exact: true })).toHaveCount(0)
  console.log(
    'F025 actual SDK/Edge/Chromium passed: same-browser sign-out/account switch, delayed private response isolation, and open-page revocation denial. No preview bypass.',
  )
} catch {
  console.error('F025 local acceptance failed during', phase)
  process.exitCode = 1
} finally {
  releaseRead?.()
  await browser?.close()
  if (frontend?.pid) {
    try {
      process.kill(-frontend.pid, 'SIGTERM')
    } catch {
      /* Own process already ended. */
    }
  }
  let failed = false
  for (const fixture of fixtures) {
    for (const table of ['memberships', 'auth_identities']) {
      if ((await admin.from(table).delete().eq('person_id', fixture.person)).error) failed = true
    }
    if ((await admin.from('people').delete().eq('id', fixture.person)).error) failed = true
    const remaining = await admin.from('people').select('id').eq('id', fixture.person)
    if (remaining.error || remaining.data.length) failed = true
  }
  // Identity foreign keys must be removed before supported Auth account deletion.
  for (const id of users) if ((await admin.auth.admin.deleteUser(id)).error) failed = true
  if (failed) {
    console.error('F025 exact fictional cleanup requires inspection')
    process.exitCode = 1
  } else
    console.log(
      'F025 exact disposable accounts and domain fixtures removed; existing accounts untouched.',
    )
}
