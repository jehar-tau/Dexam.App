import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  assertLocalEmployeeEmail,
  sendCapturedEmployeeEmail,
} from '../_shared/local-employee-email.mjs'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
function reply(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, 'Method not allowed.')
  const apiURL = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const config = {
    mode: Deno.env.get('EMPLOYEE_EMAIL_DELIVERY_MODE'),
    apiURL,
    captureURL: Deno.env.get('LOCAL_MAIL_CAPTURE_URL'),
  }
  // This guard runs before Auth creation, DB mutation or any email operation.
  try {
    assertLocalEmployeeEmail(config, 'preflight@fixture.invalid')
  } catch {
    return reply(503, 'Employee email delivery is disabled here. No invitation was sent.')
  }
  const authorization = request.headers.get('Authorization')
  if (!apiURL || !anon || !service || !authorization?.startsWith('Bearer '))
    return reply(401, 'Staff authorization required.')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const caller = createClient(apiURL, anon, {
    ...options,
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(apiURL, service, options)
  let requestId: string
  let actorAuthId: string
  try {
    const actor = await caller.auth.getUser()
    if (actor.error || !actor.data.user) return reply(401, 'Staff authorization required.')
    const permission = await caller.rpc('current_person_can_invite_employees')
    if (permission.error || permission.data !== true)
      return reply(403, 'Recent Elevated Admin verification required.')
    actorAuthId = actor.data.user.id
    const text = await request.text()
    if (text.length > 2048) return reply(400, 'Invalid invitation request.')
    const body = JSON.parse(text)
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
    )
      return reply(400, 'Invalid invitation request.')
    requestId = body.requestId
  } catch {
    return reply(400, 'Invalid invitation request.')
  }
  let claim: { email: string; auth_user_id: string | null; delivery_key: string }
  try {
    const claimed = await admin.rpc('claim_employee_invitation', {
      p_request_id: requestId,
      p_actor_auth_id: actorAuthId,
    })
    if (claimed.error || !claimed.data?.[0])
      return reply(409, 'Invitation authority, state or expiry changed. Review the queue.')
    claim = claimed.data[0]
    assertLocalEmployeeEmail(config, claim.email)
  } catch {
    return reply(503, 'Invitation delivery could not be started. No access was activated.')
  }
  let succeeded = false
  try {
    let linkType: 'invite' | 'recovery' = 'invite'
    if (claim.auth_user_id) {
      const account = await admin.auth.admin.getUserById(claim.auth_user_id)
      if (account.error || account.data.user.email?.toLowerCase() !== claim.email)
        throw new Error('Identity changed.')
      if (account.data.user.email_confirmed_at) linkType = 'recovery'
    }
    const generated = await admin.auth.admin.generateLink({
      type: linkType,
      email: claim.email,
      options: { redirectTo: 'http://127.0.0.1:5173/staff/activate' },
    })
    if (
      generated.error ||
      !generated.data.user ||
      !generated.data.properties.action_link ||
      (claim.auth_user_id && generated.data.user.id !== claim.auth_user_id)
    )
      throw new Error('Provider invitation unavailable.')
    const nonce = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`employee-invite:${requestId}:${nonce}`),
    )
    const proofHash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const bound = await admin.rpc('bind_employee_invitation_auth', {
      p_request_id: requestId,
      p_delivery_key: claim.delivery_key,
      p_auth_user_id: generated.data.user.id,
      p_proof_hash: proofHash,
    })
    if (bound.error) throw new Error('Invitation binding denied.')
    const callback = new URL('http://127.0.0.1:5173/staff/activate')
    callback.hash = new URLSearchParams({
      request: requestId,
      proof: nonce,
      token_hash: generated.data.properties.hashed_token,
      type: linkType,
    }).toString()
    await sendCapturedEmployeeEmail(
      { ...config, linkType, linkFormat: 'application-action' },
      claim.email,
      callback.toString(),
      'invite',
    )
    succeeded = true
  } catch {
    succeeded = false
  }
  try {
    const outcome = await admin.rpc('finish_employee_invitation_delivery', {
      p_request_id: requestId,
      p_delivery_key: claim.delivery_key,
      p_succeeded: succeeded,
    })
    if (outcome.error)
      return reply(
        409,
        'Delivery did not confirm a usable invitation. Review current state before retrying. No employee access was activated.',
      )
  } catch {
    return reply(503, 'Invitation outcome needs review. No employee access was activated.')
  }
  return succeeded
    ? reply(
        200,
        'Fictional invitation captured locally. The employee must verify the link and choose a password; no role was granted.',
      )
    : reply(
        502,
        'Delivery failed. Review the pending identity before deliberately reissuing; no employee access was activated.',
      )
})
