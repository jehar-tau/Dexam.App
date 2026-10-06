import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null | undefined

function isConfiguredValue(value: string | undefined) {
  return Boolean(value && !value.startsWith('replace-with-'))
}

export function getSupabaseClient() {
  if (browserClient !== undefined) return browserClient

  const url = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!isConfiguredValue(url) || !isConfiguredValue(publishableKey)) {
    browserClient = null
    return browserClient
  }

  browserClient = createClient(url!, publishableKey!, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  })

  return browserClient
}
