import { getSupabaseClient } from '../auth/supabaseClient'

export type CrmContactKind = 'email' | 'phone'
export type CrmContactRelationship = 'guardian' | 'other' | 'self'
export type CrmActivityOutcome =
  'connected' | 'contact_attempted' | 'counselling_arranged' | 'no_response' | 'note_added'
export type CrmEnquiryStage =
  | 'closed'
  | 'contact_in_progress'
  | 'converted'
  | 'engaged'
  | 'enrolment_review_requested'
  | 'new'
  | 'qualified'
export type CrmQueueView = 'active' | 'dead_archive' | 'recently_dead'

export type CrmEnquiry = {
  archiveAt: string | null
  closedAt: string | null
  closedReason: string | null
  contactKind: CrmContactKind
  contactName: string
  contactRelationship: CrmContactRelationship
  contactValue: string
  createdAt: string
  followUpDueAt: string | null
  followUpId: string | null
  id: string
  interestSummary: string
  lastActivityAt: string | null
  lastActivityOutcome: CrmActivityOutcome | null
  ownerName: string
  possibleIdentityMatch: boolean
  reviewRequestedAt: string | null
  source: string
  stage: CrmEnquiryStage
  subjectName: string
  targetIntake: string | null
}

export type CreateCrmEnquiryInput = {
  contactKind: CrmContactKind
  contactName: string
  contactRelationship: CrmContactRelationship
  contactValue: string
  interestSummary: string
  requestKey: string
  source: string
  subjectName: string
  targetIntake: string
}

type Row = Record<string, unknown>

const unavailableMessage = 'The CRM workspace could not be loaded. Check your access and try again.'
const stages: CrmEnquiryStage[] = [
  'new',
  'contact_in_progress',
  'engaged',
  'qualified',
  'enrolment_review_requested',
  'converted',
  'closed',
]
const outcomes: CrmActivityOutcome[] = [
  'contact_attempted',
  'connected',
  'counselling_arranged',
  'no_response',
  'note_added',
]

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function string(value: unknown) {
  if (typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function nullableString(value: unknown) {
  if (value !== null && typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function parseCrmEnquiry(value: unknown): CrmEnquiry {
  if (!value || typeof value !== 'object') throw new Error(unavailableMessage)
  const row = value as Row
  if (
    !stages.includes(row.stage as CrmEnquiryStage) ||
    (row.contact_kind !== 'email' && row.contact_kind !== 'phone') ||
    !['self', 'guardian', 'other'].includes(String(row.contact_relationship)) ||
    (row.last_activity_outcome !== null &&
      !outcomes.includes(row.last_activity_outcome as CrmActivityOutcome)) ||
    typeof row.possible_identity_match !== 'boolean'
  ) {
    throw new Error(unavailableMessage)
  }
  return {
    id: string(row.id),
    archiveAt: nullableString(row.archive_at),
    closedAt: nullableString(row.closed_at),
    closedReason: nullableString(row.closed_reason),
    subjectName: string(row.subject_name),
    contactName: string(row.contact_name),
    contactRelationship: row.contact_relationship as CrmContactRelationship,
    contactKind: row.contact_kind,
    contactValue: string(row.contact_value),
    source: string(row.source),
    interestSummary: string(row.interest_summary),
    targetIntake: nullableString(row.target_intake),
    stage: row.stage as CrmEnquiryStage,
    ownerName: string(row.owner_name),
    followUpId: nullableString(row.follow_up_id),
    followUpDueAt: nullableString(row.follow_up_due_at),
    lastActivityAt: nullableString(row.last_activity_at),
    lastActivityOutcome: row.last_activity_outcome as CrmActivityOutcome | null,
    possibleIdentityMatch: row.possible_identity_match,
    reviewRequestedAt: nullableString(row.review_requested_at),
    createdAt: string(row.created_at),
  }
}

export async function listCrmEnquiries(
  limit = 25,
  search = '',
  queue: CrmQueueView = 'active',
): Promise<CrmEnquiry[]> {
  const result = await clientOrThrow().rpc('list_crm_enquiries', {
    p_limit: limit,
    p_search: search.trim() || null,
    p_queue: queue,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseCrmEnquiry)
}

export async function createCrmEnquiry(input: CreateCrmEnquiryInput) {
  const result = await clientOrThrow().rpc('create_crm_enquiry', {
    p_subject_name: input.subjectName,
    p_contact_name: input.contactName,
    p_contact_relationship: input.contactRelationship,
    p_contact_kind: input.contactKind,
    p_contact_value: input.contactValue,
    p_interest_summary: input.interestSummary,
    p_target_intake: input.targetIntake,
    p_source: input.source,
    p_request_key: input.requestKey,
  })
  const first = Array.isArray(result.data) ? (result.data[0] as unknown) : null
  if (result.error || !first || typeof first !== 'object') {
    throw new Error('The enquiry could not be created. Check the details and try again.')
  }
  const row = first as Row
  if (typeof row.enquiry_id !== 'string') {
    throw new Error('The enquiry could not be created. Check the details and try again.')
  }
  return {
    enquiryId: row.enquiry_id,
    possibleIdentityMatch: Boolean(row.possible_identity_match),
  }
}

export async function recordCrmActivity(
  enquiryId: string,
  outcome: CrmActivityOutcome,
  note: string,
) {
  const result = await clientOrThrow().rpc('record_crm_activity', {
    p_enquiry_id: enquiryId,
    p_outcome: outcome,
    p_note: note.trim() || null,
  })
  if (result.error) throw new Error('The activity could not be saved.')
}

export async function scheduleCrmFollowUp(enquiryId: string, dueAt: string) {
  const result = await clientOrThrow().rpc('schedule_crm_follow_up', {
    p_enquiry_id: enquiryId,
    p_due_at: dueAt,
  })
  if (result.error) throw new Error('The follow-up could not be scheduled.')
}

export async function updateCrmEnquiryStage(
  enquiryId: string,
  stage: CrmEnquiryStage,
  reasonCode: string,
  note = '',
) {
  const result = await clientOrThrow().rpc('update_crm_enquiry_stage', {
    p_enquiry_id: enquiryId,
    p_to_stage: stage,
    p_reason_code: reasonCode,
    p_note: note.trim() || null,
  })
  if (result.error) throw new Error('The enquiry stage could not be updated.')
}

export async function requestCrmEnrolmentReview(enquiryId: string, note: string) {
  const result = await clientOrThrow().rpc('request_crm_enrolment_review', {
    p_enquiry_id: enquiryId,
    p_request_note: note,
  })
  if (result.error) throw new Error('The enrolment review request could not be submitted.')
}
