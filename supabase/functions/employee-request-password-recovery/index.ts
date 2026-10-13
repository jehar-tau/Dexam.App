import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  assertLocalEmployeeEmail,
  sendCapturedEmployeeEmail,
} from '../_shared/local-employee-email.mjs'
import { employeeActionNonce, employeeActionProofHash } from '../_shared/employee-action-proof.ts'
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const generic =
  'If this is an eligible employee account, recovery instructions will be available in the local capture inbox.'
function reply(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers })
}
async function hmac(value: string, pepper: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, 'Method not allowed.')
  const apiURL = Deno.env.get('SUPABASE_URL'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    pepper = Deno.env.get('ACTION_TOKEN_PEPPER')
  const config = {
    mode: Deno.env.get('EMPLOYEE_EMAIL_DELIVERY_MODE'),
    apiURL,
    captureURL: Deno.env.get('LOCAL_MAIL_CAPTURE_URL'),
  }
  try {
    assertLocalEmployeeEmail(config, 'preflight@fixture.invalid')
  } catch {
    return reply(503, 'Employee email recovery is disabled in this environment.')
  }
  if (!apiURL || !service || !pepper || pepper.length < 32)
    return reply(503, 'Employee recovery is temporarily unavailable.')
  const admin = createClient(apiURL, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  EdgeRuntime.waitUntil(
    (async () => {
      let requestId: string | undefined
      let proofHash: string | undefined
      try {
        const text = await request.text()
        if (text.length > 2048) return
        const body = JSON.parse(text)
        if (typeof body.email !== 'string') return
        const email = body.email.trim().toLowerCase()
        assertLocalEmployeeEmail(config, email)
        // Local testing uses one shared abuse budget; untrusted forwarding headers cannot rotate it.
        const network = 'local-shared-network'
        const result = await admin.rpc('prepare_employee_password_recovery', {
          p_email: email,
          p_email_hash: await hmac(`employee-recovery-email:${email}`, pepper),
          p_network_hash: await hmac(`employee-recovery-network:${network}`, pepper),
        })
        const record = result.data?.[0]
        if (result.error || !record) return
        requestId = record.id
        const account = await admin.auth.admin.getUserById(record.auth_user_id)
        if (
          account.error ||
          account.data.user.email?.toLowerCase() !== record.email ||
          !account.data.user.email_confirmed_at
        )
          throw new Error('Identity changed.')
        const generated = await admin.auth.admin.generateLink({
          type: 'recovery',
          email: record.email,
          options: { redirectTo: 'http://127.0.0.1:5173/staff/recover' },
        })
        if (
          generated.error ||
          generated.data.user?.id !== record.auth_user_id ||
          !generated.data.properties?.hashed_token
        )
          throw new Error('Provider unavailable.')
        const nonce = employeeActionNonce()
        proofHash = await employeeActionProofHash('recovery', record.id, nonce)
        const callback = new URL('http://127.0.0.1:5173/staff/recover')
        callback.hash = new URLSearchParams({
          request: record.id,
          proof: nonce,
          token_hash: generated.data.properties.hashed_token,
          type: 'recovery',
        }).toString()
        await sendCapturedEmployeeEmail(
          { ...config, linkFormat: 'application-action' },
          record.email,
          callback.toString(),
          'recovery',
        )
        const finished = await admin.rpc('finish_employee_recovery_delivery', {
          p_request_id: record.id,
          p_proof_hash: proofHash,
          p_succeeded: true,
        })
        if (finished.error) throw new Error('Delivery outcome unconfirmed.')
      } catch {
        try {
          if (requestId)
            await admin.rpc('finish_employee_recovery_delivery', {
              p_request_id: requestId,
              p_proof_hash: null,
              p_succeeded: false,
            })
        } catch {
          /* No provider details or request contents enter logs or the public response. */
        }
      }
    })(),
  )
  // No account-existence, throttle, delivery, or identity outcome is exposed publicly.
  return reply(200, generic)
})
