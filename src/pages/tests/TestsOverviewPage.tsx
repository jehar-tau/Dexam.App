import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { EmptyState } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchProgress } from '../../features/testSeries/bankPaper'
import { partALikelihood, readCategory } from '../../features/testSeries/likelihood'
import { fetchLiveEvents, formatWhen } from '../../features/testSeries/liveEvents'
import { previewSearch } from '../../features/testSeries/previewSearch'
import {
  attemptName,
  dayStreak,
  formatMarks,
  percentOf,
  previewProgress,
} from '../../features/testSeries/progressView'
import { useTestAccess } from '../../features/testSeries/testAccess'
import styles from './TestsOverviewPage.module.css'

const upcomingPhases = ['registration', 'waiting', 'part-a', 'break', 'part-b', 'upload']

/** The test-series home: where the student stands and what to do next. */
export function TestsOverviewPage() {
  const search = previewSearch(useLocation().search)
  const preview = search !== ''
  const { session } = useAuth()
  const client = getSupabaseClient()
  const access = useTestAccess(!preview)
  const progress = useQuery({
    queryKey: ['bank-progress', session?.user.id],
    queryFn: () => fetchProgress(client!),
    enabled: !preview && Boolean(client && session),
    staleTime: 30_000,
  })
  const live = useQuery({
    queryKey: ['live-events', session?.user.id],
    queryFn: () => fetchLiveEvents(client!),
    enabled: !preview && Boolean(client && session),
  })
  const [category] = useState(readCategory)
  const [now] = useState(() => Date.now())

  const data = preview ? previewProgress : progress.data
  const attempts = data?.attempts ?? []
  const full = attempts.filter((attempt) => attempt.kind !== 'practice')
  const latest = full.at(-1)
  const band = latest
    ? partALikelihood(latest.exam, latest.score, latest.maxScore, category)?.band
    : undefined
  const weakest = [...(data?.topics ?? [])]
    .filter((topic) => topic.total >= 5)
    .sort((a, b) => a.scored / a.total - b.scored / b.total)[0]
  const upcoming = (live.data ?? [])
    .filter((event) => upcomingPhases.includes(event.schedule.phase))
    .sort((a, b) => Date.parse(a.schedule.partAStartsAt) - Date.parse(b.schedule.partAStartsAt))[0]
  const firstName = access.data?.displayName?.split(' ')[0]

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{firstName ? `Welcome back, ${firstName}` : 'Overview'}</h1>
        <p className={styles.note}>Where you stand, and what to do next.</p>
      </div>

      {!data && !preview && progress.isPending && client && session ? (
        <p className={styles.note}>Loading your progress…</p>
      ) : null}
      {progress.isError ? <p className={styles.note}>{progress.error.message}</p> : null}

      <dl className={styles.stats}>
        <div>
          <dt>Papers and mocks</dt>
          <dd>{full.length}</dd>
        </div>
        <div>
          <dt>Latest score</dt>
          <dd>{latest ? `${Math.round(percentOf(latest))}%` : '—'}</dd>
        </div>
        <div>
          <dt>Shortlisting band</dt>
          <dd>{band ?? '—'}</dd>
        </div>
        <div>
          <dt>Day streak</dt>
          <dd>
            {dayStreak(
              attempts.map((attempt) => attempt.submittedAt),
              now,
            )}
          </dd>
        </div>
      </dl>

      <section className={styles.panel} aria-labelledby="next-title">
        <h2 id="next-title" className={styles.panelTitle}>
          Up next
        </h2>
        <ul className={styles.next}>
          {upcoming ? (
            <li>
              <Link
                className={styles.nextLink}
                to={`/tests/live/${encodeURIComponent(upcoming.key)}`}
              >
                <span className={styles.nextTitle}>{upcoming.title}</span>
                <span className={styles.note}>
                  All-India live mock · Part A {formatWhen(upcoming.schedule.partAStartsAt)}
                  {upcoming.me ? ` · Roll ${upcoming.me.rollNo}` : ' · Register now'}
                </span>
              </Link>
            </li>
          ) : preview ? (
            <li>
              <Link className={styles.nextLink} to={`/tests/live/sample${search}`}>
                <span className={styles.nextTitle}>Sample all-India UCEED live mock</span>
                <span className={styles.note}>All-India live mock · Starting soon</span>
              </Link>
            </li>
          ) : null}
          <li>
            <Link className={styles.nextLink} to={`/tests/mocks${search}`}>
              <span className={styles.nextTitle}>Take a full mock</span>
              <span className={styles.note}>
                Built for you on the 2026 pattern, with questions you have not seen.
              </span>
            </Link>
          </li>
          {weakest ? (
            <li>
              <Link
                className={styles.nextLink}
                to={`/tests/practice?topic=${encodeURIComponent(weakest.slug)}${search ? '&preview=1' : ''}`}
              >
                <span className={styles.nextTitle}>Practise {weakest.name}</span>
                <span className={styles.note}>
                  Your weakest topic so far: {Math.round((weakest.scored / weakest.total) * 100)}%
                  of {weakest.total} questions.
                </span>
              </Link>
            </li>
          ) : null}
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="recent-title">
        <h2 id="recent-title" className={styles.panelTitle}>
          Recent results
        </h2>
        {attempts.length ? (
          <ul className={styles.recent}>
            {[...attempts]
              .reverse()
              .slice(0, 3)
              .map((attempt) => (
                <li key={attempt.attemptId}>
                  <span>{attemptName(attempt)}</span>
                  <span className={styles.mono}>
                    {formatMarks(attempt.score)} / {formatMarks(attempt.maxScore)}
                  </span>
                  {preview ? null : (
                    <Link className={styles.link} to={`/tests/results/${attempt.attemptId}`}>
                      View
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        ) : (
          <EmptyState
            title="No results yet"
            description="Start with one of your free papers; your scores and progress appear here."
            action={
              <Link className={styles.link} to={`/tests/papers${search}`}>
                Go to Papers
              </Link>
            }
          />
        )}
        {attempts.length ? (
          <Link className={styles.link} to={`/tests/analytics${search}`}>
            See all analytics
          </Link>
        ) : null}
      </section>
    </div>
  )
}
