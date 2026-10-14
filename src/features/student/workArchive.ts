import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
const date = z.string().datetime({ offset: true })
const fileSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  mimeType: z.string(),
  byteSize: z.number().nonnegative(),
})
const feedbackSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  nextStep: z.string().nullable(),
  publishedAt: date,
  aiAssisted: z.boolean(),
  voiceIds: z.array(z.string().uuid()),
})
const attemptSchema = z.object({
  id: z.string().uuid(),
  assignmentTitle: z.string(),
  attemptNumber: z.number().int().positive(),
  submittedAt: date,
  files: z.array(fileSchema),
  feedback: z.array(feedbackSchema),
})
const archiveSchema = z.object({
  enrollmentId: z.string().uuid(),
  offeringTitle: z.string(),
  status: z.enum(['completed', 'withdrawn']),
  endedAt: date,
  expiresAt: date,
  attempts: z.array(attemptSchema),
})
export type WorkArchive = z.infer<typeof archiveSchema>
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error('Work archive is not configured.')
  return value
}
export async function getWorkArchive() {
  const result = await client().rpc('list_student_work_archive')
  const parsed = z.array(archiveSchema).safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error('Your work archive could not be loaded. Please retry.')
  return parsed.data
}
export async function getArchiveDownload(fileId: string, kind: 'submission' | 'voice') {
  const result = await client().functions.invoke('student-work-archive-file', {
    body: { fileId, kind },
  })
  const parsed = z.object({ path: z.string(), expiresAt: date }).safeParse(result.data)
  const base = import.meta.env.VITE_SUPABASE_URL
  if (
    result.error ||
    !parsed.success ||
    !base ||
    !/^\/storage\/v1\/object\/sign\/(student-submissions|teacher-feedback-audio)\//.test(
      parsed.data.path,
    ) ||
    parsed.data.path.includes('#')
  )
    throw new Error(
      'This retained file could not be downloaded. It may be missing, expired, or no longer authorized.',
    )
  const url = new URL(parsed.data.path, base)
  if (url.origin !== new URL(base).origin)
    throw new Error('Download response could not be verified.')
  return { url: url.toString(), expiresAt: parsed.data.expiresAt }
}
