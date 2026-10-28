import type { QuestionStatus } from '../../../features/testSeries/examAttempt'
import styles from './ExamWindow.module.css'

const symbolClass: Record<QuestionStatus, string | undefined> = {
  'not-visited': styles.statusNotVisited,
  'not-answered': styles.statusNotAnswered,
  answered: styles.statusAnswered,
  review: styles.statusReview,
  'answered-review': styles.statusAnsweredReview,
}

export function statusClassName(status: QuestionStatus): string {
  return `${styles.status} ${symbolClass[status] ?? ''}`
}
