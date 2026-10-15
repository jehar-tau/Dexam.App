import { z } from 'zod'
import { getSupabaseClient } from './supabaseClient'

export const navigationSchema = z.strictObject({
  student: z.boolean(),
  employee: z.boolean(),
  crm: z.boolean(),
  crmAssignments: z.boolean(),
  privacy: z.boolean(),
  enrolments: z.boolean(),
  content: z.boolean(),
  distribution: z.boolean(),
  reviews: z.boolean(),
  closeout: z.boolean(),
  classes: z.boolean(),
  curriculumImpact: z.boolean(),
  employees: z.boolean(),
  studentRecovery: z.boolean(),
  staffRecovery: z.boolean(),
})
export type NavigationAccess = z.infer<typeof navigationSchema>
export async function getNavigationAccess() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Navigation access could not be verified.')
  const result = await client.rpc('get_my_navigation_access'),
    parsed = navigationSchema.safeParse(result.data)
  if (result.error || !parsed.success) throw new Error('Navigation access could not be verified.')
  return parsed.data
}
