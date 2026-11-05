import type { Session } from '@supabase/supabase-js'
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'

import { revokeAllObjectUrls } from '../files/protectedFiles'
import { AuthContext, type AuthContextValue } from './AuthContext'
import { signInEmployee, signOutCurrentSession } from './employeeAuth'
import { signInStudent } from './studentAuth'
import { getSupabaseClient } from './supabaseClient'

export function AuthProvider({ children }: PropsWithChildren) {
  const client = getSupabaseClient()
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(Boolean(client))

  useEffect(() => {
    if (!client) return

    let active = true
    let observedAuthEvent = false
    let userId: string | null | undefined

    void client.auth.getSession().then(({ data }) => {
      if (!active || observedAuthEvent) return
      userId = data.session?.user.id ?? null
      setSession(data.session)
      setInitializing(false)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      const nextUserId = nextSession?.user.id ?? null
      // Private files opened for one account never stay in memory for the next.
      if (userId !== undefined && nextUserId !== userId) revokeAllObjectUrls()
      userId = nextUserId
      observedAuthEvent = true
      setSession(nextSession)
      setInitializing(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: Boolean(client),
      initializing,
      session,
      signInEmployee: async (email, password) => {
        await signInEmployee(email, password)
      },
      signInStudent: async (memberId, password) => {
        await signInStudent(memberId, password)
      },
      signOut: async () => {
        await signOutCurrentSession()
      },
    }),
    [client, initializing, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
