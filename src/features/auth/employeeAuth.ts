import type { Session } from '@supabase/supabase-js'

import { getSupabaseClient } from './supabaseClient'

const genericSignInError = 'We could not sign you in. Check your details and try again.'

export type EmployeeAccess = {
  activeEmployee: boolean
  hasCapability: boolean
}

function requireClient() {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Employee sign-in is not configured in this environment.')
  }
  return client
}

export async function signInEmployee(email: string, password: string): Promise<Session> {
  const client = requireClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    throw new Error(genericSignInError)
  }

  if (!data.user.email_confirmed_at) {
    await client.auth.signOut({ scope: 'local' })
    throw new Error(genericSignInError)
  }

  try {
    const access = await getEmployeeAccess()
    if (!access.activeEmployee) {
      throw new Error(genericSignInError)
    }
  } catch (accessError) {
    await client.auth.signOut({ scope: 'local' })
    if (accessError instanceof Error && accessError.message === genericSignInError) {
      throw accessError
    }
    throw new Error('We could not verify employee access. Please try again.', {
      cause: accessError,
    })
  }

  return data.session
}

export async function signOutCurrentSession() {
  const client = requireClient()
  const { error } = await client.auth.signOut({ scope: 'local' })
  if (error) throw new Error('Sign-out failed. Please try again.')
}

export async function getEmployeeAccess(capability?: string): Promise<EmployeeAccess> {
  const client = requireClient()
  const membershipResult = await client.rpc('current_person_has_active_employee_membership')

  if (membershipResult.error) {
    throw new Error('Employee access could not be verified.')
  }

  const activeEmployee = Boolean(membershipResult.data)

  if (!activeEmployee) {
    return { activeEmployee: false, hasCapability: false }
  }

  if (!capability) {
    return { activeEmployee: true, hasCapability: true }
  }

  const capabilityResult = await client.rpc('current_person_has_capability', {
    p_capability_key: capability,
  })

  if (capabilityResult.error) {
    throw new Error('Employee permissions could not be verified.')
  }

  return { activeEmployee: true, hasCapability: Boolean(capabilityResult.data) }
}
