import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import styles from './SignInPage.module.css'
import { safePortalReturn, type EmployeePortal } from '../features/auth/portals'

export function StaffSignInPage({ portal = 'staff' }: { portal?: EmployeePortal }) {
  const { configured, session, signInEmployee } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = safePortalReturn(searchParams.get('returnTo'), portal)
  const title =
    portal === 'teacher'
      ? 'Welcome to your teaching space.'
      : portal === 'admin'
        ? 'Administration, protected.'
        : 'Welcome back to Dexam.'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate replace to={destination} />

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signInEmployee(email.trim(), password)
      void navigate(destination, { replace: true })
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign-in failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.layout} aria-labelledby="staff-sign-in-title">
      <div className={styles.intro}>
        <p className="eyebrow">Protected {portal} access</p>
        <h1 id="staff-sign-in-title">{title}</h1>
        <p className={styles.lede}>
          Sign in with your verified employee email. Access is checked against your current role
          every time a protected workspace opens.
        </p>
        <ul className={styles.trustList}>
          <li>Revoked employee access is blocked by current database state.</li>
          <li>Student and employee accounts remain separate.</li>
          <li>Your password is handled by the authentication service, not stored by Dexam.</li>
        </ul>
      </div>

      <Card className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>
            {portal === 'teacher'
              ? 'Teacher sign in'
              : portal === 'admin'
                ? 'Admin sign in'
                : 'Employee sign in'}
          </h2>
          <p>
            Use your established employee email. This entrance does not grant a role.
            {portal === 'admin' ? ' Administrative operations require MFA.' : ''}
          </p>
        </div>

        {!configured ? (
          <Callout tone="warning" icon="warning">
            Employee sign-in is not configured in this environment yet.
          </Callout>
        ) : null}

        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <Input
            autoComplete="email"
            disabled={!configured || submitting}
            label="Employee email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
            type="email"
            value={email}
          />
          <Input
            autoComplete="current-password"
            disabled={!configured || submitting}
            label="Password"
            minLength={8}
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <Button disabled={!configured || submitting} fullWidth type="submit">
            {submitting ? 'Signing in securely…' : 'Sign in'}
          </Button>
        </form>

        <p className={styles.support}>
          <Link to="/staff/recover">Forgot your employee password?</Link> Access is invite-only.
          Contact your Dexam administrator if you cannot use your account.
        </p>
      </Card>
    </section>
  )
}
