import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card, Input } from '../components'
import {
  completeEmployeePasswordRecovery,
  getPendingEmployeeRecoveryProof,
  requestEmployeePasswordRecovery,
  verifyEmployeeRecovery,
} from '../features/auth/employeePasswordRecovery'
import styles from './SignInPage.module.css'
export function EmployeePasswordRecoveryPage() {
  const [proof, setProof] = useState(getPendingEmployeeRecoveryProof)
  const [stage, setStage] = useState<'request' | 'verify' | 'password' | 'complete'>(() =>
    getPendingEmployeeRecoveryProof() ? 'verify' : 'request',
  )
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError('')
    setMessage('')
    if (stage === 'password' && password !== confirmation) {
      setError('The passwords must match.')
      return
    }
    setBusy(true)
    try {
      if (stage === 'request') {
        await requestEmployeePasswordRecovery(email)
        setMessage(
          'If this is an eligible employee account, recovery instructions will be available in the local capture inbox.',
        )
        setEmail('')
      } else if (stage === 'verify' && proof) {
        await verifyEmployeeRecovery(proof)
        setStage('password')
      } else if (stage === 'password' && proof) {
        await completeEmployeePasswordRecovery(proof, password)
        setPassword('')
        setConfirmation('')
        setProof(null)
        setStage('complete')
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Recovery could not be completed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout} aria-labelledby="employee-password-recovery-title">
      <div className={styles.intro}>
        <p className="eyebrow">Employee password recovery</p>
        <h1 id="employee-password-recovery-title">Get back to your team.</h1>
        <p className={styles.lede}>
          Use your unchanged, verified employee email. Recovery changes your password and blocks
          previous application sessions, but never removes MFA or restores suspended access.
        </p>
        <p>
          <Link to="/staff/sign-in">Back to employee sign in</Link>
        </p>
      </div>
      <Card className={styles.card}>
        <Callout tone="warning" icon="warning">
          Fictional local testing only. Use .invalid employee emails; hosted and real email recovery
          are disabled.
        </Callout>
        <h2>
          {stage === 'complete'
            ? 'Password updated'
            : stage === 'password'
              ? 'Choose a new password'
              : stage === 'verify'
                ? 'Verify your recovery link'
                : 'Request a recovery link'}
        </h2>
        {stage === 'complete' ? (
          <>
            <Callout tone="success" icon="success">
              Previous application sessions are blocked. Sign in again with your new password; your
              existing authenticator is still required.
            </Callout>
            <p>
              <Link to="/staff/sign-in">Sign in again</Link>
            </p>
          </>
        ) : (
          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            {stage === 'request' ? (
              <Input
                label="Employee email"
                type="email"
                autoComplete="email"
                required
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.target.value)}
                hint="Use the established account email. We never confirm whether an account exists."
              />
            ) : stage === 'password' ? (
              <>
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={password}
                  disabled={busy}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <Input
                  label="Confirm password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  required
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </>
            ) : (
              <p>This one-time link proves email ownership. Existing MFA remains in place.</p>
            )}
            <Button fullWidth type="submit" disabled={busy}>
              {busy
                ? 'Checking securely…'
                : stage === 'request'
                  ? 'Request recovery link'
                  : stage === 'verify'
                    ? 'Verify recovery link'
                    : 'Update password and block previous sessions'}
            </Button>
          </form>
        )}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
      </Card>
    </section>
  )
}
