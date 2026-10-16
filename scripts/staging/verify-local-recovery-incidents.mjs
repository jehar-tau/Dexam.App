// Exact-owned fictional local incident review, supported Auth/MFA and real browser.
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomBytes, randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { chromium, expect } from '@playwright/test'
import { totp } from './local-totp.mjs'
let config
try {
  config = JSON.parse(
    execFileSync('pnpm', ['exec', 'supabase', 'status', '--output', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  )
  if (config.API_URL !== 'http://127.0.0.1:54321') throw new Error()
} catch {
  console.error('Local incident configuration unavailable; provider output withheld.')
  process.exit(1)
}
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: {
    fetch: (url, init) => {
      if (new URL(url).origin !== config.API_URL) throw new Error('Local target required')
      return fetch(url, { ...init, redirect: 'error' })
    },
  },
}
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, options),
  clients = Array.from({ length: 4 }, () => createClient(config.API_URL, config.ANON_KEY, options))
const template = readFileSync('supabase/tests/00360_recovery_incident_review.test.sql', 'utf8'),
  mappings = new Map(
    [...template.matchAll(/ff[0-9a-f]{6}-[0-9a-f-]{27}/g)].map((m) => [m[0], randomUUID()]),
  )
const id = (kind, n = 1) => mappings.get(`ff${kind}00000-0000-4000-8000-00000000000${n}`)
const people = [1, 2, 3, 4].map((n) => id(1, n)),
  users = [],
  emails = []
const member =
  'DXM-' + [...randomBytes(12)].map((v) => '23456789ABCDEFGHJKMNPQRSTUVWXYZ'[v % 30]).join('')
let browser,
  frontend,
  writer,
  phase = 'fixture accounts'
