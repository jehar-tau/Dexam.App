import { getSupabaseClient } from '../auth/supabaseClient'

export type ActivationQueueItem = {
  approvedAt: string
  cohortName: string | null
  displayName: string
  enrollmentId: string
  memberId: string
  offeringTitle: string
  requestedAt: string
  sourceType: string
}

type ActivationQueueRow = {
  approved_at?: unknown
  cohort_name?: unknown
  enrollment_id?: unknown
  member_id?: unknown
  offering_title?: unknown
  requested_at?: unknown
  source_type?: unknown
  student_display_name?: unknown
}

const unavailableMessage =
  'The activation queue could not be loaded. Check your access and try again.'

function parseRow(row: ActivationQueueRow): ActivationQueueItem | null {
  if (
    typeof row.enrollment_id !== 'string' ||
    typeof row.member_id !== 'string' ||
    typeof row.student_display_name !== 'string' ||
    typeof row.offering_title !== 'string' ||
    (row.cohort_name !== null && typeof row.cohort_name !== 'string') ||
    typeof row.source_type !== 'string' ||
    typeof row.requested_at !== 'string' ||
    typeof row.approved_at !== 'string'
  ) {
    return null
  }

  return {
    enrollmentId: row.enrollment_id,
    memberId: row.member_id,
    displayName: row.student_display_name,
    offeringTitle: row.offering_title,
    cohortName: row.cohort_name,
    sourceType: row.source_type,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at,
  }
}

export async function listActivationQueue(limit = 25, search = ''): Promise<ActivationQueueItem[]> {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)

  const result = await client.rpc('list_student_activation_queue', {
    p_limit: limit,
    p_search: search.trim() || null,
  })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)

  const parsed = result.data.map((row) => parseRow(row as ActivationQueueRow))
  if (parsed.some((row) => row === null)) throw new Error(unavailableMessage)

  return parsed as ActivationQueueItem[]
}
