import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  fetchLiveEvent,
  fetchLiveStanding,
  formatCountdown,
  formatWhen,
  joinLivePartA,
  nextBoundary,
  registerLiveEvent,
  type LiveEvent,
  type LivePhase,
  type LiveStanding,
} from '../../features/testSeries/liveEvents'
import { previewSearch } from '../../features/testSeries/previewSearch'
import styles from './TestsLivePage.module.css'

const phaseLabels: Record<LivePhase, string> = {
  registration: 'Registration open',
  waiting: 'Waiting room',
  'part-a': 'Part A is live',
  break: 'Break',
  'part-b': 'Part B is live',
  upload: 'Upload window',
  finished: 'Finished',
  cancelled: 'Cancelled',
}

function countdownFor(event: LiveEvent): { label: string; at: string } | null {
  const s = event.schedule
  switch (s.phase) {
    case 'registration':
      return { label: 'Registration closes in', at: s.registrationClosesAt }
    case 'waiting':
      return { label: 'Part A starts in', at: s.partAStartsAt }
    case 'part-a':
      return { label: 'Part A ends in', at: s.partAEndsAt }
    case 'break':
      return { label: 'Part B starts in', at: s.partBStartsAt }
    case 'part-b':
      return { label: 'Part B ends in', at: s.partBEndsAt }
    case 'upload':
      return { label: 'Uploads close in', at: s.uploadEndsAt }
    default:
      return null
  }
}

const rankedPhases: LivePhase[] = ['break', 'part-b', 'upload', 'finished']

/** A fictional event for the student preview, always in the waiting room. */
function previewEvent(now: number): LiveEvent {
  const at = (minutes: number) => new Date(now + minutes * 60_000).toISOString()
  return {
    id: '00000000-0000-4000-8000-0000000000f5',
    key: 'sample',
    title: 'Sample all-India UCEED live mock',
    blueprintKey: 'uceed-2026',
    level: 'bdes',
    status: 'published',
    seatLimit: 5000,
    registered: 1287,
    questionCount: 57,
    taskCount: 2,
    partAMinutes: 120,
    breakMinutes: 15,
    partBMinutes: 60,
    uploadMinutes: 10,
    schedule: {
      registrationClosesAt: at(-5),
      partAStartsAt: at(12),
      partAEndsAt: at(132),
      partBStartsAt: at(147),
      partBEndsAt: at(207),
      uploadEndsAt: at(217),
      phase: 'waiting',
    },
    me: { rollNo: 'SAMPLE-00042', attemptId: null, registeredAt: at(-600) },
  }
}

