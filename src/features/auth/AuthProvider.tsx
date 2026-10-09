import type { Session } from '@supabase/supabase-js'
import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'

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

    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setInitializing(false)
    })

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
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
        const nextSession = await signInEmployee(email, password)
        setSession(nextSession)
      },
      signInStudent: async (memberId, password) => {
        const nextSession = await signInStudent(memberId, password)
        setSession(nextSession)
      },
      signOut: async () => {
        await signOutCurrentSession()
        setSession(null)
      },
    }),
    [client, initializing, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
