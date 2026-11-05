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
export async function finishPortalGoogleLogin() {
  const client = getSupabaseClient()
  if (!client || !sharedGoogleEnabled())
    throw new Error('Shared Google sign-in is not enabled in this environment.')
  const operation = await captureAccountOperation(client)
  try {
    const result = await operation.client.rpc('provision_google_candidate')
    operation.assertCurrent()
    if (result.error)
      throw new Error(
        result.error.code === '40001'
          ? 'An existing account needs administrator identity review. No accounts were merged.'
          : 'Your approved identity could not be confirmed. Check with Dexam; Google login alone does not grant access.',
      )
  } finally {
    operation.dispose()
  }
}
