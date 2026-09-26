import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const memberIdPattern = /^DXM-[2-9A-HJKMNP-Z]{12}$/
const genericFailure = 'The activation details are invalid or expired.'

type ActivationRequest = {
  memberId?: unknown
  credential?: unknown
  credentialType?: unknown
  password?: unknown
}

function json(status: number, body: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function normalizeMemberId(value: string) {
  return value.trim().toUpperCase().replaceAll(' ', '')
}

function normalizeCredential(value: string, credentialType: 'link' | 'backup') {
  return credentialType === 'backup'
    ? value.trim().toUpperCase().replaceAll(/[-\s]/g, '')
    : value.trim()
}

async function digestCredential(
  credential: string,
  credentialType: 'link' | 'backup',
  pepper: string,
) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pepper),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${credentialType}:${credential}`),
  )
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hashesMatch(left: string, right: string) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const pepper = Deno.env.get('ACTION_TOKEN_PEPPER')

  if (!supabaseUrl || !serviceRoleKey || !pepper || pepper.length < 32) {
    console.error('student-activate is missing required server configuration')
    return json(503, { message: 'Activation is temporarily unavailable.' })
  }

  let body: ActivationRequest
  try {
    body = (await request.json()) as ActivationRequest
  } catch {
    return json(400, { message: genericFailure })
  }

  if (
    typeof body.memberId !== 'string' ||
    typeof body.credential !== 'string' ||
    (body.credentialType !== 'link' && body.credentialType !== 'backup') ||
    typeof body.password !== 'string'
  ) {
    return json(400, { message: genericFailure })
  }

  const memberId = normalizeMemberId(body.memberId)
  const credentialType = body.credentialType
  const credential = normalizeCredential(body.credential, credentialType)

  if (
    !memberIdPattern.test(memberId) ||
    (credentialType === 'backup' && credential.length !== 10) ||
    (credentialType === 'link' && credential.length < 32) ||
    body.password.length < 12 ||
    body.password.length > 128
  ) {
    return json(400, { message: genericFailure })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: person } = await admin
    .from('people')
    .select('id, member_id')
    .eq('member_id', memberId)
    .eq('status', 'active')
    .maybeSingle()

  if (!person) return json(400, { message: genericFailure })

  const { data: token } = await admin
    .from('account_action_tokens')
    .select(
      'id, link_token_hash, backup_code_hash, expires_at, attempt_count, max_attempts, consumed_at, invalidated_at',
    )
    .eq('person_id', person.id)
    .eq('kind', 'activation')
    .is('consumed_at', null)
    .is('invalidated_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!token) return json(400, { message: genericFailure })

  const computedHash = await digestCredential(credential, credentialType, pepper)
  const storedHash = credentialType === 'link' ? token.link_token_hash : token.backup_code_hash
  const expired = Date.parse(token.expires_at) <= Date.now()
  const exhausted = token.attempt_count >= token.max_attempts

  if (expired || exhausted || !hashesMatch(computedHash, storedHash)) {
    if (!expired && !exhausted) {
      await admin
        .from('account_action_tokens')
        .update({ attempt_count: token.attempt_count + 1 })
        .eq('id', token.id)
        .eq('attempt_count', token.attempt_count)
    }
    return json(400, { message: genericFailure })
  }

  const internalEmail = `${memberId.toLowerCase()}@members.dexam.invalid`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password: body.password,
    email_confirm: true,
    user_metadata: { account_kind: 'student' },
  })

  if (createError || !created.user) {
    console.error('student activation could not create Auth user', createError?.code)
    return json(400, { message: genericFailure })
  }

  const { data: finalized, error: finalizeError } = await admin.rpc('finalize_student_activation', {
    p_person_id: person.id,
    p_auth_user_id: created.user.id,
    p_token_id: token.id,
    p_token_hash: computedHash,
    p_credential_type: credentialType,
  })

  if (finalizeError || finalized !== true) {
    await admin.auth.admin.deleteUser(created.user.id)
    console.error('student activation finalization failed', finalizeError?.code)
    return json(400, { message: genericFailure })
  }

  return json(200, { message: 'Your Dexam account is ready.' })
})
