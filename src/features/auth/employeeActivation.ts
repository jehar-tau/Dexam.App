import { createEmployeeActivationClient, getSupabaseClient } from './supabaseClient'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

export type EmployeeActivationProof = {
  requestId: string
  proof: string
  tokenHash: string
  type: 'invite' | 'recovery'
}

export function parseEmployeeActivationProof(fragment: string): EmployeeActivationProof | null {
  const values = new URLSearchParams(fragment.replace(/^#/, ''))
  if ([...values.keys()].length !== 4) return null
  const requestId = values.get('request') ?? ''
  const proof = values.get('proof') ?? ''
  const tokenHash = values.get('token_hash') ?? ''
  const type = values.get('type')
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(requestId) ||
    !/^[0-9a-f]{64}$/.test(proof) ||
    !/^[A-Za-z0-9_-]{16,512}$/.test(tokenHash) ||
    (type !== 'invite' && type !== 'recovery')
  )
    return null
  return { requestId, proof, tokenHash, type }
}

// Capture once before React renders (including StrictMode), never in durable storage.
let pendingProof: EmployeeActivationProof | null = null
let activationClient: SupabaseClient | null = null
let verifiedRequestId: string | null = null
if (typeof window !== 'undefined' && window.location.pathname === '/staff/activate') {
  pendingProof = parseEmployeeActivationProof(window.location.hash)
  window.history.replaceState(null, '', window.location.pathname)
}

export function getPendingEmployeeActivationProof() {
  return pendingProof
}

export function clearEmployeeActivationProof() {
  pendingProof = null
  activationClient = null
  verifiedRequestId = null
}

export async function verifyEmployeeActivation(proof: EmployeeActivationProof) {
  activationClient = null
  verifiedRequestId = null
  const client = createEmployeeActivationClient()
  if (!client) throw new Error('Employee activation is not configured.')
  // An invitation must never accidentally use a previously signed-in administrator.
  await getSupabaseClient()?.auth.signOut({ scope: 'local' })
  const result = await client.auth.verifyOtp({ token_hash: proof.tokenHash, type: proof.type })
  if (result.error)
    throw new Error('This invitation is invalid or expired. Ask for a new invitation.')
  const state = await client.rpc('get_my_employee_activation_state')
  const parsed = z
    .array(z.object({ status: z.string(), expires_at: z.string().datetime({ offset: true }) }))
    .safeParse(state.data)
  const invitation = parsed.success ? parsed.data[0] : undefined
  if (
    state.error ||
    invitation?.status !== 'delivered' ||
    Date.parse(invitation.expires_at) <= Date.now()
  ) {
    await client.auth.signOut({ scope: 'local' })
    throw new Error(
      'This invitation is no longer available. Ask your administrator for a new invitation.',
    )
  }
  activationClient = client
  verifiedRequestId = proof.requestId
}

export async function completeEmployeeActivation(proof: EmployeeActivationProof, password: string) {
  const client = activationClient
  if (!client || verifiedRequestId !== proof.requestId)
    throw new Error('Verify this invitation before choosing a password.')
  const updated = await client.auth.updateUser({ password })
  if (updated.error) throw new Error('Your password could not be saved. Try again.')
  const accepted = await client.functions.invoke('employee-activate', {
    body: { requestId: proof.requestId, proof: proof.proof },
  })
  if (accepted.error)
    throw new Error(
      'Activation could not be completed. Your administrator may need to reissue the invitation.',
    )
  clearEmployeeActivationProof()
  await client.auth.signOut({ scope: 'local' })
}
