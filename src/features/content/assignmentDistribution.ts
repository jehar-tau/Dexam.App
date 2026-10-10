import { getSupabaseClient } from '../auth/supabaseClient'

export type DistributionOffering = { id: string; title: string }
export type DistributionCohort = { id: string; name: string; offeringId: string }
export type DistributionAssignment = {
  code: string
  groupName: string
  id: string
  offeringId: string
  title: string
  versionNumber: number
}
export type DistributionTarget = {
  cohortId: string | null
  cohortName: string | null
  displayName: string | null
  enrollmentId: string
  memberId: string
}
export type AssignmentRelease = {
  assignmentVersionId: string
  dueAt: string | null
  id: string
  offeringId: string
  releaseNote: string
  releasedAt: string
  status: string
  targetKind: string
}
export type AssignmentDistributionWorkspace = {
  assignments: DistributionAssignment[]
  cohorts: DistributionCohort[]
  offerings: DistributionOffering[]
  releases: AssignmentRelease[]
}

type Row = Record<string, unknown>
const unavailableMessage =
  'Assignment distribution could not be loaded. Check your access and try again.'

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function rows(value: unknown) {
  if (!Array.isArray(value)) throw new Error(unavailableMessage)
  return value as Row[]
}

function text(value: unknown) {
  if (typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function nullableText(value: unknown) {
  if (value === null || typeof value === 'string') return value
  throw new Error(unavailableMessage)
}

function relation(value: unknown) {
  const candidate: unknown = Array.isArray(value) ? (value as unknown[])[0] : value
  if (!candidate || typeof candidate !== 'object') throw new Error(unavailableMessage)
  return candidate as Row
}

export async function getAssignmentDistributionWorkspace(): Promise<AssignmentDistributionWorkspace> {
  const client = clientOrThrow()
  const [offeringResult, cohortResult, assignmentResult, releaseResult] = await Promise.all([
    client.from('offerings').select('id, title').order('title'),
    client.from('cohorts').select('id, offering_id, name').eq('status', 'active').order('name'),
    client
      .from('assignment_versions')
      .select(
        'id, version_number, group_name, title, assignment_definition:assignment_definitions!inner(offering_id, code)',
      )
      .eq('status', 'published')
      .order('published_at', { ascending: false }),
    client
      .from('assignment_releases')
      .select(
        'id, assignment_version_id, offering_id, target_kind, due_at, status, release_note, released_at',
      )
      .order('released_at', { ascending: false }),
  ])
  if (offeringResult.error || cohortResult.error || assignmentResult.error || releaseResult.error) {
    throw new Error(unavailableMessage)
  }

  return {
    offerings: rows(offeringResult.data).map((row) => ({
      id: text(row.id),
      title: text(row.title),
    })),
    cohorts: rows(cohortResult.data).map((row) => ({
      id: text(row.id),
      offeringId: text(row.offering_id),
      name: text(row.name),
    })),
    assignments: rows(assignmentResult.data).map((row) => {
      const definition = relation(row.assignment_definition)
      if (typeof row.version_number !== 'number') throw new Error(unavailableMessage)
      return {
        id: text(row.id),
        offeringId: text(definition.offering_id),
        code: text(definition.code),
        versionNumber: row.version_number,
        groupName: text(row.group_name),
        title: text(row.title),
      }
    }),
    releases: rows(releaseResult.data).map((row) => ({
      id: text(row.id),
      assignmentVersionId: text(row.assignment_version_id),
      offeringId: text(row.offering_id),
      targetKind: text(row.target_kind),
      dueAt: nullableText(row.due_at),
      status: text(row.status),
      releaseNote: text(row.release_note),
      releasedAt: text(row.released_at),
    })),
  }
}

export async function getAssignmentDistributionTargets(
  offeringId: string,
): Promise<DistributionTarget[]> {
  const result = await clientOrThrow().rpc('list_assignment_distribution_targets', {
    p_offering_id: offeringId,
  })
  if (result.error) throw new Error(unavailableMessage)
  return rows(result.data).map((row) => ({
    enrollmentId: text(row.enrollment_id),
    memberId: text(row.member_id),
    displayName: nullableText(row.display_name),
    cohortId: nullableText(row.cohort_id),
    cohortName: nullableText(row.cohort_name),
  }))
}

export async function distributeAssignment(input: {
  assignmentVersionId: string
  cohortId: string | null
  dueAt: string | null
  enrollmentIds: string[]
  releaseNote: string
  requestKey: string
}) {
  const result = await clientOrThrow().rpc('distribute_assignment_version', {
    p_assignment_version_id: input.assignmentVersionId,
    p_cohort_id: input.cohortId,
    p_enrollment_ids: input.enrollmentIds.length > 0 ? input.enrollmentIds : null,
    p_due_at: input.dueAt,
    p_release_note: input.releaseNote.trim(),
    p_request_key: input.requestKey,
  })
  if (result.error || typeof result.data !== 'string') {
    throw new Error('The assignment could not be released. Check the targets and try again.')
  }
  return result.data
}
