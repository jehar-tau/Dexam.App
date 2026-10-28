import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchPaperReadiness } from '../../features/testSeries/bankPaper'

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
            <dd>{isFree ? 'Free paper' : 'Included in your plan'}</dd>
          </div>
          <div>
            <dt>Your best</dt>
            <dd>{progress ? `${progress.bestScore}/${paper.maxMarks}` : 'Not attempted'}</dd>
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

/** For signed-in students: how much of the paper has been reviewed, and the way in. */
function BankPaperActions({ paper }: { paper: CatalogPaper }) {
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
      <p className={styles.note}>
        {counts.ready === counts.objective
          ? `All ${counts.objective} questions are ready.`
          : `${counts.ready} of ${counts.objective} questions have been reviewed and are ready; the rest appear once they are checked.`}
      </p>
    </div>
  )
}

/** D-057: the old F037 demo URL now opens the new Papers page, keeping preview mode. */
export function LegacyStudentTestsRedirect() {
  const search = previewSearch(useLocation().search)
  return <Navigate replace to={`/tests/papers${search}`} />
}
