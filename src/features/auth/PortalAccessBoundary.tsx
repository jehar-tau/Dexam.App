import { useQuery } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { canOpenPortal, getPortalAccess, type EmployeePortal } from './portals'
import { Button, Callout } from '../../components'

// Presentation entrance check only; children retain their existing operation-level guards.
export function PortalAccessBoundary({
  portal,
  children,
  allowPreview = false,
}: PropsWithChildren<{ portal: EmployeePortal; allowPreview?: boolean }>) {
  const { session } = useAuth()
  const location = useLocation()
  const preview =
    allowPreview &&
    portal !== 'admin' &&
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' &&
    new URLSearchParams(location.search).get('preview') === '1'
  const access = useQuery({
    queryKey: ['portal-access', session?.user.id],
    queryFn: getPortalAccess,
    enabled: Boolean(session) && !preview,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  if (preview) return children
  if (access.isError)
    return (
      <section>
        <h1>Portal access could not be verified.</h1>
        <Callout tone="warning">No portal authority is assumed.</Callout>
        <Button onClick={() => void access.refetch()}>Try again</Button>
      </section>
    )
  if (!session || access.isPending) return <p role="status">Checking portal access…</p>
  if (!canOpenPortal(portal, access.data))
    return (
      <section>
        <h1>This portal is not available to your account.</h1>
        <p>
          Your existing account has not been granted the required current access. Use an authorized
          portal or contact your administrator.
        </p>
      </section>
    )
  return children
}
