import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchMyAttempts, fetchPaperReadiness } from '../../features/testSeries/bankPaper'
import { paperAccess, useTestAccess } from '../../features/testSeries/testAccess'

import { previewSearch } from '../../features/testSeries/previewSearch'
import { EmptyState } from '../../components'
import {
  bankPaperId,
  exams,
  findPaper,
  freePaperId,
  paperLabel,
  previewProgress,
  type CatalogPaper,
} from '../../features/testSeries/paperCatalog'
import styles from './TestsSectionPages.module.css'

/** Sections that exist in the navigation but are built in later steps of D-057. */
export function TestsComingSoonPage({
  title,
  description,
}: {
  title: string
  description: string
}) {
  const search = previewSearch(useLocation().search)
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.panel}>
        <EmptyState
          title="Coming in a later build step"
          description={description}
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

export function TestsPaperPage() {
  const { paperId = '' } = useParams()
  const search = previewSearch(useLocation().search)
  const paper = findPaper(paperId)

  if (!paper) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Paper not found</h1>
        <div className={styles.panel}>
          <EmptyState
            title="We could not find that paper."
            description="It may have been renamed or removed from the catalogue."
            action={
              <Link className={styles.link} to={`/tests/papers${search}`}>
                Back to papers
              </Link>
            }
          />
        </div>
      </div>
    )
  }

  const exam = exams.find((item) => item.key === paper.exam)
  const progress = search ? previewProgress[paper.id] : undefined
  const isFree = freePaperId(paper.exam) === paper.id

  return (
    <div className={styles.page}>
      <Link className={styles.back} to={`/tests/papers${search}`}>
        ← Back to papers
      </Link>
      <section className={styles.panel} aria-labelledby="paper-title">
        <p className={styles.eyebrow}>{exam?.description}</p>
        <h1 id="paper-title" className={styles.title}>
          {paperLabel(paper)}
        </h1>
        <dl className={styles.facts}>
          <div>
            <dt>Maximum marks</dt>
            <dd>{paper.maxMarks}</dd>
          </div>
          <div>
            <dt>Access</dt>
            <dd>
              {search ? (
                isFree ? (
                  'Free paper'
                ) : (
                  'Included in your plan'
                )
              ) : (
                <AccessFact paper={paper} />
              )}
            </dd>
          </div>
          <div>
            <dt>Your best</dt>
            <dd>
              {search ? (
                progress ? (
                  `${progress.bestScore}/${paper.maxMarks}`
                ) : (
                  'Not attempted'
                )
              ) : (
                <BankBest paper={paper} />
              )}
            </dd>
          </div>
        </dl>
        {search ? (
          <div className={styles.actions}>
            <Link className={styles.start} to={`/tests/exam/${paper.id}${search}`}>
              Start timed paper
            </Link>
            <p className={styles.note}>Preview opens a fictional practice paper.</p>
          </div>
        ) : (
          <BankPaperActions paper={paper} />
        )}
      </section>
    </div>
  )
}

const formatMarks = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2))

function useMyAttempts() {
  const { session } = useAuth()
  const client = getSupabaseClient()
  return useQuery({
    queryKey: ['bank-attempts', session?.user.id],
    queryFn: () => fetchMyAttempts(client!),
    enabled: Boolean(client && session),
    staleTime: 30_000,
  })
}

function submittedFor(paper: CatalogPaper, attempts: Awaited<ReturnType<typeof fetchMyAttempts>>) {
  const bankId = bankPaperId(paper)
  return attempts.filter((attempt) => attempt.paperId === bankId && attempt.status === 'submitted')
}

function BankBest({ paper }: { paper: CatalogPaper }) {
  const attempts = useMyAttempts()
  const submitted = submittedFor(paper, attempts.data ?? [])
  const best = submitted.reduce<(typeof submitted)[number] | null>(
    (top, attempt) => (!top || (attempt.score ?? 0) > (top.score ?? 0) ? attempt : top),
    null,
  )
  return best ? (
    <>{`${formatMarks(best.score ?? 0)}/${formatMarks(best.maxScore ?? 0)}`}</>
  ) : (
    <>Not attempted</>
  )
}