/** F050: one all-India live mock — registration, waiting room, the shared clock and ranks. */
export function TestsLivePage() {
  const { key = '' } = useParams()
  const preview = previewSearch(useLocation().search) !== ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const owner = session?.user.id
  const [now, setNow] = useState(() => Date.now())
  const [sample] = useState(() => previewEvent(Date.now()))

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const query = useQuery({
    queryKey: ['live-event', owner, key],
    queryFn: () => fetchLiveEvent(client!, key),
    enabled: !preview && Boolean(client && session),
    refetchInterval: 30_000,
    retry: false,
  })
  const event = preview ? sample : query.data

  // Refresh the moment the phase turns, so the right action appears for everyone together.
  const { refetch } = query
  useEffect(() => {
    if (!event || preview) return
    const boundary = nextBoundary(event, Date.now())
    if (boundary === null || boundary - Date.now() > 60 * 60_000) return
    const timer = setTimeout(() => void refetch(), boundary - Date.now() + 1000)
    return () => clearTimeout(timer)
  }, [event, preview, refetch])

  const register = useMutation({
    mutationFn: () => registerLiveEvent(client!, key),
    onSuccess: (data) => {
      queryClient.setQueryData(['live-event', owner, key], data)
      void queryClient.invalidateQueries({ queryKey: ['live-events'] })
    },
  })
  const join = useMutation({
    mutationFn: () => joinLivePartA(client!, key),
    onSuccess: (attempt) => {
      if (attempt.status === 'submitted') {
        void queryClient.invalidateQueries({ queryKey: ['live-event', owner, key] })
        return
      }
      void navigate(`/tests/live/${encodeURIComponent(key)}/run/${attempt.attemptId}`)
    },
  })

  const phase = event?.schedule.phase
  const attemptId = event?.me?.attemptId ?? null
  const standing = useQuery({
    queryKey: ['live-standing', owner, key],
    queryFn: () => fetchLiveStanding(client!, key),
    enabled: !preview && Boolean(client && attemptId && phase && rankedPhases.includes(phase)),
    refetchInterval: 60_000,
  })

  if (!event) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>
          {query.isError ? 'Live mock not found' : 'Loading the live mock…'}
        </h1>
        {query.isError ? (
          <p className={styles.note}>
            {query.error.message} <Link to="/tests/mocks">Back to mocks</Link>
          </p>
        ) : null}
      </div>
    )
  }

  const s = event.schedule
  const countdown = countdownFor(event)
  const seatsLeft = Math.max(0, event.seatLimit - event.registered)

  return (
    <div className={styles.page}>
      <div>
        <p className={styles.eyebrow}>All-India live mock</p>
        <h1 className={styles.title}>{event.title}</h1>
        <p className={styles.meta}>
          {event.blueprintKey === 'uceed-2026' ? 'UCEED' : 'CEED'} 2026 pattern ·{' '}
          {event.questionCount} questions · Part A {event.partAMinutes} min · break{' '}
          {event.breakMinutes} min · Part B {event.partBMinutes} min
        </p>
      </div>

      <section className={styles.banner} aria-label="Status">
        <div>
          <p className={styles.phase}>{phaseLabels[event.schedule.phase]}</p>
          {event.me ? (
            <p className={styles.note}>
              Roll number <strong className={styles.roll}>{event.me.rollNo}</strong>
            </p>
          ) : null}
        </div>
        {countdown ? (
          <p className={styles.countdown} role="timer" aria-label={countdown.label}>
            <span className={styles.countdownLabel}>{countdown.label}</span>
            <span className={styles.clock}>{formatCountdown(Date.parse(countdown.at) - now)}</span>
          </p>
        ) : null}
      </section>

      <section className={styles.panel} aria-labelledby="live-action-title">
        <h2 id="live-action-title" className={styles.panelTitle}>
          {event.me ? 'Your seat' : 'Take part'}
        </h2>
        <PhaseAction
          event={event}
          preview={preview}
          registering={register.isPending}
          joining={join.isPending}
          onRegister={() => register.mutate()}
          onJoin={() => join.mutate()}
          seatsLeft={seatsLeft}
          submitted={join.data?.status === 'submitted'}
        />
        {register.isError ? (
          <p className={styles.error} role="alert">
            {register.error.message}
          </p>
        ) : null}
        {join.isError ? (
          <p className={styles.error} role="alert">
            {join.error.message}
          </p>
        ) : null}
      </section>

      {standing.data ? <StandingCard standing={standing.data} /> : null}
      {standing.isError ? <p className={styles.note}>{standing.error.message}</p> : null}

      <section className={styles.panel} aria-labelledby="live-schedule-title">
        <h2 id="live-schedule-title" className={styles.panelTitle}>
          Schedule
        </h2>
        <dl className={styles.schedule}>
          <div>
            <dt>Registration closes</dt>
            <dd>{formatWhen(s.registrationClosesAt)}</dd>
          </div>
          <div>
            <dt>Part A</dt>
            <dd>
              {formatWhen(s.partAStartsAt)} – {formatWhen(s.partAEndsAt)}
            </dd>
          </div>
          <div>
            <dt>Break</dt>
            <dd>{event.breakMinutes} minutes</dd>
          </div>
          <div>
            <dt>Part B</dt>
            <dd>
              {formatWhen(s.partBStartsAt)} – {formatWhen(s.partBEndsAt)}
            </dd>
          </div>
          <div>
            <dt>Uploads close</dt>
            <dd>{formatWhen(s.uploadEndsAt)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.panel} aria-labelledby="live-rules-title">
        <h2 id="live-rules-title" className={styles.panelTitle}>
          How the live mock works
        </h2>
        <ul className={styles.rules}>
          <li>
            Everyone gets the same paper, and the questions are released only when Part A starts.
          </li>
          <li>
            Part A ends at the same time for everyone, however late you enter, and submits itself
            when the time is up.
          </li>
          <li>
            Ranks, answers and explanations open when Part A ends. Papers submitted after the time
            are not ranked.
          </li>
          <li>
            After the break, Part B runs on the same clock, then you have {event.uploadMinutes}{' '}
            minutes to upload photos or scans of your sheets.
          </li>
          <li>Questions in this paper count as seen, so they never appear in your later mocks.</li>
        </ul>
      </section>

      {preview ? (
        <p className={styles.note}>Preview shows a sample event. Sign in to see real events.</p>
      ) : null}
      <Link className={styles.link} to="/tests/mocks">
        Back to mocks
      </Link>
    </div>
  )
}

