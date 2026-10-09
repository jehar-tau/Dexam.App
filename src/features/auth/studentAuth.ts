import type { Session } from '@supabase/supabase-js'

import { getSupabaseClient } from './supabaseClient'

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

export async function getStudentAccess() {
  const client = requireClient()
  const result = await client.rpc('current_person_has_active_student_membership')
  if (result.error) throw new Error('Student access could not be verified.')
  return Boolean(result.data)
}

export async function signInStudent(memberId: string, password: string): Promise<Session> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  const client = requireClient()

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

  const sessionResult = await client.auth.setSession({
    access_token: data.accessToken,
    refresh_token: data.refreshToken,
  })

  if (sessionResult.error || !sessionResult.data.session) {
    throw new Error(genericSignInError)
  }

  try {
    if (!(await getStudentAccess())) throw new Error(genericSignInError)
  } catch (accessError) {
    await client.auth.signOut({ scope: 'local' })
    if (accessError instanceof Error && accessError.message === genericSignInError) {
      throw accessError
    }
    throw new Error('We could not verify student access. Please try again.', {
      cause: accessError,
    })
  }

  return sessionResult.data.session
}
