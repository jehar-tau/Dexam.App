import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  fetchPartB,
  partBStatusLabel,
  signPartBMedia,
  type PartB,
} from '../../features/testSeries/partB'
import styles from './PartBResultCard.module.css'

/**
 * F043/F048: Part B on a paper's result page. Before the sitting it offers Part B; afterwards it
 * keeps the uploaded sheets and, once released, the evaluator's marks and feedback per task.
 */
export function PartBResultCard({ attemptId }: { attemptId: string }) {
  const { session } = useAuth()
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['part-b', session?.user.id, attemptId, 'summary'],
    queryFn: async () => {
      const partB = await fetchPartB(client!, attemptId)
      const done = partB.status === 'submitted' || partB.status === 'evaluated'
      return {
        partB,
        urls: done ? await signPartBMedia(client!, partB) : new Map<string, string>(),
      }
    },
    enabled: Boolean(client && session),
    retry: false,
  })
  const partB = query.data?.partB
  if (
    !partB ||
    (partB.kind !== 'paper' && partB.kind !== 'live') ||
    (partB.status === 'none' && partB.available === 0)
  )
    return null
  const done = partB.status === 'submitted' || partB.status === 'evaluated'
  return (
    <section className={styles.panel} aria-labelledby="part-b-card">
      <header className={styles.head}>
        <h2 id="part-b-card" className={styles.heading}>
          Part B: drawing
        </h2>
        {done ? (
          <span
            className={`${styles.badge} ${partB.status === 'evaluated' ? styles.badgeDone : ''}`}
          >
            {partB.status === 'evaluated'
              ? `${partB.score} / ${partB.maxScore}`
              : partBStatusLabel[partB.status]}
          </span>
        ) : null}
      </header>
      <p className={styles.note}>
        {partB.status === 'none'
          ? `${partB.available} drawing ${partB.available === 1 ? 'task is' : 'tasks are'} ready for this paper.`
          : partB.status === 'evaluated'
            ? `Evaluated: ${partB.score} out of ${partB.maxScore}. The evaluator's marks and feedback are below.`
            : partB.status === 'submitted'
              ? 'Submitted. A Dexam evaluator will mark it; the marks and feedback appear here.'
              : 'In progress.'}
      </p>
      {done ? <SheetList partB={partB} urls={query.data!.urls} /> : null}
      {partB.status === 'none' || partB.status === 'drawing' || partB.status === 'uploading' ? (
        <Link className={styles.primary} to={`/tests/part-b/${attemptId}`}>
          {partB.status === 'none' ? 'Start Part B' : 'Continue Part B'}
        </Link>
      ) : null}
    </section>
  )
}

function SheetList({ partB, urls }: { partB: PartB; urls: Map<string, string> }) {
  return (
    <ol className={styles.tasks}>
      {partB.tasks.map((task, index) => (
        <li key={task.id} className={styles.task}>
          <p className={styles.prompt}>
            <strong>Task {index + 1}.</strong> {task.prompt}
          </p>
          <div className={styles.sheets}>
            {task.uploads.length === 0 ? (
              <span className={styles.note}>No sheet uploaded.</span>
            ) : null}
            {task.uploads.map((file, fileIndex) =>
              file.mimeType.startsWith('image/') && urls.get(file.path) ? (
                <a key={file.path} href={urls.get(file.path)} target="_blank" rel="noreferrer">
                  <img
                    src={urls.get(file.path)}
                    alt={`Sheet ${fileIndex + 1} for task ${index + 1}`}
                  />
                </a>
              ) : (
                <a
                  key={file.path}
                  className={styles.pdf}
                  href={urls.get(file.path)}
                  target="_blank"
                  rel="noreferrer"
                >
                  PDF {fileIndex + 1}
                </a>
              ),
            )}
          </div>
          {task.marks !== null ? (
            <p className={styles.feedback}>
              <strong>
                {task.marks} / {task.maxMarks}
              </strong>
              {task.feedback ? ` · ${task.feedback}` : ''}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
