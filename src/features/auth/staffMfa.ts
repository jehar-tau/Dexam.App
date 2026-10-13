import { getEmployeeAccess } from './employeeAuth'
import { getSupabaseClient } from './supabaseClient'

const unavailable = 'We could not verify staff security. Please try again.'

async function requireActiveClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailable)
  const access = await getEmployeeAccess()
  if (!access.activeEmployee) throw new Error(unavailable)
  return client
}

export async function getStaffMfaState() {
  const client = await requireActiveClient()
  const [assurance, factors] = await Promise.all([
    client.auth.mfa.getAuthenticatorAssuranceLevel(),
    client.auth.mfa.listFactors(),
  ])
  if (assurance.error || factors.error || !assurance.data || !factors.data) {
    throw new Error(unavailable)
  }
  let currentLevel = assurance.data.currentLevel
  if (currentLevel === 'aal2') {
    const live = await client.rpc('current_session_has_live_mfa')
    if (live.error) throw new Error(unavailable)
    if (live.data !== true) currentLevel = 'aal1'
  }
  return {
    currentLevel,
    factors: factors.data.totp.filter((factor) => factor.status === 'verified'),
  }
}

// Returned enrolment material belongs only in transient component state.
// Never persist it in application tables, browser storage, or logs.
export async function enrollStaffTotp(friendlyName: string) {
  const name = friendlyName.trim()
  if (!name || name.length > 64) throw new Error('Enter a factor name of 1 to 64 characters.')
  const client = await requireActiveClient()
  const { data, error } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: name,
    issuer: 'Dexam',
  })
  if (error || !data) throw new Error('We could not start authenticator setup. Please try again.')
  return { id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

export async function verifyStaffTotp(factorId: string, code: string) {
  if (!factorId || !/^\d{6}$/.test(code)) {
    throw new Error('Enter the six-digit code from your authenticator.')
  }
  const client = await requireActiveClient()
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId, code })
  if (error) throw new Error('We could not verify that code. Try a current code again.')
  const state = await getStaffMfaState()
  if (state.currentLevel !== 'aal2') throw new Error(unavailable)
}

export async function cancelStaffTotpEnrollment(factorId: string) {
  const client = await requireActiveClient()
  const { data, error } = await client.auth.mfa.listFactors()
  if (error || !data) throw new Error(unavailable)
  // This helper can remove only an unfinished enrolment, never a verified factor.
  const factor = data.all.find((entry) => entry.id === factorId)
  if (!factor || factor.factor_type !== 'totp' || factor.status !== 'unverified') {
    throw new Error('Only unfinished authenticator setup can be cancelled here.')
  }
  const result = await client.auth.mfa.unenroll({ factorId })
  if (result.error) throw new Error('We could not cancel setup. Please try again.')
}

export async function signOutAllStaffSessions() {
  const client = await requireActiveClient()
  const invalidation = await client.rpc('invalidate_my_staff_sessions')
  if (invalidation.error)
    throw new Error('We could not block your other sessions. Please try again.')
  let cleanupFailed: boolean
  try {
    const result = await client.auth.signOut({ scope: 'global' })
    cleanupFailed = Boolean(result.error)
  } catch {
    cleanupFailed = true
  }
  if (cleanupFailed) {
    try {
      await client.auth.signOut({ scope: 'local' })
    } catch {
      /* Durable denial is already established. */
    }
    throw new Error('Your previous sessions are blocked. Sign in again to continue.')
  }
}

export async function removeStaffTotpFactor(factorId: string) {
  const client = await requireActiveClient()
  const state = await getStaffMfaState()
  if (state.currentLevel !== 'aal2')
    throw new Error('Verify your authenticator before removing a factor.')
  if (!state.factors.some((factor) => factor.id === factorId))
    throw new Error('That authenticator is not available.')
  const required = await client.rpc('current_person_requires_mfa')
  if (required.error || typeof required.data !== 'boolean') throw new Error(unavailable)
  if (required.data && state.factors.length <= 1)
    throw new Error('Add and verify a backup authenticator before removing your last one.')
  const result = await client.auth.mfa.unenroll({ factorId })
  if (result.error) throw new Error('We could not remove that authenticator. Please try again.')
}
