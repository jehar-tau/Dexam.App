import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'

const courseSchema = z.object({
  enrollmentId: z.uuid(),
  offeringTitle: z.string(),
  readOnly: z.boolean(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  topics: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      sectionTitle: z.string(),
      markedAt: z.iso.datetime({ offset: true }).nullable(),
    }),
  ),
})
export type StudyChecklistCourse = z.infer<typeof courseSchema>
const unavailable = 'Your private study checklist could not be loaded.'
export async function getStudyChecklist(): Promise<StudyChecklistCourse[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailable)
  const result = await client.rpc('list_student_topic_checklist')
  const parsed = z.array(courseSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data
}
export async function setTopicStudied(enrollmentId: string, topicId: string, studied: boolean) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Your study choice could not be saved.')
  const result = await client.rpc('set_student_topic_mark', {
    p_enrollment_id: enrollmentId,
    p_topic_id: topicId,
    p_studied: studied,
  })
  if (result.error)
    throw new Error('Your study choice could not be saved. Your course access may have changed.')
}
