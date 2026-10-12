import { accounts, academicFixture, isAllowedSupabaseUrl } from './synthetic-fixtures.mjs'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/
const memberIdPattern = /^DXM-[2-9A-HJKMNP-Z]{12}$/
const allowedRoles = new Set(['teacher', 'sales', 'ordinary_admin', 'elevated_admin'])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const ids = []
const emails = []

assert(accounts.length === 9, 'The reviewed synthetic account set must contain nine accounts')

for (const account of accounts) {
  assert(account.label.startsWith('Fictional '), `${account.key} must be clearly fictional`)
  assert(account.email.endsWith('.invalid'), `${account.key} must use the reserved .invalid TLD`)
  assert(
    uuidPattern.test(account.personId),
    `${account.key} person ID is not a deterministic v4 UUID`,
  )
  assert(
    uuidPattern.test(account.identityId),
    `${account.key} identity ID is not a deterministic v4 UUID`,
  )
  assert(
    uuidPattern.test(account.membershipId),
    `${account.key} membership ID is not a deterministic v4 UUID`,
  )
  assert(
    account.membershipKind === 'student' || account.membershipKind === 'employee',
    `${account.key} has an unsupported membership kind`,
  )
  assert(
    account.membershipKind === 'employee' || memberIdPattern.test(account.memberId ?? ''),
    `${account.key} needs a valid fictional Member ID`,
  )
  assert(
    account.role === null || allowedRoles.has(account.role),
    `${account.key} has an unsupported role`,
  )
  assert(
    account.membershipKind === 'employee' || account.role === null,
    `${account.key} cannot receive an employee role`,
  )

  ids.push(account.personId, account.identityId, account.membershipId)
  emails.push(account.email)
}

ids.push(academicFixture.offeringId, academicFixture.cohortId, academicFixture.enrollmentId)
assert(new Set(ids).size === ids.length, 'Synthetic fixture UUIDs must be unique')
assert(new Set(emails).size === emails.length, 'Synthetic fixture emails must be unique')
assert(
  accounts.some(({ key }) => key === 'revoked_employee'),
  'A revoked employee fixture is required',
)
assert(
  accounts.some(({ key }) => key === 'inactive_employee'),
  'An inactive employee fixture is required',
)
assert(isAllowedSupabaseUrl('https://example.supabase.co'), 'Hosted Supabase URLs must be allowed')
assert(isAllowedSupabaseUrl('http://127.0.0.1:54321'), 'Local Supabase URLs must be allowed')
assert(!isAllowedSupabaseUrl('http://example.com'), 'Remote plaintext Supabase URLs must be denied')

console.log(`Synthetic fixture manifest is safe and deterministic (${accounts.length} accounts).`)
