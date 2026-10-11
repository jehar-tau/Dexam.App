import { getSupabaseClient } from '../auth/supabaseClient'

export type BackendHealth = 'not-configured' | 'operational'

export async function getBackendHealth(): Promise<BackendHealth> {
  const client = getSupabaseClient()
  if (!client) return 'not-configured'

  const response: unknown = await client.rpc('platform_health')
  if (
    !response ||
    typeof response !== 'object' ||
    !('data' in response) ||
    !('error' in response) ||
    response.error ||
    response.data !== 'ok'
  ) {
    throw new Error('The staging backend health check did not complete.')
  }

  return 'operational'
}
