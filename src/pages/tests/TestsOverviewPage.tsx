import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { EmptyState } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchProgress } from '../../features/testSeries/bankPaper'
import { categoryLabels, partALikelihood, readCategory } from '../../features/testSeries/likelihood'
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
import { ProgressChart, type ProgressSeries } from './ProgressChart'
import styles from './TestsOverviewPage.module.css'

const upcomingPhases = ['registration', 'waiting', 'part-a', 'break', 'part-b', 'upload']

const examNames: Record<string, string> = {
  uceed: 'UCEED',
  ceed: 'CEED',
  nid: 'NID DAT',
  nift: 'NIFT',
}
const examOrder = ['uceed', 'ceed', 'nid', 'nift']

/**
 * The test-series home (Overview and Analytics in one page): where the student stands, what to
 * do next, the progress chart, topic strengths and every result.
 */
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
  // Full papers, mocks and live mocks are all timed full-length sittings.
  const full = attempts.filter((attempt) => attempt.kind !== 'practice')
  const latest = full.at(-1)
  const band = latest
    ? partALikelihood(latest.exam, latest.score, latest.maxScore, category)?.band
    : undefined
  const percents = full.map(percentOf)
  const best = percents.length ? Math.max(...percents) : null
  const totals = (data?.topics ?? []).reduce(
    (sum, topic) => ({ total: sum.total + topic.total, scored: sum.scored + topic.scored }),
    { total: 0, scored: 0 },
  )
  const weakest = [...(data?.topics ?? [])]
    .filter((topic) => topic.total >= 5)
    .sort((a, b) => a.scored / a.total - b.scored / b.total)[0]
  const upcoming = (live.data ?? [])
    .filter((event) => upcomingPhases.includes(event.schedule.phase))
    .sort((a, b) => Date.parse(a.schedule.partAStartsAt) - Date.parse(b.schedule.partAStartsAt))[0]
  const firstName = access.data?.displayName?.split(' ')[0]
  const practiceLink = (slug: string) =>
    `/tests/practice?topic=${encodeURIComponent(slug)}${search ? '&preview=1' : ''}`

  const series: ProgressSeries[] = examOrder
    .map((exam) => ({
      key: exam,
      name: examNames[exam]!,
      points: full
        .filter((attempt) => attempt.exam === exam)
        .map((attempt) => ({
          id: attempt.attemptId,
          time: Date.parse(attempt.submittedAt),
          percent: percentOf(attempt),
          label: attemptName(attempt),
        })),
    }))
    .filter((entry) => entry.points.length > 0)

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{firstName ? `Welcome back, ${firstName}` : 'Overview'}</h1>
        <p className={styles.note}>
          {preview
            ? 'Preview: fictional progress.'
            : 'Where you stand, how you are improving and what to do next.'}
        </p>
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
          <dt>Best score</dt>
          <dd>{best === null ? '—' : `${Math.round(best)}%`}</dd>
        </div>
        <div>
          <dt>Shortlisting band</dt>
          <dd>{band ?? '—'}</dd>
        </div>
        <div>
          <dt>Questions marked right</dt>
          <dd>{totals.total ? `${Math.round((totals.scored / totals.total) * 100)}%` : '—'}</dd>
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
              <Link className={styles.nextLink} to={practiceLink(weakest.slug)}>
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

      {data && !attempts.length ? (
        <section className={styles.panel} aria-label="Your progress">
          <EmptyState
            title="No results yet"
            description="Take a paper or a practice set. Your scores, progress chart and topic strengths appear here."
            action={
              <Link className={styles.link} to={`/tests/papers${search}`}>
                Go to Papers
              </Link>
            }
          />
        </section>
      ) : null}

      {attempts.length ? (
        <>
          <section className={styles.panel} aria-labelledby="progress-title">
            <h2 id="progress-title" className={styles.panelTitle}>
              Paper scores over time
            </h2>
            {series.length ? (
              <ProgressChart series={series} />
            ) : (
              <p className={styles.note}>Take a full paper to start your progress chart.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="topics-title">
            <h2 id="topics-title" className={styles.panelTitle}>
              Topic strengths
            </h2>
            <p className={styles.note}>Weakest first, across every paper and practice set.</p>
            <ul className={styles.topics}>
              {data!.topics.map((topic) => {
                const share = topic.total ? topic.scored / topic.total : 0
                return (
                  <li key={topic.slug} className={styles.topic}>
                    <span className={styles.topicName}>{topic.name}</span>
                    <span className={styles.bar} aria-hidden="true">
                      <span
                        className={styles.barFill}
                        style={{ width: `${Math.round(share * 100)}%` }}
                      />
                    </span>
                    <span className={styles.mono}>
                      {topic.scored}/{topic.total}
                    </span>
                    <Link
                      className={styles.link}
                      to={practiceLink(topic.slug)}
                      aria-label={`Practise ${topic.name}`}
                    >
                      Practise
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>

          <section className={styles.panel} aria-labelledby="history-title">
            <h2 id="history-title" className={styles.panelTitle}>
              Results
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Paper or set</th>
                    <th scope="col">Score</th>
                    <th scope="col">%</th>
                    <th scope="col">
                      <abbr
                        title={`Part A shortlisting likelihood, ${categoryLabels[category]} (Dexam estimate)`}
                      >
                        Band
                      </abbr>
                    </th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Result</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...attempts].reverse().map((attempt) => (
                    <tr key={attempt.attemptId}>
                      <td>
                        {new Date(attempt.submittedAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <th scope="row">{attemptName(attempt)}</th>
                      <td className={styles.mono}>
                        {formatMarks(attempt.score)} / {formatMarks(attempt.maxScore)}
                      </td>
                      <td className={styles.mono}>{Math.round(percentOf(attempt))}%</td>
                      <td>
                        {attempt.kind === 'practice'
                          ? '—'
                          : (partALikelihood(
                              attempt.exam,
                              attempt.score,
                              attempt.maxScore,
                              category,
                            )?.band ?? '—')}
                      </td>
                      <td>
                        {preview ? null : (
                          <Link className={styles.link} to={`/tests/results/${attempt.attemptId}`}>
                            View result
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
