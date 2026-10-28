import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import { EmptyState } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  fetchProgress,
  type Progress,
  type ProgressAttempt,
} from '../../features/testSeries/bankPaper'
import { bankPaperId, paperLabel, papers } from '../../features/testSeries/paperCatalog'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { ProgressChart, type ProgressSeries } from './ProgressChart'
import styles from './TestsAnalyticsPage.module.css'

const examNames: Record<string, string> = {
  uceed: 'UCEED',
  ceed: 'CEED',
  nid: 'NID DAT',
  nift: 'NIFT',
}
const examOrder = ['uceed', 'ceed', 'nid', 'nift']

const day = 24 * 60 * 60 * 1000
const fictionalDate = (daysAgo: number) =>
  new Date(Date.UTC(2026, 9, 27) - daysAgo * day).toISOString()

// Fictional preview progress. Real progress comes from get_assessment_progress().
const previewProgress: Progress = {
  attempts: [
    {
      attemptId: '00000000-0000-4000-8000-00000000f001',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2022',
      exam: 'uceed',
      submittedAt: fictionalDate(42),
      score: 76,
      maxScore: 200,
      questionCount: 57,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f002',
      kind: 'paper',
      title: null,
      paperId: 'nid-bdes-2019',
      exam: 'nid',
      submittedAt: fictionalDate(35),
      score: 40,
      maxScore: 100,
      questionCount: 18,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f003',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2023',
      exam: 'uceed',
      submittedAt: fictionalDate(28),
      score: 90,
      maxScore: 200,
      questionCount: 57,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f004',
      kind: 'practice',
      title: 'Practice · Spatial Reasoning',
      paperId: 'practice-all-spatial-reasoning',
      exam: '',
      submittedAt: fictionalDate(21),
      score: 7,
      maxScore: 10,
      questionCount: 10,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f005',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2024',
      exam: 'uceed',
      submittedAt: fictionalDate(14),
      score: 104,
      maxScore: 200,
      questionCount: 57,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f006',
      kind: 'paper',
      title: null,
      paperId: 'nid-bdes-2020',
      exam: 'nid',
      submittedAt: fictionalDate(9),
      score: 55,
      maxScore: 100,
      questionCount: 19,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f007',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2025',
      exam: 'uceed',
      submittedAt: fictionalDate(2),
      score: 128,
      maxScore: 200,
      questionCount: 56,
    },
  ],
  topics: [
    { slug: 'analytical-reasoning', name: 'Analytical Reasoning', total: 24, scored: 9 },
    { slug: 'numerical-reasoning', name: 'Numerical Reasoning', total: 31, scored: 15 },
    { slug: 'design-awareness', name: 'Design Awareness', total: 12, scored: 7 },
    { slug: 'spatial-reasoning', name: 'Spatial Reasoning', total: 40, scored: 29 },
    { slug: 'language', name: 'Language', total: 9, scored: 8 },
  ],
}

const percentOf = (attempt: ProgressAttempt) =>
  attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0

function attemptName(attempt: ProgressAttempt) {
  if (attempt.kind === 'practice') return attempt.title ?? 'Practice set'
  if (attempt.kind === 'mock' || attempt.kind === 'live') return attempt.title ?? 'Mock'
  const paper = papers.find((item) => bankPaperId(item) === attempt.paperId)
  return paper ? paperLabel(paper) : attempt.paperId.toUpperCase()
}

const formatMarks = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2))

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
