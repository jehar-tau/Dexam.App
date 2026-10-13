import { z } from 'zod'
import { getSupabaseClient } from './supabaseClient'

const invitationSchema = z.object({
  id: z.string().uuid(),
  person_id: z.string().uuid(),
  display_name: z.string().nullable(),
  masked_email: z.string(),
  status: z.enum(['pending', 'delivering', 'delivered', 'accepted', 'cancelled', 'failed']),
  expires_at: z.string().datetime({ offset: true }),
})
const personSchema = z.object({
  person_id: z.string().uuid(),
  display_name: z.string().nullable(),
  has_employee_identity: z.boolean(),
  employee_status: z.string().nullable(),
})
export type InvitationPerson = z.infer<typeof personSchema>
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error('Employee invitations are not configured.')
  return value
}
export async function getEmployeeInvitationWorkspace() {
  const permission = await client().rpc('current_person_can_invite_employees')
  if (permission.error) throw new Error('Invitation access could not be verified.')
  if (permission.data !== true)
    return { authorized: false, invitations: [] as z.infer<typeof invitationSchema>[] }
  const result = await client().rpc('list_employee_invitations')
  const parsed = z.array(invitationSchema).safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error('Invitations could not be loaded. Verify MFA again and retry.')
  return { authorized: true, invitations: parsed.data }
}
export async function searchInvitationPeople(search: string) {
  const result = await client().rpc('search_employee_invitation_people', {
    p_search: search.trim(),
  })
  const parsed = z.array(personSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error('Duplicate review could not be loaded.')
  return parsed.data
}
export async function prepareEmployeeInvitation(
  personId: string | null,
  name: string,
  email: string,
  reviewed: boolean,
) {
  const result = await client().rpc('prepare_employee_invitation', {
    p_person_id: personId,
    p_display_name: personId ? null : name.trim(),
    p_email: email.trim().toLowerCase(),
    p_duplicates_reviewed: reviewed,
  })
  const parsed = z.string().uuid().safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error(
      'Invitation could not be prepared. Check duplicates, employee status, unchanged email, and the one-minute reissue cooldown.',
    )
  return parsed.data
}
export async function deliverEmployeeInvitation(requestId: string) {
  const result = await client().functions.invoke('staff-employee-invite', { body: { requestId } })
  if (result.error)
    throw new Error(
      'Delivery did not confirm completion. Refresh the queue before retrying. Hosted email delivery remains disabled.',
    )
}
export async function cancelEmployeeInvitation(requestId: string) {
  const result = await client().rpc('cancel_employee_invitation', { p_request_id: requestId })
  if (result.error)
    throw new Error('Cancellation could not be confirmed. Refresh and verify MFA again.')
}
