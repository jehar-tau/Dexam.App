import { getSupabaseClient } from '../auth/supabaseClient'

export type HandoffContactKind = 'email' | 'phone'
export type StudentResolutionMode = 'existing' | 'new'
export type IdentityCandidateDecision = 'distinct_people' | 'resolved'

export type EnrolmentHandoff = {
  contactKind: HandoffContactKind
  contactName: string
  contactRelationship: 'guardian' | 'other' | 'self'
  contactValue: string
  enquiryId: string
  interestSummary: string
  pendingIdentityMatches: number
  requestId: string
  requestNote: string
  requestedAt: string
  salesOwnerName: string | null
  subjectName: string
  targetIntake: string | null
}

export type EnrolmentIdentityCandidate = {
  accountClaimed: boolean
  candidateId: string
  contactValue: string | null
  evidenceKind: HandoffContactKind
  existingDisplayName: string
  existingMemberId: string | null
  existingPersonId: string
  newPersonName: string
}

export type EnrolmentStudent = {
  accountClaimed: boolean
  displayName: string
  memberId: string
  openEnrollmentCount: number
  openOfferingTitles: string[]
  personId: string
}

export type EnrolmentChoice = {
  cohortId: string | null
  cohortName: string | null
  offeringId: string
  offeringTitle: string
}

export type EnrolmentApproval = {
  activationRequired: boolean
  enrollmentId: string
  enrollmentStatus: 'active' | 'approved'
  memberId: string
  personId: string
}

export type ApproveEnrolmentHandoffInput = {
  candidateDecisions: Array<{ candidateId: string; decision: IdentityCandidateDecision }>
  cohortId: string | null
  existingPersonId: string | null
  offeringId: string
  reason: string
  requestId: string
  resolutionMode: StudentResolutionMode
}

type Row = Record<string, unknown>

const unavailableMessage =
  'The enrolment handoff workspace could not be loaded. Check your access and try again.'

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function requiredString(value: unknown) {
  if (typeof value !== 'string' || !value) throw new Error(unavailableMessage)
  return value
}

function nullableString(value: unknown) {
  if (value !== null && typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function boolean(value: unknown) {
  if (typeof value !== 'boolean') throw new Error(unavailableMessage)
  return value
}

function integer(value: unknown) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(unavailableMessage)
  }
  return value
}

function row(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(unavailableMessage)
  return value as Row
}

function parseHandoff(value: unknown): EnrolmentHandoff {
  const item = row(value)
  if (!['email', 'phone'].includes(String(item.contact_kind))) throw new Error(unavailableMessage)
  if (!['guardian', 'other', 'self'].includes(String(item.contact_relationship))) {
    throw new Error(unavailableMessage)
  }
  return {
    requestId: requiredString(item.request_id),
    enquiryId: requiredString(item.enquiry_id),
    subjectName: requiredString(item.subject_name),
    contactName: requiredString(item.contact_name),
    contactRelationship: item.contact_relationship as EnrolmentHandoff['contactRelationship'],
    contactKind: item.contact_kind as HandoffContactKind,
    contactValue: requiredString(item.contact_value),
    interestSummary: requiredString(item.interest_summary),
    targetIntake: nullableString(item.target_intake),
    requestNote: requiredString(item.request_note),
    salesOwnerName: nullableString(item.sales_owner_name),
    pendingIdentityMatches: integer(item.pending_identity_matches),
    requestedAt: requiredString(item.requested_at),
  }
}

function parseCandidate(value: unknown): EnrolmentIdentityCandidate {
  const item = row(value)
  if (!['email', 'phone'].includes(String(item.evidence_kind))) throw new Error(unavailableMessage)
  return {
    candidateId: requiredString(item.candidate_id),
    newPersonName: requiredString(item.new_person_name),
    existingPersonId: requiredString(item.existing_person_id),
    existingDisplayName: requiredString(item.existing_display_name),
    existingMemberId: nullableString(item.existing_member_id),
    evidenceKind: item.evidence_kind as HandoffContactKind,
    contactValue: nullableString(item.contact_value),
    accountClaimed: boolean(item.account_claimed),
  }
}

