import { getSupabaseClient } from './supabaseClient'
import { captureAccountOperation } from './accountOperation'

export function safeGoogleReturnTo(value: string | null): string {
  if (
    !value ||
    value.includes('\\') ||
    value.includes('#') ||
    [...value].some((character) => character.charCodeAt(0) <= 32) ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return '/student'
  const url = new URL(value, 'https://dexam.invalid')
  if (
    url.origin !== 'https://dexam.invalid' ||
    !['/student', '/teacher', '/staff', '/admin', '/tests'].some(
      (root) => url.pathname === root || url.pathname.startsWith(`${root}/`),
    )
  )
    return '/student'
  return url.pathname + url.search
}
export function sharedGoogleEnabled() {
  return import.meta.env.VITE_ENABLE_SHARED_GOOGLE_LOGIN === 'true'
}
export async function startPortalGoogleLogin(returnTo: string) {
  const client = getSupabaseClient()
  if (!client || !sharedGoogleEnabled())
    throw new Error('Shared Google sign-in is not enabled in this environment.')
  const redirectTo = new URL('/auth/google', window.location.origin)
  redirectTo.searchParams.set('returnTo', safeGoogleReturnTo(returnTo))
  const result = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      scopes: 'openid email profile',
      redirectTo: redirectTo.toString(),
    },
  })
  if (result.error)
    throw new Error(
      'Google sign-in could not start. Your existing password sign-in remains available.',
    )
}
const notListed =
  'This Google account is not on the Dexam App student list. Ask Dexam sales or an admin to add the Google email you paid with. Your Member ID sign-in still works.'
const claimMessages: Record<string, string> = {
  '40001': 'An existing account needs administrator identity review. No accounts were merged.',
  '55000': 'Google sign-in for the Dexam App is not switched on yet. Use your Member ID.',
}
// D-067: the App admits listed students (and current staff) only. Unlike the Mock Test
// sign-up, it never creates a test-series candidate for an unlisted Google account.
export async function finishPortalGoogleLogin() {
  const client = getSupabaseClient()
  if (!client || !sharedGoogleEnabled())
    throw new Error('Shared Google sign-in is not enabled in this environment.')
  const operation = await captureAccountOperation(client)
  let refused = ''
  try {
    const result = await operation.client.rpc('claim_app_google_login')
    operation.assertCurrent()
    const allowed =
      !result.error &&
      typeof result.data === 'object' &&
      result.data !== null &&
      (result.data as { allowed?: unknown }).allowed === true
    if (!allowed) refused = claimMessages[result.error?.code ?? ''] ?? notListed
  } finally {
    operation.dispose()
  }
  if (refused) {
    // Leave no signed-in Google session behind on a refused App sign-in.
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    throw new Error(refused)
  }
}
