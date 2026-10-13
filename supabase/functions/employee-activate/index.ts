import { createClient } from 'npm:@supabase/supabase-js@2'
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
  const url = Deno.env.get('SUPABASE_URL'),
    anon = Deno.env.get('SUPABASE_ANON_KEY'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!url || !anon || !service || !authorization?.startsWith('Bearer '))
    return reply(401, 'Employee activation authorization required.')
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const caller = createClient(url, anon, {
    ...options,
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(url, service, options)
  try {
    const account = await caller.auth.getUser()
    if (account.error || !account.data.user)
      return reply(401, 'Employee activation authorization required.')
    const claims = JSON.parse(
      atob(authorization.slice(7).split('.')[1].replaceAll('-', '+').replaceAll('_', '/')),
    )
    if (
      typeof claims.session_id !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claims.session_id)
    )
      return reply(400, 'This activation link is invalid or expired.')
    const text = await request.text()
    if (text.length > 2048) return reply(400, 'This activation link is invalid or expired.')
    const body = JSON.parse(text)
    if (
      typeof body.requestId !== 'string' ||
      typeof body.proof !== 'string' ||
      !/^[0-9a-f]{64}$/.test(body.proof) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
    )
      return reply(400, 'This activation link is invalid or expired.')
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`employee-invite:${body.requestId}:${body.proof}`),
    )
    const proofHash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('')
    const result = await admin.rpc('finalize_employee_invitation', {
      p_request_id: body.requestId,
      p_auth_user_id: account.data.user.id,
      p_session_id: claims.session_id,
      p_proof_hash: proofHash,
    })
    if (result.error)
      return reply(
        400,
        'This activation link is invalid or expired. No employee access was activated.',
      )
    return reply(200, 'Employee activation completed. No staff role was granted automatically.')
  } catch {
    return reply(
      400,
      'This activation link is invalid or expired. No employee access was activated.',
    )
  }
})
