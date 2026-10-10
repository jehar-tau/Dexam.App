import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}

type PurgeCandidate = {
  file_id: string
  object_path: string
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
    return json(401, { message: 'Retention cleanup is not authorized.' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const candidatesResult = await admin.rpc('list_submission_files_due_for_purge', { p_limit: 100 })
  if (candidatesResult.error) {
    console.error('submission retention queue failed', candidatesResult.error.code)
    return json(503, { message: 'Retention cleanup could not start.' })
  }

  const candidates = (candidatesResult.data ?? []) as PurgeCandidate[]
  let purged = 0
  for (const candidate of candidates) {
    const removal = await admin.storage.from('student-submissions').remove([candidate.object_path])
    if (removal.error) {
      console.error('submission retention object removal failed', candidate.file_id)
      continue
    }
    const completion = await admin.rpc('complete_submission_file_purge', {
      p_submission_file_id: candidate.file_id,
    })
    if (completion.error) {
      console.error('submission retention metadata update failed', candidate.file_id)
      continue
    }
    purged += 1
  }

  return json(200, { examined: candidates.length, purged })
})
