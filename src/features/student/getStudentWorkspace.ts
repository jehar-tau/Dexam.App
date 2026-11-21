import { getSupabaseClient } from '../auth/supabaseClient'

export type StudentEnrollment = {
  activatedAt: string | null
  archiveAvailable: boolean
  approvedAt: string | null
  cohortName: string | null
  enrollmentId: string
  offeringTitle: string
  status: string
}

export type StudentWorkspace = {
  displayName: string | null
  enrollments: StudentEnrollment[]
  memberId: string
}

type ProfileRow = {
  display_name?: unknown
  member_id?: unknown
}

type EnrollmentRow = {
  activated_at?: unknown
  approved_at?: unknown
  cohort_name?: unknown
  enrollment_id?: unknown
  offering_title?: unknown
  access_state?: unknown
  archive_available?: unknown
}

const unavailableMessage = 'Your learning workspace could not be loaded. Please try again.'

function nullableDate(value: unknown) {
  return value === null || typeof value === 'string' ? value : undefined
}

function parseEnrollment(row: EnrollmentRow): StudentEnrollment | null {
  const approvedAt = nullableDate(row.approved_at)
  const activatedAt = nullableDate(row.activated_at)

  if (
    typeof row.enrollment_id !== 'string' ||
    typeof row.access_state !== 'string' ||
    typeof row.offering_title !== 'string' ||
    (row.cohort_name !== null && typeof row.cohort_name !== 'string') ||
    typeof row.archive_available !== 'boolean' ||
    approvedAt === undefined ||
    activatedAt === undefined
  ) {
    return null
  }

  return {
    enrollmentId: row.enrollment_id,
    status: row.access_state,
    archiveAvailable: row.archive_available,
    offeringTitle: row.offering_title,
    cohortName: row.cohort_name,
    approvedAt,
    activatedAt,
  }
}

export async function getStudentWorkspace(): Promise<StudentWorkspace> {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)

  const [profileResult, enrollmentResult] = await Promise.all([
    client.from('people').select('member_id, display_name').single(),
    client.rpc('list_my_student_enrollment_access'),
  ])

  const profile = profileResult.data as ProfileRow | null
  if (
    profileResult.error ||
    !profile ||
    typeof profile.member_id !== 'string' ||
    (profile.display_name !== null && typeof profile.display_name !== 'string') ||
    enrollmentResult.error ||
    !Array.isArray(enrollmentResult.data)
  ) {
    throw new Error(unavailableMessage)
  }

  const enrollments = enrollmentResult.data.map((row) => parseEnrollment(row as EnrollmentRow))
  if (enrollments.some((enrollment) => enrollment === null)) {
    throw new Error(unavailableMessage)
  }

  return {
    memberId: profile.member_id,
    displayName: profile.display_name,
    enrollments: enrollments as StudentEnrollment[],
  }
}
