import { createClient } from 'npm:@supabase/supabase-js@2'
import { boundedBody, maxLessonBytes, validLessonFile } from '../_shared/lesson-file-validation.mjs'
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}
const reply = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers })
const uuid = (value: unknown) =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (request.method !== 'POST') return reply(405, { message: 'Method not allowed.' })
  const url = Deno.env.get('SUPABASE_URL'),
    anon = Deno.env.get('SUPABASE_ANON_KEY'),
    service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    auth = request.headers.get('Authorization')
  if (!url || !anon || !service || !auth?.startsWith('Bearer '))
    return reply(401, { message: 'Authorization required.' })
  const options = { auth: { autoRefreshToken: false, persistSession: false } }
  const caller = createClient(url, anon, {
      ...options,
      global: { headers: { Authorization: auth } },
    }),
    admin = createClient(url, service, options)
  let unattached: string | null = null
  try {
    if (request.headers.get('Content-Type')?.startsWith('multipart/form-data')) {
      const bytes = await boundedBody(request, maxLessonBytes + 65536)
      const form = await new Response(bytes, {
        headers: { 'Content-Type': request.headers.get('Content-Type')! },
      }).formData()
      const file = form.get('file'),
        lesson = form.get('lessonId')
      if (
        !(file instanceof File) ||
        !uuid(lesson) ||
        !validLessonFile(file, new Uint8Array(await file.slice(0, 16).arrayBuffer()))
      )
        return reply(400, { message: 'Choose a valid PDF, JPEG, PNG or WebP file up to 10 MB.' })
      const reservation = await caller.rpc('reserve_lesson_file', {
        p_lesson_id: lesson,
        p_file_name: file.name,
        p_mime_type: file.type,
        p_byte_size: file.size,
      })
      const asset = reservation.data?.[0]
      if (reservation.error || !asset)
        return reply(403, { message: 'This draft cannot accept the file.' })
      unattached = asset.file_id
      const uploaded = await admin.storage
        .from('lesson-materials')
        .upload(asset.object_path, file, {
          contentType: file.type,
          upsert: false,
          cacheControl: '0',
        })
      if (uploaded.error) return reply(503, { message: 'The file could not be uploaded.' })
      const ready = await admin.rpc('complete_lesson_upload', { p_file_id: asset.file_id })
      if (ready.error) return reply(503, { message: 'The file could not be prepared.' })
      const attached = await caller.rpc('attach_lesson_file', { p_file_id: asset.file_id })
      if (attached.error)
        return reply(403, { message: 'Draft access changed; the file was not attached.' })
      unattached = null
      return reply(200, { ok: true })
    }
    const bytes = await boundedBody(request, 2048),
      body = JSON.parse(new TextDecoder().decode(bytes))
    if (!uuid(body.lessonId) || !uuid(body.fileId))
      return reply(400, { message: 'Invalid file request.' })
    const args = { p_lesson_id: body.lessonId, p_file_id: body.fileId }
    const lookup = await caller.rpc('get_lesson_file', args),
      file = lookup.data?.[0]
    if (lookup.error || !file)
      return reply(403, { message: 'This lesson file is not available to your account.' })
    const signed = await admin.storage
      .from('lesson-materials')
      .createSignedUrl(file.object_path, 60, { download: file.file_name })
    if (signed.error) return reply(404, { message: 'This lesson file is unavailable.' })
    const recheck = await caller.rpc('get_lesson_file', args)
    if (recheck.error || recheck.data?.[0]?.object_path !== file.object_path)
      return reply(403, { message: 'Current lesson access changed.' })
    const signedURL = new URL(signed.data.signedUrl)
    return reply(200, { path: signedURL.pathname + signedURL.search })
  } catch {
    return reply(400, { message: 'The lesson file request could not be completed.' })
  } finally {
    if (unattached)
      await admin.rpc('abandon_lesson_upload', { p_file_id: unattached }).catch(() => {})
  }
})
