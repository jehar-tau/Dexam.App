import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Callout } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  getRecoveryIncidents,
  openRecoveryIncident,
  reviewRecoveryIncident,
} from '../features/auth/recoveryIncidents'
import styles from './SignInPage.module.css'
import securityStyles from './StaffSecurityPage.module.css'
export function RecoveryIncidentsPage() {
  const { session } = useAuth()
  const workspace = useQuery({
    queryKey: ['recovery-incidents', session?.user.id, session?.expires_at],
    queryFn: getRecoveryIncidents,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const [acknowledged, setAcknowledged] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
      setAcknowledged([])
      setMessage('Investigation recorded. The password reset remains blocked.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Incident review unavailable.')
    } finally {
      await workspace.refetch()
      setBusy(false)
    }
  }
  return (
    <section
      className={`${styles.layout} ${securityStyles.recovery}`}
      aria-labelledby="incident-title"
    >
      <div className={styles.intro}>
        <p className="eyebrow">Independent administrative review</p>
        <h1 id="incident-title">Investigate an uncertain password reset.</h1>
        <p className={styles.lede}>
          Two different Elevated Admins, neither the affected person, review the exact request. Keep
          passwords, recovery links and personal documents out of this investigation.
        </p>
        <Link to="/staff/security?verifyAgain=1&returnTo=%2Fstaff%2Fsecurity%2Fincidents">
          Verify your authenticator again
        </Link>
      </div>
      <Card className={styles.card}>
        <Callout tone="warning" icon="warning">
          Fictional testing only. An investigation does not restore access. The reset stays blocked
          until a separately verified resolution is available.
        </Callout>
        {workspace.isPending ? (
          <p role="status">Checking incident authority…</p>
        ) : workspace.isError ? (
          <p role="alert">Incident authority or queue unavailable. Verify MFA again.</p>
        ) : (
          <>
            <h2>Uncertain recovery requests</h2>
            {!workspace.data.incidents.length ? (
              <p>No eligible executing recovery requests.</p>
            ) : (
              workspace.data.incidents.map((incident) => {
                const key = `${incident.recovery_kind}:${incident.request_id}`,
                  checked = acknowledged.includes(key)
                const isProposer = incident.proposer_person_id === workspace.data.actorPersonId
                return (
                  <div className={securityStyles.setup} key={key}>
                    <h3>
                      {incident.display_name ?? 'Member'}
                      {incident.member_id ? ` · ${incident.member_id}` : ''}
                    </h3>
                    <p>
                      {incident.recovery_kind === 'employee' ? 'Employee' : 'Student'} recovery ·
                      Request {incident.request_id}
                    </p>
                    <p>
                      Requested {new Date(incident.request_created_at).toLocaleString()}
                      {incident.execution_started_at
                        ? ` · Execution started ${new Date(incident.execution_started_at).toLocaleString()}`
                        : ''}
                    </p>
                    <p>Reset: executing · Application access remains blocked.</p>
                    {incident.incident_status === 'reviewed' ? (
                      <p>
                        Independent investigation recorded.
                        {!incident.review_is_current
                          ? ' Administrator verification or request state has changed; escalate before further action.'
                          : ''}
                      </p>
                    ) : incident.incident_id && isProposer ? (
                      <p>
                        Awaiting another eligible administrator. You cannot review your own
                        proposal. If none is available, contact your incident lead and keep the
                        reset blocked.
                      </p>
                    ) : (
                      <>
                        {incident.incident_id && !incident.review_is_current ? (
                          <p>
                            The proposing administrator must retain current authority and recent MFA
                            before review can proceed.
                          </p>
                        ) : null}
                        <label>
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy}
                            onChange={(event) =>
                              setAcknowledged((value) =>
                                event.target.checked
                                  ? [...value, key]
                                  : value.filter((item) => item !== key),
                              )
                            }
                          />{' '}
                          I inspected this exact request and understand that recording this
                          investigation keeps the reset blocked.
                        </label>
                        <Button
                          disabled={
                            busy ||
                            !checked ||
                            Boolean(incident.incident_id && !incident.review_is_current)
                          }
                          onClick={() =>
                            void act(() =>
                              incident.incident_id
                                ? reviewRecoveryIncident(incident.incident_id, true)
                                : openRecoveryIncident(
                                    incident.recovery_kind,
                                    incident.request_id,
                                    true,
                                  ),
                            )
                          }
                        >
                          {incident.incident_id
                            ? 'Record independent review'
                            : 'Open investigation'}
                        </Button>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
        <Button variant="secondary" disabled={busy} onClick={() => void workspace.refetch()}>
          Refresh current state
        </Button>
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
