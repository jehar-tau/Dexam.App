// Local F054 acceptance on a new disposable stack. Each browser uses its own real TOTP session.
// Stop that specific project with --no-backup when finished. Fixtures remain for inspection.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { chromium, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createServer } from 'vite'
import { totp } from './local-totp.mjs'

const workdir = process.argv[2]
assert.ok(workdir, 'Supply the workdir of a fresh, owned dexam-f054-browser-* stack.')
const projectId = /^project_id = "(dexam-f054-browser-[a-z0-9]+)"$/m.exec(
  readFileSync(join(workdir, 'supabase/config.toml'), 'utf8'),
)?.[1]
assert.ok(projectId, 'Use a disposable browser-acceptance project.')
const config = JSON.parse(
  execFileSync('pnpm', ['exec', 'supabase', 'status', '--workdir', workdir, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }),
)
const api = new URL(config.API_URL)
assert.ok(api.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(api.hostname))
const gatewayPorts = JSON.parse(
  execFileSync(
    'docker',
    [
      'inspect',
      '--format',
      '{{json (index .NetworkSettings.Ports "8000/tcp")}}',
      'supabase_kong_' + projectId,
    ],
    { encoding: 'utf8' },
  ),
)
assert.ok(
  gatewayPorts?.some(({ HostPort }) => HostPort === api.port),
  'The loopback API must be the published gateway of the same disposable project.',
)
const container = 'supabase_db_' + projectId

function sql(statement) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-qAt',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: statement,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  ).trim()
}
assert.equal(
  sql(
    'select (select count(*) from public.people) = 0 and (select count(*) from auth.users) = 0 and not (select enabled from public.admissions_runtime_gate where singleton)',
  ),
  't',
  'Use a fresh empty stack with admission writes disabled.',
)

const clients = {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
}
const service = createClient(config.API_URL, config.SERVICE_ROLE_KEY, clients)
async function checked(operation) {
  const { data, error } = await operation
  if (error)
    throw new Error(
      'Fictional fixture operation failed: ' + (error.code ?? error.status ?? 'unknown'),
    )
  return data
}
async function adminSession(name) {
  const email = randomUUID() + '@admissions.fixture.invalid'
  const password = randomBytes(32).toString('base64url')
  const user = (
    await checked(service.auth.admin.createUser({ email, password, email_confirm: true }))
  ).user
  const person = randomUUID()
  await checked(service.from('people').insert({ id: person, display_name: name }))
  await checked(
    service
      .from('auth_identities')
      .insert({ person_id: person, auth_user_id: user.id, kind: 'employee_email' }),
  )
  await checked(
    service.from('memberships').insert({ person_id: person, kind: 'employee', status: 'active' }),
  )
  await checked(
    service.from('role_assignments').insert({
      person_id: person,
      role_key: 'elevated_admin',
      grant_reason: 'Fictional browser acceptance',
    }),
  )
  const client = createClient(config.API_URL, config.ANON_KEY, clients)
  await checked(client.auth.signInWithPassword({ email, password }))
  const factor = await checked(
    client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Fixture authenticator' }),
  )
  await checked(
    client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) }),
  )
  const { session } = await checked(client.auth.getSession())
  assert.ok(await checked(client.rpc('current_person_can_manage_admissions')))
  return session
}

const morning = randomUUID()
const evening = randomUUID()
const unpinned = randomUUID()
const learner = 'Fictional studio learner'
const revised = 'Fictional revised learner'
const email = randomUUID() + '@student.fixture.invalid'
function indiaInput(days) {
  return new Date(Date.now() + days * 86_400_000 + 330 * 60_000).toISOString().slice(0, 16)
}
let server,
  browser,
  gateOpened = false
