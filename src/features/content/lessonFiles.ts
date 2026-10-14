import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
import { prepareSubmissionFile } from '../student/prepareSubmissionFile'
import { validateMaterialFile } from './contentWorkspace'
const schema = z.object({
  id: z.string().uuid(),
  file_name: z.string().min(1).max(180),
  mime_type: z.enum(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  byte_size: z.number().int().positive().max(10485760),
})
export type LessonFile = z.infer<typeof schema>
const failed = 'The lesson files could not be verified. Check your access and try again.'
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error(failed)
  return value
}
export async function listLessonFiles(lessonId: string) {
  const result = await client().rpc('list_lesson_files', { p_lesson_id: lessonId })
  const parsed = z.array(schema).max(5).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(failed)
  return parsed.data
}
export async function uploadLessonFile(lessonId: string, file: File, count: number) {
  const error = validateMaterialFile(file, count)
  if (error) throw new Error(error)
  const prepared = await prepareSubmissionFile(file)
  try {
    const form = new FormData()
    form.set('lessonId', lessonId)
    form.set('file', prepared.file)
    const result = await client().functions.invoke('lesson-material-file', { body: form })
    if (result.error || !z.object({ ok: z.literal(true) }).safeParse(result.data).success)
      throw new Error('The lesson file could not be attached. Check the draft and try again.')
  } finally {
    if (prepared.previewUrl) URL.revokeObjectURL(prepared.previewUrl)
  }
}
export async function removeLessonFile(lessonId: string, fileId: string) {
  const result = await client().rpc('remove_lesson_file', {
    p_lesson_id: lessonId,
    p_file_id: fileId,
  })
  if (result.error) throw new Error('The file could not be removed from this draft.')
}
export async function getLessonDownload(lessonId: string, fileId: string) {
  const result = await client().functions.invoke('lesson-material-file', {
    body: { lessonId, fileId },
  })
  const parsed = z.object({ path: z.string() }).safeParse(result.data)
  const base = import.meta.env.VITE_SUPABASE_URL,
    path = parsed.success ? parsed.data.path : null
  if (
    result.error ||
    !base ||
    typeof path !== 'string' ||
    !/^\/storage\/v1\/object\/sign\/lesson-materials\/[0-9a-f-]{36}\?/.test(path) ||
    path.includes('#')
  )
    throw new Error(failed)
  const url = new URL(path, base)
  if (url.origin !== new URL(base).origin || !url.searchParams.get('token')) throw new Error(failed)
  return url.toString()
}