function PaperAttempts({ paper }: { paper: CatalogPaper }) {
  const attempts = useMyAttempts()
  const submitted = submittedFor(paper, attempts.data ?? [])
  if (!submitted.length) return null
  return (
    <div className={styles.attempts}>
      <h2 className={styles.attemptsTitle}>Your attempts</h2>
      <ul className={styles.attemptList}>
        {submitted.map((attempt) => (
          <li key={attempt.attemptId}>
            <span>
              {attempt.submittedAt
                ? new Date(attempt.submittedAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Submitted'}
            </span>
            <span className={styles.attemptScore}>
              {formatMarks(attempt.score ?? 0)} / {formatMarks(attempt.maxScore ?? 0)}
            </span>
            <Link className={styles.link} to={`/tests/results/${attempt.attemptId}`}>
              View result
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** For signed-in students: how much of the paper has been reviewed, and the way in. */
function AccessFact({ paper }: { paper: CatalogPaper }) {
  const access = useTestAccess()
  if (access.data?.kind === 'student') return <>Included with your coaching</>
  const state = paperAccess(paper, access.data)
  return (
    <>
      {state === 'free-claimed'
        ? 'Your free paper'
        : state === 'free-choice'
          ? 'Free (your first paper of this exam)'
          : state === 'locked'
            ? 'Locked'
            : 'Included'}
    </>
  )
}

function BankPaperActions({ paper }: { paper: CatalogPaper }) {
  const access = useTestAccess()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const readiness = useQuery({
    queryKey: ['bank-paper-readiness', session?.user.id],
    queryFn: () => fetchPaperReadiness(client!),
    enabled: Boolean(client && session),
    staleTime: 60_000,
  })
  const bankId = bankPaperId(paper)
  const counts = bankId ? readiness.data?.get(bankId) : undefined

  if (readiness.isPending && bankId && client) {
    return <p className={styles.note}>Checking which questions are ready…</p>
  }
  if (readiness.isError) {
    return <p className={styles.note}>Paper availability could not be loaded. Please try again.</p>
  }
  const testAccess = access.data
  const state = paperAccess(paper, testAccess)
  if (state === 'locked') {
    return (
      <div className={styles.actions}>
        <p className={styles.note}>
          {testAccess?.freeSlots.some((slot) => slot.slot === paper.exam)
            ? 'You have used your free paper for this exam. More papers unlock with a plan, coming soon.'
            : 'This paper belongs to the other programme. Change your programme on the welcome page, or unlock it with a plan when plans arrive.'}
        </p>
        <PaperAttempts paper={paper} />
      </div>
    )
  }
  if (!counts?.ready) {
    return (
      <div className={styles.actions}>
        <p className={styles.note}>
          This paper is still being reviewed. Its questions appear once their figures, options and
          answer keys have been checked.
        </p>
      </div>
    )
  }
  return (
    <div className={styles.actions}>
      <Link className={styles.start} to={`/tests/exam/${paper.id}`}>
        Start timed paper
      </Link>
      {state === 'free-choice' ? (
        <p className={styles.note}>
          Starting this paper uses your free{' '}
          {paper.exam.startsWith('nid')
            ? 'NID DAT'
            : paper.exam.startsWith('nift')
              ? 'NIFT'
              : paper.exam.toUpperCase()}{' '}
          paper.
        </p>
      ) : null}
      <p className={styles.note}>
        {counts.ready === counts.objective
          ? `All ${counts.objective} questions are ready.`
          : `${counts.ready} of ${counts.objective} questions have been reviewed and are ready; the rest appear once they are checked.`}
      </p>
      <PaperAttempts paper={paper} />
    </div>
  )
}

/** D-057: the old F037 demo URL now opens the new Papers page, keeping preview mode. */
export function LegacyStudentTestsRedirect() {
  const search = previewSearch(useLocation().search)
  return <Navigate replace to={`/tests/papers${search}`} />
}
