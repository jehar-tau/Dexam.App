import type { Session, SupabaseClient } from '@supabase/supabase-js'

import { createEmployeeActivationClient, getSupabaseClient } from './supabaseClient'
import { watchAccountChanges } from './accountOperation'

const genericSignInError = 'We could not sign you in. Check your details and try again.'

type StudentSignInResponse = {
  accessToken?: unknown
  refreshToken?: unknown
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) throw new Error('Student sign-in is not configured in this environment.')
  return client
}

export function normalizeMemberId(value: string) {
  return value.trim().toUpperCase().replaceAll(' ', '')
}

async function getStudentAccessWithClient(client: SupabaseClient) {
  const result = await client.rpc('current_person_has_active_student_membership')
  if (result.error) throw new Error('Student access could not be verified.')
  return Boolean(result.data)
}

export function getStudentAccess() {
  return getStudentAccessWithClient(requireClient())
}

export async function signInStudent(memberId: string, password: string): Promise<Session> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const client = requireClient()
  const isolated = createEmployeeActivationClient()
  if (!isolated) throw new Error(genericSignInError)
  const guard = watchAccountChanges(client)
  let committed = false
  try {
    if (!supabaseUrl || !anonKey) {
      throw new Error('Student sign-in is not configured in this environment.')
    }

    let response: Response
    try {
      response = await fetch(`${supabaseUrl}/functions/v1/student-sign-in`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ memberId: normalizeMemberId(memberId), password }),
      })
    } catch {
      throw new Error(genericSignInError)
    }

    const data = (await response.json().catch(() => ({}))) as StudentSignInResponse
    if (
      !response.ok ||
      typeof data.accessToken !== 'string' ||
      typeof data.refreshToken !== 'string'
    ) {
      throw new Error(genericSignInError)
    }

    const sessionResult = await isolated.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    })

    if (sessionResult.error || !sessionResult.data.session) {
      throw new Error(genericSignInError)
    }

    try {
      if (!(await getStudentAccessWithClient(isolated))) throw new Error(genericSignInError)
    } catch (accessError) {
      if (accessError instanceof Error && accessError.message === genericSignInError) {
        throw accessError
      }
      throw new Error('We could not verify student access. Please try again.', {
        cause: accessError,
      })
    }

    guard.assertCurrent()
    const result = await client.auth.setSession({
      access_token: data.accessToken,
      refresh_token: data.refreshToken,
    })
    if (result.error || !result.data.session) throw new Error(genericSignInError)
    committed = true
    return result.data.session
  } finally {
    guard.dispose()
    if (!committed) await isolated.auth.signOut({ scope: 'local' })
  }
}