function parseStudent(value: unknown): EnrolmentStudent {
  const item = row(value)
  if (
    !Array.isArray(item.open_offering_titles) ||
    item.open_offering_titles.some((v) => typeof v !== 'string')
  ) {
    throw new Error(unavailableMessage)
  }
  return {
    personId: requiredString(item.person_id),
    memberId: requiredString(item.member_id),
    displayName: requiredString(item.display_name),
    accountClaimed: boolean(item.account_claimed),
    openEnrollmentCount: integer(item.open_enrollment_count),
    openOfferingTitles: item.open_offering_titles.filter(
      (offeringTitle): offeringTitle is string => typeof offeringTitle === 'string',
    ),
  }
}

function parseChoice(value: unknown): EnrolmentChoice {
  const item = row(value)
  return {
    offeringId: requiredString(item.offering_id),
    offeringTitle: requiredString(item.offering_title),
    cohortId: nullableString(item.cohort_id),
    cohortName: nullableString(item.cohort_name),
  }
}

function parseApproval(value: unknown): EnrolmentApproval {
  const item = row(value)
  if (!['active', 'approved'].includes(String(item.enrollment_status))) {
    throw new Error(unavailableMessage)
  }
  return {
    personId: requiredString(item.person_id),
    memberId: requiredString(item.member_id),
    enrollmentId: requiredString(item.enrollment_id),
    enrollmentStatus: item.enrollment_status as EnrolmentApproval['enrollmentStatus'],
    activationRequired: boolean(item.activation_required),
  }
}

function mutationMessage(error: unknown) {
  const value = error as { code?: unknown } | null
  if (value?.code === '40001') return 'This handoff changed. Refresh the queue before continuing.'
  if (value?.code === '23505')
    return 'This student already has an open enrolment for that course and cohort.'
  return 'The handoff could not be saved. Nothing was changed; check the details and try again.'
}

export async function listEnrolmentHandoffs(limit = 25, search = '') {
  const result = await clientOrThrow().rpc('list_enrolment_handoffs', {
    p_limit: limit,
    p_search: search.trim() || null,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseHandoff)
}

export async function listEnrolmentIdentityCandidates(requestId: string) {
  const result = await clientOrThrow().rpc('list_enrolment_identity_candidates', {
    p_request_id: requestId,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseCandidate)
}

export async function searchEnrolmentStudents(search: string, limit = 20) {
  const result = await clientOrThrow().rpc('search_enrolment_students', {
    p_limit: limit,
    p_search: search.trim(),
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseStudent)
}

export async function listEnrolmentHandoffChoices() {
  const result = await clientOrThrow().rpc('list_enrolment_handoff_choices')
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseChoice)
}

export async function returnEnrolmentHandoff(requestId: string, reason: string) {
  const result = await clientOrThrow().rpc('return_crm_enrolment_review', {
    p_request_id: requestId,
    p_reason: reason.trim(),
  })
  if (result.error) throw new Error(mutationMessage(result.error))
}

export async function approveEnrolmentHandoff(input: ApproveEnrolmentHandoffInput) {
  const result = await clientOrThrow().rpc('approve_crm_enrolment_review', {
    p_request_id: input.requestId,
    p_resolution_mode: input.resolutionMode,
    p_existing_person_id: input.existingPersonId,
    p_offering_id: input.offeringId,
    p_cohort_id: input.cohortId,
    p_reason: input.reason.trim(),
    p_candidate_ids: input.candidateDecisions.map((item) => item.candidateId),
    p_candidate_decisions: input.candidateDecisions.map((item) => item.decision),
  })
  const first: unknown = Array.isArray(result.data) ? result.data[0] : null
  if (result.error || !first) throw new Error(mutationMessage(result.error))
  return parseApproval(first)
}
