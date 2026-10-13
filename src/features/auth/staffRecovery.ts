import { z } from 'zod'
import { getSupabaseClient } from './supabaseClient'

const targetSchema = z.object({
  person_id: z.string().uuid(),
  display_name: z.string().nullable(),
  factor_id: z.string().uuid(),
  factor_name: z.string(),
})
const requestSchema = z.object({
  id: z.string().uuid(),
  target_person_id: z.string().uuid(),
  target_name: z.string().nullable(),
  factor_id: z.string().uuid(),
  proposer_person_id: z.string().uuid(),
  reason_code: z.string(),
  status: z.enum([
    'pending',
    'approved',
    'rejected',
    'cancelled',
    'executing',
    'completed',
    'failed',
  ]),
  expires_at: z.string().datetime({ offset: true }),
})
export type StaffRecoveryTarget = z.infer<typeof targetSchema>
export type StaffRecoveryRequest = z.infer<typeof requestSchema>

function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error('Staff recovery is not configured.')
  return value
}

export async function getStaffRecoveryWorkspace() {
  const value = client()
  const permission = await value.rpc('current_person_can_manage_staff_security')
  if (permission.error) throw new Error('We could not check staff recovery access.')
  if (permission.data !== true)
    return {
      authorized: false,
      personId: null,
      targets: [] as StaffRecoveryTarget[],
      requests: [] as StaffRecoveryRequest[],
    }
  const [person, targets, requests] = await Promise.all([
    value.rpc('current_person_id'),
    value.rpc('list_staff_security_factors'),
    value.rpc('list_staff_mfa_reset_requests'),
  ])
  const actor = z.string().uuid().safeParse(person.data)
  const parsedTargets = z.array(targetSchema).safeParse(targets.data)
  const parsedRequests = z.array(requestSchema).safeParse(requests.data)
  if (
    person.error ||
    targets.error ||
    requests.error ||
    !actor.success ||
    !parsedTargets.success ||
    !parsedRequests.success
  )
    throw new Error('We could not load staff recovery. Verify your authenticator again and retry.')
  return {
    authorized: true,
    personId: actor.data,
    targets: parsedTargets.data,
    requests: parsedRequests.data,
  }
}

export async function proposeStaffRecovery(personId: string, factorId: string, reasonCode: string) {
  const result = await client().rpc('propose_staff_mfa_reset', {
    p_person_id: personId,
    p_factor_id: factorId,
    p_reason_code: reasonCode,
  })
  if (result.error)
    throw new Error(
      'Recovery could not be proposed. Check your verification and whether a request already exists.',
    )
}

export async function decideStaffRecovery(requestId: string, approve: boolean) {
  const result = await client().rpc('decide_staff_mfa_reset', {
    p_request_id: requestId,
    p_approve: approve,
  })
  if (result.error)
    throw new Error('The decision could not be recorded. Check independent authority and expiry.')
}

export async function cancelStaffRecovery(requestId: string) {
  const result = await client().rpc('cancel_staff_mfa_reset', { p_request_id: requestId })
  if (result.error) throw new Error('This recovery request could not be cancelled.')
}

export async function executeStaffRecovery(requestId: string) {
  const result = await client().functions.invoke('staff-reset-mfa', { body: { requestId } })
  if (result.error)
    throw new Error(
      'Recovery did not confirm completion. Check the request state before retrying; previous sessions may already be blocked.',
    )
}
