import { createClient } from 'npm:@supabase/supabase-js@2'

const headers = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return json(405, { message: 'Method not allowed.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !serviceRoleKey || authorization !== `Bearer ${serviceRoleKey}`) {
    return json(401, { message: 'Notification processing is not authorized.' })
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const processing = await admin.rpc('process_notification_outbox', { p_limit: 100 })
  if (processing.error) {
    console.error('notification outbox processing failed', processing.error.code)
    return json(503, { message: 'Notification processing could not complete.' })
  }

  const cleanup = await admin.rpc('purge_expired_notifications', { p_limit: 500 })
  if (cleanup.error) {
    console.error('notification retention cleanup failed', cleanup.error.code)
    return json(503, { message: 'Notification retention cleanup could not complete.' })
  }

  return json(200, {
    processing: processing.data?.[0] ?? { processed_count: 0, failed_count: 0 },
    purged: cleanup.data ?? 0,
  })
})
