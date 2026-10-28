import { Link, Navigate, useLocation, useParams } from 'react-router-dom'

import { previewSearch } from '../../features/testSeries/previewSearch'
import { Button, EmptyState } from '../../components'
import {
  exams,
  findPaper,
  freePaperId,
  paperLabel,
  previewProgress,
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
        <div className={styles.actions}>
          <Button disabled>Start timed paper</Button>
          <p className={styles.note}>
            The full exam window (exam-centre login, instructions, timed exam screen) is the next
            build step.
          </p>
        </div>
      </section>
    </div>
  )
}

/** D-057: the old F037 demo URL now opens the new Papers page, keeping preview mode. */
export function LegacyStudentTestsRedirect() {
  const search = previewSearch(useLocation().search)
  return <Navigate replace to={`/tests/papers${search}`} />
}
