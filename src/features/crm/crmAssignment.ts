import { getSupabaseClient } from '../auth/supabaseClient'
import type { CrmContactRelationship, CrmEnquiryStage } from './crm'

export type CrmAssignmentQueue = 'needs_reassignment' | 'unassigned'

export type CrmAssignmentItem = {
  contactRelationship: CrmContactRelationship
  createdAt: string
  currentOwnerName: string | null
  currentOwnerPersonId: string | null
  followUpDueAt: string | null
  id: string
  interestSummary: string
  ownerIsEligible: boolean
  source: string
  stage: CrmEnquiryStage
  subjectName: string
  targetIntake: string | null
}

export type CrmEligibleOwner = {
  displayName: string
  personId: string
}

type Row = Record<string, unknown>

const unavailableMessage = 'CRM assignment could not be loaded. Check your access and try again.'
const stages: CrmEnquiryStage[] = [
  'new',
  'contact_in_progress',
  'engaged',
  'qualified',
  'enrolment_review_requested',
  'converted',
  'closed',
]

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function requiredString(value: unknown) {
  if (typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function nullableString(value: unknown) {
  if (value !== null && typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function parseAssignmentItem(value: unknown): CrmAssignmentItem {
  if (!value || typeof value !== 'object') throw new Error(unavailableMessage)
  const row = value as Row
  if (
    !stages.includes(row.stage as CrmEnquiryStage) ||
    !['self', 'guardian', 'other'].includes(String(row.contact_relationship)) ||
    typeof row.owner_is_eligible !== 'boolean'
  ) {
    throw new Error(unavailableMessage)
  }
  return {
    id: requiredString(row.id),
    subjectName: requiredString(row.subject_name),
    contactRelationship: row.contact_relationship as CrmContactRelationship,
    source: requiredString(row.source),
    interestSummary: requiredString(row.interest_summary),
    targetIntake: nullableString(row.target_intake),
    stage: row.stage as CrmEnquiryStage,
    currentOwnerPersonId: nullableString(row.current_owner_person_id),
    currentOwnerName: nullableString(row.current_owner_name),
    ownerIsEligible: row.owner_is_eligible,
    followUpDueAt: nullableString(row.follow_up_due_at),
    createdAt: requiredString(row.created_at),
  }
}

function parseOwner(value: unknown): CrmEligibleOwner {
  if (!value || typeof value !== 'object') throw new Error(unavailableMessage)
  const row = value as Row
  return {
    personId: requiredString(row.person_id),
    displayName: requiredString(row.display_name),
  }
}

export async function listCrmAssignmentQueue(
  queue: CrmAssignmentQueue,
  limit = 25,
  search = '',
): Promise<CrmAssignmentItem[]> {
  const result = await clientOrThrow().rpc('list_crm_assignment_queue', {
    p_limit: limit,
    p_search: search.trim() || null,
    p_queue: queue,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseAssignmentItem)
}

export async function listCrmEligibleOwners(limit = 50, search = '') {
  const result = await clientOrThrow().rpc('list_crm_eligible_owners', {
    p_limit: limit,
    p_search: search.trim() || null,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseOwner)
}

export async function assignCrmEnquiry(input: {
  enquiryId: string
  expectedOwnerPersonId: string | null
  ownerPersonId: string
  reason: string
}) {
  const result = await clientOrThrow().rpc('assign_crm_enquiry', {
    p_enquiry_id: input.enquiryId,
    p_owner_person_id: input.ownerPersonId,
    p_reason: input.reason.trim(),
    p_expected_owner_person_id: input.expectedOwnerPersonId,
    p_expect_unassigned: input.expectedOwnerPersonId === null,
  })
  if (result.error?.code === '40001') {
    throw new Error('This enquiry was assigned by someone else. Refresh and review the new owner.')
  }
  if (result.error) {
    throw new Error('The enquiry could not be assigned. Refresh the queue and try again.')
  }
}
