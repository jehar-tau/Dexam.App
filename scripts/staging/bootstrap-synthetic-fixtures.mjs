import { createClient } from '@supabase/supabase-js'

import {
  academicFixture,
  accounts,
  capabilityGrantId,
  endedTimestamp,
  fixedTimestamp,
  isAllowedSupabaseUrl,
  roleAssignmentId,
  suspendedTimestamp,
} from './synthetic-fixtures.mjs'

const supabaseUrl = process.env.STAGING_SUPABASE_URL
const serviceRoleKey = process.env.STAGING_SERVICE_ROLE_KEY
const password = process.env.STAGING_SYNTHETIC_PASSWORD

if (!isAllowedSupabaseUrl(supabaseUrl) || !serviceRoleKey || !password) {
  throw new Error('Staging URL, service-role key, and synthetic password are required.')
}
if (password.length < 20 || password.length > 128) {
  throw new Error('The synthetic staging password must contain between 20 and 128 characters.')
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function requireSuccess(label, operation) {
  const result = await operation
  if (result.error) throw new Error(`${label} failed (${result.error.code ?? 'unknown'}).`)
  return result.data
}

async function upsertRows(table, rows) {
  await requireSuccess(`Upserting ${table}`, admin.from(table).upsert(rows, { onConflict: 'id' }))
}

async function existingAuthUsers() {
  const users = []
  for (let page = 1; page <= 10; page += 1) {
    const data = await requireSuccess(
      'Listing synthetic Auth users',
      admin.auth.admin.listUsers({ page, perPage: 1000 }),
    )
    users.push(...data.users)
    if (data.users.length < 1000) return users
  }
  throw new Error('Auth user lookup exceeded the bounded page limit.')
}

async function ensureAuthUsers() {
  const existingByEmail = new Map(
    (await existingAuthUsers())
      .filter((user) => typeof user.email === 'string')
      .map((user) => [user.email.toLowerCase(), user]),
  )
  const authUsers = new Map()

  for (const account of accounts) {
    const existing = existingByEmail.get(account.email.toLowerCase())
    if (existing) {
      const updated = await requireSuccess(
        `Rotating ${account.key} Auth credential`,
        admin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
          user_metadata: { account_kind: account.membershipKind, fixture_key: account.key },
        }),
      )
      authUsers.set(account.key, updated.user)
      continue
    }

    const created = await requireSuccess(
      `Creating ${account.key} Auth user`,
      admin.auth.admin.createUser({
        email: account.email,
        password,
        email_confirm: true,
        user_metadata: { account_kind: account.membershipKind, fixture_key: account.key },
      }),
    )
    authUsers.set(account.key, created.user)
  }

  return authUsers
}

