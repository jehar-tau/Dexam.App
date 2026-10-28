import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'

import { EmptyState } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  fetchPartB,
  listMyPartB,
  partBStatusLabel,
  signPartBMedia,
  type PartB,
} from '../../features/testSeries/partB'
import { bankPaperId, paperLabel, papers } from '../../features/testSeries/paperCatalog'
import { previewSearch } from '../../features/testSeries/previewSearch'
import styles from './TestsSketchesPage.module.css'

const titleFor = (bankId: string) => {
  const paper = papers.find((item) => bankPaperId(item) === bankId)
  return paper ? paperLabel(paper) : bankId.toUpperCase()
}

/** F043/F048: the student's Part B sittings, sheets and evaluator feedback. */
export function TestsSketchesPage() {
  const search = previewSearch(useLocation().search)
  const { session } = useAuth()
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['my-part-b', session?.user.id],
    queryFn: async () => {
      const list = await listMyPartB(client!)
      const urls = new Map<string, string>()
      for (const item of list) {
        for (const [path, url] of await signPartBMedia(client!, item)) urls.set(path, url)
      }
      return { list, urls }
    },
    enabled: !search && Boolean(client && session),
  })

  if (search) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Sketches</h1>
        <div className={styles.panel}>
          <EmptyState
            title="Your Part B drawings appear here"
            description="After a paper's Part B, your uploaded sheets, marks and evaluator feedback are kept here. Sign in as a student to see yours."
          />
        </div>
      </div>
    )
  }

  if (!query.data) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Sketches</h1>
        <p className={styles.note}>
          {query.isError ? query.error.message : 'Loading your sketches…'}
        </p>
      </div>
    )
  }

  const { list, urls } = query.data
  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>Sketches</h1>
        <p className={styles.note}>Your Part B drawing sheets, marks and evaluator feedback.</p>
      </div>
      {list.length === 0 ? (
        <div className={styles.panel}>
          <EmptyState
            title="No drawings yet"
            description="Papers with a Part B offer it after Part A. Your uploaded sheets will be kept here."
            action={
              <Link className={styles.link} to="/tests/papers">
                Go to Papers
              </Link>
            }
          />
        </div>
      ) : (
        list.map((item) => <SittingCard key={item.attemptId} item={item} urls={urls} />)
      )}
    </div>
  )
}

function SittingCard({ item, urls }: { item: PartB; urls: Map<string, string> }) {
  return (
    <section className={styles.panel} aria-label={`${titleFor(item.paperId)} Part B`}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.heading}>{titleFor(item.paperId)} · Part B</h2>
          <p className={styles.note}>
            {item.submittedAt
              ? new Date(item.submittedAt).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : partBStatusLabel[item.status]}
          </p>
        </div>
        <span className={`${styles.badge} ${item.status === 'evaluated' ? styles.badgeDone : ''}`}>
          {item.status === 'evaluated'
            ? `${item.score} / ${item.maxScore}`
            : partBStatusLabel[item.status]}
        </span>
      </header>
      <ol className={styles.tasks}>
        {item.tasks.map((task, index) => (
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
      {item.status === 'drawing' || item.status === 'uploading' ? (
        <Link className={styles.link} to={`/tests/part-b/${item.attemptId}`}>
          Continue Part B
        </Link>
      ) : null}
    </section>
  )
}

/** Part B status on a paper's result page. */
export function PartBResultCard({ attemptId }: { attemptId: string }) {
  const { session } = useAuth()
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['part-b', session?.user.id, attemptId, 'summary'],
    queryFn: () => fetchPartB(client!, attemptId),
    enabled: Boolean(client && session),
    retry: false,
  })
  const partB = query.data
  if (!partB || partB.kind !== 'paper' || (partB.status === 'none' && partB.available === 0))
    return null
  return (
    <section className={styles.panel} aria-labelledby="part-b-card">
      <h2 id="part-b-card" className={styles.heading}>
        Part B: drawing
      </h2>
      <p className={styles.note}>
        {partB.status === 'none'
          ? `${partB.available} drawing ${partB.available === 1 ? 'task is' : 'tasks are'} ready for this paper.`
          : partB.status === 'evaluated'
            ? `Evaluated: ${partB.score} out of ${partB.maxScore}. See the feedback in Sketches.`
            : partB.status === 'submitted'
              ? 'Submitted. A Dexam evaluator will mark it; the marks appear here and in Sketches.'
              : 'In progress.'}
      </p>
      {partB.status === 'none' || partB.status === 'drawing' || partB.status === 'uploading' ? (
        <Link className={styles.primary} to={`/tests/part-b/${attemptId}`}>
          {partB.status === 'none' ? 'Start Part B' : 'Continue Part B'}
        </Link>
      ) : (
        <Link className={styles.link} to="/tests/sketches">
          Open Sketches
        </Link>
      )}
    </section>
  )
}
