import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}

const memberIdPattern = /^DXM-[2-9A-HJKMNP-Z]{12}$/
const genericFailure = 'We could not sign you in. Check your details and try again.'

type SignInRequest = {
  memberId?: unknown
  password?: unknown
}

function json(status: number, body: Record<string, unknown>, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, ...extraHeaders },
  })
}

function normalizeMemberId(value: string) {
  return value.trim().toUpperCase().replaceAll(' ', '')
}

function requestNetwork(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || request.headers.get('cf-connecting-ip')?.trim() || 'unavailable'
}

async function digest(value: string, pepper: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const pepper = Deno.env.get('ACTION_TOKEN_PEPPER')

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !pepper || pepper.length < 32) {
    console.error('student-sign-in is missing required server configuration')
    return json(503, { message: 'Sign-in is temporarily unavailable.' })
  }

  let body: SignInRequest
  try {
    body = (await request.json()) as SignInRequest
  } catch {
    return json(400, { message: genericFailure })
  }

  if (typeof body.memberId !== 'string' || typeof body.password !== 'string') {
    return json(400, { message: genericFailure })
  }

  const memberId = normalizeMemberId(body.memberId)
  if (!memberIdPattern.test(memberId) || body.password.length < 12 || body.password.length > 128) {
    return json(400, { message: genericFailure })
  }

  const memberHash = await digest(`student-member:${memberId}`, pepper)
  const networkHash = await digest(`student-network:${requestNetwork(request)}`, pepper)
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const throttle = await admin.rpc('consume_student_sign_in_attempt', {
    p_member_hash: memberHash,
    p_network_hash: networkHash,
  })

  if (throttle.error) {
    console.error('student sign-in throttle failed', throttle.error.code)
    return json(503, { message: 'Sign-in is temporarily unavailable.' })
  }
  if (throttle.data !== true) {
    return json(429, { message: genericFailure }, { 'Retry-After': '900' })
  }

  const internalEmail = `${memberId.toLowerCase()}@members.dexam.invalid`
  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const signInResult = await authClient.auth.signInWithPassword({
    email: internalEmail,
    password: body.password,
  })

  if (signInResult.error || !signInResult.data.session) {
    return json(400, { message: genericFailure })
  }

  const session = signInResult.data.session
  const memberClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  })
  const access = await memberClient.rpc('current_person_has_active_student_membership')

  if (access.error || access.data !== true) {
    await authClient.auth.signOut({ scope: 'local' })
    return json(400, { message: genericFailure })
  }

  const reset = await admin.rpc('clear_student_sign_in_member_attempts', {
    p_member_hash: memberHash,
  })
  if (reset.error) console.error('student sign-in throttle reset failed', reset.error.code)

  return json(200, {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  })
})
