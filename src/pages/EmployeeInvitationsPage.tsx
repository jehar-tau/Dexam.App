import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  cancelEmployeeInvitation,
  deliverEmployeeInvitation,
  getEmployeeInvitationWorkspace,
  prepareEmployeeInvitation,
  searchInvitationPeople,
  type InvitationPerson,
} from '../features/auth/employeeInvitations'
import styles from './SignInPage.module.css'
import securityStyles from './StaffSecurityPage.module.css'

export function EmployeeInvitationsPage() {
  const { session } = useAuth()
  const workspace = useQuery({
    queryKey: ['employee-invitations', session?.user.id],
    queryFn: getEmployeeInvitationWorkspace,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [people, setPeople] = useState<InvitationPerson[]>([])
  const [selected, setSelected] = useState('')
  const [searched, setSearched] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Please retry.')
    } finally {
      await workspace.refetch()
      setBusy(false)
    }
  }
  return (
    <section
      className={`${styles.layout} ${securityStyles.recovery}`}
      aria-labelledby="employee-invitations-title"
    >
      <div className={styles.intro}>
        <p className="eyebrow">Controlled employee invitations</p>
        <h1 id="employee-invitations-title">Invite your team.</h1>
        <p className={styles.lede}>
          Review the canonical person first. Invitations verify email and activate a pending
          employee account, but never grant work permissions or restore suspended access.
        </p>
        <p>
          Links expire after one hour. Cancel an existing invitation before deliberately reissuing
          it to the same person and unchanged email. Reissue has a one-minute cooldown.
        </p>
        <Link to="/staff/security?verifyAgain=1&returnTo=%2Fstaff%2Femployees">
          Verify your authenticator again
        </Link>
      </div>
      <Card className={styles.card}>
        <Callout tone="warning" icon="warning">
          Fictional local testing only: use addresses ending in .invalid. Emails go to the local
          capture inbox. Real and hosted email delivery are disabled.
        </Callout>
        {workspace.isPending ? (
          <p role="status">Checking invitation authority…</p>
        ) : workspace.isError ? (
          <>
            <p role="alert">Invitations could not be loaded.</p>
            <Button onClick={() => void workspace.refetch()}>Try again</Button>
          </>
        ) : !workspace.data.authorized ? (
          <Callout tone="warning" icon="warning">
            Recent Elevated Admin MFA and employee-role authority are required.
          </Callout>
        ) : (
          <>
            <h2>Review the person</h2>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                void act(async () => {
                  setPeople(await searchInvitationPeople(name))
                  setSearched(true)
                  setReviewed(false)
                  setSelected('')
                })
              }}
            >
              <Input
                label="Person name"
                value={name}
                minLength={2}
                maxLength={120}
                required
                disabled={busy}
                onChange={(event) => {
                  setName(event.target.value)
                  setSearched(false)
                  setReviewed(false)
                  setSelected('')
                  setPeople([])
                }}
              />
              <Button type="submit" disabled={busy}>
                Search for existing people
              </Button>
            </form>
            {searched ? (
              <form
                className={styles.form}
                onSubmit={(event) => {
                  event.preventDefault()
                  void act(async () => {
                    const id = await prepareEmployeeInvitation(
                      selected === 'new' ? null : selected,
                      name,
                      email,
                      reviewed,
                    )
                    await deliverEmployeeInvitation(id)
                    setMessage(
                      'Invitation delivered to the local capture inbox. No work permissions were granted.',
                    )
                    setReviewed(false)
                    setEmail('')
                  })
                }}
              >
                <label>
                  Canonical person
                  <select
                    required
                    disabled={busy}
                    value={selected}
                    onChange={(event) => {
                      setSelected(event.target.value)
                      setReviewed(false)
                    }}
                  >
                    <option value="">Choose deliberately</option>
                    <option value="new">Create a new person: {name}</option>
                    {people.map((person) => (
                      <option
                        key={person.person_id}
                        value={person.person_id}
                        disabled={['active', 'suspended', 'ended'].includes(
                          person.employee_status ?? '',
                        )}
                      >
                        {person.display_name ?? 'Person'} — {person.person_id} (
                        {person.employee_status ?? 'no employee account'})
                      </option>
                    ))}
                  </select>
                </label>
                <Input
                  label="Fictional employee email"
                  type="email"
                  required
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                  hint="For example, teacher@fixture.invalid. Existing employee email cannot be replaced."
                />
                <label>
                  <input
                    type="checkbox"
                    checked={reviewed}
                    disabled={busy}
                    onChange={(event) => setReviewed(event.target.checked)}
                  />{' '}
                  I reviewed the matches and deliberately selected the correct person.
                </label>
                <Button type="submit" disabled={busy || !reviewed || !selected}>
                  Prepare and deliver invitation
                </Button>
              </form>
            ) : null}
            <h2>Invitation queue</h2>
            {!workspace.data.invitations.length ? (
              <p>No invitations yet.</p>
            ) : (
              workspace.data.invitations.map((invitation) => {
                const expired = Date.parse(invitation.expires_at) <= now
                const cancellable = ['pending', 'delivering', 'delivered'].includes(
                  invitation.status,
                )
                return (
                  <div className={securityStyles.setup} key={invitation.id}>
                    <h3>{invitation.display_name ?? 'Employee'}</h3>
                    <p>
                      {invitation.masked_email} ·{' '}
                      {expired && cancellable ? 'expired' : invitation.status}
                    </p>
                    <p>Expires {new Date(invitation.expires_at).toLocaleString()}</p>
                    <p>Person reference: {invitation.person_id}</p>
                    {invitation.status === 'pending' && !expired ? (
                      <Button
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await deliverEmployeeInvitation(invitation.id)
                            setMessage('Local capture delivery confirmed.')
                          })
                        }
                      >
                        Deliver pending invitation
                      </Button>
                    ) : null}
                    {invitation.status === 'delivering' ? (
                      <p>
                        Delivery is awaiting confirmation. Refresh first; cancel and deliberately
                        reissue if the outcome remains uncertain.
                      </p>
                    ) : null}
                    {cancellable ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await cancelEmployeeInvitation(invitation.id)
                            setMessage(
                              'Invitation cancelled. Reissue requires selecting this same person and unchanged email above.',
                            )
                          })
                        }
                      >
                        Cancel invitation
                      </Button>
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
