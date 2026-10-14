import { createClient } from 'npm:@supabase/supabase-js@2'
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
function reply(status: number, body: object) {
  return new Response(JSON.stringify(body), { status, headers })
}
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, { message: 'Method not allowed.' })
  const apiURL = Deno.env.get('SUPABASE_URL'),
    anon = Deno.env.get('SUPABASE_ANON_KEY'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    authorization = request.headers.get('Authorization')
  if (!apiURL || !anon || !service || !authorization?.startsWith('Bearer '))
    return reply(401, { message: 'Student authorization required.' })
  const options = { auth: { autoRefreshToken: false, persistSession: false } }
  const caller = createClient(apiURL, anon, {
    ...options,
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(apiURL, service, options)
  try {
    const bodyText = await request.text()
    if (bodyText.length > 2048) return reply(400, { message: 'Invalid file request.' })
    const body = JSON.parse(bodyText)
    if (
      typeof body.fileId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.fileId) ||
      !['submission', 'voice'].includes(body.kind)
    )
      return reply(400, { message: 'Invalid file request.' })
    const lookup = await caller.rpc('get_student_archive_file', {
      p_file_id: body.fileId,
      p_kind: body.kind,
    })
    const file = lookup.data?.[0]
    if (lookup.error || !file)
      return reply(403, { message: 'This retained file is not available to your account.' })
    const remaining = Math.floor((Date.parse(file.expires_at) - Date.now()) / 1000)
    const seconds = Math.min(60, remaining)
    if (seconds < 1) return reply(403, { message: 'The archive has expired.' })
    const signed = await admin.storage
      .from(file.bucket)
      .createSignedUrl(file.object_path, seconds, { download: true })
    if (signed.error)
      return reply(404, { message: 'This retained file is missing or no longer available.' })
    const signedURL = new URL(signed.data.signedUrl)
    const token = signedURL.searchParams.get('token')
    if (!token) return reply(404, { message: 'Download proof unavailable.' })
    const claims = JSON.parse(atob(token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')))
    if (
      typeof claims.exp !== 'number' ||
      claims.exp * 1000 > Date.parse(file.expires_at) ||
      claims.exp * 1000 <= Date.now()
    )
      return reply(403, { message: 'The archive download window has ended.' })
    const recheck = await caller.rpc('get_student_archive_file', {
      p_file_id: body.fileId,
      p_kind: body.kind,
    })
    if (recheck.error || recheck.data?.[0]?.object_path !== file.object_path)
      return reply(403, { message: 'Current file access changed.' })
    return reply(200, {
      path: signedURL.pathname + signedURL.search,
      expiresAt: new Date(claims.exp * 1000).toISOString(),
    })
  } catch {
    return reply(400, { message: 'The file request could not be completed.' })
  }
})
