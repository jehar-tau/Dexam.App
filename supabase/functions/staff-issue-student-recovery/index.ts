import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  assertLocalStudentRecovery,
  studentRecoverySecrets,
  studentRecoveryHash,
} from '../_shared/student-recovery-proof.mjs'
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
    pepper = Deno.env.get('ACTION_TOKEN_PEPPER')
  try {
    assertLocalStudentRecovery(Deno.env.get('STUDENT_RECOVERY_MODE'), apiURL)
  } catch {
    return reply(503, { message: 'Student assisted recovery is disabled here.' })
  }
  const authorization = request.headers.get('Authorization')
  if (!apiURL || !anon || !service || !authorization?.startsWith('Bearer '))
    return reply(401, { message: 'Staff authorization required.' })
  const options = { auth: { persistSession: false, autoRefreshToken: false } }
  const caller = createClient(apiURL, anon, {
    ...options,
    global: { headers: { Authorization: authorization } },
  })
  const admin = createClient(apiURL, service, options)
  try {
    const actor = await caller.auth.getUser()
    if (actor.error || !actor.data.user)
      return reply(401, { message: 'Staff authorization required.' })
    const permission = await caller.rpc('current_person_can_assist_student_recovery')
    if (permission.error || permission.data !== true)
      return reply(403, { message: 'Recent Elevated Admin verification required.' })
    const text = await request.text()
    if (text.length > 2048) return reply(400, { message: 'Invalid recovery request.' })
    const body = JSON.parse(text)
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)
    )
      return reply(400, { message: 'Invalid recovery request.' })
    const secrets = studentRecoverySecrets()
    const issued = await admin.rpc('issue_student_recovery_pack', {
      p_request_id: body.requestId,
      p_actor_auth_id: actor.data.user.id,
      p_link_hash: await studentRecoveryHash(pepper, 'link', secrets.link),
      p_backup_hash: await studentRecoveryHash(pepper, 'backup', secrets.backup),
    })
    if (issued.error || !issued.data?.[0])
      return reply(409, {
        message: 'Recovery authority, state or expiry changed. Review the queue.',
      })
    const pack = issued.data[0]
    const link = new URL('http://127.0.0.1:5173/student/recover')
    link.hash = new URLSearchParams({ memberId: pack.member_id, token: secrets.link }).toString()
    return reply(200, {
      memberId: pack.member_id,
      expiresAt: pack.expires_at,
      recoveryURL: link.toString(),
      backupCode: secrets.backup,
    })
  } catch {
    return reply(400, {
      message: 'Recovery pack could not be issued. Review current state before retrying.',
    })
  }
})
