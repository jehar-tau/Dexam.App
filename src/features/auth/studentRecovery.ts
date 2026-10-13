import { z } from 'zod'
import { createEmployeeActivationClient, getSupabaseClient } from './supabaseClient'
const targetSchema = z.object({
  person_id: z.string().uuid(),
  member_id: z.string().regex(/^DXM-[2-9A-HJKMNP-Z]{12}$/),
  display_name: z.string().nullable(),
})
const requestSchema = targetSchema.omit({ person_id: true }).extend({
  id: z.string().uuid(),
  target_person_id: z.string().uuid(),
  proposer_person_id: z.string().uuid(),
  status: z.string(),
  expires_at: z.string(),
  pack_expires_at: z.string().nullable(),
})
const packSchema = z.object({
  memberId: z.string().regex(/^DXM-[2-9A-HJKMNP-Z]{12}$/),
  expiresAt: z.string().datetime({ offset: true }),
  recoveryURL: z.string().url(),
  backupCode: z.string().regex(/^[2-9A-HJKMNP-Z]{10}$/),
})
export type StudentRecoveryTarget = z.infer<typeof targetSchema>
export type StudentRecoveryPack = z.infer<typeof packSchema>
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error('Student recovery is not configured.')
  return value
}
export async function getStudentRecoveryWorkspace() {
  const permission = await client().rpc('current_person_can_assist_student_recovery')
  if (permission.error || permission.data !== true)
    throw new Error('Recent Elevated Admin verification required.')
  const [queue, actor] = await Promise.all([
    client().rpc('list_student_recovery_requests'),
    client().rpc('current_person_id'),
  ])
  if (queue.error || actor.error) throw new Error('Recovery queue could not be loaded.')
  const requests = z.array(requestSchema).safeParse(queue.data)
  const person = z.string().uuid().safeParse(actor.data)
  if (!requests.success || !person.success) throw new Error('Recovery queue could not be loaded.')
  return { requests: requests.data, actorPersonId: person.data }
}
export async function findStudentRecoveryTarget(memberId: string) {
  const result = await client().rpc('find_student_recovery_target', {
    p_member_id: memberId.trim().toUpperCase(),
  })
  if (result.error) throw new Error('Student identity could not be checked.')
  const parsed = z.array(targetSchema).safeParse(result.data)
  if (!parsed.success) throw new Error('Student identity could not be checked.')
  return parsed.data[0] ?? null
}
export async function proposeStudentRecovery(
  personId: string,
  identity: boolean,
  enrolment: boolean,
) {
  const result = await client().rpc('propose_student_recovery', {
    p_person_id: personId,
    p_reason_code: 'forgotten_password',
    p_identity_verified: identity,
    p_enrollment_reviewed: enrolment,
  })
  if (result.error)
    throw new Error(
      'Proposal unavailable. Check evidence, current authority, eligibility and cooldown.',
    )
}
export async function decideStudentRecovery(
  requestId: string,
  approved: boolean,
  identity: boolean,
  enrolment: boolean,
) {
  const result = await client().rpc('decide_student_recovery', {
    p_request_id: requestId,
    p_approve: approved,
    p_identity_rechecked: identity,
    p_enrollment_rechecked: enrolment,
  })
  if (result.error)
    throw new Error('Independent decision unavailable. Check current authority and evidence.')
}
export async function cancelStudentRecovery(requestId: string) {
  const result = await client().rpc('cancel_student_recovery', { p_request_id: requestId })
  if (result.error)
    throw new Error('Cancellation unavailable. In-progress password changes cannot be cancelled.')
}
export async function issueStudentRecoveryPack(requestId: string) {
  const result = await client().functions.invoke('staff-issue-student-recovery', {
    body: { requestId },
  })
  if (result.error)
    throw new Error(
      'Pack issuance did not confirm completion. Refresh the queue before retrying; hosted issuance is disabled.',
    )
  const parsed = packSchema.safeParse(result.data)
  if (!parsed.success)
    throw new Error(
      'Recovery pack response could not be verified. Refresh the queue; no credential is displayed.',
    )
  const callback = new URL(parsed.data.recoveryURL)
  const proof = parseStudentRecoveryFragment(callback.hash)
  if (
    callback.origin !== 'http://127.0.0.1:5173' ||
    callback.pathname !== '/student/recover' ||
    callback.search ||
    !proof ||
    proof.memberId !== parsed.data.memberId
  )
    throw new Error(
      'Recovery pack response could not be verified. Refresh the queue; no credential is displayed.',
    )
  return parsed.data
}
export function parseStudentRecoveryFragment(fragment: string) {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const memberId = params.get('memberId'),
    token = params.get('token')
  if (
    params.size !== 2 ||
    !memberId ||
    !/^DXM-[2-9A-HJKMNP-Z]{12}$/.test(memberId) ||
    !token ||
    !/^[0-9a-f]{64}$/.test(token)
  )
    return null
  return { memberId, token }
}
let pendingProof: ReturnType<typeof parseStudentRecoveryFragment> = null
if (typeof window !== 'undefined' && window.location.pathname === '/student/recover') {
  pendingProof = parseStudentRecoveryFragment(window.location.hash)
  window.history.replaceState(null, '', window.location.pathname)
}
export function takeStudentRecoveryProof() {
  return pendingProof
}
export function clearStudentRecoveryProof() {
  pendingProof = null
}
export async function resetStudentPassword(
  memberId: string,
  proof: string,
  credentialType: 'link' | 'backup',
  password: string,
) {
  const isolated = createEmployeeActivationClient()
  if (!isolated) throw new Error('Student recovery is not configured.')
  const result = await isolated.functions.invoke('student-reset-password', {
    body: { memberId: memberId.trim().toUpperCase(), proof, credentialType, password },
  })
  if (result.error)
    throw new Error(
      'Recovery did not confirm completion. Proof may be expired or access may already be blocked. Contact your administrator; hosted recovery is disabled.',
    )
  clearStudentRecoveryProof()
  await getSupabaseClient()?.auth.signOut({ scope: 'local' })
}
