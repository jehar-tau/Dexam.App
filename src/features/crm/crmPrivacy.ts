import { getSupabaseClient } from '../auth/supabaseClient'

export type CrmPrivacyCaseKind = 'correction' | 'erasure'
export type CrmPrivacyCaseStatus =
  | 'under_review'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'partially_completed'
  | 'expired'
export type CrmPrivacyLifecycleState =
  'active' | 'restricted' | 'minimization_due' | 'held' | 'minimized'
export type CrmPrivacyRequesterRelationship =
  'self' | 'parent_guardian' | 'authorized_representative'
export type CrmPrivacyVerificationMethod =
  'existing_contact_callback' | 'member_account' | 'in_person' | 'authorized_representative'
export type CrmPrivacyCorrectionField =
  'subject_name' | 'contact_name' | 'contact_value' | 'interest_summary' | 'target_intake'
export type CrmPrivacyQueue = 'open' | 'completed' | 'all'

export type CrmPrivacyCase = {
  approverName: string | null
  enquiryId: string
  expiresAt: string
  holdId: string | null
  holdReviewBy: string | null
  id: string
  kind: CrmPrivacyCaseKind
  lifecycleState: CrmPrivacyLifecycleState
  maskedContact: string
  minimizationDueAt: string | null
  proposalReason: string | null
  proposerName: string | null
  requestSummary: string
  requestedAt: string
  requesterRelationship: CrmPrivacyRequesterRelationship
  status: CrmPrivacyCaseStatus
  subjectName: string
  verificationMethod: CrmPrivacyVerificationMethod
}

export type CrmErasureImpact = {
  category: string
  plannedAction: string
  protectedRecord: boolean
  recordCount: number
}

type Row = Record<string, unknown>

const unavailableMessage =
  'Privacy operations could not be loaded. Check your MFA session and current access, then try again.'