try {
  // Read the same random fixture ID over HTTP before making any privileged Auth API writes.
  const course = sql(
    "insert into public.offerings(code,title,status) values ('BROWSER_FIXTURE','Fictional studio course','active') returning id",
  )
  const courseOverHttp = await checked(
    service.from('offerings').select('id').eq('id', course).single(),
  )
  assert.equal(courseOverHttp.id, course)
  const sessions = []
  for (const name of [
    'Fictional admitting admin',
    'Fictional editing admin',
    'Fictional reviewing admin',
  ]) {
    sessions.push(await adminSession(name))
  }
  const curriculum = sql(`
    with version as (
      insert into public.curriculum_versions(offering_id,version_number,title,created_by_person_id)
      select o.id,1,'Fictional studio curriculum',p.id from public.offerings o cross join public.people p
      where o.code='BROWSER_FIXTURE' and p.display_name='Fictional admitting admin' returning id
    ), section as (
      insert into public.curriculum_sections(curriculum_version_id,code,title,position)
      select id,'STUDIO','Studio',1 from version returning id
    )
    insert into public.curriculum_topics(section_id,code,title,position) select id,'LINES','Lines',1 from section;
    update public.curriculum_versions set status='published',published_by_person_id=created_by_person_id,
      published_at=now(),release_note='Fictional release' where title='Fictional studio curriculum' returning id;
  `)
  await checked(
    service.from('cohorts').insert([
      {
        id: morning,
        offering_id: course,
        curriculum_version_id: curriculum,
        code: 'MORNING',
        name: 'Fictional morning',
        status: 'active',
      },
      {
        id: evening,
        offering_id: course,
        curriculum_version_id: curriculum,
        code: 'EVENING',
        name: 'Fictional evening',
        status: 'active',
      },
      {
        id: unpinned,
        offering_id: course,
        curriculum_version_id: null,
        code: 'LEGACY',
        name: 'Fictional unpinned batch',
        status: 'active',
      },
    ]),
  )
  server = await createServer({
    server: { host: '127.0.0.1', port: 0 },
    logLevel: 'error',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(config.API_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(config.ANON_KEY),
    },
  })
  await server.listen()
  const origin = 'http://127.0.0.1:' + server.httpServer.address().port
  browser = await chromium.launch()
  async function workspace(session, width) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      timezoneId: 'America/Los_Angeles',
      storageState: {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              {
                name: 'sb-' + api.hostname.split('.')[0] + '-auth-token',
                value: JSON.stringify(session),
              },
            ],
          },
        ],
      },
    })
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    await page.goto(origin + '/admin/admissions')
    await expect(page.getByRole('heading', { name: 'Student directory' })).toBeVisible()
    return page
  }
  const admitting = await workspace(sessions[0], 1440)
  const submit = admitting.getByRole('button', { name: 'Record admission and manual receipt' })
  await expect(submit).toBeDisabled()
  await expect(admitting.getByText(/new admissions and edits are disabled/i)).toBeVisible()
  gateOpened = true
  sql('update public.admissions_runtime_gate set enabled=true where singleton')
  await admitting.reload()
  await admitting.getByLabel('Student display name').fill(learner)
  await admitting.getByLabel('Dedicated student login email').fill(email)
  await admitting.getByRole('button', { name: 'Check existing identity' }).click()
  await admitting.getByRole('radio', { name: /this is a new person/i }).check()
  await admitting.getByRole('combobox', { name: /^Programme/ }).selectOption(course)
  await admitting.getByRole('combobox', { name: /^Delivery batch/ }).selectOption(morning)
  await admitting.getByLabel('Access start — Asia/Kolkata', { exact: true }).fill(indiaInput(1))
  await admitting.getByLabel('Duration preset').selectOption('12')
  await admitting.getByLabel(/Amount actually received/).fill('2500.50')
  await admitting.getByLabel(/Payment received at/).fill(indiaInput(-1))
  await admitting.getByLabel(/Receipt\/reference/).fill('Fictional cash receipt')
  await admitting.getByLabel('Admission reason').fill('Reviewed fictional enrolment')
  await expect(submit).toBeDisabled()
  await admitting.getByRole('checkbox', { name: /I verified the canonical student/ }).check()
  // Lose the first successful response after the local database has committed the receipt.
  const admissionEndpoint = '**/rest/v1/rpc/admit_student'
  let responseLost = false
  await admitting.route(
    admissionEndpoint,
    async (route) => {
      const response = await route.fetch()
      if (response.ok()) {
        responseLost = true
        await route.abort('failed')
      } else {
        await route.fulfill({ response })
      }
    },
    { times: 1 },
  )
  await submit.click()
  await expect(admitting.getByRole('alert')).toContainText('Admission was not confirmed')
  assert.ok(responseLost, 'The first admission committed before its response was lost.')
  assert.equal(sql('select count(*) from public.admission_receipts'), '1')
  await submit.click()
  await expect(
    admitting.getByRole('status').filter({ hasText: 'Admission recorded' }),
  ).toBeVisible()

  const editing = await workspace(sessions[1], 390)
  const review = () => editing.getByRole('button', { name: 'Review changes' })
  await review().click()
  await editing.getByLabel('Display name', { exact: true }).fill(revised)
  await editing.getByLabel('Reason for change').fill('Updated fictional display name')
  const save = editing.getByRole('button', { name: 'Record reviewed change' })
  await expect(save).toBeDisabled()
  const confirmEdit = editing.getByRole('checkbox', { name: /I reviewed this exact student/ })
  await confirmEdit.check()
  await save.click()
  await expect(editing.getByRole('heading', { name: new RegExp(revised) })).toBeVisible()
  await review().click()
  await editing.getByLabel('Change type').selectOption('batch_transfer')
  await editing.getByLabel('New delivery batch').selectOption(unpinned)
  await editing.getByLabel('Reason for change').fill('Requested fictional transfer')
  await confirmEdit.check()
  await save.click()
  await expect(editing.getByRole('alert')).toBeVisible()
  assert.equal(sql('select count(*) from public.admission_change_history'), '2')
  const windowBefore = sql('select starts_at,expires_at from public.enrollment_access_windows')
  await editing.getByLabel('New delivery batch').selectOption(evening)
  await editing.getByLabel('Reason for change').fill('Moved to fictional evening batch')
  await confirmEdit.check()
  await save.click()
  await expect(editing.getByRole('article').filter({ hasText: revised })).toContainText(
    'Fictional evening',
  )
  assert.equal(
    sql(
      'select c.curriculum_version_id from public.enrollments e join public.cohorts c on c.id=e.cohort_id',
    ),
    curriculum,
  )
  assert.equal(
    sql('select starts_at,expires_at from public.enrollment_access_windows'),
    windowBefore,
  )

  sql('update public.admissions_runtime_gate set enabled=false where singleton')
  gateOpened = false
  const reviewing = await workspace(sessions[2], 390)
  await reviewing.getByLabel(/Search name, Member ID/).fill(revised)
  const record = reviewing.getByRole('article').filter({ hasText: revised })
  await expect(record.getByRole('button', { name: 'Review changes' })).toBeDisabled()
  const disclose = record.getByRole('button', { name: 'View history' })
  await disclose.focus()
  await reviewing.keyboard.press('Enter')
  const history = reviewing.getByRole('region', { name: 'Enrolment history' })
  await expect(history.getByText('Admission recorded', { exact: true })).toBeVisible()
  await expect(history.getByText('Display name updated', { exact: true })).toBeVisible()
  await expect(history.getByText('Batch transferred', { exact: true })).toBeVisible()
  await expect(history.getByText('Fictional morning → Fictional evening')).toBeVisible()
  await expect(history.getByText(/2,500\.50.*Cash/)).toBeVisible()
  await expect(history.getByText(/Confirmed by Fictional admitting admin/)).toBeVisible()
  await expect(history.getByText(/Fictional editing admin/)).toHaveCount(2)
  assert.equal(sql('select count(*) from public.admission_receipts'), '1')
  assert.equal(sql('select count(*) from public.admission_change_history'), '3')
  for (const page of [admitting, editing, reviewing]) {
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    assert.deepEqual(
      result.violations.map((v) => v.id),
      [],
    )
    assert.ok(
      await page
        .locator('html')
        .evaluate((html) => html.scrollWidth <= html.ownerDocument.defaultView.innerWidth),
    )
  }
  console.log(
    'Passed on fictional local data: three authenticated administrators, admission and receipt, name edit, batch transfer, write-gate closure, attributed evidence, keyboard, axe and viewport checks.',
  )
} finally {
  try {
    if (gateOpened) sql('update public.admissions_runtime_gate set enabled=false where singleton')
  } finally {
    try {
      await browser?.close()
    } finally {
      await server?.close()
    }
  }
}
