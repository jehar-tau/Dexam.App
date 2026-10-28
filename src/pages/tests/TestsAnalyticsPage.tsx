import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { EmptyState } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchProgress } from '../../features/testSeries/bankPaper'
import { categoryLabels, partALikelihood, readCategory } from '../../features/testSeries/likelihood'
import { previewSearch } from '../../features/testSeries/previewSearch'
import {
  attemptName,
  formatMarks,
  percentOf,
  previewProgress,
} from '../../features/testSeries/progressView'
import { ProgressChart, type ProgressSeries } from './ProgressChart'
import styles from './TestsAnalyticsPage.module.css'

const examNames: Record<string, string> = {
  uceed: 'UCEED',
  ceed: 'CEED',
  nid: 'NID DAT',
  nift: 'NIFT',
}
const examOrder = ['uceed', 'ceed', 'nid', 'nift']

export function TestsAnalyticsPage() {
  const search = previewSearch(useLocation().search)
  const preview = search !== ''
  const { session } = useAuth()
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['bank-progress', session?.user.id],
    queryFn: () => fetchProgress(client!),
    enabled: !preview && Boolean(client && session),
    staleTime: 30_000,
  })

  const progress = preview ? previewProgress : query.data
  const [category] = useState(readCategory)

  if (!progress) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Analytics</h1>
        <p className={styles.note}>
          {query.isError ? query.error.message : 'Loading your progress…'}
        </p>
      </div>
    )
  }

  // Full papers and mocks are both timed full-length sittings.
  const paperAttempts = progress.attempts.filter((attempt) => attempt.kind !== 'practice')
  const practiceAttempts = progress.attempts.filter((attempt) => attempt.kind === 'practice')
  const totals = progress.topics.reduce(
    (sum, topic) => ({ total: sum.total + topic.total, scored: sum.scored + topic.scored }),
    { total: 0, scored: 0 },
  )
  const percents = paperAttempts.map(percentOf)
  const average = percents.length ? percents.reduce((a, b) => a + b, 0) / percents.length : null
  const best = percents.length ? Math.max(...percents) : null

  const series: ProgressSeries[] = examOrder
    .map((exam) => ({
      key: exam,
      name: examNames[exam]!,
      points: paperAttempts
        .filter((attempt) => attempt.exam === exam)
        .map((attempt) => ({
          id: attempt.attemptId,
          time: Date.parse(attempt.submittedAt),
          percent: percentOf(attempt),
          label: attemptName(attempt),
        })),
    }))
    .filter((entry) => entry.points.length > 0)

  if (!progress.attempts.length) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Analytics</h1>
        <div className={styles.panel}>
          <EmptyState
            title="No results yet"
            description="Take a paper or a practice set. Your scores, progress chart and topic strengths appear here."
            action={
              <Link className={styles.link} to={`/tests/papers${search}`}>
                Go to Papers
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Analytics</h1>
        {preview ? <p className={styles.note}>Preview: fictional progress.</p> : null}
      </div>

      <dl className={styles.stats}>
        <div>
          <dt>Papers taken</dt>
          <dd>{paperAttempts.length}</dd>
        </div>
        <div>
          <dt>Average paper score</dt>
          <dd>{average === null ? '—' : `${Math.round(average)}%`}</dd>
        </div>
        <div>
          <dt>Best paper score</dt>
          <dd>{best === null ? '—' : `${Math.round(best)}%`}</dd>
        </div>
        <div>
          <dt>Practice sets</dt>
          <dd>{practiceAttempts.length}</dd>
        </div>
        <div>
          <dt>Questions marked right</dt>
          <dd>{totals.total ? `${Math.round((totals.scored / totals.total) * 100)}%` : '—'}</dd>
        </div>
      </dl>

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
          {progress.topics.map((topic) => {
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
                  to={`/tests/practice?topic=${encodeURIComponent(topic.slug)}${search ? '&preview=1' : ''}`}
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
          History
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
              {[...progress.attempts].reverse().map((attempt) => (
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
                      : (partALikelihood(attempt.exam, attempt.score, attempt.maxScore, category)
                          ?.band ?? '—')}
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
    </div>
  )
}
