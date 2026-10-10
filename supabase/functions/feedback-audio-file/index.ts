import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedTypes = new Set(['audio/webm', 'audio/mpeg', 'audio/mp4'])
const maxFileBytes = 10 * 1024 * 1024
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}

type ReservedFile = { file_id: string; object_path: string }

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[index + offset] === value)
}

async function signatureMatches(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (file.type === 'audio/webm') return hasBytes(bytes, [0x1a, 0x45, 0xdf, 0xa3])
  if (file.type === 'audio/mpeg') {
    return (
      new TextDecoder().decode(bytes.slice(0, 3)) === 'ID3' ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    )
  }
  if (file.type === 'audio/mp4') {
    return new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp'
  }
  return false
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  if (!['POST', 'DELETE'].includes(request.method)) {
    return json(405, { message: 'Method not allowed.' })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const authorization = request.headers.get('Authorization')
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json(401, { message: 'You are not authorized to change feedback audio.' })
  }

  const teacher = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (request.method === 'DELETE') {
    let fileId: unknown
    try {
      fileId = ((await request.json()) as { fileId?: unknown }).fileId
    } catch {
      return json(400, { message: 'The audio removal request is invalid.' })
    }
    if (typeof fileId !== 'string' || !uuidPattern.test(fileId)) {
      return json(400, { message: 'The audio removal request is invalid.' })
    }

    const target = await teacher.rpc('feedback_audio_removal_target', {
      p_feedback_audio_file_id: fileId,
    })
    if (target.error || typeof target.data !== 'string') {
      return json(403, { message: 'This audio cannot be removed.' })
    }
    const removal = await admin.storage.from('teacher-feedback-audio').remove([target.data])
    if (removal.error) {
      console.error('feedback audio object removal failed', removal.error.message)
      return json(503, { message: 'The audio could not be removed. Please try again.' })
    }
    const completion = await admin.rpc('complete_feedback_audio_file_removal', {
      p_feedback_audio_file_id: fileId,
    })
    if (completion.error) {
      console.error('feedback audio metadata removal failed', completion.error.code)
      return json(503, { message: 'The audio could not be removed. Please try again.' })
    }
    return json(200, { removed: true })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json(400, { message: 'The audio upload request is invalid.' })
  }

  const file = form.get('file')
  const revisionId = form.get('revisionId')
  const kind = form.get('kind')
  const originalFileName = form.get('originalFileName')
  const durationValue = form.get('durationSeconds')
  const durationSeconds = typeof durationValue === 'string' ? Number(durationValue) : Number.NaN

  if (
    !(file instanceof File) ||
    typeof revisionId !== 'string' ||
    !uuidPattern.test(revisionId) ||
    (kind !== 'voice_note' && kind !== 'dictation_temp') ||
    typeof originalFileName !== 'string' ||
    originalFileName.trim().length < 1 ||
    originalFileName.trim().length > 180 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds > 300 ||
    file.size < 1 ||
    file.size > maxFileBytes ||
    !allowedTypes.has(file.type)
  ) {
    return json(400, { message: 'This recording does not meet the feedback requirements.' })
  }
  if (!(await signatureMatches(file))) {
    return json(400, { message: 'The recording contents do not match the selected file type.' })
  }

  const reservation = await teacher.rpc('reserve_feedback_audio_file', {
    p_feedback_revision_id: revisionId,
    p_kind: kind,
    p_original_file_name: originalFileName.trim(),
    p_mime_type: file.type,
    p_byte_size: file.size,
    p_duration_seconds: durationSeconds,
  })
  const reserved = reservation.data?.[0] as ReservedFile | undefined
  if (reservation.error || !reserved) {
    console.error('feedback audio reservation denied', reservation.error?.code)
    return json(403, { message: 'This recording cannot be added to the feedback.' })
  }

  const upload = await admin.storage
    .from('teacher-feedback-audio')
    .upload(reserved.object_path, file, {
      cacheControl: '0',
      contentType: file.type,
      upsert: false,
    })
  if (upload.error) {
    await admin.from('feedback_audio_files').delete().eq('id', reserved.file_id)
    console.error('feedback audio upload failed', upload.error.message)
    return json(503, { message: 'The recording could not be uploaded. Please try again.' })
  }

  const completion = await admin.rpc('complete_feedback_audio_file_upload', {
    p_feedback_audio_file_id: reserved.file_id,
  })
  if (completion.error) {
    await admin.storage.from('teacher-feedback-audio').remove([reserved.object_path])
    await admin.from('feedback_audio_files').delete().eq('id', reserved.file_id)
    console.error('feedback audio verification failed', completion.error.code)
    return json(503, { message: 'The recording could not be verified. Please try again.' })
  }

  return json(201, {
    file: {
      id: reserved.file_id,
      kind,
      name: originalFileName.trim(),
      mimeType: file.type,
      byteSize: file.size,
      durationSeconds,
    },
  })
})
