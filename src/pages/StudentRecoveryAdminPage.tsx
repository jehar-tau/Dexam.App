import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  cancelStudentRecovery,
  decideStudentRecovery,
  findStudentRecoveryTarget,
  getStudentRecoveryWorkspace,
  issueStudentRecoveryPack,
  proposeStudentRecovery,
  type StudentRecoveryPack,
  type StudentRecoveryTarget,
} from '../features/auth/studentRecovery'
import styles from './SignInPage.module.css'
import securityStyles from './StaffSecurityPage.module.css'
export function StudentRecoveryAdminPage() {
  const { session } = useAuth()
  const workspace = useQuery({
    queryKey: ['student-recovery', session?.user.id, session?.expires_at],
    queryFn: getStudentRecoveryWorkspace,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const [memberId, setMemberId] = useState(''),
    [target, setTarget] = useState<StudentRecoveryTarget | null>(null)
  const [identity, setIdentity] = useState(false),
    [enrolment, setEnrolment] = useState(false)
  const [review, setReview] = useState(''),
    [reviewIdentity, setReviewIdentity] = useState(false),
    [reviewEnrolment, setReviewEnrolment] = useState(false)
  const [pack, setPack] = useState<StudentRecoveryPack | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  useEffect(() => {
    if (!pack) return
    const timer = window.setTimeout(
      () => setPack(null),
      Math.max(0, Date.parse(pack.expiresAt) - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [pack])
  async function act(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    setPack(null)
    try {
      await action()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Recovery unavailable.')
    } finally {
      await workspace.refetch()
      setBusy(false)
    }
  }
  return (
    <section
      className={`${styles.layout} ${securityStyles.recovery}`}
      aria-labelledby="student-admin-recovery-title"
    >
      <div className={styles.intro}>
        <p className="eyebrow">Independently approved student recovery</p>
        <h1 id="student-admin-recovery-title">Help the student, preserve their identity.</h1>
        <p className={styles.lede}>
          Two different Elevated Admins must independently verify established identity and admitted
          enrolment evidence. A name or knowledge of a Member ID is not sufficient. Do not record
          documents, answers or government identifiers here.
        </p>
        <p>
          Proposals and packs expire after 15 minutes. Both administrators must retain recent
          verification. Stop and escalate weak, inconsistent or suspicious evidence.
        </p>
        <Link to="/staff/security?verifyAgain=1&returnTo=%2Fstaff%2Fstudent-recovery">
          Verify your authenticator again
        </Link>
      </div>
      <Card className={styles.card}>
        <Callout tone="warning" icon="warning">
          Fictional local testing only. No real student data. Hosted reset-pack issuance is
          disabled.
        </Callout>
        {workspace.isPending ? (
          <p role="status">Checking recovery authority…</p>
        ) : workspace.isError ? (
          <>
            <p role="alert">Recovery authority or queue unavailable. Verify MFA again.</p>
            <Button onClick={() => void workspace.refetch()}>Refresh queue</Button>
          </>
        ) : (
          <>
            <h2>Find the exact student</h2>
            <form
              className={styles.form}
              onSubmit={(event) => {
                event.preventDefault()
                void act(async () => {
                  const found = await findStudentRecoveryTarget(memberId)
                  setTarget(found)
                  setIdentity(false)
                  setEnrolment(false)
                  if (!found)
                    setMessage(
                      'No eligible claimed student found. Escalate rather than substituting another identity.',
                    )
                })
              }}
            >
              <Input
                label="Exact Dexam Member ID"
                value={memberId}
                required
                disabled={busy}
                onChange={(event) => {
                  setMemberId(event.target.value)
                  setTarget(null)
                  setIdentity(false)
                  setEnrolment(false)
                }}
              />
              <Button type="submit" disabled={busy}>
                Check student identity
              </Button>
            </form>
            {target ? (
              <div className={securityStyles.setup}>
                <h3>
                  {target.display_name ?? 'Student'} · {target.member_id}
                </h3>
                <label>
                  <input
                    type="checkbox"
                    checked={identity}
                    disabled={busy}
                    onChange={(event) => setIdentity(event.target.checked)}
                  />{' '}
                  I verified established student identity with evidence beyond their name or Member
                  ID.
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={enrolment}
                    disabled={busy}
                    onChange={(event) => setEnrolment(event.target.checked)}
                  />{' '}
                  I checked the admitted enrolment record and verified this is the same student.
                </label>
                <Button
                  disabled={busy || !identity || !enrolment}
                  onClick={() =>
                    void act(async () => {
                      await proposeStudentRecovery(target.person_id, identity, enrolment)
                      setTarget(null)
                      setMessage(
                        'Proposal recorded. A different Elevated Admin must independently review before a pack can be issued.',
                      )
                    })
                  }
                >
                  Propose forgotten-password recovery
                </Button>
              </div>
            ) : null}
            <h2>Recovery queue</h2>
            <Button variant="secondary" disabled={busy} onClick={() => void act(async () => {})}>
              Refresh current state
            </Button>
            {!workspace.data.requests.length ? (
              <p>No recovery requests.</p>
            ) : (
              workspace.data.requests.map((request) => (
                <div className={securityStyles.setup} key={request.id}>
                  <h3>
                    {request.display_name ?? 'Student'} · {request.member_id}
                  </h3>
                  <p>
                    {request.status} · Proposal expires{' '}
                    {new Date(request.expires_at).toLocaleString()}
                  </p>
                  {request.status === 'pending' &&
                  request.proposer_person_id !== workspace.data.actorPersonId ? (
                    <>
                      <Button
                        disabled={busy}
                        variant="secondary"
                        onClick={() => {
                          setReview(request.id)
                          setReviewIdentity(false)
                          setReviewEnrolment(false)
                          setPack(null)
                        }}
                      >
                        Independently review evidence
                      </Button>
                      {review === request.id ? (
                        <>
                          <p>
                            Verify this exact student independently. Do not approve solely because
                            another administrator requested it.
                          </p>
                          <label>
                            <input
                              type="checkbox"
                              checked={reviewIdentity}
                              disabled={busy}
                              onChange={(event) => setReviewIdentity(event.target.checked)}
                            />{' '}
                            I independently rechecked established identity.
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={reviewEnrolment}
                              disabled={busy}
                              onChange={(event) => setReviewEnrolment(event.target.checked)}
                            />{' '}
                            I independently rechecked admitted enrolment evidence.
                          </label>
                          <Button
                            disabled={busy || !reviewIdentity || !reviewEnrolment}
                            onClick={() =>
                              void act(async () => {
                                await decideStudentRecovery(
                                  request.id,
                                  true,
                                  reviewIdentity,
                                  reviewEnrolment,
                                )
                                setReview('')
                                setMessage('Independent approval recorded.')
                              })
                            }
                          >
                            Approve this recovery
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              void act(async () => {
                                await decideStudentRecovery(request.id, false, false, false)
                                setReview('')
                                setMessage('Recovery rejected. No password changed.')
                              })
                            }
                          >
                            Reject recovery
                          </Button>
                        </>
                      ) : null}
                    </>
                  ) : request.status === 'pending' ? (
                    <p>
                      Awaiting a different Elevated Admin. You cannot approve your own proposal.
                    </p>
                  ) : null}
                  {request.status === 'approved' ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          setPack(await issueStudentRecoveryPack(request.id))
                        })
                      }
                    >
                      Issue one-time recovery pack
                    </Button>
                  ) : null}
                  {['pending', 'approved', 'issued'].includes(request.status) ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await cancelStudentRecovery(request.id)
                          setMessage('Request cancelled. No access restored.')
                        })
                      }
                    >
                      Cancel recovery
                    </Button>
                  ) : null}
                  {request.status === 'issued' ? (
                    <p>
                      Pack expires{' '}
                      {request.pack_expires_at
                        ? new Date(request.pack_expires_at).toLocaleString()
                        : 'soon'}
                      . Lost packs require deliberate cancellation and fresh independent approval.
                    </p>
                  ) : null}
                  {request.status === 'executing' ? (
                    <Callout tone="warning" icon="warning">
                      Password mutation is in progress or uncertain. Do not supersede, cancel or
                      release it on expiry. Operational investigation is required.
                    </Callout>
                  ) : null}
                </div>
              ))
            )}
          </>
        )}
        {pack && !workspace.isError && !workspace.isPending ? (
          <div className={securityStyles.setup}>
            <h2>Hand over this pack privately</h2>
            <p>
              Only hand it to the verified student. Do not put it in screenshots, tickets, shared
              messages or recordings. It is shown once and cannot be retrieved.
            </p>
            <p>Member ID: {pack.memberId}</p>
            <p>Expires {new Date(pack.expiresAt).toLocaleString()}</p>
            <Input
              label="One-time recovery link"
              value={pack.recoveryURL}
              readOnly
              autoComplete="off"
            />
            <Input label="Backup code" value={pack.backupCode} readOnly autoComplete="off" />
            <Button onClick={() => setPack(null)}>Handover complete — hide credentials</Button>
          </div>
        ) : null}
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
