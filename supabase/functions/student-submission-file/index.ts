import { createClient } from 'npm:@supabase/supabase-js@2'

const allowedTypes = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
const maxFileBytes = 10 * 1024 * 1024
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json',
}

type ReservedFile = {
  file_id: string
  object_path: string
}

type SubmissionFileRow = {
  object_path?: unknown
  submission_attempts?: unknown
}

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders })
}

function integerField(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function booleanField(value: FormDataEntryValue | null) {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function hasBytes(bytes: Uint8Array, expected: number[], offset = 0) {
  return expected.every((value, index) => bytes[index + offset] === value)
}

async function signatureMatches(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (file.type === 'application/pdf') {
    return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-'
  }
  if (file.type === 'image/jpeg') return hasBytes(bytes, [0xff, 0xd8, 0xff])
  if (file.type === 'image/png') {
    return hasBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  }
  if (file.type === 'image/webp') {
    return (
      new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' &&
      new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
    )
  }
  return false
}

function relatedAttempt(value: unknown) {
  const related = Array.isArray(value) ? value[0] : value
  if (!related || typeof related !== 'object') return null
  const row = related as Record<string, unknown>
  if (typeof row.assignment_instance_id !== 'string' || row.status !== 'draft') return null
  return { assignmentInstanceId: row.assignment_instance_id }
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
    return json(401, { message: 'You are not authorized to change submission files.' })
  }

  const studentClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const access = await studentClient.rpc('current_person_has_active_student_membership')
  if (access.error || access.data !== true) {
    return json(403, { message: 'Your student access is not active.' })
  }

  if (request.method === 'DELETE') {
    let fileId: unknown
    try {
      fileId = ((await request.json()) as { fileId?: unknown }).fileId
    } catch {
      return json(400, { message: 'The file removal request is invalid.' })
    }
    if (typeof fileId !== 'string' || !uuidPattern.test(fileId)) {
      return json(400, { message: 'The file removal request is invalid.' })
    }

    const lookup = await studentClient
      .from('submission_files')
      .select('object_path, submission_attempts!inner(assignment_instance_id, status)')
      .eq('id', fileId)
      .single()
    const row = lookup.data as SubmissionFileRow | null
    const attempt = relatedAttempt(row?.submission_attempts)
    if (lookup.error || !row || typeof row.object_path !== 'string' || !attempt) {
      return json(403, { message: 'This file cannot be removed.' })
    }

    const ownsInstance = await studentClient.rpc('current_person_can_access_assignment_instance', {
      p_assignment_instance_id: attempt.assignmentInstanceId,
    })
    if (ownsInstance.error || ownsInstance.data !== true) {
      return json(403, { message: 'This file cannot be removed.' })
    }

    const storageRemoval = await admin.storage.from('student-submissions').remove([row.object_path])
    if (storageRemoval.error) {
      console.error('student submission object removal failed', storageRemoval.error.message)
      return json(503, { message: 'The file could not be removed. Please try again.' })
    }
    const metadataRemoval = await admin.from('submission_files').delete().eq('id', fileId)
    if (metadataRemoval.error) {
      console.error('student submission metadata removal failed', metadataRemoval.error.code)
      return json(503, { message: 'The file could not be removed. Please try again.' })
    }
    return json(200, { removed: true })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json(400, { message: 'The upload request is invalid.' })
  }

  const file = form.get('file')
  const attemptId = form.get('attemptId')
  const originalFileName = form.get('originalFileName')
  const originalByteSize = integerField(form.get('originalByteSize'))
  const wasCompressed = booleanField(form.get('wasCompressed'))
  const pixelWidth = integerField(form.get('pixelWidth'))
  const pixelHeight = integerField(form.get('pixelHeight'))

  if (
    !(file instanceof File) ||
    typeof attemptId !== 'string' ||
    !uuidPattern.test(attemptId) ||
    typeof originalFileName !== 'string' ||
    originalFileName.trim().length < 1 ||
    originalFileName.trim().length > 180 ||
    originalByteSize === null ||
    wasCompressed === null ||
    file.size < 1 ||
    file.size > maxFileBytes ||
    !allowedTypes.has(file.type) ||
    (file.type === 'application/pdf' && (pixelWidth !== null || pixelHeight !== null)) ||
    (file.type !== 'application/pdf' &&
      (pixelWidth === null ||
        pixelHeight === null ||
        pixelWidth < 1 ||
        pixelWidth > 3200 ||
        pixelHeight < 1 ||
        pixelHeight > 3200)) ||
    (wasCompressed && originalByteSize <= file.size)
  ) {
    return json(400, { message: 'This file does not meet the submission requirements.' })
  }

  if (!(await signatureMatches(file))) {
    return json(400, { message: 'The file contents do not match the selected file type.' })
  }

  const reservation = await studentClient.rpc('reserve_submission_file', {
    p_submission_attempt_id: attemptId,
    p_original_file_name: originalFileName.trim(),
    p_mime_type: file.type,
    p_byte_size: file.size,
    p_original_byte_size: originalByteSize,
    p_was_compressed: wasCompressed,
    p_pixel_width: pixelWidth,
    p_pixel_height: pixelHeight,
  })
  const reserved = reservation.data?.[0] as ReservedFile | undefined
  if (reservation.error || !reserved) {
    console.error('student submission reservation denied', reservation.error?.code)
    return json(403, { message: 'This file cannot be added to the assignment.' })
  }

  const upload = await admin.storage
    .from('student-submissions')
    .upload(reserved.object_path, file, {
      cacheControl: '0',
      contentType: file.type,
      upsert: false,
    })
  if (upload.error) {
    await admin.from('submission_files').delete().eq('id', reserved.file_id)
    console.error('student submission upload failed', upload.error.message)
    return json(503, { message: 'The file could not be uploaded. Please try again.' })
  }

  const completion = await admin.rpc('complete_submission_file_upload', {
    p_submission_file_id: reserved.file_id,
  })
  if (completion.error) {
    await admin.storage.from('student-submissions').remove([reserved.object_path])
    await admin.from('submission_files').delete().eq('id', reserved.file_id)
    console.error('student submission verification failed', completion.error.code)
    return json(503, { message: 'The file could not be verified. Please try again.' })
  }

  return json(201, {
    file: {
      id: reserved.file_id,
      name: originalFileName.trim(),
      mimeType: file.type,
      byteSize: file.size,
      originalByteSize,
      wasCompressed,
      pixelWidth,
      pixelHeight,
    },
  })
})
