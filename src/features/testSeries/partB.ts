import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

/**
 * F043 Part B (drawing and uploads) and F048 evaluation. The server pins the drawing tasks and
 * times the drawing and the upload window; the storage policy refuses uploads outside it.
 * Evaluators see a candidate reference, never a name.
 */

export const PART_B_BUCKET = 'assessment-part-b'
export const PART_B_MAX_BYTES = 10 * 1024 * 1024
export const PART_B_MAX_FILES = 5
export const PART_B_TYPES = ['image/jpeg', 'image/png', 'application/pdf'] as const

const extensionFor: Record<(typeof PART_B_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
}

const numberish = z.union([z.number(), z.string().transform(Number)])

const partBSchema = z.object({
  attemptId: z.string().uuid(),
  paperId: z.string(),
  exam: z.string(),
  kind: z.enum(['paper', 'practice', 'mock']),
  partAStatus: z.enum(['open', 'in_progress', 'submitted']),
  status: z.enum(['none', 'drawing', 'uploading', 'submitted', 'evaluated']),
  available: z.number().int(),
  startedAt: z.string().nullable(),
  drawingDeadline: z.string().nullable(),
  uploadDeadline: z.string().nullable(),
  submittedAt: z.string().nullable(),
  score: numberish.nullable(),
  maxScore: numberish.nullable(),
  reference: z.string(),
  tasks: z.array(
    z.object({
      id: z.string().uuid(),
      number: z.string().nullable(),
      prompt: z.string(),
      figures: z.array(
        z.object({ path: z.string(), width: z.number().nullable(), height: z.number().nullable() }),
      ),
      maxMarks: numberish,
      marks: numberish.nullable(),
      feedback: z.string().nullable(),
      uploads: z.array(
        z.object({ path: z.string(), mimeType: z.string(), bytes: z.number().int() }),
      ),
    }),
  ),
})

export type PartB = z.infer<typeof partBSchema>
export type PartBTask = PartB['tasks'][number]

export class PartBError extends Error {}

async function call(client: SupabaseClient, name: string, args: Record<string, unknown>) {
  const result = await client.rpc(name, args)
  if (result.error) {
    if (result.error.code === 'P0002')
      throw new PartBError('This paper has no Part B tasks ready yet.')
    if (result.error.code === 'DX002') throw new PartBError('The upload window has closed.')
    throw new PartBError('Part B could not be updated. Please try again.')
  }
  return result.data as unknown
}

export async function fetchPartB(client: SupabaseClient, attemptId: string): Promise<PartB> {
  return partBSchema.parse(await call(client, 'get_part_b', { p_attempt_id: attemptId }))
}

export async function beginPartB(client: SupabaseClient, attemptId: string) {
  return partBSchema.parse(await call(client, 'begin_part_b', { p_attempt_id: attemptId }))
}

export async function startPartBUpload(client: SupabaseClient, attemptId: string) {
  return partBSchema.parse(await call(client, 'start_part_b_upload', { p_attempt_id: attemptId }))
}

export async function submitPartB(client: SupabaseClient, attemptId: string) {
  return partBSchema.parse(await call(client, 'submit_part_b', { p_attempt_id: attemptId }))
}

/** Why a file cannot be uploaded, or null when it can. */
export function partBFileProblem(file: File): string | null {
  if (!(PART_B_TYPES as readonly string[]).includes(file.type)) {
    return `${file.name}: only JPEG, PNG or PDF files can be uploaded.`
  }
  if (file.size > PART_B_MAX_BYTES) return `${file.name}: files must be 10 MB or smaller.`
  if (file.size === 0) return `${file.name}: the file is empty.`
  return null
}

export async function uploadPartBFile(
  client: SupabaseClient,
  attemptId: string,
  taskId: string,
  file: File,
) {
  const problem = partBFileProblem(file)
  if (problem) throw new PartBError(problem)
  const extension = extensionFor[file.type as (typeof PART_B_TYPES)[number]]
  const path = `${attemptId}/${taskId}/${crypto.randomUUID()}.${extension}`
  const upload = await client.storage
    .from(PART_B_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })
  if (upload.error) {
    throw new PartBError(`${file.name} could not be uploaded. The window may have closed.`)
  }
  await call(client, 'register_part_b_upload', {
    p_attempt_id: attemptId,
    p_question_id: taskId,
    p_storage_path: path,
    p_mime_type: file.type,
    p_byte_size: file.size,
  })
}

/** Signed links for task figures (bank media) and uploaded sheets. */
export async function signPartBMedia(client: SupabaseClient, partB: PartB) {
  const urls = new Map<string, string>()
  const figures = [...new Set(partB.tasks.flatMap((task) => task.figures.map((f) => f.path)))]
  const uploads = partB.tasks.flatMap((task) => task.uploads.map((u) => u.path))
  const sign = async (bucket: string, paths: string[]) => {
    if (!paths.length) return
    const signed = await client.storage.from(bucket).createSignedUrls(paths, 60 * 60)
    if (signed.error) return
    for (const entry of signed.data) {
      if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl)
    }
  }
  await Promise.all([sign('assessment-media', figures), sign(PART_B_BUCKET, uploads)])
  return urls
}

export async function listMyPartB(client: SupabaseClient): Promise<PartB[]> {
  return z.array(partBSchema).parse(await call(client, 'list_my_part_b', {}))
}

const queueSchema = z.array(
  z.object({
    attemptId: z.string().uuid(),
    paperId: z.string(),
    exam: z.string(),
    status: z.enum(['submitted', 'evaluated']),
    submittedAt: z.string().nullable(),
    reference: z.string(),
    tasks: z.number().int(),
    marked: z.number().int(),
    uploads: z.number().int(),
  }),
)

export type PartBQueueItem = z.infer<typeof queueSchema>[number]

export async function listPartBQueue(client: SupabaseClient) {
  return queueSchema.parse(await call(client, 'list_part_b_queue', {}))
}

export async function savePartBEvaluation(
  client: SupabaseClient,
  attemptId: string,
  taskId: string,
  marks: number,
  feedback: string,
) {
  await call(client, 'save_part_b_evaluation', {
    p_attempt_id: attemptId,
    p_question_id: taskId,
    p_marks: marks,
    p_feedback: feedback,
  })
}

export async function releasePartB(client: SupabaseClient, attemptId: string) {
  await call(client, 'release_part_b', { p_attempt_id: attemptId })
}

export const partBStatusLabel: Record<PartB['status'], string> = {
  none: 'Not started',
  drawing: 'Drawing',
  uploading: 'Uploading',
  submitted: 'Awaiting evaluation',
  evaluated: 'Evaluated',
}
