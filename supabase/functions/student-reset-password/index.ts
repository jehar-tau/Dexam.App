import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  assertLocalStudentRecovery,
  studentRecoveryHash,
} from '../_shared/student-recovery-proof.mjs'
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
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    pepper = Deno.env.get('ACTION_TOKEN_PEPPER')
  try {
    assertLocalStudentRecovery(Deno.env.get('STUDENT_RECOVERY_MODE'), apiURL)
  } catch {
    return reply(503, 'Student assisted recovery is disabled here.')
  }
  if (!apiURL || !service) return reply(503, 'Recovery unavailable.')
  const admin = createClient(apiURL, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  try {
    const text = await request.text()
    if (text.length > 4096) return reply(400, 'Recovery could not be completed.')
    const body = JSON.parse(text)
    if (
      typeof body.memberId !== 'string' ||
      !/^DXM-[2-9A-HJKMNP-Z]{12}$/.test(body.memberId) ||
      !['link', 'backup'].includes(body.credentialType) ||
      typeof body.proof !== 'string' ||
      !(body.credentialType === 'link' ? /^[0-9a-f]{64}$/ : /^[2-9A-HJKMNP-Z]{10}$/).test(
        body.proof,
      ) ||
      typeof body.password !== 'string' ||
      body.password.length < 12 ||
      body.password.length > 128
    )
      return reply(400, 'Recovery could not be completed.')
    const claimed = await admin.rpc('claim_student_recovery', {
      p_member_id: body.memberId,
      p_credential_type: body.credentialType,
      p_proof_hash: await studentRecoveryHash(pepper, body.credentialType, body.proof),
      p_member_hash: await studentRecoveryHash(pepper, 'member', body.memberId),
      // Forwarded IP headers are untrusted; this is a bounded shared local budget.
      p_network_hash: await studentRecoveryHash(pepper, 'budget', 'local-shared'),
    })
    const claim = claimed.data?.[0]
    if (claimed.error || !claim)
      return reply(
        400,
        'Recovery proof is invalid, expired, or no longer eligible. Contact your administrator.',
      )
    let outcome = 'uncertain'
    try {
      outcome = employeePasswordUpdateOutcome(
        await admin.auth.admin.updateUserById(claim.auth_user_id, { password: body.password }),
        claim.auth_user_id,
      )
    } catch {
      /* Keep the durable execution fence. */
    }
    if (outcome === 'uncertain')
      return reply(
        409,
        'Password update outcome is uncertain. Access remains blocked until an administrator investigates.',
      )
    const finished = await admin.rpc('finish_student_recovery', {
      p_request_id: claim.request_id,
      p_execution_key: claim.execution_key,
      p_succeeded: outcome === 'succeeded',
    })
    if (finished.error || finished.data !== true)
      return reply(
        409,
        'Recovery did not confirm completion. Contact your administrator; previous sessions remain blocked.',
      )
    return reply(200, 'Password updated. Sign in again with your unchanged Member ID.')
  } catch {
    return reply(400, 'Recovery did not confirm completion. Contact your administrator if needed.')
  }
})
