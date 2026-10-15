import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'

import { AuthProvider } from '../features/auth/AuthProvider'
import { useAuth } from '../features/auth/AuthContext'

function AccountQueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  )

  // A retired account's pending requests and private cache never reach the next account.
  useEffect(() => () => queryClient.clear(), [queryClient])

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function AccountWorkspace({ children }: PropsWithChildren) {
  const { session } = useAuth()
  // Do not key by access token/expiry: routine refresh must preserve current-account drafts.
  return (
    <AccountQueryProvider key={session?.user.id ?? 'signed-out'}>{children}</AccountQueryProvider>
  )
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <AccountWorkspace>{children}</AccountWorkspace>
    </AuthProvider>
  )
}
