import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { EmptyState } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchAttemptResult } from '../../features/testSeries/bankPaper'
import { bankPaperId, findPaper, paperLabel, papers } from '../../features/testSeries/paperCatalog'
import { buildPracticeResult } from '../../features/testSeries/practiceResult'
import {
  categoryLabels,
  examOf,
  LIKELIHOOD_VERSION,
  partALikelihood,
  readCategory,
  saveCategory,
  type Category,
} from '../../features/testSeries/likelihood'
import { previewSearch } from '../../features/testSeries/previewSearch'
import {
  describeKey,
  describeResponse,
  sectionName,
  summariseResult,
  type AttemptResult,
  type Outcome,
  type ResultQuestion,
} from '../../features/testSeries/scoring'
import { ExamFigure } from './exam/ExamFigure'
import { PartBResultCard } from './TestsSketchesPage'
import styles from './TestsResultPage.module.css'

const PREVIEW_PREFIX = 'preview-'

/** The catalogue paper behind a bank paper id, for titles and "take it again" links. */
function catalogForBank(bankId: string) {
  return papers.find((paper) => bankPaperId(paper) === bankId)
}

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2))
const percent = (value: number) => `${Math.round(value * 100)}%`

const outcomeLabels: Record<Outcome, string> = {
  correct: 'Correct',
  partial: 'Part marks',
  wrong: 'Wrong',
  unanswered: 'Not answered',
  dropped: 'Dropped',
  full_marks: 'Full marks',
}

export function TestsResultPage() {
  const { attemptId = '' } = useParams()
  const search = previewSearch(useLocation().search)
  const { session } = useAuth()
  const client = getSupabaseClient()
  const isPreview = attemptId.startsWith(PREVIEW_PREFIX)

  const [previewResult] = useState(() => {
    if (!isPreview || !search) return null
    const paper = findPaper(attemptId.slice(PREVIEW_PREFIX.length))
    return paper ? buildPracticeResult(paper.id, paperLabel(paper)) : null
  })

  const query = useQuery({
    queryKey: ['bank-result', session?.user.id, attemptId],
    queryFn: () =>
      fetchAttemptResult(client!, attemptId, (bankId) => {
        const paper = catalogForBank(bankId)
        return paper ? paperLabel(paper) : bankId.toUpperCase()
      }),
    enabled: !isPreview && Boolean(client && session),
    staleTime: Infinity,
    retry: false,
  })

  const result = isPreview ? previewResult : query.data
  const papersPath = `/tests/papers${search}`

  if (!result) {
    const loading = !isPreview && query.isPending && Boolean(client && session)
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>{loading ? 'Loading your result…' : 'Result not found'}</h1>
        {loading ? null : (
          <div className={styles.panel}>
            <EmptyState
              title="We could not find that result."
              description={
                query.error?.message ??
                'It may belong to another account, or the paper has not been submitted yet.'
              }
              action={
                <Link className={styles.link} to={papersPath}>
                  Back to papers
                </Link>
              }
            />
          </div>
        )}
      </div>
    )
  }

  return <ResultView result={result} search={search} />
}

