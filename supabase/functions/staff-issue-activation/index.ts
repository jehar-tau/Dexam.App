import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

const backupAlphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const reasonPattern = /^[a-z][a-z0-9_]{2,79}$/

type IssueRequest = {
  enrollmentId?: unknown
  reasonCode?: unknown
}

type IssueResult = {
  token_id: string
  member_id: string
  expires_at: string
  is_reissue: boolean
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function base64Url(bytes: Uint8Array) {
  let value = ''
  for (const byte of bytes) value += String.fromCharCode(byte)
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function randomLinkToken() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

function randomBackupCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return [...bytes].map((byte) => backupAlphabet[byte % backupAlphabet.length]).join('')
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const pepper = Deno.env.get('ACTION_TOKEN_PEPPER')
  const appUrl = Deno.env.get('DEXAM_APP_URL') ?? 'http://127.0.0.1:5173'
  const authorization = request.headers.get('Authorization')

  if (!supabaseUrl || !anonKey || !pepper || pepper.length < 32 || !authorization) {
    return json(401, { message: 'You are not authorized to issue an activation pack.' })
  }

  let body: IssueRequest
  try {
    body = (await request.json()) as IssueRequest
  } catch {
    return json(400, { message: 'The activation-pack request is invalid.' })
  }

  if (
    typeof body.enrollmentId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.enrollmentId,
    ) ||
    typeof body.reasonCode !== 'string' ||
    !reasonPattern.test(body.reasonCode)
  ) {
    return json(400, { message: 'The activation-pack request is invalid.' })
  }

  const linkToken = randomLinkToken()
  const backupCode = randomBackupCode()
  const [linkHash, backupHash] = await Promise.all([
    digestCredential(linkToken, 'link', pepper),
    digestCredential(backupCode, 'backup', pepper),
  ])
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data, error } = await client.rpc('issue_student_activation_pack', {
    p_enrollment_id: body.enrollmentId,
    p_link_token_hash: linkHash,
    p_backup_code_hash: backupHash,
    p_expires_at: expiresAt,
    p_reason_code: body.reasonCode,
  })

  const result = data?.[0] as IssueResult | undefined
  if (error || !result) {
    console.error('activation pack issuance denied', error?.code)
    return json(403, { message: 'This activation pack cannot be issued.' })
  }

  const activationUrl = new URL('/activate', appUrl)
  activationUrl.searchParams.set('memberId', result.member_id)
  activationUrl.searchParams.set('token', linkToken)

  return json(200, {
    memberId: result.member_id,
    activationUrl: activationUrl.toString(),
    backupCode,
    expiresAt: result.expires_at,
    reissued: result.is_reissue,
  })
})
