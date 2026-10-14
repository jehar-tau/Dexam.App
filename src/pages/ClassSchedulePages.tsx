import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, Callout, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  getSchedulingContext,
  getStudentAgenda,
  saveClass,
  type ScheduledClass,
} from '../features/student/classSchedule'
import styles from './SignInPage.module.css'
import fieldStyles from '../components/forms/Input.module.css'
function ClassDetails({ item }: { item: ScheduledClass }) {
  let time = `${item.starts_at} – ${item.ends_at}`
  try {
    const format = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: item.timezone,
    })
    time = `${format.format(new Date(item.starts_at))} – ${format.format(new Date(item.ends_at))}`
  } catch {
    /* UTC timestamps remain explicit. */
  }
  return (
    <>
      <h3>{item.title}</h3>
      <p>
        {item.cancelled_at ? 'Cancelled' : 'Scheduled'} · {time} · {item.timezone}
      </p>
      {item.location ? <p>{item.location}</p> : null}
    </>
  )
}
export function StudentAgendaPage() {
  const { session } = useAuth()
  const agenda = useQuery({
    queryKey: ['student-agenda', session?.user.id],
    queryFn: getStudentAgenda,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  return (
    <section className={styles.layout}>
      <div className={styles.intro}>
        <p className="eyebrow">Class agenda</p>
        <h1>Your classes.</h1>
        <p className={styles.lede}>
          Current one-off classes for your active courses and cohorts. Changes appear here;
          cancelled classes remain clearly marked. This is not an attendance record.
        </p>
        <Link to="/student">Student workspace</Link>
      </div>
      <div>
        {agenda.isPending ? (
          <p role="status">Loading your classes…</p>
        ) : agenda.isError ? (
          <Card>
            <p role="alert">Your class schedule could not be loaded.</p>
            <Button onClick={() => void agenda.refetch()}>Try again</Button>
          </Card>
        ) : !agenda.data.length ? (
          <Card>
            <h2>No classes available</h2>
            <p>Classes appear only for your currently active courses.</p>
          </Card>
        ) : (
          agenda.data.map((item) => (
            <Card key={item.id}>
              <ClassDetails item={item} />
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
export function ClassSchedulingPage() {
  const { session } = useAuth()
  const context = useQuery({
    queryKey: ['staff-class-scheduling', session?.user.id],
    queryFn: getSchedulingContext,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const [offering, setOffering] = useState(''),
    [cohort, setCohort] = useState(''),
    [title, setTitle] = useState(''),
    [start, setStart] = useState(''),
    [end, setEnd] = useState(''),
    [zone, setZone] = useState('Asia/Kolkata'),
    [location, setLocation] = useState(''),
    [selected, setSelected] = useState<ScheduledClass | null>(null),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const course = context.data?.find((item) => item.id === offering)
  function changed() {
    setConfirmed(false)
    setRequestKey(crypto.randomUUID())
    setMessage('')
  }
  function edit(item: ScheduledClass) {
    changed()
    setSelected(item)
    setCohort(item.cohort_id ?? '')
    setTitle(item.title)
    setStart(item.starts_at)
    setEnd(item.ends_at)
    setZone(item.timezone)
    setLocation(item.location ?? '')
  }
  function reset() {
    changed()
    setSelected(null)
    setCohort('')
    setTitle('')
    setStart('')
    setEnd('')
    setLocation('')
  }
  async function submit(cancel: boolean) {
    if (busy || !confirmed || !course) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      if (!cancel) {
        if (!/(Z|[+-]\d{2}:\d{2})$/.test(start) || !/(Z|[+-]\d{2}:\d{2})$/.test(end))
          throw new Error('Enter times with an explicit UTC offset.')
        new Intl.DateTimeFormat(undefined, { timeZone: zone })
      }
      await saveClass({
        p_session_id: selected?.id ?? null,
        p_offering_id: offering,
        p_cohort_id: cohort || null,
        p_title: title,
        p_starts_at: start,
        p_ends_at: end,
        p_timezone: zone,
        p_location: location || null,
        p_expected_revision: selected?.revision ?? 0,
        p_cancel: cancel,
        p_confirmed: confirmed,
        p_request_key: requestKey,
      })
      await context.refetch()
      reset()
      setMessage(cancel ? 'Class cancelled.' : 'Class schedule saved.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Class change unavailable.')
      await context.refetch()
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout}>
      <div className={styles.intro}>
        <p className="eyebrow">Scoped class scheduling</p>
        <h1>Organize one-off classes.</h1>
        <p className={styles.lede}>
          Schedule, reschedule or cancel within your explicitly granted offering. Students receive
          generic in-app change alerts. No recurring series, attendance or external messages are
          created.
        </p>
      </div>
      <div>
        {message ? <p role="status">{message}</p> : null}
        {error ? (
          <Callout tone="warning" icon="warning">
            <p role="alert">{error}</p>
          </Callout>
        ) : null}
        {context.isPending ? (
          <p role="status">Checking scheduling access…</p>
        ) : context.isError ? (
          <Card>
            <p role="alert">Scheduling could not be loaded.</p>
            <Button onClick={() => void context.refetch()}>Try again</Button>
          </Card>
        ) : !context.data.length ? (
          <Card>
            <h2>No scheduling scope</h2>
            <p>An explicit offering-scoped scheduling grant is required.</p>
          </Card>
        ) : (
          <>
            <Card className={styles.form}>
              <div className={fieldStyles.field}>
                <label className={fieldStyles.label} htmlFor="class-offering">
                  Offering
                </label>
                <select
                  className={fieldStyles.input}
                  id="class-offering"
                  value={offering}
                  disabled={busy}
                  onChange={(event) => {
                    setOffering(event.target.value)
                    reset()
                  }}
                >
                  <option value="">Choose offering</option>
                  {context.data.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </div>
              {course ? (
                <>
                  <div className={fieldStyles.field}>
                    <label className={fieldStyles.label} htmlFor="class-cohort">
                      Audience
                    </label>
                    <select
                      className={fieldStyles.input}
                      id="class-cohort"
                      value={cohort}
                      disabled={busy || Boolean(selected)}
                      onChange={(event) => {
                        changed()
                        setCohort(event.target.value)
                      }}
                    >
                      <option value="">Whole offering</option>
                      {course.cohorts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Class title"
                    value={title}
                    disabled={busy}
                    onChange={(event) => {
                      changed()
                      setTitle(event.target.value)
                    }}
                  />
                  <Input
                    label="Start time with UTC offset"
                    hint="Example: 2026-10-20T09:00:00+05:30"
                    value={start}
                    disabled={busy}
                    onChange={(event) => {
                      changed()
                      setStart(event.target.value)
                    }}
                  />
                  <Input
                    label="End time with UTC offset"
                    value={end}
                    disabled={busy}
                    onChange={(event) => {
                      changed()
                      setEnd(event.target.value)
                    }}
                  />
                  <Input
                    label="Display timezone"
                    value={zone}
                    disabled={busy}
                    onChange={(event) => {
                      changed()
                      setZone(event.target.value)
                    }}
                  />
                  <Input
                    label="Classroom or location (plain text only)"
                    value={location}
                    disabled={busy}
                    onChange={(event) => {
                      changed()
                      setLocation(event.target.value)
                    }}
                  />
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={busy}
                      onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    I checked this audience and time, and confirm this schedule change or
                    cancellation.
                  </label>
                  <Button disabled={busy || !confirmed} onClick={() => void submit(false)}>
                    {selected ? 'Save rescheduled class' : 'Schedule class'}
                  </Button>
                  {selected ? (
                    <>
                      <Button
                        variant="secondary"
                        disabled={busy || !confirmed}
                        onClick={() => void submit(true)}
                      >
                        Cancel this class
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={reset}>
                        Start a new class
                      </Button>
                    </>
                  ) : null}
                </>
              ) : null}
            </Card>
            {course?.sessions.map((item) => (
              <Card key={item.id}>
                <ClassDetails item={item} />
                <p>
                  Revision {item.revision} · History retained until{' '}
                  {new Date(item.retention_until).toLocaleDateString()}
                </p>
                {!item.cancelled_at && Date.parse(item.ends_at) > context.dataUpdatedAt ? (
                  <Button variant="secondary" disabled={busy} onClick={() => edit(item)}>
                    Review class change: {item.title}
                  </Button>
                ) : null}
              </Card>
            ))}
          </>
        )}
      </div>
    </section>
  )
}
