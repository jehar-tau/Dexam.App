import { z } from 'zod'
import { getSupabaseClient } from './supabaseClient'
import { captureAccountOperation } from './accountOperation'
const row = z.object({
  recovery_kind: z.enum(['employee', 'student']),
  request_id: z.string().uuid(),
  target_person_id: z.string().uuid(),
  display_name: z.string().nullable(),
  member_id: z.string().nullable(),
  request_created_at: z.string(),
  execution_started_at: z.string().nullable(),
  incident_id: z.string().uuid().nullable(),
  proposer_person_id: z.string().uuid().nullable(),
  reviewer_person_id: z.string().uuid().nullable(),
  incident_status: z.enum(['pending', 'reviewed']).nullable(),
  review_is_current: z.boolean(),
})
function client() {
  const c = getSupabaseClient()
  if (!c) throw new Error('Recovery incident review is not configured.')
  return c
}
export async function getRecoveryIncidents() {
  const c = client(),
    guard = await captureAccountOperation(c)
  try {
    const permission = await guard.client.rpc('current_person_can_manage_staff_security')
    guard.assertCurrent()
    if (permission.error || permission.data !== true)
      throw new Error('Recent Elevated Admin verification required.')
    const [queue, person] = await Promise.all([
      guard.client.rpc('list_recovery_incidents'),
      guard.client.rpc('current_person_id'),
    ])
    guard.assertCurrent()
    const rows = z.array(row).safeParse(queue.data),
      actor = z.string().uuid().safeParse(person.data)
    if (queue.error || person.error || !rows.success || !actor.success)
      throw new Error('Incident queue could not be verified.')
    return { incidents: rows.data, actorPersonId: actor.data }
  } finally {
    guard.dispose()
  }
}
export async function openRecoveryIncident(
  kind: 'employee' | 'student',
  requestId: string,
  acknowledged: boolean,
) {
  const guard = await captureAccountOperation(client())
  try {
    guard.assertCurrent()
    const result = await guard.client.rpc('open_recovery_incident', {
      p_kind: kind,
      p_request_id: requestId,
      p_reason_code: 'uncertain_password_update',
      p_fence_acknowledged: acknowledged,
    })
    guard.assertCurrent()
    if (result.error)
      throw new Error(
        'Incident could not be opened. Refresh current state and verify your authority.',
      )
  } finally {
    guard.dispose()
  }
}
export async function reviewRecoveryIncident(incidentId: string, acknowledged: boolean) {
  const guard = await captureAccountOperation(client())
  try {
    guard.assertCurrent()
    const result = await guard.client.rpc('review_recovery_incident', {
      p_incident_id: incidentId,
      p_fence_acknowledged: acknowledged,
    })
    guard.assertCurrent()
    if (result.error)
      throw new Error(
        'Independent review unavailable. Check current authority, request state and the other administrator’s verification.',
      )
  } finally {
    guard.dispose()
  }
}
