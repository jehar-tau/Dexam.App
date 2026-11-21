import { navigationSchema } from './navigationSchema'
import { getSupabaseClient } from './supabaseClient'

export { navigationSchema, type NavigationAccess } from './navigationSchema'

export async function getNavigationAccess() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Navigation access could not be verified.')
  const result = await client.rpc('get_my_navigation_access'),
    parsed = navigationSchema.safeParse(result.data)
  if (result.error || !parsed.success) throw new Error('Navigation access could not be verified.')
  return parsed.data
}
