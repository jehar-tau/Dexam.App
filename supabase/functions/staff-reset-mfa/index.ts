import { createClient } from 'npm:@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}
function json(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json(405, 'Method not allowed.')
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !anon || !serviceKey || !authorization?.startsWith('Bearer '))
    return json(401, 'Staff security authorization required.')

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  let requestId: string
  try {
    const user = await caller.auth.getUser()
    if (user.error || !user.data.user) return json(401, 'Staff security authorization required.')
    const permission = await caller.rpc('current_person_can_manage_staff_security')
    if (permission.error || permission.data !== true)
      return json(403, 'Recent independent staff security authorization required.')
    const text = await request.text()
    if (text.length > 4096) return json(400, 'Invalid recovery request.')
    const body = JSON.parse(text)
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
    )
      return json(400, 'Invalid recovery request.')
    requestId = body.requestId
  } catch {
    return json(400, 'Invalid recovery request.')
  }

  let claim: { target_auth_user_id: string; factor_id: string; execution_key: string }
  try {
    const result = await admin.rpc('claim_staff_mfa_reset', { p_request_id: requestId })
    if (result.error || !result.data?.[0])
      return json(
        409,
        'This recovery request is no longer executable. Review its authority and expiry.',
      )
    claim = result.data[0]
  } catch {
    return json(503, 'Recovery could not be started. Please try again.')
  }

  let succeeded = false
  try {
    const factors = await admin.auth.admin.mfa.listFactors({ userId: claim.target_auth_user_id })
    if (!factors.error) {
      const factor = factors.data.factors.find((entry) => entry.id === claim.factor_id)
      if (!factor) succeeded = true
      else if (factor.factor_type === 'totp' && factor.status === 'verified') {
        await admin.auth.admin.mfa.deleteFactor({
          userId: claim.target_auth_user_id,
          id: claim.factor_id,
        })
        const checked = await admin.auth.admin.mfa.listFactors({
          userId: claim.target_auth_user_id,
        })
        succeeded =
          !checked.error && !checked.data.factors.some((entry) => entry.id === claim.factor_id)
      }
    }
  } catch {
    succeeded = false
  }

  try {
    const finished = await admin.rpc('finish_staff_mfa_reset', {
      p_request_id: requestId,
      p_execution_key: claim.execution_key,
      p_succeeded: succeeded,
    })
    if (finished.error)
      return json(503, 'Previous sessions are blocked. Recovery completion needs review.')
  } catch {
    return json(503, 'Previous sessions are blocked. Recovery completion needs review.')
  }
  return succeeded
    ? json(
        200,
        'Authenticator reset completed. Previous sessions are blocked; the employee must sign in and enrol again before sensitive access.',
      )
    : json(
        502,
        'Previous sessions are blocked. The reset did not complete; start a new reviewed request.',
      )
})
