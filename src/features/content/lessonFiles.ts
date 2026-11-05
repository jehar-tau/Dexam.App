import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
import { prepareSubmissionFile } from '../student/prepareSubmissionFile'
import { validateMaterialFile } from './contentWorkspace'
import { captureAccountOperation } from '../auth/accountOperation'
import { protectedFunctionFile } from '../files/protectedFiles'
const schema = z.object({
  id: z.string().uuid(),
  file_name: z.string().min(1).max(180),
  mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  byte_size: z.number().int().positive().max(10485760),
  display_name: z.string().min(1).max(180).optional(),
})
export type LessonFile = z.infer<typeof schema>
const failed = 'The lesson files could not be verified. Check your access and try again.'
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error(failed)
  return value
}
export async function listLessonFiles(lessonId: string) {
  const result = await client().rpc('list_named_lesson_files', { p_lesson_id: lessonId })
  const parsed = z.array(schema).max(5).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(failed)
  return parsed.data
}
export async function uploadLessonFile(lessonId: string, file: File, count: number) {
  const error = validateMaterialFile(file, count)
  if (error) throw new Error(error)
  const operation = await captureAccountOperation(client())
  let prepared: Awaited<ReturnType<typeof prepareSubmissionFile>> | undefined
  try {
    prepared = await prepareSubmissionFile(file)
    operation.assertCurrent()
    const form = new FormData()
    form.set('lessonId', lessonId)
    form.set('file', prepared.file)
    const result = await operation.client.functions.invoke('lesson-material-file', { body: form })
    operation.assertCurrent()
    if (result.error || !z.object({ ok: z.literal(true) }).safeParse(result.data).success)
      throw new Error('The lesson file could not be attached. Check the draft and try again.')
  } finally {
    if (prepared?.previewUrl) URL.revokeObjectURL(prepared.previewUrl)
    operation.dispose()
  }
}
export async function removeLessonFile(lessonId: string, fileId: string) {
  const result = await client().rpc('remove_lesson_file', {
    p_lesson_id: lessonId,
    p_file_id: fileId,
  })
  if (result.error) throw new Error('The file could not be removed from this draft.')
}
/** The function checks lesson access and returns the bytes themselves, never a signed link. */
export async function getLessonDownload(lessonId: string, fileId: string) {
  const result = await client().functions.invoke('lesson-material-file', {
    body: { lessonId, fileId },
  })
  const file = protectedFunctionFile(result)
  if (!file) throw new Error(failed)
  return file
}
