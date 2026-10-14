import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
const rowSchema = z.object({
  enrollment_id: z.string().uuid(),
  member_id: z.string(),
  display_name: z.string().nullable(),
  offering_title: z.string(),
  cohort_name: z.string().nullable(),
  status: z.enum(['active', 'completed', 'withdrawn']),
  ended_at: z.string().nullable(),
})
export type CloseoutEnrollment = z.infer<typeof rowSchema>
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error('Enrolment closeout is not configured.')
  return value
}
export async function listEnrollmentCloseouts(search: string) {
  const result = await client().rpc('list_enrollment_closeout_queue', { p_search: search.trim() })
  const parsed = z.array(rowSchema).safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error('Enrolments could not be loaded. Check your current access and retry.')
  return parsed.data
}
export async function closeEnrollment(
  enrollmentId: string,
  outcome: 'completed' | 'withdrawn',
  confirmed: boolean,
  requestKey: string,
) {
  const result = await client().rpc('close_enrollment', {
    p_enrollment_id: enrollmentId,
    p_outcome: outcome,
    p_reason_code: outcome === 'completed' ? 'course_completed' : 'student_withdrew',
    p_confirmed: confirmed,
    p_request_key: requestKey,
  })
  const parsed = z.string().datetime({ offset: true }).safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error(
      'Closeout was not confirmed. Refresh current state before retrying; no access restoration is available here.',
    )
  return parsed.data
}
