import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import { safeSecurityReturn } from '../features/auth/securityReturn'
import {
  cancelStaffTotpEnrollment,
  enrollStaffTotp,
  getStaffMfaState,
  verifyStaffTotp,
  signOutAllStaffSessions,
  removeStaffTotpFactor,
} from '../features/auth/staffMfa'
import styles from './SignInPage.module.css'
import securityStyles from './StaffSecurityPage.module.css'

export function StaffSecurityPage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const state = useQuery({
    queryKey: ['staff-security', session?.user.id],
    queryFn: getStaffMfaState,
    retry: false,
    staleTime: 0,
  })
  const [setup, setSetup] = useState<Awaited<ReturnType<typeof enrollStaffTotp>> | null>(null)
  const [name, setName] = useState('My authenticator')
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [complete, setComplete] = useState(false)
  const verifyAgain = params.get('verifyAgain') === '1' && !complete

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.')
    } finally {
      setBusy(false)
      setCode('')
    }
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await run(async () => {
      await verifyStaffTotp((setup?.id ?? factorId) || state.data?.factors[0]?.id || '', code)
      setSetup(null)
      setShowKey(false)
      setComplete(true)
      await queryClient.invalidateQueries({ queryKey: ['employee-access'] })
      await queryClient.invalidateQueries({ queryKey: ['navigation-access'] })
      await state.refetch()
    })
  }

  const factors = state.data?.factors ?? []
  return (
    <section className={styles.layout} aria-labelledby="staff-security-title">
      <div className={styles.intro}>
        <p className="eyebrow">Staff account security</p>
        <h1 id="staff-security-title">Protect your staff access.</h1>
        <p className={styles.lede}>
          Use an authenticator app to confirm it is you before opening sensitive workspaces.
        </p>
        <p>
          If you have lost your authenticator, contact your Dexam administrator for independently
          approved recovery.
        </p>
      </div>
      <Card className={styles.card}>
        {state.isPending ? (
          <p role="status">Checking your authenticator…</p>
        ) : state.isError ? (
          <>
            <Callout tone="warning" icon="warning">
              We could not check your staff security.
            </Callout>
            <Button onClick={() => void state.refetch()}>Try again</Button>
          </>
        ) : (
          <>
            <div className={styles.cardHeader}>
              <h2>
                {setup
                  ? 'Set up your authenticator'
                  : complete || (state.data.currentLevel === 'aal2' && !verifyAgain)
                    ? 'Authenticator verified'
                    : factors.length
                      ? 'Enter your authenticator code'
                      : 'Add an authenticator'}
              </h2>
            </div>
            {complete || (!setup && state.data.currentLevel === 'aal2' && !verifyAgain) ? (
              <>
                <p role="status">Your staff session has two-factor verification.</p>
                <Button
                  onClick={() =>
                    void navigate(safeSecurityReturn(params.get('returnTo')), { replace: true })
                  }
                >
                  Continue to workspace
                </Button>
              </>
            ) : null}
            {setup ? (
              <div className={securityStyles.setup}>
                <p>
                  Scan this QR code in your authenticator app, then enter the code it generates.
                </p>
                <img
                  className={securityStyles.qr}
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(setup.qrCode)}`}
                  alt="Authenticator setup QR code"
                />
                <Button variant="secondary" disabled={busy} onClick={() => setShowKey(!showKey)}>
                  {showKey ? 'Hide setup key' : 'Show manual setup key'}
                </Button>
                {showKey ? <p className={securityStyles.key}>{setup.secret}</p> : null}
              </div>
            ) : null}
            {!setup &&
            (factors.length === 0 || (state.data.currentLevel === 'aal2' && !verifyAgain)) ? (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault()
                  void run(async () => {
                    setSetup(await enrollStaffTotp(name))
                    setComplete(false)
                  })
                }}
              >
                <Input
                  label="Authenticator name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={64}
                  required
                  disabled={busy}
                />
                <Button type="submit" disabled={busy}>
                  {busy
                    ? 'Starting setup…'
                    : factors.length
                      ? 'Add backup authenticator'
                      : 'Start authenticator setup'}
                </Button>
              </form>
            ) : null}
            {setup ||
            (factors.length > 0 &&
              (state.data.currentLevel !== 'aal2' || verifyAgain) &&
              !complete) ? (
              <form className={styles.form} onSubmit={(event) => void verify(event)}>
                {!setup && factors.length > 1 ? (
                  <label>
                    Authenticator
                    <select
                      value={factorId || factors[0]?.id || ''}
                      disabled={busy}
                      onChange={(event) => setFactorId(event.target.value)}
                    >
                      {factors.map((factor) => (
                        <option key={factor.id} value={factor.id}>
                          {factor.friendly_name || 'Authenticator'}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Input
                  label="Six-digit code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  disabled={busy}
                />
                <Button type="submit" disabled={busy}>
                  {busy ? 'Verifying…' : 'Verify authenticator'}
                </Button>
                {setup ? (
                  <Button
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await cancelStaffTotpEnrollment(setup.id)
                        setSetup(null)
                        setShowKey(false)
                      })
                    }
                  >
                    Cancel setup
                  </Button>
                ) : null}
              </form>
            ) : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {state.data.currentLevel === 'aal2' && !setup && !verifyAgain ? (
              <div className={securityStyles.setup}>
                <h3>Your authenticators</h3>
                {factors.map((factor) => (
                  <div key={factor.id}>
                    <p>{factor.friendly_name || 'Authenticator'}</p>
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await removeStaffTotpFactor(factor.id)
                          setComplete(false)
                          await state.refetch()
                          await queryClient.invalidateQueries({ queryKey: ['employee-access'] })
                          await queryClient.invalidateQueries({ queryKey: ['navigation-access'] })
                        })
                      }
                    >
                      Remove {factor.friendly_name || 'authenticator'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
            <p className={styles.support}>
              If you suspect someone else has access, sign out all devices. You will need to sign in
              again.
            </p>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await signOutAllStaffSessions()
                  void navigate('/staff/sign-in', { replace: true })
                })
              }
            >
              Sign out all devices
            </Button>
            <p className={styles.support}>
              <Link to="/staff/security/recovery">Elevated Admin recovery queue</Link>
            </p>
          </>
        )}
      </Card>
    </section>
  )
}