function PhaseAction({
  event,
  preview,
  registering,
  joining,
  onRegister,
  onJoin,
  seatsLeft,
  submitted,
}: {
  event: LiveEvent
  preview: boolean
  registering: boolean
  joining: boolean
  onRegister: () => void
  onJoin: () => void
  seatsLeft: number
  submitted: boolean
}) {
  const s = event.schedule
  const me = event.me
  if (s.phase === 'cancelled') return <p className={styles.note}>This live mock was cancelled.</p>
  if (!me) {
    if (s.phase !== 'registration') {
      return <p className={styles.note}>Registration has closed for this live mock.</p>
    }
    return (
      <>
        <p className={styles.note}>
          {seatsLeft > 0
            ? `${seatsLeft.toLocaleString('en-IN')} of ${event.seatLimit.toLocaleString('en-IN')} seats left.`
            : 'All seats are taken.'}
        </p>
        <button
          type="button"
          className={styles.primary}
          disabled={preview || registering || seatsLeft === 0}
          onClick={onRegister}
        >
          {registering ? 'Registering…' : 'Register'}
        </button>
      </>
    )
  }
  switch (s.phase) {
    case 'registration':
    case 'waiting':
      return (
        <p className={styles.note}>
          You are registered. Come back to this page a few minutes before{' '}
          {formatWhen(s.partAStartsAt)}; the Enter Part A button appears when Part A starts.
        </p>
      )
    case 'part-a':
      return submitted ? (
        <p className={styles.note}>
          Part A is submitted. Your rank and answers open at {formatWhen(s.partAEndsAt)}.
        </p>
      ) : (
        <button
          type="button"
          className={styles.primary}
          disabled={preview || joining}
          onClick={onJoin}
        >
          {joining ? 'Opening Part A…' : me.attemptId ? 'Return to Part A' : 'Enter Part A'}
        </button>
      )
    case 'break':
      return (
        <p className={styles.note}>
          {me.attemptId
            ? `Part B opens at ${formatWhen(s.partBStartsAt)}. Keep paper, pencils and colours ready.`
            : 'You did not take Part A, so Part B is not available.'}
        </p>
      )
    case 'part-b':
    case 'upload':
      return me.attemptId ? (
        <Link className={styles.primary} to={`/tests/part-b/${me.attemptId}`}>
          {s.phase === 'part-b' ? 'Open Part B' : 'Upload your sheets'}
        </Link>
      ) : (
        <p className={styles.note}>You did not take Part A, so Part B is not available.</p>
      )
    default:
      return me.attemptId ? (
        <Link className={styles.primary} to={`/tests/results/${me.attemptId}`}>
          See your answers
        </Link>
      ) : (
        <p className={styles.note}>You did not take part in this live mock.</p>
      )
  }
}

function StandingCard({ standing }: { standing: LiveStanding }) {
  return (
    <section className={styles.panel} aria-labelledby="live-standing-title">
      <h2 id="live-standing-title" className={styles.panelTitle}>
        Dexam cohort rank
      </h2>
      {standing.ranked && standing.rank !== null ? (
        <p className={styles.standing}>
          <span className={styles.clock}>
            {standing.rank} / {standing.participants}
          </span>
          {standing.percentile !== null ? (
            <span className={styles.note}> · {standing.percentile} percentile</span>
          ) : null}
          <span className={styles.note}>
            {' '}
            · Part A {standing.score} / {standing.maxScore}
          </span>
        </p>
      ) : (
        <p className={styles.note}>
          {standing.submitted
            ? 'Your Part A was submitted after the time ended, so it is not ranked.'
            : 'You did not submit Part A, so you are not ranked.'}
        </p>
      )}
      <p className={styles.note}>
        A Dexam estimate among participants who submitted on time — not an official rank.
      </p>
      {standing.top.length ? (
        <table className={styles.table}>
          <caption className={styles.caption}>Top {standing.top.length}</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Roll number</th>
              <th scope="col">Part A</th>
            </tr>
          </thead>
          <tbody>
            {standing.top.map((row) => (
              <tr key={row.rollNo}>
                <td>{standing.top.filter((other) => other.score > row.score).length + 1}</td>
                <td>{row.rollNo}</td>
                <td>{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <Link className={styles.link} to={`/tests/results/${standing.attemptId}`}>
        See your Part A answers
      </Link>
    </section>
  )
}