async function bootstrap() {
  const authUsers = await ensureAuthUsers()
  const elevatedAdmin = accounts.find(({ key }) => key === 'elevated_admin')
  const student = accounts.find(({ key }) => key === 'student')
  if (!elevatedAdmin || !student) throw new Error('Required synthetic fixture accounts are absent.')

  await upsertRows(
    'people',
    accounts.map((account) => ({
      id: account.personId,
      member_id: account.memberId ?? null,
      display_name: account.label,
      status: account.personStatus,
      suspended_at: account.personStatus === 'suspended' ? suspendedTimestamp : null,
      created_at: fixedTimestamp,
      updated_at: fixedTimestamp,
    })),
  )

  await upsertRows(
    'auth_identities',
    accounts.map((account) => {
      const authUser = authUsers.get(account.key)
      if (!authUser) throw new Error(`Auth user ${account.key} was not prepared.`)
      return {
        id: account.identityId,
        person_id: account.personId,
        auth_user_id: authUser.id,
        kind: account.membershipKind === 'student' ? 'member_id' : 'employee_email',
        created_at: fixedTimestamp,
      }
    }),
  )

  await upsertRows(
    'memberships',
    accounts.map((account) => ({
      id: account.membershipId,
      person_id: account.personId,
      kind: account.membershipKind,
      status: account.membershipStatus,
      starts_at: fixedTimestamp,
      ends_at: account.membershipStatus === 'ended' ? endedTimestamp : null,
      created_at: fixedTimestamp,
      updated_at: fixedTimestamp,
    })),
  )

  const roleAssignments = accounts
    .filter((account) => account.role)
    .map((account, index) => ({
      id: roleAssignmentId(index),
      person_id: account.personId,
      role_key: account.role,
      scope_type: 'global',
      scope_id: null,
      starts_at: fixedTimestamp,
      ends_at: account.membershipStatus === 'ended' ? endedTimestamp : null,
      revoked_at: account.personStatus === 'suspended' ? suspendedTimestamp : null,
      granted_by_person_id: elevatedAdmin.personId,
      grant_reason: 'Deterministic fictional staging acceptance fixture',
      created_at: fixedTimestamp,
    }))
  await upsertRows('role_assignments', roleAssignments)

  let capabilityIndex = 0
  const capabilityGrants = accounts.flatMap((account) =>
    account.capabilities.map((capability) => {
      const row = {
        id: capabilityGrantId(capabilityIndex),
        person_id: account.personId,
        capability_key: capability,
        required_role_key: account.role,
        scope_type: 'global',
        scope_id: null,
        starts_at: fixedTimestamp,
        ends_at: null,
        revoked_at: null,
        granted_by_person_id: elevatedAdmin.personId,
        grant_reason: 'Deterministic fictional staging acceptance fixture',
        created_at: fixedTimestamp,
      }
      capabilityIndex += 1
      return row
    }),
  )
  await upsertRows('capability_grants', capabilityGrants)

  await upsertRows('offerings', [
    {
      id: academicFixture.offeringId,
      code: academicFixture.offeringCode,
      title: 'Fictional Design Foundation',
      offering_type: 'course',
      status: 'active',
      available_from: fixedTimestamp,
      available_until: null,
      created_at: fixedTimestamp,
      updated_at: fixedTimestamp,
    },
  ])
  await upsertRows('cohorts', [
    {
      id: academicFixture.cohortId,
      offering_id: academicFixture.offeringId,
      code: academicFixture.cohortCode,
      name: 'Fictional Staging Cohort',
      status: 'active',
      starts_at: fixedTimestamp,
      ends_at: null,
      curriculum_version_id: null,
      created_at: fixedTimestamp,
      updated_at: fixedTimestamp,
    },
  ])
  await upsertRows('enrollments', [
    {
      id: academicFixture.enrollmentId,
      person_id: student.personId,
      offering_id: academicFixture.offeringId,
      cohort_id: academicFixture.cohortId,
      curriculum_version_id: null,
      status: 'active',
      source_type: 'staging_fixture',
      source_reference: 'F014 synthetic acceptance',
      requested_by_person_id: elevatedAdmin.personId,
      approved_by_person_id: elevatedAdmin.personId,
      requested_at: fixedTimestamp,
      approved_at: fixedTimestamp,
      activated_at: fixedTimestamp,
      ended_at: null,
      created_at: fixedTimestamp,
      updated_at: fixedTimestamp,
    },
  ])

  const scheduler = accounts.find((account) => account.key === 'enrolment_operator')
  if (!scheduler) throw new Error('Fictional scheduler is absent.')
  await upsertRows('role_assignments', [
    {
      id: '10000000-0000-4000-8000-000000001001',
      person_id: scheduler.personId,
      role_key: 'ordinary_admin',
      scope_type: 'offering',
      scope_id: academicFixture.offeringId,
      starts_at: fixedTimestamp,
      ends_at: null,
      revoked_at: null,
      granted_by_person_id: elevatedAdmin.personId,
      grant_reason: 'D034 fictional offering-scoped scheduler',
    },
  ])
  await upsertRows('capability_grants', [
    {
      id: '10000000-0000-4000-8000-000000001002',
      person_id: scheduler.personId,
      capability_key: 'class.schedule',
      required_role_key: 'ordinary_admin',
      scope_type: 'offering',
      scope_id: academicFixture.offeringId,
      starts_at: fixedTimestamp,
      ends_at: null,
      revoked_at: null,
      granted_by_person_id: elevatedAdmin.personId,
      grant_reason: 'D034 fictional offering-scoped scheduler',
    },
  ])
  const people = await requireSuccess(
    'Verifying synthetic people',
    admin
      .from('people')
      .select('id')
      .in(
        'id',
        accounts.map(({ personId }) => personId),
      ),
  )
  if (people.length !== accounts.length) {
    throw new Error('Synthetic fixture verification returned an incomplete account set.')
  }

  console.log(`Bootstrapped ${accounts.length} fictional staging accounts and one enrolment.`)
}

await bootstrap()
