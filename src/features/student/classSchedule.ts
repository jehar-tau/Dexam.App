import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
const timestamp = z.iso.datetime({ offset: true })
export const classSchema = z.object({
  id: z.uuid(),
  offering_id: z.uuid(),
  cohort_id: z.uuid().nullable(),
  title: z.string(),
  starts_at: timestamp,
  ends_at: timestamp,
  timezone: z.string(),
  location: z.string().nullable(),
  revision: z.number().int().positive(),
  cancelled_at: timestamp.nullable(),
  retention_until: timestamp,
})
export type ScheduledClass = z.infer<typeof classSchema>
const contextSchema = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    cohorts: z.array(z.object({ id: z.uuid(), name: z.string() })),
    sessions: z.array(classSchema),
  }),
)
export async function getClassSchedule(staff: boolean) {
  const client = getSupabaseClient()
  if (!client) throw new Error('Your class schedule could not be loaded.')
  const result = await client.rpc(staff ? 'list_class_scheduling_context' : 'list_my_class_agenda')
  const parsed = (staff ? contextSchema : z.array(classSchema)).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error('Your class schedule could not be loaded.')
  return parsed.data
}
export async function getSchedulingContext() {
  return contextSchema.parse(await getClassSchedule(true))
}
export async function getStudentAgenda() {
  return z.array(classSchema).parse(await getClassSchedule(false))
}
export async function saveClass(args: Record<string, unknown>) {
  const client = getSupabaseClient()
  if (!client) throw new Error('The class change could not be saved.')
  const result = await client.rpc('save_class_session', args)
  if (result.error || !z.uuid().safeParse(result.data).success)
    throw new Error(
      'The class change could not be saved. Check current access and reload before retrying a changed class.',
    )
}
