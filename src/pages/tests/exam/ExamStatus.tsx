import type { ReactNode } from 'react'

import {
  questionStatuses,
  type QuestionStatus,
  type StatusCounts,
} from '../../../features/testSeries/examAttempt'
import { statusClassName } from './statusClassName'
import styles from './ExamWindow.module.css'

export function StatusSymbol({
  status,
  children,
}: {
  status: QuestionStatus
  children?: ReactNode
}) {
  return (
    <span className={statusClassName(status)} aria-hidden="true">
      {children}
    </span>
  )
}

/** The official palette legend; with counts in the exam, without them in the instructions. */
export function StatusLegend({ counts }: { counts?: StatusCounts }) {
  return (
    <ul className={styles.legend}>
      {questionStatuses.map(({ status, label }) => (
        <li key={status} className={status === 'answered-review' ? styles.legendWide : undefined}>
          <StatusSymbol status={status}>{counts ? counts[status] : ''}</StatusSymbol>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  )
}
