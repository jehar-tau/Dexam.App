import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
const count = z.number().int().nonnegative()
const version = z.object({ id: z.uuid(), title: z.string(), number: count })
const context = z.array(z.object({ id: z.uuid(), title: z.string(), versions: z.array(version) }))
export const reportSchema = z.object({
  sourceId: z.uuid(),
  targetId: z.uuid(),
  affected: z.object({ direct: count, cohort: count, total: count }),
  counts: z.object({ added: count, removed: count, changed: count, total: count }),
  truncated: z.boolean(),
  differences: z
    .array(
      z.object({
        kind: z.enum(['topic', 'lesson', 'material']),
        code: z.string(),
        title: z.string(),
        change: z.enum(['added', 'removed', 'changed']),
      }),
    )
    .max(100),
})
export type CurriculumImpact = z.infer<typeof reportSchema>
function client() {
  const value = getSupabaseClient()
  if (!value) throw new Error('Curriculum preview is not available.')
  return value
}
export async function getCurriculumPreviewContext() {
  const result = await client().rpc('list_curriculum_preview_context')
  const parsed = context.safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error('Curriculum preview access could not be verified.')
  return parsed.data
}
export async function getCurriculumImpact(offeringId: string, sourceId: string, targetId: string) {
  const result = await client().rpc('preview_curriculum_upgrade', {
    p_offering_id: offeringId,
    p_source_id: sourceId,
    p_target_id: targetId,
  })
  const parsed = reportSchema.safeParse(result.data)
  if (result.error || !parsed.success)
    throw new Error('The comparison could not be verified. Check your current access and versions.')
  return parsed.data
}
