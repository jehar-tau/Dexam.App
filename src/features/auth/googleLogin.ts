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
// D-068: once Google sign-in is on, it is the only sign-in for every portal. Password sign-in
// stays in the code and returns only when VITE_ENABLE_PASSWORD_SIGN_IN is set.
export function passwordSignInEnabled() {
  return !sharedGoogleEnabled() || import.meta.env.VITE_ENABLE_PASSWORD_SIGN_IN === 'true'
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
  'This Google account is not on the Dexam App student list. Ask Dexam sales or an admin to add the Google email you paid with.'
const admissionFeePending =
  'Your Google email is on the list, but your admission fee has not been recorded yet. Ask Dexam sales to record it, then sign in again.'
const claimMessages: Record<string, string> = {
  '40001': 'An existing account needs administrator identity review. No accounts were merged.',
  '55000': 'Google sign-in for the Dexam App is not switched on yet.',
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
    const data =
      !result.error && typeof result.data === 'object' && result.data !== null
        ? (result.data as { allowed?: unknown; reason?: unknown })
        : null
    if (data?.allowed !== true)
      refused =
        data?.reason === 'admission_fee_pending'
          ? admissionFeePending
          : (claimMessages[result.error?.code ?? ''] ?? notListed)
  } finally {
    operation.dispose()
  }
  if (refused) {
    // Leave no signed-in Google session behind on a refused App sign-in.
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined)
    throw new Error(refused)
  }
}
