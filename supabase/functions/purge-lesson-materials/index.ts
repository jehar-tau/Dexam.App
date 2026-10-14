import { createClient } from 'npm:@supabase/supabase-js@2'
const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers })
Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, { message: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key || request.headers.get('Authorization') !== `Bearer ${key}`)
    return reply(401, { message: 'Retention cleanup is not authorized.' })
  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  const claimed = await admin.rpc('claim_lesson_files_for_purge', { p_limit: 100 })
  if (claimed.error) return reply(503, { message: 'Retention cleanup could not start.' })
  let purged = 0
  for (const asset of claimed.data ?? []) {
    const removal = await admin.storage.from('lesson-materials').remove([asset.object_path])
    if (removal.error) continue
    const completion = await admin.rpc('complete_lesson_file_purge', { p_file_id: asset.file_id })
    if (!completion.error) purged++
  }
  return reply(200, { examined: claimed.data?.length ?? 0, purged })
})
