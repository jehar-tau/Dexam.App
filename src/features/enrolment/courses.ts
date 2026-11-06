import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'

// D-068/F057: admins add courses and set their length and fees.
export const courseStatuses = ['draft', 'active', 'archived'] as const
export type CourseStatus = (typeof courseStatuses)[number]
const courseSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  title: z.string(),
  status: z.enum(courseStatuses),
  duration_days: z.number().int().positive().nullable(),
  total_fee_paise: z.number().int().nonnegative().nullable(),
  admission_fee_paise: z.number().int().nonnegative().nullable(),
  revision: z.number().int().positive(),
  open_enrolments: z.number().int().nonnegative(),
})
export type Course = {
  id: string
  code: string
  title: string
  status: CourseStatus
  durationDays: number | null
  totalFeePaise: number | null
  admissionFeePaise: number | null
  revision: number
  openEnrolments: number
}

const unavailable = 'Courses could not be loaded. Check your access and try again.'
export async function getCourses(): Promise<Course[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailable)
  const result = await client.rpc('list_courses')
  const parsed = z.array(courseSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status,
    durationDays: row.duration_days,
    totalFeePaise: row.total_fee_paise,
    admissionFeePaise: row.admission_fee_paise,
    revision: row.revision,
    openEnrolments: row.open_enrolments,
  }))
}

const saveMessages: Record<string, string> = {
  '42501': 'Only an admin can change courses.',
  '40001': 'This course changed since you opened it. Reload and review.',
  '23505': 'A course with that code already exists.',
  '55000': 'Close or move every open enrolment before taking this course out of active.',
}
export async function saveCourse(input: {
  requestKey: string
  courseId: string | null
  expectedRevision: number | null
  code: string
  title: string
  status: CourseStatus
  durationDays: number | null
  totalFeePaise: number | null
  admissionFeePaise: number | null
  reason: string
}) {
  const client = getSupabaseClient()
  if (!client) throw new Error('The course could not be saved.')
  const result = await client.rpc('save_course', {
    p_request_key: input.requestKey,
    p_offering_id: input.courseId,
    p_expected_revision: input.expectedRevision,
    p_code: input.courseId ? null : input.code,
    p_title: input.title,
    p_status: input.status,
    p_duration_days: input.durationDays,
    p_total_fee_paise: input.totalFeePaise,
    p_admission_fee_paise: input.admissionFeePaise,
    p_reason: input.reason,
  })
  if (result.error || typeof result.data !== 'string') {
    const code = result.error?.code ?? ''
    throw new Error(
      saveMessages[code] ??
        (code === '22023' && result.error?.message
          ? `Not saved: ${result.error.message}.`
          : 'The course could not be saved.'),
    )
  }
  return result.data
}
