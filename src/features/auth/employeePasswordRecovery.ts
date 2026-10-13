import type { SupabaseClient } from '@supabase/supabase-js'
import { createEmployeeActivationClient, getSupabaseClient } from './supabaseClient'
import { parseEmployeeActivationProof, type EmployeeActivationProof } from './employeeActivation'

let pendingProof: EmployeeActivationProof | null = null
let recoveryClient: SupabaseClient | null = null
let verifiedRequestId: string | null = null
if (typeof window !== 'undefined' && window.location.pathname === '/staff/recover') {
  const parsed = parseEmployeeActivationProof(window.location.hash)
  pendingProof = parsed?.type === 'recovery' ? parsed : null
  window.history.replaceState(null, '', window.location.pathname)
}
export function getPendingEmployeeRecoveryProof() {
  return pendingProof
}
export function clearEmployeeRecoveryProof() {
  pendingProof = null
  recoveryClient = null
  verifiedRequestId = null
}
export async function requestEmployeePasswordRecovery(email: string) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Employee recovery is not configured.')
  const result = await client.functions.invoke('employee-request-password-recovery', {
    body: { email: email.trim().toLowerCase() },
  })
  if (result.error)
    throw new Error(
      'Employee email recovery is unavailable in this environment. Contact your administrator.',
    )
}
export async function verifyEmployeeRecovery(proof: EmployeeActivationProof) {
  recoveryClient = null
  verifiedRequestId = null
  const client = createEmployeeActivationClient()
  if (!client || proof.type !== 'recovery')
    throw new Error('Recovery link is invalid or unavailable.')
  const result = await client.auth.verifyOtp({ token_hash: proof.tokenHash, type: 'recovery' })
  if (result.error) throw new Error('This recovery link is invalid or expired. Request a new link.')
  recoveryClient = client
  verifiedRequestId = proof.requestId
}
export async function completeEmployeePasswordRecovery(
  proof: EmployeeActivationProof,
  password: string,
) {
  const client = recoveryClient
  if (!client || verifiedRequestId !== proof.requestId)
    throw new Error('Verify the recovery link first.')
  const result = await client.functions.invoke('employee-reset-password', {
    body: { requestId: proof.requestId, proof: proof.proof, password },
  })
  if (result.error)
    throw new Error(
      'Recovery did not confirm completion. Previous sessions may already be blocked. Contact your administrator if an in-progress request remains unresolved; expiry cannot safely release an uncertain password update.',
    )
  clearEmployeeRecoveryProof()
  await client.auth.signOut({ scope: 'local' })
  await getSupabaseClient()?.auth.signOut({ scope: 'local' })
}
