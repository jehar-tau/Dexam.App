import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { Button } from '../../components'
import { useAuth } from '../auth/AuthContext'
import styles from '../auth/StaffAccessBoundary.module.css'
import { previewSearch } from './previewSearch'
import { useTestAccess } from './testAccess'

/**
 * F039: the test series admits coaching students and public candidates. Signed-out visitors go
 * to the test-series sign-in; a login without a test-series account, or a candidate who has not
 * chosen B.Des or M.Des yet, goes to the welcome page.
 */
export function TestsAccessBoundary({ children }: PropsWithChildren) {
  const location = useLocation()
  const { configured, initializing, session } = useAuth()
  const preview = previewSearch(location.search) !== ''
  const access = useTestAccess(!preview)
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)

  if (preview) return children

  if (initializing) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Test series</p>
        <h1>Checking your session…</h1>
      </section>
    )
  }
  if (!configured || !session)
    return <Navigate replace to={`/tests/sign-in?returnTo=${returnTo}`} />
  if (access.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Test series</p>
        <h1>Checking your access…</h1>
      </section>
    )
  }
  if (access.isError) {
    return (
      <section className={styles.state} aria-labelledby="tests-access-error">
        <p className="eyebrow">Test series</p>
        <h1 id="tests-access-error">We could not check your access.</h1>
        <p>Check your connection and try again.</p>
        <div className={styles.actions}>
          <Button onClick={() => void access.refetch()}>Try again</Button>
        </div>
      </section>
    )
  }
  if (!access.data.kind || (access.data.kind === 'candidate' && !access.data.profile)) {
    return <Navigate replace to={`/tests/welcome?returnTo=${returnTo}`} />
  }
  return children
}
