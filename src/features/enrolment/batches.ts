import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'

// D-066/F055: batches are delivery cohorts. Dates are staff-only and read through these RPCs.
const timestamp = z.iso.datetime({ offset: true })
export const batchStatuses = ['active', 'completed', 'cancelled'] as const
const workspaceSchema = z.object({
  canManage: z.boolean(),
  serviceTypes: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      defaultDurationDays: z.number().int().positive(),
    }),
  ),
  offerings: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      canAssign: z.boolean(),
      // D-068: the admin-set course length, when present, pre-fills a new batch's end date.
      durationDays: z.number().int().positive().nullable(),
    }),
  ),
  batches: z.array(
    z.object({
      id: z.uuid(),
      offeringId: z.uuid(),
      code: z.string(),
      name: z.string(),
      serviceType: z.string().nullable(),
      status: z.enum(['planned', ...batchStatuses]),
      startsAt: timestamp.nullable(),
      endsAt: timestamp.nullable(),
      revision: z.number().int().positive(),
      studentCount: z.number().int().nonnegative(),
    }),
  ),
})
const studentSchema = z.array(
  z.object({
    enrollment_id: z.uuid(),
    member_id: z.string(),
    display_name: z.string(),
    cohort_id: z.uuid().nullable(),
    movable: z.boolean(),
  }),
)
export type BatchWorkspace = z.infer<typeof workspaceSchema>
export type Batch = BatchWorkspace['batches'][number]
export type BatchStudent = {
  enrollmentId: string
  memberId: string
  displayName: string
  batchId: string | null
  movable: boolean
}
export type BatchDraft = {
  requestKey: string
  batchId: string | null
  expectedRevision: number | null
  offeringId: string
  name: string
  serviceType: string
  startsOn: string
  endsOn: string
  status: (typeof batchStatuses)[number]
}

const unavailable = 'Batches could not be loaded. Check your access and try again.'
function clientOrThrow(message: string) {
  const client = getSupabaseClient()
  if (!client) throw new Error(message)
  return client
}

/** Calendar dates are Dexam's operating day (India Standard Time), stored as that midnight. */
export function istMidnight(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Enter a valid date.')
  const value = `${date}T00:00:00+05:30`
  if (Number.isNaN(Date.parse(value))) throw new Error('Enter a valid date.')
  return value
}
export function istDate(timestampValue: string) {
  return new Date(Date.parse(timestampValue) + 330 * 60_000).toISOString().slice(0, 10)
}
export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export async function getBatchWorkspace(): Promise<BatchWorkspace> {
  const result = await clientOrThrow(unavailable).rpc('get_batch_workspace')
  const parsed = workspaceSchema.safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data
}

export async function getBatchStudents(offeringId: string): Promise<BatchStudent[]> {
  const result = await clientOrThrow(unavailable).rpc('list_batch_students', {
    p_offering_id: offeringId,
  })
  const parsed = studentSchema.safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({
    enrollmentId: row.enrollment_id,
    memberId: row.member_id,
    displayName: row.display_name,
    batchId: row.cohort_id,
    movable: row.movable,
  }))
}

const saveMessages: Record<string, string> = {
  '40001': 'This batch changed since you opened it. Reload and review before saving again.',
  '42501': 'Your account cannot create or edit batches.',
  '22023': 'Enter a name, service type, start date and a later end date.',
}
export async function saveBatch(draft: BatchDraft) {
  const result = await clientOrThrow('The batch could not be saved.').rpc('save_batch', {
    p_request_key: draft.requestKey,
    p_cohort_id: draft.batchId,
    p_expected_revision: draft.expectedRevision,
    p_offering_id: draft.offeringId,
    p_name: draft.name,
    p_service_type: draft.serviceType,
    p_starts_at: istMidnight(draft.startsOn),
    p_ends_at: istMidnight(draft.endsOn),
    p_status: draft.status,
  })
  if (result.error || !z.uuid().safeParse(result.data).success)
    throw new Error(saveMessages[result.error?.code ?? ''] ?? 'The batch could not be saved.')
}

const assignMessages: Record<string, string> = {
  '40001': 'This student’s batch changed since you opened the list. Reload and review.',
  '42501': 'Your account cannot place students in batches for this course.',
  '23505': 'This student already has an open enrolment in that batch.',
  '55000': 'Only current enrolments can change batch.',
}
export async function assignStudentBatch(input: {
  requestKey: string
  enrollmentId: string
  expectedBatchId: string | null
  batchId: string
  reason: string
}) {
  const result = await clientOrThrow('The batch change could not be saved.').rpc(
    'assign_student_batch',
    {
      p_request_key: input.requestKey,
      p_enrollment_id: input.enrollmentId,
      p_expected_cohort_id: input.expectedBatchId,
      p_cohort_id: input.batchId,
      p_reason: input.reason,
    },
  )
  if (result.error || !z.uuid().safeParse(result.data).success) {
    const code = result.error?.code ?? ''
    throw new Error(
      assignMessages[code] ??
        (code === '22023' && result.error?.message
          ? `The batch change was refused: ${result.error.message}.`
          : 'The batch change could not be saved.'),
    )
  }
}
