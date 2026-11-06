import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'

// D-067/F056: the Dexam App Google sign-in list. Sales and admins add; admins revoke.
const rowSchema = z.object({
  person_id: z.uuid(),
  member_id: z.string().nullable(),
  display_name: z.string(),
  email: z.string().nullable(),
  state: z.enum(['none', 'approved', 'revoked']),
  linked: z.boolean(),
  revision: z.number().int().positive().nullable(),
  revoked_at: z.iso.datetime({ offset: true }).nullable(),
  admission_paid: z.boolean(),
})
export type StudentGoogleLogin = {
  personId: string
  memberId: string | null
  displayName: string
  email: string | null
  state: 'none' | 'approved' | 'revoked'
  linked: boolean
  revision: number | null
  revokedAt: string | null
  admissionPaid: boolean
}

const unavailable = 'The Google sign-in list could not be loaded. Check your access and try again.'
function clientOrThrow(message: string) {
  const client = getSupabaseClient()
  if (!client) throw new Error(message)
  return client
}

export async function getStudentGoogleLogins(search: string): Promise<StudentGoogleLogin[]> {
  const result = await clientOrThrow(unavailable).rpc('list_student_google_logins', {
    p_search: search.trim(),
  })
  const parsed = z.array(rowSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({
    personId: row.person_id,
    memberId: row.member_id,
    displayName: row.display_name,
    email: row.email,
    state: row.state,
    linked: row.linked,
    revision: row.revision,
    revokedAt: row.revoked_at,
    admissionPaid: row.admission_paid,
  }))
}

const approveMessages: Record<string, string> = {
  '42501': 'Your account cannot add this student. Only an admin can restore a revoked login.',
  '23505': 'That Google email is already listed for another person.',
  '40001': 'This request was already used. Reload and review.',
}
export async function approveStudentGoogleLogin(input: {
  requestKey: string
  personId: string
  email: string
  reason: string
}) {
  const result = await clientOrThrow('The Google email could not be added.').rpc(
    'approve_student_google_login',
    {
      p_request_key: input.requestKey,
      p_person_id: input.personId,
      p_email: input.email,
      p_reason: input.reason,
    },
  )
  if (result.error || typeof result.data !== 'number') {
    const code = result.error?.code ?? ''
    throw new Error(
      approveMessages[code] ??
        (code === '22023' && result.error?.message
          ? `Not added: ${result.error.message}.`
          : 'The Google email could not be added.'),
    )
  }
}

const revokeMessages: Record<string, string> = {
  '42501': 'Only an admin with a current two-step verified session can revoke Google sign-in.',
  '40001': 'This student’s Google sign-in changed since you opened the list. Reload and review.',
  '22023': 'There is no approved Google sign-in to revoke.',
}
export async function revokeStudentGoogleLogin(input: {
  requestKey: string
  personId: string
  expectedRevision: number
  reason: string
}) {
  const result = await clientOrThrow('Google sign-in could not be revoked.').rpc(
    'revoke_student_google_login',
    {
      p_request_key: input.requestKey,
      p_person_id: input.personId,
      p_expected_revision: input.expectedRevision,
      p_reason: input.reason,
    },
  )
  if (result.error || typeof result.data !== 'number')
    throw new Error(
      revokeMessages[result.error?.code ?? ''] ?? 'Google sign-in could not be revoked.',
    )
}
