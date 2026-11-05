import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
import { captureAccountOperation } from '../auth/accountOperation'
import { amountReceivedPaise, normalizeStudentLoginEmail } from './admissionInputs'

const id = z.string().uuid()
const revision = z.number().int().positive().safe()
export const admissionRowSchema = z.object({
  personId: id,
  memberId: z.string().nullable(),
  name: z.string().nullable(),
  loginEmail: z.string().nullable(),
  loginRevision: revision.nullable(),
  enrollmentId: id,
  offeringId: id,
  programme: z.string(),
  cohortId: id.nullable(),
  batch: z.string().nullable(),
  revision: revision.nullable(),
  startsAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  state: z.enum(['legacy', 'active', 'scheduled', 'expired', 'suspended', 'revoked', 'ended']),
})
export type AdmissionRow = z.infer<typeof admissionRowSchema>
const choicesSchema = z.object({
  enabled: z.boolean(),
  timezone: z.literal('Asia/Kolkata'),
  offerings: z.array(
    z.object({ id, title: z.string(), batches: z.array(z.object({ id, name: z.string() })) }),
  ),
})
export const admissionIdentitySchema = z.object({
  personId: id,
  memberId: z.string().nullable(),
  name: z.string().nullable(),
  loginEmail: z.string().nullable(),
  state: z.string(),
})
export type AdmissionIdentity = z.infer<typeof admissionIdentitySchema>
async function rpc<T>(
  name: string,
  args: Record<string, unknown>,
  schema: z.ZodType<T>,
): Promise<T> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Admissions is not configured.')
  const operation = await captureAccountOperation(client)
  try {
    const result = await operation.client.rpc(name, args)
    operation.assertCurrent()
    if (result.error) {
      if (result.error.code === '40001' || result.error.code === '23505')
        throw new Error(
          'This identity or record changed. Refresh and deliberately review the existing student; nothing was overwritten.',
        )
      if (result.error.code === '42501')
        throw new Error('Current admissions authority is required. Check your session and MFA.')
      if (result.error.code === '55000')
        throw new Error(
          'This operation is not currently available. Refresh and review the integration or access state.',
        )
      throw new Error(
        'Admission was not confirmed. Keep this form unchanged to retry safely, or refresh current state before making changes.',
      )
    }
    const parsed = schema.safeParse(result.data)
    if (!parsed.success)
      throw new Error(
        'The admission response could not be verified. Refresh current state before making another request.',
      )
    return parsed.data
  } finally {
    operation.dispose()
  }
}
export function listAdmissions(search: string, state?: string) {
  return rpc(
    'list_admissions_directory',
    { p_search: search, p_state: state || null },
    z.array(admissionRowSchema),
  )
}
export function getAdmissionChoices() {
  return rpc('get_admission_choices', {}, choicesSchema)
}
export function searchAdmissionIdentity(search: string) {
  return rpc('search_admission_identity', { p_search: search }, z.array(admissionIdentitySchema))
}
export type AdmissionDraft = {
  requestKey: string
  existingPerson: string | null
  name: string
  email: string
  offeringId: string
  cohortId: string | null
  startsAt: string
  expiresAt: string
  method: 'cash' | 'online_transfer' | 'card_machine'
  amount: string
  paidAt: string
  reference: string
  reason: string
  confirmed: boolean
}
export async function admitStudent(draft: AdmissionDraft) {
  if (!draft.confirmed) throw new Error('Confirm the student, dates and manual payment evidence.')
  const amount = amountReceivedPaise(draft.amount)
  if (amount <= 0) throw new Error('Enter the positive amount actually received.')
  return rpc(
    'admit_student',
    {
      p_request_key: id.parse(draft.requestKey),
      p_existing_person: draft.existingPerson ? id.parse(draft.existingPerson) : null,
      p_email: normalizeStudentLoginEmail(draft.email),
      p_name: draft.name.trim(),
      p_offering: id.parse(draft.offeringId),
      p_cohort: draft.cohortId ? id.parse(draft.cohortId) : null,
      p_start: draft.startsAt,
      p_expiry: draft.expiresAt,
      p_method: draft.method,
      p_amount_paise: amount,
      p_paid_at: draft.paidAt,
      p_reference: draft.reference.trim(),
      p_confirmed: draft.confirmed,
      p_reason: draft.reason.trim(),
    },
    z.object({
      personId: id,
      enrollmentId: id,
      receiptId: id,
      replayed: z.boolean(),
      memberId: z.string().optional(),
    }),
  )
}
export type AdmissionEdit = {
  enrollment: AdmissionRow
  requestKey: string
  action: 'details' | 'dates' | 'renewal' | 'suspension' | 'revocation' | 'batch_transfer'
  reason: string
  name?: string
  startsAt?: string
  expiresAt?: string
  cohortId?: string
}
export function editAdmission(edit: AdmissionEdit) {
  return rpc(
    'edit_admission',
    {
      p_enrollment: edit.enrollment.enrollmentId,
      p_expected_revision: edit.enrollment.revision,
      p_expected_person_revision: edit.enrollment.loginRevision,
      p_request_key: id.parse(edit.requestKey),
      p_action: edit.action,
      p_reason: edit.reason,
      p_name: edit.name ?? null,
      p_start: edit.startsAt ?? null,
      p_expiry: edit.expiresAt ?? null,
      p_cohort: edit.cohortId ?? null,
    },
    revision,
  )
}