const kinds: CrmPrivacyCaseKind[] = ['correction', 'erasure']
const statuses: CrmPrivacyCaseStatus[] = [
  'under_review',
  'approval_required',
  'approved',
  'rejected',
  'completed',
  'partially_completed',
  'expired',
]
const lifecycleStates: CrmPrivacyLifecycleState[] = [
  'active',
  'restricted',
  'minimization_due',
  'held',
  'minimized',
]
const requesterRelationships: CrmPrivacyRequesterRelationship[] = [
  'self',
  'parent_guardian',
  'authorized_representative',
]
const verificationMethods: CrmPrivacyVerificationMethod[] = [
  'existing_contact_callback',
  'member_account',
  'in_person',
  'authorized_representative',
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

function parseCase(value: unknown): CrmPrivacyCase {
  if (!value || typeof value !== 'object') throw new Error(unavailableMessage)
  const row = value as Row
  if (
    !kinds.includes(row.kind as CrmPrivacyCaseKind) ||
    !statuses.includes(row.status as CrmPrivacyCaseStatus) ||
    !lifecycleStates.includes(row.privacy_state as CrmPrivacyLifecycleState) ||
    !requesterRelationships.includes(
      row.requester_relationship as CrmPrivacyRequesterRelationship,
    ) ||
    !verificationMethods.includes(row.verification_method as CrmPrivacyVerificationMethod)
  ) {
    throw new Error(unavailableMessage)
  }
  return {
    id: requiredString(row.id),
    enquiryId: requiredString(row.enquiry_id),
    kind: row.kind as CrmPrivacyCaseKind,
    status: row.status as CrmPrivacyCaseStatus,
    subjectName: requiredString(row.subject_name),
    maskedContact: requiredString(row.masked_contact),
    requesterRelationship: row.requester_relationship as CrmPrivacyRequesterRelationship,
    verificationMethod: row.verification_method as CrmPrivacyVerificationMethod,
    requestSummary: requiredString(row.request_summary),
    proposalReason: nullableString(row.proposal_reason),
    proposerName: nullableString(row.proposer_name),
    approverName: nullableString(row.approver_name),
    requestedAt: requiredString(row.requested_at),
    expiresAt: requiredString(row.expires_at),
    lifecycleState: row.privacy_state as CrmPrivacyLifecycleState,
    minimizationDueAt: nullableString(row.minimization_due_at),
    holdId: nullableString(row.hold_id),
    holdReviewBy: nullableString(row.hold_review_by),
  }
}

function parseImpact(value: unknown): CrmErasureImpact {
  if (!value || typeof value !== 'object') throw new Error(unavailableMessage)
  const row = value as Row
  if (typeof row.record_count !== 'number' || typeof row.protected_record !== 'boolean') {
    throw new Error(unavailableMessage)
  }
  return {
    category: requiredString(row.category),
    recordCount: row.record_count,
    plannedAction: requiredString(row.planned_action),
    protectedRecord: row.protected_record,
  }
}

function actionError(message: string, error: { code?: string } | null) {
  if (error?.code === '42501') {
    return new Error('Your privacy authority or MFA assurance is no longer current. Sign in again.')
  }
  if (error?.code === '55000') {
    return new Error('This case changed or is no longer actionable. Refresh before continuing.')
  }
  return new Error(message)
}

export async function listCrmPrivacyCases(queue: CrmPrivacyQueue = 'open') {
  const result = await clientOrThrow().rpc('list_crm_privacy_cases', {
    p_limit: 100,
    p_status: queue,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseCase)
}

export async function previewCrmErasure(caseId: string) {
  const result = await clientOrThrow().rpc('preview_crm_erasure', { p_case_id: caseId })
  if (result.error || !Array.isArray(result.data)) {
    throw actionError('The erasure impact could not be prepared.', result.error)
  }
  return result.data.map(parseImpact)
}

export async function createCrmPrivacyCase(input: {
  enquiryId: string
  kind: CrmPrivacyCaseKind
  requestSummary: string
  requesterRelationship: CrmPrivacyRequesterRelationship
  verificationMethod: CrmPrivacyVerificationMethod
}) {
  const result = await clientOrThrow().rpc('create_crm_privacy_case', {
    p_enquiry_id: input.enquiryId,
    p_kind: input.kind,
    p_requester_relationship: input.requesterRelationship,
    p_verification_method: input.verificationMethod,
    p_request_summary: input.requestSummary.trim(),
  })
  if (result.error) throw actionError('The privacy request could not be recorded.', result.error)
  return requiredString(result.data)
}

export async function applyCrmPrivacyCorrection(input: {
  caseId: string
  field: CrmPrivacyCorrectionField
  newValue: string
  reason: string
}) {
  const result = await clientOrThrow().rpc('apply_crm_privacy_correction', {
    p_case_id: input.caseId,
    p_field: input.field,
    p_new_value: input.newValue.trim(),
    p_reason: input.reason.trim(),
  })
  if (result.error) throw actionError('The correction could not be applied.', result.error)
}

export async function proposeCrmErasure(caseId: string, reason: string) {
  const result = await clientOrThrow().rpc('propose_crm_erasure', {
    p_case_id: caseId,
    p_reason: reason.trim(),
  })
  if (result.error) throw actionError('The erasure could not be proposed.', result.error)
}

export async function decideCrmErasure(caseId: string, approve: boolean, note: string) {
  const result = await clientOrThrow().rpc('decide_crm_erasure', {
    p_case_id: caseId,
    p_approve: approve,
    p_note: note.trim(),
  })
  if (result.error) throw actionError('The erasure decision could not be recorded.', result.error)
}

export async function placeCrmPrivacyHold(input: {
  enquiryId: string
  note: string
  reasonCode: string
  reviewBy: string
}) {
  const result = await clientOrThrow().rpc('place_crm_privacy_hold', {
    p_enquiry_id: input.enquiryId,
    p_reason_code: input.reasonCode,
    p_note: input.note.trim(),
    p_review_by: input.reviewBy,
  })
  if (result.error) throw actionError('The temporary hold could not be placed.', result.error)
  return requiredString(result.data)
}

export async function releaseCrmPrivacyHold(holdId: string, reason: string) {
  const result = await clientOrThrow().rpc('release_crm_privacy_hold', {
    p_hold_id: holdId,
    p_reason: reason.trim(),
  })
  if (result.error) throw actionError('The temporary hold could not be released.', result.error)
}
