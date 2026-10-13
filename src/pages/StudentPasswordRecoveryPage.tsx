import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card, Input } from '../components'
import {
  clearStudentRecoveryProof,
  resetStudentPassword,
  takeStudentRecoveryProof,
} from '../features/auth/studentRecovery'
import styles from './SignInPage.module.css'
export function StudentPasswordRecoveryPage() {
  const [linkProof, setLinkProof] = useState(takeStudentRecoveryProof)
  const [memberId, setMemberId] = useState(() => takeStudentRecoveryProof()?.memberId ?? '')
  const [backup, setBackup] = useState(''),
    [password, setPassword] = useState(''),
    [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [complete, setComplete] = useState(false)
  useEffect(() => () => clearStudentRecoveryProof(), [])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (password !== confirmation) {
      setError('The passwords must match.')
      return
    }
    setBusy(true)
    try {
      await resetStudentPassword(
        memberId,
        linkProof?.token ?? backup.trim().toUpperCase(),
        linkProof ? 'link' : 'backup',
        password,
      )
      setPassword('')
      setConfirmation('')
      setBackup('')
      setLinkProof(null)
      setComplete(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Recovery unavailable.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout} aria-labelledby="student-recovery-title">
      <div className={styles.intro}>
        <p className="eyebrow">Student password recovery</p>
        <h1 id="student-recovery-title">Keep your identity. Choose a new password.</h1>
        <p className={styles.lede}>
          Ask Dexam for an independently approved recovery pack. Your Member ID and learning history
          stay unchanged. Suspended or ended access is never restored by a reset.
        </p>
        <Link to="/sign-in">Back to student sign in</Link>
      </div>
      <Card className={styles.card}>
        <Callout tone="warning" icon="warning">
          Fictional local testing only. Hosted password recovery is disabled.
        </Callout>
        {complete ? (
          <>
            <h2>Password updated</h2>
            <p role="status">
              Previous application sessions are blocked. Sign in again using your same Member ID.
            </p>
            <Link to="/sign-in">Sign in again</Link>
          </>
        ) : (
          <>
            <h2>Use your one-time recovery pack</h2>
            <p>
              The pack expires after 15 minutes. Both administrators must still have current
              authority and recent verification.
            </p>
            <form className={styles.form} onSubmit={(event) => void submit(event)}>
              <Input
                label="Dexam Member ID"
                value={memberId}
                required
                disabled={busy || Boolean(linkProof)}
                onChange={(event) => setMemberId(event.target.value)}
              />
              {linkProof ? (
                <p>Recovery link loaded securely. It has been removed from the address bar.</p>
              ) : (
                <Input
                  label="Recovery backup code"
                  type="password"
                  autoComplete="off"
                  required
                  minLength={10}
                  maxLength={10}
                  value={backup}
                  disabled={busy}
                  onChange={(event) => setBackup(event.target.value)}
                />
              )}
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                minLength={12}
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
                minLength={12}
                maxLength={128}
                required
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
              />
              <Button fullWidth type="submit" disabled={busy}>
                {busy ? 'Updating securely…' : 'Update password and block old sessions'}
              </Button>
            </form>
          </>
        )}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
      </Card>
    </section>
  )
}
