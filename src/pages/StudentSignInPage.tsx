import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import styles from './SignInPage.module.css'

function safeReturnTo(value: string | null) {
  if (!value || (value !== '/student' && !value.startsWith('/student?'))) return '/student'
  return value
}

export function StudentSignInPage() {
  const { configured, session, signInStudent } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destination = safeReturnTo(searchParams.get('returnTo'))
  const [memberId, setMemberId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate replace to={destination} />

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await signInStudent(memberId, password)
      void navigate(destination, { replace: true })
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign-in failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.layout} aria-labelledby="student-sign-in-title">
      <div className={styles.intro}>
        <p className="eyebrow">Student access</p>
        <h1 id="student-sign-in-title">Continue your learning.</h1>
        <p className={styles.lede}>
          Sign in with the permanent Dexam Member ID from your activation pack and the password you
          created privately.
        </p>
        <ul className={styles.trustList}>
          <li>Your Member ID remains yours throughout your Dexam journey.</li>
          <li>Dexam staff cannot see or recover your password.</li>
          <li>Suspended or ended access is checked against current records.</li>
        </ul>
      </div>

      <Card className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Student sign in</h2>
          <p>Use the same Member ID every time you return.</p>
        </div>

        {!configured ? (
          <Callout tone="warning" icon="warning">
            Student sign-in is not configured in this environment yet.
          </Callout>
        ) : null}

        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <Input
            autoCapitalize="characters"
            autoComplete="username"
            disabled={!configured || submitting}
            label="Dexam Member ID"
            maxLength={16}
            name="memberId"
            onChange={(event) => setMemberId(event.target.value)}
            placeholder="DXM-7K3M9Q2RW5TY"
            required
            spellCheck={false}
            value={memberId}
          />
          <Input
            autoComplete="current-password"
            disabled={!configured || submitting}
            label="Password"
            maxLength={128}
            minLength={12}
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
          First visit? <Link to="/activate">Activate your account</Link> using the one-time pack
          provided by Dexam.
        </p>
      </Card>
    </section>
  )
}
