import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  closeEnrollment,
  listEnrollmentCloseouts,
  type CloseoutEnrollment,
} from '../features/enrolment/enrollmentCloseout'
import styles from './SignInPage.module.css'
export function EnrollmentCloseoutPage() {
  const { session } = useAuth()
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState<CloseoutEnrollment | null>(null)
  const [outcome, setOutcome] = useState<'completed' | 'withdrawn'>('completed'),
    [confirmed, setConfirmed] = useState(false),
    [requestKey, setRequestKey] = useState('')
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const queue = useQuery({
    queryKey: ['enrollment-closeouts', session?.user.id, search],
    queryFn: () => listEnrollmentCloseouts(search),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || busy || !confirmed) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await closeEnrollment(selected.enrollment_id, outcome, confirmed, requestKey)
      setSelected(null)
      setConfirmed(false)
      setMessage(
        'Course closed. The Member ID and other courses remain unchanged; retained work is read-only for 12 months.',
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Closeout unavailable.')
    } finally {
      await queue.refetch()
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout} aria-labelledby="closeout-title">
      <div className={styles.intro}>
        <p className="eyebrow">Enrolment closeout</p>
        <h1 id="closeout-title">End the course, not the student’s identity.</h1>
        <p className={styles.lede}>
          Mark one active course completed or withdrawn. Lessons and new submissions stop for that
          course. Finalized work and published feedback stay privately readable for 12 months,
          subject to current student access.
        </p>
        <p>
          This does not delete an account, restore suspended access, transfer a batch or change
          another course. End time is recorded now; backdating and reactivation are not available.
        </p>
      </div>
      <Card className={styles.card}>
        <Input
          label="Search Member ID or name"
          value={search}
          maxLength={120}
          disabled={busy}
          onChange={(event) => {
            setSearch(event.target.value)
            setSelected(null)
            setConfirmed(false)
          }}
        />
        {queue.isPending ? (
          <p role="status">Loading authorized enrolments…</p>
        ) : queue.isError ? (
          <>
            <p role="alert">Enrolments could not be loaded.</p>
            <Button onClick={() => void queue.refetch()}>Try again</Button>
          </>
        ) : !queue.data.length ? (
          <p>No active or closed enrolments in your current authorized scope.</p>
        ) : (
          queue.data.map((enrollment) => (
            <div key={enrollment.enrollment_id}>
              <h2>
                {enrollment.display_name ?? 'Student'} · {enrollment.member_id}
              </h2>
              <p>
                {enrollment.offering_title} · {enrollment.cohort_name ?? 'Independent enrolment'}
              </p>
              <p>
                {enrollment.status}
                {enrollment.ended_at
                  ? ` · Ended ${new Date(enrollment.ended_at).toLocaleString()}`
                  : ''}
              </p>
              {enrollment.status === 'active' ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => {
                    setSelected(enrollment)
                    setOutcome('completed')
                    setConfirmed(false)
                    setRequestKey(crypto.randomUUID())
                    setError('')
                    setMessage('')
                  }}
                >
                  Review course closeout
                </Button>
              ) : null}
            </div>
          ))
        )}
        {selected ? (
          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            <h2>Confirm this exact course</h2>
            <p>
              {selected.member_id} · {selected.offering_title} ·{' '}
              {selected.cohort_name ?? 'Independent enrolment'}
            </p>
            <label>
              Closeout outcome
              <select
                value={outcome}
                disabled={busy}
                onChange={(event) => {
                  setOutcome(event.target.value as 'completed' | 'withdrawn')
                  setConfirmed(false)
                  setRequestKey(crypto.randomUUID())
                }}
              >
                <option value="completed">Completed — course completed</option>
                <option value="withdrawn">Withdrawn — student withdrew</option>
              </select>
            </label>
            <Callout tone="warning" icon="warning">
              This ends teaching access and new submissions immediately for this course. The student
              can download retained finalized work for 12 months. No undo or account suspension is
              performed here.
            </Callout>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />{' '}
              I checked this student and course and confirm the stated access change.
            </label>
            <Button type="submit" disabled={busy || !confirmed}>
              {busy ? 'Closing securely…' : 'Close this enrolment'}
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setSelected(null)
                setConfirmed(false)
              }}
            >
              Cancel review
            </Button>
          </form>
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