const must = async (result) => {
  const r = await result
  if (r.error) throw new Error('Fictional operation rejected')
  return r.data
}
const ensure = (value) => {
  if (!value) throw new Error('Fictional assertion failed')
}
const sql = (input) =>
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
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  ).trim()
async function holdSource() {
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
    if (String(data).includes('F031-held')) held = true
  })
  writer.stdin.write(
    `begin;select id from public.student_recovery_requests where id='${id(5, 3)}' for update;select 'F031-held';\n`,
  )
  for (let i = 0; i < 100 && !held; i++) await new Promise((r) => setTimeout(r, 50))
  ensure(held)
}
async function releaseSource() {
  const done = new Promise((resolve, reject) =>
    writer.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error('Source lock release failed')),
    ),
  )
  writer.stdin.end('commit;\n')
  await done
  writer = undefined
}
try {
  for (let n = 1; n <= 4; n++) {
    const email =
        n === 3
          ? `${member.toLowerCase()}@members.dexam.invalid`
          : `incident-${randomUUID()}@fixture.invalid`,
      password = randomBytes(32).toString('base64url')
    emails.push(email)
    const created = await must(
      admin.auth.admin.createUser({ email, password, email_confirm: true }),
    )
    users.push(created.user.id)
    mappings.set(`ff000000-0000-4000-8000-00000000000${n}`, created.user.id)
    await must(clients[n - 1].auth.signInWithPassword({ email, password }))
  }
  let fixture = template.slice(
    template.indexOf('insert into public.people'),
    template.indexOf('insert into auth.mfa_factors'),
  )
  fixture += template.slice(
    template.indexOf('insert into public.people(id,display_name)'),
    template.indexOf('set local role anon'),
  )
  for (const [before, after] of mappings) fixture = fixture.replaceAll(before, after)
  fixture = fixture
    .replaceAll('DXM-7K3M9Q2RW5T2', member)
    .replaceAll('dxm-7k3m9q2rw5t2@members.dexam.invalid', emails[2])
    .replaceAll('incident-employee@fixture.invalid', emails[3])
    .replaceAll('RECOVERY_FIXTURE', 'IR_' + randomBytes(5).toString('hex').toUpperCase())
  // Domain-only synthetic execution history. Auth users/sessions/factors are SDK-owned.
  sql('begin;' + fixture + 'commit;')
  for (let n = 0; n < 2; n++) {
    const f = await must(
      clients[n].auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Fictional incident review' }),
    )
    await must(
      clients[n].auth.mfa.challengeAndVerify({ factorId: f.id, code: totp(f.totp.secret) }),
    )
  }
  // Captured synthetic proposer session is not used by incident review; its own
  // actor/session binding is captured from the current verified session below.
  phase = 'SDK source and target isolation'
  ensure((await must(clients[0].rpc('list_recovery_incidents'))).length === 2)
  ensure(!!(await clients[2].rpc('list_recovery_incidents')).error)
  ensure(!!(await clients[3].rpc('list_recovery_incidents')).error)
  const args = {
    p_kind: 'student',
    p_request_id: id(5, 3),
    p_reason_code: 'uncertain_password_update',
    p_fence_acknowledged: true,
  }
  const incident = await must(clients[0].rpc('open_recovery_incident', args))
  ensure((await must(clients[0].rpc('open_recovery_incident', args))) === incident)
  ensure(
    !!(
      await clients[0].rpc('review_recovery_incident', {
        p_incident_id: incident,
        p_fence_acknowledged: true,
      })
    ).error,
  )
  phase = 'queued review and actor revocation'
  await holdSource()
  const pending = clients[1]
    .rpc('review_recovery_incident', { p_incident_id: incident, p_fence_acknowledged: true })
    .then((r) => r)
  let waiting = false
  for (let i = 0; i < 100; i++) {
    waiting =
      sql(
        "select count(*) from pg_stat_activity where wait_event_type='Lock' and query like '%review_recovery_incident%'",
      ) !== '0'
    if (waiting) break
    await new Promise((r) => setTimeout(r, 50))
  }
  ensure(waiting)
  await must(admin.from('memberships').update({ status: 'suspended' }).eq('person_id', people[1]))
  await releaseSource()
  ensure(!!(await pending).error)
  await must(admin.from('memberships').update({ status: 'active' }).eq('person_id', people[1]))
  phase = 'employee review and concurrent idempotent retry'
  const employeeIncident = await must(
    clients[0].rpc('open_recovery_incident', {
      p_kind: 'employee',
      p_request_id: id(5, 4),
      p_reason_code: 'uncertain_password_update',
      p_fence_acknowledged: true,
    }),
  )
  await Promise.all(
    Array.from({ length: 2 }, () =>
      must(
        clients[1].rpc('review_recovery_incident', {
          p_incident_id: employeeIncident,
          p_fence_acknowledged: true,
        }),
      ),
    ),
  )
  ensure(
    sql(
      `select count(*) from public.security_audit_events where event_type='recovery_incident_reviewed' and metadata->>'incident_id'='${employeeIncident}'`,
    ) === '1',
  )
  phase = 'real browser independent review'
  frontend = spawn(
    'pnpm',
    ['exec', 'vite', '--host', '127.0.0.1', '--port', '5191', '--strictPort'],
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
  for (let i = 0; i < 50; i++) {
    if (frontend.exitCode !== null) throw new Error('Frontend startup failed')
    try {
      ready = (await fetch('http://127.0.0.1:5191', { redirect: 'error' })).ok
    } catch {
      /* The owned frontend is still starting. */
    }
    if (ready) break
    await new Promise((r) => setTimeout(r, 100))
  }
  ensure(ready)
  browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    session = (await must(clients[1].auth.getSession())).session
  await context.addInitScript(
    ({ session, key }) => localStorage.setItem(key, JSON.stringify(session)),
    { session, key: 'sb-' + new URL(config.API_URL).hostname.split('.')[0] + '-auth-token' },
  )
  const page = await context.newPage()
  await page.goto('http://127.0.0.1:5191/staff/security/incidents')
  await expect(page.getByRole('heading', { name: 'Uncertain recovery requests' })).toBeVisible()
  const entry = page
    .locator('div')
    .filter({
      has: page.getByRole('heading', { name: `Recovery Student · ${member}`, exact: true }),
    })
    .filter({ has: page.getByRole('button', { name: 'Record independent review' }) })
    .last()
  await entry.getByRole('checkbox').check()
  await entry.getByRole('button', { name: 'Record independent review' }).click()
  await expect(
    page.getByText('Investigation recorded. The password reset remains blocked.'),
  ).toBeVisible()
  ensure(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  )
  await page.setViewportSize({ width: 1440, height: 1000 })
  ensure(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
    ),
  )
  ensure(
    sql(`select status from public.student_recovery_requests where id='${id(5, 3)}'`) ===
      'executing',
  )
  ensure(
    sql(`select status from public.employee_password_recoveries where id='${id(5, 4)}'`) ===
      'executing',
  )
  ensure((await must(clients[2].rpc('current_person_id'))) === null)
  ensure(
    (await must(clients[1].rpc('list_recovery_incidents'))).find((r) => r.incident_id === incident)
      .incident_status === 'reviewed',
  )
  console.log(
    'F031 actual SDK/MFA/browser acceptance passed: independent review, self/target denial, queued revocation, responsive queue and unchanged execution fences.',
  )
} catch {
  console.error(`F031 acceptance failed during ${phase}; credentials/provider payloads withheld.`)
  process.exitCode = 1
} finally {
  writer?.kill('SIGTERM')
  try {
    if (browser) await browser.close()
  } catch {
    console.error('F031 browser cleanup failed; continuing fixture cleanup.')
    process.exitCode = 1
  }
  try {
    if (frontend?.pid) process.kill(-frontend.pid, 'SIGTERM')
  } catch {
    /* The owned frontend may already have stopped. */
  }
  try {
    const p = "('" + people.join("','") + "')",
      u = users.length ? "('" + users.join("','") + "')" : '(null)'
    sql(
      `begin;delete from public.recovery_incident_reviews where target_person_id in ${p};delete from public.employee_password_recoveries where person_id in ${p};delete from public.student_recovery_requests where target_person_id in ${p};delete from public.auth_session_cutoffs where auth_user_id in ${u};delete from public.security_audit_events where subject_person_id in ${p};delete from public.enrollment_transitions where enrollment_id in(select id from public.enrollments where person_id in ${p});delete from public.enrollments where person_id in ${p};delete from public.capability_grants where person_id in ${p};delete from public.role_assignments where person_id in ${p};delete from public.memberships where person_id in ${p};delete from public.auth_identities where person_id in ${p};delete from public.people where id in ${p};delete from public.offerings where id='${id(6)}';commit;`,
    )
    for (let page = 1; ; page++) {
      const listed = await must(admin.auth.admin.listUsers({ page, perPage: 1000 }))
      for (const user of listed.users)
        if (emails.includes(user.email) && !users.includes(user.id)) users.push(user.id)
      if (listed.users.length < 1000) break
    }
    for (const user of users) await must(admin.auth.admin.deleteUser(user))
    console.log('F031 exact fictional domain records and supported Auth accounts cleaned.')
  } catch {
    console.error('F031 exact fixture cleanup requires inspection.')
    process.exitCode = 1
  }
}
