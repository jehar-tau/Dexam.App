import { useQuery } from '@tanstack/react-query'
import { type PropsWithChildren, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button, Callout } from '../../components'
import { useAuth } from './AuthContext'
import { getStudentAccess } from './studentAuth'
import styles from './StaffAccessBoundary.module.css'

export function StudentAccessBoundary({ children }: PropsWithChildren) {
  const location = useLocation()
  const { configured, initializing, session, signOut } = useAuth()
  const [signOutError, setSignOutError] = useState('')
  const previewEnabled =
    import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true' &&
    new URLSearchParams(location.search).get('preview') === '1'

  const accessQuery = useQuery({
    queryKey: ['student-access', session?.user.id],
    queryFn: getStudentAccess,
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
        <p className="eyebrow">Student workspace</p>
        <h1>Checking your session…</h1>
        <p>We are confirming your current student access.</p>
      </section>
    )
  }

  if (!configured || !session) {
    const returnTo = `${location.pathname}${location.search}`
    return <Navigate replace to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`} />
  }

  if (accessQuery.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Student workspace</p>
        <h1>Checking your access…</h1>
        <p>We are checking your current student membership.</p>
      </section>
    )
  }

  if (accessQuery.isError) {
    return (
      <section className={styles.state} aria-labelledby="student-access-check-title">
        <p className="eyebrow">Student workspace</p>
        <h1 id="student-access-check-title">We could not verify your access.</h1>
        <Callout tone="warning" icon="warning">
          Your session is still protected. Check your connection and try again.
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

  if (!accessQuery.data) {
    return (
      <section className={styles.state} aria-labelledby="student-access-denied-title">
        <p className="eyebrow">Student workspace</p>
        <h1 id="student-access-denied-title">This student workspace is not available.</h1>
        <p>
          Your student membership is not currently active. Contact Dexam support if you believe this
          is incorrect.
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
