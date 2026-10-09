import { getSupabaseClient } from '../auth/supabaseClient'

export type StudentEnrollment = {
  activatedAt: string | null
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
  cohort?: unknown
  id?: unknown
  offering?: unknown
  status?: unknown
}

const unavailableMessage = 'Your learning workspace could not be loaded. Please try again.'

function relatedText(value: unknown, key: string, nullable = false) {
  if (nullable && value === null) return null
  if (!value || typeof value !== 'object') return undefined
  const text = (value as Record<string, unknown>)[key]
  return typeof text === 'string' ? text : undefined
}

function nullableDate(value: unknown) {
  return value === null || typeof value === 'string' ? value : undefined
}

function parseEnrollment(row: EnrollmentRow): StudentEnrollment | null {
  const offeringTitle = relatedText(row.offering, 'title')
  const cohortName = relatedText(row.cohort, 'name', true)
  const approvedAt = nullableDate(row.approved_at)
  const activatedAt = nullableDate(row.activated_at)

  if (
    typeof row.id !== 'string' ||
    typeof row.status !== 'string' ||
    typeof offeringTitle !== 'string' ||
    cohortName === undefined ||
    approvedAt === undefined ||
    activatedAt === undefined
  ) {
    return null
  }

  return {
    enrollmentId: row.id,
    status: row.status,
    offeringTitle,
    cohortName,
    approvedAt,
    activatedAt,
  }
}

export async function getStudentWorkspace(): Promise<StudentWorkspace> {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)

  const [profileResult, enrollmentResult] = await Promise.all([
    client.from('people').select('member_id, display_name').single(),
    client
      .from('enrollments')
      .select(
        'id, status, approved_at, activated_at, offering:offerings(title), cohort:cohorts(name)',
      )
      .order('created_at', { ascending: false }),
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
