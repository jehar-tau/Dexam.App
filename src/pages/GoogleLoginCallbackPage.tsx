import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../features/auth/AuthContext'
import { finishPortalGoogleLogin, safeGoogleReturnTo } from '../features/auth/googleLogin'
import { Card } from '../components'

export function GoogleLoginCallbackPage() {
  const { initializing, session } = useAuth()
  const navigate = useNavigate(),
    [params] = useSearchParams()
  const [error, setError] = useState('')
  const destination = safeGoogleReturnTo(params.get('returnTo'))
  const providerError = params.has('error')
  useEffect(() => {
    if (initializing || !session || providerError) return
    let cancelled = false
    void finishPortalGoogleLogin()
      .then(() => {
        if (!cancelled) void navigate(destination, { replace: true })
      })
      .catch((failure: unknown) => {
        if (!cancelled)
          setError(failure instanceof Error ? failure.message : 'Identity confirmation failed.')
      })
    return () => {
      cancelled = true
    }
  }, [initializing, session, destination, navigate, providerError])
  return (
    <Card>
      <h1>Confirming your Dexam identity</h1>
      {providerError ? (
        <p role="alert">Google sign-in was cancelled or could not complete.</p>
      ) : error ? (
        <p role="alert">{error}</p>
      ) : initializing || session ? (
        <p role="status">Checking verified login and current account access…</p>
      ) : (
        <p role="alert">No current Google session was found. Start sign-in again.</p>
      )}
      <p>
        Employee roles, enrolment validity and recorded fees are still checked by the protected
        workspace.
      </p>
      <Link to="/sign-in">Student sign in</Link>
      {' · '}
      <Link to="/staff/sign-in">Staff sign in</Link>
      {' · '}
      <Link to="/admin/sign-in">Admin sign in</Link>
    </Card>
  )
}
