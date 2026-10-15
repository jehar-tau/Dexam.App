import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** Fence an operation against intervening authentication changes, not token renewal. */
export function watchAccountChanges(client: SupabaseClient) {
  let changed = false
  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((event) => {
    if (event !== 'INITIAL_SESSION' && event !== 'TOKEN_REFRESHED') changed = true
  })
  return {
    assertCurrent() {
      if (changed) throw new Error('Your session changed. Start the operation again.')
    },
    dispose: () => subscription.unsubscribe(),
  }
}

/** Pin multi-step writes to their starting JWT; never borrow a replacement account's auth. */
export async function captureAccountOperation(client: SupabaseClient) {
  const guard = watchAccountChanges(client)
  try {
    const { data, error } = await client.auth.getSession()
    guard.assertCurrent()
    if (error || !data.session) throw new Error('A current session is required.')
    const url = import.meta.env.VITE_SUPABASE_URL,
      key = import.meta.env.VITE_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('This operation is not configured.')
    const bound = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    return { ...guard, client: bound }
  } catch (error) {
    guard.dispose()
    throw error
  }
}
