import { getSupabaseClient } from '../auth/supabaseClient'
import type { PreparedSubmissionFile } from './prepareSubmissionFile'

export type SubmissionFile = {
  byteSize: number
  id: string
  mimeType: string
  name: string
  originalByteSize: number
  position: number
  status: string
  wasCompressed: boolean
}

export type SubmissionAttempt = {
  attemptNumber: number
  files: SubmissionFile[]
  id: string
  status: string
  submittedAt: string | null
  submittedLate: boolean | null
}

export type StudentAssignment = {
  assignedAt: string
  assignmentCode: string
  assignmentVersionId: string
  attempts: SubmissionAttempt[]
  dueAt: string | null
  groupName: string
  id: string
  instructions: string
  releaseStatus: string
  status: string
  title: string
}

type UnknownRow = Record<string, unknown>

const unavailableMessage = 'Your assignments could not be loaded. Please try again.'

function related(value: unknown): UnknownRow | null {
  const candidate: unknown = Array.isArray(value) ? (value as unknown[])[0] : value
  return candidate && typeof candidate === 'object' ? (candidate as UnknownRow) : null
}

function nullableString(value: unknown) {
  return value === null || typeof value === 'string' ? value : undefined
}

function parseFile(value: unknown): SubmissionFile | null {
  if (!value || typeof value !== 'object') return null
  const row = value as UnknownRow
  if (
    typeof row.id !== 'string' ||
    typeof row.original_file_name !== 'string' ||
    typeof row.mime_type !== 'string' ||
    typeof row.byte_size !== 'number' ||
    typeof row.original_byte_size !== 'number' ||
    typeof row.was_compressed !== 'boolean' ||
    typeof row.position !== 'number' ||
    typeof row.status !== 'string'
  )
    return null
  return {
    id: row.id,
    name: row.original_file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    originalByteSize: row.original_byte_size,
    wasCompressed: row.was_compressed,
    position: row.position,
    status: row.status,
  }
}

function parseAttempt(value: unknown): SubmissionAttempt | null {
  if (!value || typeof value !== 'object') return null
  const row = value as UnknownRow
  const submittedAt = nullableString(row.submitted_at)
  const submittedLate = row.submitted_late
  if (
    typeof row.id !== 'string' ||
    typeof row.attempt_number !== 'number' ||
    typeof row.status !== 'string' ||
    submittedAt === undefined ||
    !(submittedLate === null || typeof submittedLate === 'boolean') ||
    !Array.isArray(row.submission_files)
  )
    return null
  const files = row.submission_files.map(parseFile)
  if (files.some((file) => file === null)) return null
  return {
    id: row.id,
    attemptNumber: row.attempt_number,
    status: row.status,
    submittedAt,
    submittedLate,
    files: (files as SubmissionFile[]).sort((a, b) => a.position - b.position),
  }
}

function parseAssignment(value: unknown): StudentAssignment | null {
  if (!value || typeof value !== 'object') return null
  const row = value as UnknownRow
  const release = related(row.assignment_release)
  const version = related(release?.assignment_version)
  const definition = related(version?.assignment_definition)
  const dueAt = nullableString(release?.due_at)
  if (
    typeof row.id !== 'string' ||
    typeof row.status !== 'string' ||
    typeof row.assigned_at !== 'string' ||
    !release ||
    typeof release.status !== 'string' ||
    !version ||
    typeof version.id !== 'string' ||
    typeof version.group_name !== 'string' ||
    typeof version.title !== 'string' ||
    typeof version.instructions !== 'string' ||
    !definition ||
    typeof definition.code !== 'string' ||
    dueAt === undefined ||
    !Array.isArray(row.submission_attempts)
  )
    return null
  const attempts = row.submission_attempts.map(parseAttempt)
  if (attempts.some((attempt) => attempt === null)) return null
  return {
    id: row.id,
    status: row.status,
    assignedAt: row.assigned_at,
    releaseStatus: release.status,
    dueAt,
    assignmentVersionId: version.id,
    assignmentCode: definition.code,
    groupName: version.group_name,
    title: version.title,
    instructions: version.instructions,
    attempts: (attempts as SubmissionAttempt[]).sort((a, b) => b.attemptNumber - a.attemptNumber),
  }
}

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

export async function getStudentAssignments(): Promise<StudentAssignment[]> {
  const result = await clientOrThrow()
    .from('student_assignment_instances')
    .select(
      `
      id, status, assigned_at,
      assignment_release:assignment_releases!inner(
        due_at, status,
        assignment_version:assignment_versions!inner(
          id, group_name, title, instructions,
          assignment_definition:assignment_definitions!inner(code)
        )
      ),
      submission_attempts(
        id, attempt_number, status, submitted_at, submitted_late,
        submission_files(
          id, original_file_name, mime_type, byte_size, original_byte_size,
          was_compressed, position, status
        )
      )
    `,
    )
    .order('assigned_at', { ascending: false })

  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  const assignments = result.data.map(parseAssignment)
  if (assignments.some((assignment) => assignment === null)) throw new Error(unavailableMessage)
  return assignments as StudentAssignment[]
}

export async function startStudentAssignmentAttempt(instanceId: string) {
  const result = await clientOrThrow().rpc('start_assignment_attempt', {
    p_assignment_instance_id: instanceId,
  })
  if (result.error || typeof result.data !== 'string') {
    throw new Error('A submission attempt could not be started. Please try again.')
  }
  return result.data
}

export async function uploadStudentSubmissionFile(
  attemptId: string,
  prepared: PreparedSubmissionFile,
) {
  const form = new FormData()
  form.set('attemptId', attemptId)
  form.set('originalFileName', prepared.originalFileName)
  form.set('originalByteSize', String(prepared.originalByteSize))
  form.set('wasCompressed', String(prepared.wasCompressed))
  if (prepared.pixelWidth !== null) form.set('pixelWidth', String(prepared.pixelWidth))
  if (prepared.pixelHeight !== null) form.set('pixelHeight', String(prepared.pixelHeight))
  form.set('file', prepared.file)

  const result = await clientOrThrow().functions.invoke('student-submission-file', { body: form })
  if (result.error) throw new Error('The file could not be uploaded. Please try again.')
}

export async function removeStudentSubmissionFile(fileId: string) {
  const result = await clientOrThrow().functions.invoke('student-submission-file', {
    body: { fileId },
    method: 'DELETE',
  })
  if (result.error) throw new Error('The file could not be removed. Please try again.')
}

export async function finalizeStudentAssignmentAttempt(attemptId: string) {
  const result = await clientOrThrow().rpc('finalize_submission_attempt', {
    p_submission_attempt_id: attemptId,
  })
  if (result.error) throw new Error('The assignment could not be submitted. Please try again.')
}
