import { useQuery } from '@tanstack/react-query'
import { type PropsWithChildren, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button, Callout } from '../../components'
import { useAuth } from './AuthContext'
import { getEmployeeAccess } from './employeeAuth'
import styles from './StaffAccessBoundary.module.css'

type StaffAccessBoundaryProps = PropsWithChildren<{
  capability?: string
}>

export function StaffAccessBoundary({ capability, children }: StaffAccessBoundaryProps) {
  const location = useLocation()
  const { configured, initializing, session, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState('')
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' &&
    new URLSearchParams(location.search).get('preview') === '1'

  const accessQuery = useQuery({
    queryKey: ['employee-access', session?.user.id, capability],
    queryFn: () => getEmployeeAccess(capability),
    enabled: Boolean(session) && !previewEnabled,
    retry: false,
    staleTime: 0,
  })

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
    } catch {
      setSignOutError('Sign-out failed. Please try again.')
    }
  }

  if (previewEnabled) return children

  if (initializing) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Staff workspace</p>
        <h1>Checking your session…</h1>
        <p>We are confirming your current employee access.</p>
      </section>
    )
  }

  if (!configured || !session) {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate replace to={`/staff/sign-in?returnTo=${encodeURIComponent(returnTo)}`} />
  }

  if (accessQuery.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Staff workspace</p>
        <h1>Checking your access…</h1>
        <p>We are checking your current role before opening this workspace.</p>
      </section>
    )
  }

  if (accessQuery.isError) {
    return (
      <section className={styles.state} aria-labelledby="access-check-title">
        <p className="eyebrow">Staff workspace</p>
        <h1 id="access-check-title">We could not verify your access.</h1>
        <Callout tone="warning" icon="warning">
          Your session is still protected. Check your connection and try the access check again.
        </Callout>
        <div className={styles.actions}>
          <Button onClick={() => void accessQuery.refetch()}>Try again</Button>
          <Button variant="secondary" onClick={() => void handleSignOut()}>
            Sign out
          </Button>
        </div>
        {signOutError ? (
          <p className={styles.error} role="alert">
            {signOutError}
          </p>
        ) : null}
      </section>
    )
  }

  if (!accessQuery.data.activeEmployee || !accessQuery.data.hasCapability) {
    return (
      <section className={styles.state} aria-labelledby="access-denied-title">
        <p className="eyebrow">Staff workspace</p>
        <h1 id="access-denied-title">You do not have access to this workspace.</h1>
        <p>
          Your employee status or assigned role does not currently allow this action. Ask an
          administrator if you believe this is incorrect.
        </p>
        <Button variant="secondary" onClick={() => void handleSignOut()}>
          Sign out
        </Button>
        {signOutError ? (
          <p className={styles.error} role="alert">
            {signOutError}
          </p>
        ) : null}
      </section>
    )
  }

  return children
}
