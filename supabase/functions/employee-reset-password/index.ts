import { createClient } from 'npm:@supabase/supabase-js@2'
import { assertLocalEmployeeEmail } from '../_shared/local-employee-email.mjs'
import { employeeActionProofHash } from '../_shared/employee-action-proof.ts'
import { employeePasswordUpdateOutcome } from '../_shared/employee-password-outcome.mjs'
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
function reply(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers })
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, 'Method not allowed.')
  const apiURL = Deno.env.get('SUPABASE_URL'),
    anon = Deno.env.get('SUPABASE_ANON_KEY'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  try {
    assertLocalEmployeeEmail(
      {
        mode: Deno.env.get('EMPLOYEE_EMAIL_DELIVERY_MODE'),
        apiURL,
        captureURL: Deno.env.get('LOCAL_MAIL_CAPTURE_URL'),
      },
      'preflight@fixture.invalid',
    )
  } catch {
    return reply(503, 'Employee password recovery is disabled here.')
  }
  const authorization = request.headers.get('Authorization')
  if (!apiURL || !anon || !service || !authorization?.startsWith('Bearer '))
    return reply(401, 'Recovery authorization required.')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const caller = createClient(apiURL, anon, {
    ...options,
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(apiURL, service, options)
  try {
    const account = await caller.auth.getUser()
    if (account.error || !account.data.user) return reply(401, 'Recovery authorization required.')
    const claims = JSON.parse(
      atob(authorization.slice(7).split('.')[1].replaceAll('-', '+').replaceAll('_', '/')),
    )
    const text = await request.text()
    if (text.length > 4096) return reply(400, 'Recovery could not be completed.')
    const body = JSON.parse(text)
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (
      typeof body.requestId !== 'string' ||
      !uuid.test(body.requestId) ||
      typeof claims.session_id !== 'string' ||
      !uuid.test(claims.session_id) ||
      typeof body.proof !== 'string' ||
      !/^[0-9a-f]{64}$/.test(body.proof) ||
      typeof body.password !== 'string' ||
      body.password.length < 8 ||
      body.password.length > 128
    )
      return reply(400, 'Recovery could not be completed.')
    const claimed = await admin.rpc('claim_employee_password_recovery', {
      p_request_id: body.requestId,
      p_auth_user_id: account.data.user.id,
      p_session_id: claims.session_id,
      p_proof_hash: await employeeActionProofHash('recovery', body.requestId, body.proof),
    })
    const claim = claimed.data?.[0]
    if (claimed.error) console.error('Employee recovery claim failed', claimed.error.code)
    if (claimed.error || !claim || claim.auth_user_id !== account.data.user.id)
      return reply(
        400,
        'Recovery link is invalid, expired, or no longer eligible. Request a new link.',
      )
    // Durable application cutoff has committed BEFORE supported provider mutation.
    // Preserve email, all MFA factors, metadata, identities, memberships, and roles.
    let succeeded = false
    let knownOutcome = false
    try {
      const updated = await admin.auth.admin.updateUserById(claim.auth_user_id, {
        password: body.password,
      })
      const outcome = employeePasswordUpdateOutcome(updated, claim.auth_user_id)
      succeeded = outcome === 'succeeded'
      knownOutcome = outcome !== 'uncertain'
    } catch {
      knownOutcome = false
    }
    if (!knownOutcome)
      return reply(
        400,
        'Password update outcome is uncertain. Previous sessions remain blocked. An administrator must inspect the in-progress request before recovery can proceed.',
      )
    const finished = await admin.rpc('finish_employee_password_recovery', {
      p_request_id: body.requestId,
      p_execution_key: claim.execution_key,
      p_succeeded: succeeded,
    })
    if (finished.error || finished.data !== true)
      return reply(
        400,
        'Password recovery did not confirm completion. Previous sessions remain blocked. Contact your administrator if an in-progress request remains unresolved.',
      )
    return reply(
      200,
      'Password updated. Previous application sessions are blocked. Sign in again; existing MFA remains required.',
    )
  } catch {
    return reply(400, 'Recovery did not confirm completion. Request a new link if needed.')
  }
})
