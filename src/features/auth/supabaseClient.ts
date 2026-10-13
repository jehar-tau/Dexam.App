import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null | undefined

export function createEmployeeActivationClient() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!isConfiguredValue(url) || !isConfiguredValue(key)) return null
  return createClient(url!, key!, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  })
}

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
