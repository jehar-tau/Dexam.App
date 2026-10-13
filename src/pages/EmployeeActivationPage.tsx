import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card, Input } from '../components'
import {
  completeEmployeeActivation,
  getPendingEmployeeActivationProof,
  verifyEmployeeActivation,
} from '../features/auth/employeeActivation'
import styles from './SignInPage.module.css'

export function EmployeeActivationPage() {
  const [proof, setProof] = useState(getPendingEmployeeActivationProof)
  const [stage, setStage] = useState<'verify' | 'password' | 'complete'>('verify')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!proof || busy) return
    setError('')
    if (stage === 'password' && password !== confirmation) {
      setError('The passwords must match.')
      return
    }
    setBusy(true)
    try {
      if (stage === 'verify') {
        await verifyEmployeeActivation(proof)
        setStage('password')
      } else {
        await completeEmployeeActivation(proof, password)
        setProof(null)
        setPassword('')
        setConfirmation('')
        setStage('complete')
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Activation could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.layout} aria-labelledby="employee-activation-title">
      <div className={styles.intro}>
        <p className="eyebrow">Invite-only employee access</p>
        <h1 id="employee-activation-title">Join your Dexam team.</h1>
        <p className={styles.lede}>
          Verify your invitation, then choose your own password. Your administrator assigns work
          permissions separately.
        </p>
      </div>
      <Card className={styles.card}>
        <h2>
          {stage === 'complete'
            ? 'Account activated'
            : stage === 'password'
              ? 'Choose your password'
              : 'Verify your invitation'}
        </h2>
        {stage === 'complete' ? (
          <>
            <Callout tone="success" icon="success">
              Your employee account is ready. Sign in to continue. Workspace access requires
              separately assigned permissions.
            </Callout>
            <p>
              <Link to="/staff/sign-in">Continue to employee sign in</Link>
            </p>
          </>
        ) : !proof ? (
          <Callout tone="warning" icon="warning">
            Open the complete link from your invitation email. If it has expired, ask your
            administrator for a new invitation.
          </Callout>
        ) : (
          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            {stage === 'password' ? (
              <>
                <Input
                  label="New password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
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
                  required
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </>
            ) : (
              <p>
                This one-time invitation verifies your email ownership. Continuing signs out any
                other account on this device.
              </p>
            )}
            {error ? (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={busy} fullWidth>
              {busy
                ? 'Checking securely…'
                : stage === 'verify'
                  ? 'Verify invitation'
                  : 'Activate employee account'}
            </Button>
          </form>
        )}
      </Card>
    </section>
  )
}