function ResultView({ result, search }: { result: AttemptResult; search: string }) {
  const summary = summariseResult(result)
  const [filter, setFilter] = useState<'all' | 'wrong' | 'unanswered' | 'correct'>('all')
  const catalog = result.preview ? findPaper(result.paperId) : catalogForBank(result.paperId)
  const practiceMarking = Object.values(result.marking).some((marking) => marking?.practice)

  const shown = result.questions.filter((question) => {
    if (filter === 'all') return true
    if (filter === 'wrong') return question.outcome === 'wrong' || question.outcome === 'partial'
    if (filter === 'unanswered') return question.outcome === 'unanswered'
    return question.outcome === 'correct' || question.outcome === 'full_marks'
  })

  const filters = [
    { key: 'all', label: `All (${summary.counts.total})` },
    { key: 'wrong', label: `Wrong or part (${summary.counts.wrong + summary.counts.partial})` },
    { key: 'unanswered', label: `Not answered (${summary.counts.unanswered})` },
    {
      key: 'correct',
      label: `Correct (${summary.counts.correct + summary.counts.full_marks})`,
    },
  ] as const

  return (
    <div className={styles.page}>
      {result.kind === 'practice' ? (
        <Link className={styles.back} to="/tests/practice">
          ← Back to practice
        </Link>
      ) : (
        <Link className={styles.back} to={`/tests/papers${search}`}>
          ← Back to papers
        </Link>
      )}

      <section className={styles.hero} aria-labelledby="result-title">
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>{result.preview ? 'Preview result' : 'Your result'}</p>
          <h1 id="result-title" className={styles.title}>
            {result.title}
          </h1>
          <p className={styles.meta}>
            {result.submittedAt
              ? `Submitted ${new Date(result.submittedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}`
              : 'Submitted'}
            {result.submitReason === 'time' ? ' · automatically when time ran out' : ''}
            {result.late ? ' · after the deadline' : ''}
          </p>
          {practiceMarking ? (
            <p className={styles.note}>
              Dexam practice marking (+1 per correct answer, no negative marks): this exam does not
              publish a per-question scheme.
            </p>
          ) : null}
        </div>
        <div
          className={styles.score}
          aria-label={`Score ${format(result.score)} out of ${format(result.maxScore)}`}
        >
          <span className={styles.scoreValue}>{format(result.score)}</span>
          <span className={styles.scoreMax}>/ {format(result.maxScore)}</span>
          <span className={styles.scorePercent}>
            {result.maxScore > 0 ? percent(Math.max(0, result.score) / result.maxScore) : '—'}
          </span>
        </div>
        <dl className={styles.stats}>
          <div>
            <dt>Accuracy</dt>
            <dd>{summary.attempted ? percent(summary.accuracy) : '—'}</dd>
          </div>
          <div>
            <dt>Answered</dt>
            <dd>
              {summary.attempted} of {summary.counts.total - summary.counts.dropped}
            </dd>
          </div>
          <div>
            <dt>Correct</dt>
            <dd>{summary.counts.correct + summary.counts.full_marks}</dd>
          </div>
          <div>
            <dt>Part marks</dt>
            <dd>{summary.counts.partial}</dd>
          </div>
          <div>
            <dt>Wrong</dt>
            <dd>{summary.counts.wrong}</dd>
          </div>
        </dl>
      </section>

      {result.kind !== 'practice' ? <LikelihoodCard result={result} /> : null}

      {!result.preview && result.kind !== 'practice' ? (
        <PartBResultCard attemptId={result.attemptId} />
      ) : null}

      <div className={styles.columns}>
        <section className={styles.panel} aria-labelledby="sections-title">
          <h2 id="sections-title" className={styles.panelTitle}>
            By section
          </h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Correct</th>
                  <th scope="col">Part</th>
                  <th scope="col">Wrong</th>
                  <th scope="col">Not answered</th>
                  <th scope="col">Marks</th>
                </tr>
              </thead>
              <tbody>
                {summary.sections.map((section) => (
                  <tr key={section.type}>
                    <th scope="row">{sectionName(section.type)}</th>
                    <td>{section.correct + section.full_marks}</td>
                    <td>{section.partial}</td>
                    <td>{section.wrong}</td>
                    <td>{section.unanswered}</td>
                    <td className={styles.mono}>
                      {format(section.marks)} / {format(section.maxMarks)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="improve-title">
          <h2 id="improve-title" className={styles.panelTitle}>
            Areas to improve
          </h2>
          {summary.improve.length ? (
            <ul className={styles.improveList}>
              {summary.improve.map((topic) => (
                <li key={topic.slug}>
                  <strong>{topic.name}</strong>
                  <span>
                    {topic.scored} of {topic.total} right ·{' '}
                    <Link
                      className={styles.link}
                      to={`/tests/practice?topic=${encodeURIComponent(topic.slug)}${search ? '&preview=1' : ''}`}
                    >
                      Practise
                    </Link>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.note}>
              No topic stands out as weak in this paper. Keep practising across topics.
            </p>
          )}
        </section>
      </div>

      <section className={styles.panel} aria-labelledby="topics-title">
        <h2 id="topics-title" className={styles.panelTitle}>
          Accuracy by topic
        </h2>
        <ul className={styles.topics}>
          {summary.topics.map((topic) => (
            <li key={topic.slug} className={styles.topic}>
              <span className={styles.topicName}>{topic.name}</span>
              <span className={styles.bar} aria-hidden="true">
                <span className={styles.barFill} style={{ width: percent(topic.accuracy) }} />
              </span>
              <span className={styles.mono}>
                {topic.scored}/{topic.total}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.panel} aria-labelledby="review-title">
        <div className={styles.reviewHead}>
          <h2 id="review-title" className={styles.panelTitle}>
            Review your answers
          </h2>
          <div className={styles.filters} role="group" aria-label="Show questions">
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`${styles.filter} ${filter === item.key ? styles.filterActive : ''}`}
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <ol className={styles.review} aria-label="Questions">
          {shown.map((question) => (
            <ReviewItem
              key={question.id}
              question={question}
              index={result.questions.indexOf(question) + 1}
            />
          ))}
        </ol>
        {shown.length ? null : <p className={styles.note}>No questions in this view.</p>}
      </section>

      <div className={styles.actions}>
        {result.kind === 'practice' ? (
          <Link
            className={styles.primary}
            to={`/tests/practice${result.questions[0]?.topic ? `?topic=${encodeURIComponent(result.questions[0].topic)}` : ''}`}
          >
            Practise again
          </Link>
        ) : result.kind === 'mock' ? (
          <Link className={styles.primary} to="/tests/mocks">
            Take another mock
          </Link>
        ) : result.kind === 'live' ? (
          <Link
            className={styles.primary}
            to={`/tests/live/${encodeURIComponent(result.paperId.replace(/^live-/, ''))}`}
          >
            Back to the live mock
          </Link>
        ) : catalog ? (
          <Link className={styles.primary} to={`/tests/exam/${catalog.id}${search}`}>
            Take it again
          </Link>
        ) : null}
        <Link className={styles.link} to={`/tests/papers${search}`}>
          Back to papers
        </Link>
      </div>
    </div>
  )
}

function ReviewItem({ question, index }: { question: ResultQuestion; index: number }) {
  const chosen = Array.isArray(question.response)
    ? question.response
    : question.response
      ? [question.response]
      : []
  const correctSet = new Set(
    question.key?.kind === 'choice'
      ? question.key.correct
      : question.key?.kind === 'multi'
        ? 'correct' in question.key
          ? question.key.correct
          : question.key.alternatives.flat()
        : [],
  )

  return (
    <li className={`${styles.item} ${styles[`item_${question.outcome}`] ?? ''}`}>
      <div className={styles.itemHead}>
        <span className={styles.itemNumber}>
          Question {index} · {sectionName(question.type)}
        </span>
        <span className={styles.itemOutcome}>
          {outcomeLabels[question.outcome]}
          <span className={styles.mono}>
            {question.marks > 0 ? ` +${format(question.marks)}` : ` ${format(question.marks)}`}
          </span>
        </span>
      </div>
      <p className={styles.prompt}>{question.prompt}</p>
      {question.figure ? <ExamFigure id={question.figure} /> : null}
      {question.figures.map((figure, figureIndex) => (
        <img
          key={figure.src}
          className={styles.figure}
          src={figure.src}
          width={figure.width ?? undefined}
          height={figure.height ?? undefined}
          alt={`Figure ${figureIndex + 1} for question ${index}`}
        />
      ))}
      {question.type === 'nat' ? (
        <dl className={styles.answers}>
          <div>
            <dt>Your answer</dt>
            <dd>{describeResponse(question.response)}</dd>
          </div>
          <div>
            <dt>Accepted answer</dt>
            <dd>{describeKey(question.key)}</dd>
          </div>
        </dl>
      ) : (
        <ul className={styles.options}>
          {question.options.map((option) => {
            const mine = chosen.includes(option.key)
            const right = correctSet.has(option.key)
            return (
              <li
                key={option.key}
                className={`${styles.option} ${right ? styles.optionRight : ''} ${mine && !right ? styles.optionWrong : ''}`}
              >
                <span className={styles.optionKey}>{option.key}</span>
                <span className={styles.optionText}>
                  {option.text}
                  {option.image ? <img src={option.image} alt={`Option ${option.key}`} /> : null}
                </span>
                <span className={styles.optionTags}>
                  {mine ? <span className={styles.tag}>Your answer</span> : null}
                  {right ? <span className={styles.tagRight}>Correct</span> : null}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {question.type !== 'nat' &&
      question.key &&
      question.key.kind === 'multi' &&
      'alternatives' in question.key ? (
        <p className={styles.note}>Accepted: {describeKey(question.key)}</p>
      ) : null}
      {question.explanation ? (
        <div className={styles.explanation}>
          <strong>Explanation</strong>
          <p>{question.explanation}</p>
        </div>
      ) : null}
    </li>
  )
}

/** F045: Part A shortlisting likelihood against the published cut-offs (UCEED and CEED). */
function LikelihoodCard({ result }: { result: AttemptResult }) {
  const [category, setCategory] = useState<Category>(readCategory)
  const estimate = partALikelihood(
    examOf(result.exam, result.paperId),
    result.score,
    result.maxScore,
    category,
  )
  if (!estimate) return null
  const choose = (value: Category) => {
    setCategory(value)
    saveCategory(value)
  }
  const years = estimate.cutoffs.map((item) => item.year)
  return (
    <section className={styles.panel} aria-labelledby="likelihood-title">
      <h2 id="likelihood-title" className={styles.panelTitle}>
        Part A shortlisting likelihood
      </h2>
      <p className={styles.likelihoodRow}>
        <span className={`${styles.band} ${styles[`band${estimate.band}`]}`}>{estimate.band}</span>
        <span className={styles.note}>
          Your Part A scales to {estimate.scaled} / {estimate.partAMax} and clears{' '}
          {estimate.cleared} of the last {estimate.cutoffs.length} years&apos;{' '}
          {categoryLabels[category]} cut-offs.
        </span>
      </p>
      <div className={styles.filters} role="group" aria-label="Category">
        {(Object.keys(categoryLabels) as Category[]).map((value) => (
          <button
            key={value}
            type="button"
            className={`${styles.filter} ${category === value ? styles.filterActive : ''}`}
            aria-pressed={category === value}
            onClick={() => choose(value)}
          >
            {categoryLabels[value]}
          </button>
        ))}
      </div>
      <p className={styles.note}>
        Cut-offs {Math.min(...years)}–{Math.max(...years)}:{' '}
        {estimate.cutoffs.map((item) => `${item.year} ${item.cutoff}`).join(' · ')}. Computed from
        the mean and spread {estimate.exam.toUpperCase()} publishes each year.
      </p>
      <p className={styles.note}>
        Dexam estimate ({LIKELIHOOD_VERSION}), not an official prediction. Shortlisting only means
        Part B gets marked; the final rank also depends on Part B.
      </p>
    </section>
  )
}
