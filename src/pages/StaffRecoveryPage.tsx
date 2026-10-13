import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  cancelStaffRecovery,
  decideStaffRecovery,
  executeStaffRecovery,
  getStaffRecoveryWorkspace,
  proposeStaffRecovery,
} from '../features/auth/staffRecovery'
import styles from './SignInPage.module.css'
import securityStyles from './StaffSecurityPage.module.css'

export function StaffRecoveryPage() {
  const { session } = useAuth()
  const workspace = useQuery({
    queryKey: ['staff-recovery', session?.user.id],
    queryFn: getStaffRecoveryWorkspace,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const [selected, setSelected] = useState('')
  const [reason, setReason] = useState('lost_authenticator')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  async function act(action: () => Promise<void>, success: string) {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setMessage(success)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please try again.')
    } finally {
      await workspace.refetch()
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout} aria-labelledby="staff-recovery-title">
      <div className={styles.intro}>
        <p className="eyebrow">Independent staff recovery</p>
        <h1 id="staff-recovery-title">Recover a lost authenticator.</h1>
        <p className={styles.lede}>
          Confirm the employee and affected authenticator before proposing a reset. A different
          Elevated Admin must review and approve it.
        </p>
        <p>
          Both administrators must have verified MFA within the last 15 minutes. Requests expire
          after 15 minutes. Reset blocks previous sessions and removes only the approved
          authenticator.
        </p>
        <Link to="/staff/security?verifyAgain=1&returnTo=%2Fstaff%2Fsecurity%2Frecovery">
          Verify your authenticator again
        </Link>
      </div>
      <Card className={styles.card}>
        {workspace.isPending ? (
          <p role="status">Checking recovery authority…</p>
        ) : workspace.isError ? (
          <>
            <Callout tone="warning" icon="warning">
              We could not load staff recovery.
            </Callout>
            <Button onClick={() => void workspace.refetch()}>Try again</Button>
          </>
        ) : !workspace.data.authorized ? (
          <Callout tone="warning" icon="warning">
            Recent Elevated Admin verification is required. Verify your authenticator again before
            managing recovery.
          </Callout>
        ) : (
          <>
            <h2>Propose a reset</h2>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                const target = workspace.data.targets.find(
                  (value) => `${value.person_id}:${value.factor_id}` === selected,
                )
                if (target)
                  void act(
                    () => proposeStaffRecovery(target.person_id, target.factor_id, reason),
                    'Recovery proposed for independent review.',
                  )
              }}
            >
              <label>
                Employee authenticator
                <select
                  required
                  disabled={busy}
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  <option value="">Choose the affected employee and device</option>
                  {workspace.data.targets.map((target) => (
                    <option
                      key={`${target.person_id}:${target.factor_id}`}
                      value={`${target.person_id}:${target.factor_id}`}
                    >
                      {target.display_name || 'Employee'} — {target.factor_name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Recovery reason
                <select
                  disabled={busy}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                >
                  <option value="lost_authenticator">Lost authenticator</option>
                  <option value="damaged_device">Damaged device</option>
                  <option value="suspected_compromise">Suspected compromise</option>
                </select>
              </label>
              <Button type="submit" disabled={busy || !selected}>
                Propose recovery
              </Button>
            </form>
            <h2>Recovery requests</h2>
            {!workspace.data.requests.length ? (
              <p>No recovery requests yet.</p>
            ) : (
              workspace.data.requests.map((request) => {
                const expired = Date.parse(request.expires_at) <= now
                const own = request.proposer_person_id === workspace.data.personId
                const independent = !own && request.target_person_id !== workspace.data.personId
                return (
                  <div key={request.id} className={securityStyles.setup}>
                    <h3>{request.target_name || 'Employee'}</h3>
                    <p>Authenticator reference: {request.factor_id}</p>
                    <p>
                      {request.reason_code.replaceAll('_', ' ')} ·{' '}
                      {expired && ['pending', 'approved'].includes(request.status)
                        ? 'expired'
                        : request.status}
                    </p>
                    <p>Expires {new Date(request.expires_at).toLocaleString()}</p>
                    {request.status === 'pending' && independent && !expired ? (
                      <>
                        <Button
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () => decideStaffRecovery(request.id, true),
                              'Independent approval recorded. The reset is ready to execute.',
                            )
                          }
                        >
                          Approve reset
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            void act(
                              () => decideStaffRecovery(request.id, false),
                              'Recovery rejected.',
                            )
                          }
                        >
                          Reject reset
                        </Button>
                      </>
                    ) : null}
                    {request.status === 'pending' && own ? (
                      <p>A different administrator must decide this request.</p>
                    ) : null}
                    {own && ['pending', 'approved'].includes(request.status) ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(() => cancelStaffRecovery(request.id), 'Recovery cancelled.')
                        }
                      >
                        Cancel request
                      </Button>
                    ) : null}
                    {request.status === 'approved' && !expired ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act(
                            () => executeStaffRecovery(request.id),
                            'Reset completed. Previous sessions are blocked; the employee must sign in again.',
                          )
                        }
                      >
                        Execute approved reset
                      </Button>
                    ) : null}
                    {request.status === 'executing' ? (
                      <>
                        <Callout tone="warning" icon="warning">
                          Previous sessions are blocked. Execution is awaiting a confirmed outcome;
                          refresh before retrying.
                        </Callout>
                        {!expired ? (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              void act(
                                () => executeStaffRecovery(request.id),
                                'Recovery outcome confirmed.',
                              )
                            }
                          >
                            Resume reset
                          </Button>
                        ) : null}
                      </>
                    ) : null}
                    {request.status === 'failed' ? (
                      <Callout tone="warning" icon="warning">
                        Previous sessions remain blocked. Review the affected factor before creating
                        another request.
                      </Callout>
                    ) : null}
                  </div>
                )
              })
            )}
          </>
        )}
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p role="status">{message}</p> : null}
      </Card>
    </section>
  )
}
