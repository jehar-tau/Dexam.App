import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
import { protectedFunctionFile } from '../files/protectedFiles'
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
/** The function re-checks the archive window and returns the bytes themselves, never a link. */
export async function getArchiveDownload(fileId: string, kind: 'submission' | 'voice') {
  const result = await client().functions.invoke('student-work-archive-file', {
    body: { fileId, kind },
  })
  const file = protectedFunctionFile(result)
  if (!file)
    throw new Error(
      'This retained file could not be downloaded. It may be missing, expired, or no longer authorized.',
    )
  return file
}
