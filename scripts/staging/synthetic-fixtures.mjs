export const fixedTimestamp = '2026-01-15T09:00:00.000Z'
export const suspendedTimestamp = '2026-02-01T09:00:00.000Z'
export const endedTimestamp = '2026-02-15T09:00:00.000Z'

export const accounts = [
  {
    key: 'student',
    label: 'Fictional Student',
    email: 'dxm-stg22student@members.dexam.invalid',
    memberId: 'DXM-STG22STUDENT',
    personId: '10000000-0000-4000-8000-000000000001',
    identityId: '10000000-0000-4000-8000-000000000101',
    membershipId: '10000000-0000-4000-8000-000000000201',
    membershipKind: 'student',
    personStatus: 'active',
    membershipStatus: 'active',
    role: null,
    capabilities: [],
  },
  {
    key: 'teacher',
    label: 'Fictional Teacher',
    email: 'teacher.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000002',
    identityId: '10000000-0000-4000-8000-000000000102',
    membershipId: '10000000-0000-4000-8000-000000000202',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'active',
    role: 'teacher',
    capabilities: [
      'content.manage_drafts',
      'assignment.distribute',
      'feedback.review',
      'feedback.ai_assist',
    ],
  },
  {
    key: 'sales',
    label: 'Fictional Sales',
    email: 'sales.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000003',
    identityId: '10000000-0000-4000-8000-000000000103',
    membershipId: '10000000-0000-4000-8000-000000000203',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'active',
    role: 'sales',
    capabilities: [],
  },
  {
    key: 'crm_coordinator',
    label: 'Fictional CRM Coordinator',
    email: 'crm-coordinator.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000004',
    identityId: '10000000-0000-4000-8000-000000000104',
    membershipId: '10000000-0000-4000-8000-000000000204',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'active',
    role: 'ordinary_admin',
    capabilities: ['lead.assign'],
  },
  {
    key: 'enrolment_operator',
    label: 'Fictional Enrolment Operator',
    email: 'enrolment-operator.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000005',
    identityId: '10000000-0000-4000-8000-000000000105',
    membershipId: '10000000-0000-4000-8000-000000000205',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'active',
    role: 'ordinary_admin',
    capabilities: ['enrollment.operate'],
  },
  {
    key: 'privacy_operator',
    label: 'Fictional Privacy Operator',
    email: 'privacy-operator.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000006',
    identityId: '10000000-0000-4000-8000-000000000106',
    membershipId: '10000000-0000-4000-8000-000000000206',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'active',
    role: 'ordinary_admin',
    capabilities: ['privacy.manage', 'privacy.erase_approve'],
  },
  {
    key: 'elevated_admin',
    label: 'Fictional Elevated Admin',
    email: 'elevated-admin.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000007',
    identityId: '10000000-0000-4000-8000-000000000107',
    membershipId: '10000000-0000-4000-8000-000000000207',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'active',
    role: 'elevated_admin',
    capabilities: [],
  },
  {
    key: 'revoked_employee',
    label: 'Fictional Revoked Employee',
    email: 'revoked-employee.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000008',
    identityId: '10000000-0000-4000-8000-000000000108',
    membershipId: '10000000-0000-4000-8000-000000000208',
    membershipKind: 'employee',
    personStatus: 'suspended',
    membershipStatus: 'suspended',
    role: 'sales',
    capabilities: [],
  },
  {
    key: 'inactive_employee',
    label: 'Fictional Inactive Employee',
    email: 'inactive-employee.staging@dexam.invalid',
    personId: '10000000-0000-4000-8000-000000000009',
    identityId: '10000000-0000-4000-8000-000000000109',
    membershipId: '10000000-0000-4000-8000-000000000209',
    membershipKind: 'employee',
    personStatus: 'active',
    membershipStatus: 'ended',
    role: 'ordinary_admin',
    capabilities: [],
  },
]

export const academicFixture = {
  offeringId: '20000000-0000-4000-8000-000000000001',
  cohortId: '20000000-0000-4000-8000-000000000002',
  enrollmentId: '20000000-0000-4000-8000-000000000003',
  offeringCode: 'STAGING_FOUNDATION',
  cohortCode: 'STAGING_2026',
}

export function isAllowedSupabaseUrl(value) {
  if (typeof value !== 'string') return false
  const parsed = URL.parse(value)
  if (!parsed) return false
  return (
    parsed.protocol === 'https:' ||
    (parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname))
  )
}

export function roleAssignmentId(index) {
  return `10000000-0000-4000-8000-${String(301 + index).padStart(12, '0')}`
}

export function capabilityGrantId(index) {
  return `10000000-0000-4000-8000-${String(401 + index).padStart(12, '0')}`
}
