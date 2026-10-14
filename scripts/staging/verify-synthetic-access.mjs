import { createClient } from '@supabase/supabase-js'

import { accounts, academicFixture, isAllowedSupabaseUrl } from './synthetic-fixtures.mjs'

const supabaseUrl = process.env.STAGING_SUPABASE_URL
const publicKey = process.env.STAGING_PUBLIC_KEY
const password = process.env.STAGING_SYNTHETIC_PASSWORD

if (!isAllowedSupabaseUrl(supabaseUrl) || !publicKey || !password) {
  throw new Error('Staging URL, browser key, and synthetic password are required.')
}

function publicClient() {
  return createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, received ${actual}`)
}

async function verifyRpc(client, name, parameters, expected, message) {
  const result = await client.rpc(name, parameters)
  if (result.error) throw new Error(`${message} failed (${result.error.code ?? 'unknown'}).`)
  assertEqual(result.data, expected, message)
}

async function verifyStudent(account) {
  const response = await fetch(`${supabaseUrl}/functions/v1/student-sign-in`, {
    method: 'POST',
    headers: { apikey: publicKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ memberId: account.memberId, password }),
  })
  const body = await response.json().catch(() => ({}))
  if (
    !response.ok ||
    typeof body.accessToken !== 'string' ||
    typeof body.refreshToken !== 'string'
  ) {
    throw new Error('Fictional student sign-in failed closed unexpectedly.')
  }

  const client = publicClient()
  const session = await client.auth.setSession({
    access_token: body.accessToken,
    refresh_token: body.refreshToken,
  })
  if (session.error) throw new Error('Fictional student session could not be established.')
  await verifyRpc(
    client,
    'current_person_has_active_student_membership',
    {},
    true,
    'Student membership boundary',
  )
  await client.auth.signOut({ scope: 'local' })
  console.log('Verified fictional Student boundary.')
}

const capabilityChecks = {
  teacher: [
    ['feedback.review', true],
    ['lead.manage_assigned', false],
  ],
  sales: [
    ['lead.manage_assigned', true],
    ['lead.assign', false],
  ],
  crm_coordinator: [
    ['lead.assign', true],
    ['lead.manage_assigned', false],
  ],
  enrolment_operator: [
    ['enrollment.operate', true],
    ['lead.manage_assigned', false],
  ],
  privacy_operator: [
    ['privacy.manage', false],
    ['lead.manage_assigned', false],
  ],
  elevated_admin: [
    ['enrollment.operate', true],
    ['employee.suspend', false],
  ],
  revoked_employee: [['lead.manage_assigned', false]],
  inactive_employee: [['enrollment.request_review', false]],
}

async function verifyEmployee(account) {
  const client = publicClient()
  const signIn = await client.auth.signInWithPassword({ email: account.email, password })
  if (signIn.error || !signIn.data.session) {
    throw new Error(`${account.label} Auth sign-in failed unexpectedly.`)
  }

  const expectedActive = account.personStatus === 'active' && account.membershipStatus === 'active'
  await verifyRpc(
    client,
    'current_person_has_active_employee_membership',
    {},
    expectedActive,
    `${account.label} employee boundary`,
  )
  for (const [capability, expected] of capabilityChecks[account.key]) {
    await verifyRpc(
      client,
      'current_person_has_capability',
      { p_capability_key: capability },
      expected,
      `${account.label} ${capability} boundary`,
    )
  }
  await verifyRpc(
    client,
    'current_person_can_schedule_classes',
    { p_offering_id: academicFixture.offeringId },
    account.key === 'enrolment_operator',
    `${account.label} explicit scheduling boundary`,
  )
  await client.auth.signOut({ scope: 'local' })
  console.log(`Verified ${account.label} boundary.`)
}

for (const account of accounts) {
  if (account.membershipKind === 'student') await verifyStudent(account)
  else await verifyEmployee(account)
}

console.log('All hosted synthetic account and current-state authorization checks passed.')
