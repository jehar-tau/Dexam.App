import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'

export type AuthContextValue = {
  configured: boolean
  initializing: boolean
  session: Session | null
  signInEmployee: (email: string, password: string) => Promise<void>
  signInStudent: (memberId: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider.')
  return context
}
