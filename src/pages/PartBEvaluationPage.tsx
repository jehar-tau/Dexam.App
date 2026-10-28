import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { EmptyState } from '../components'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import {
  fetchPartB,
  listPartBQueue,
  releasePartB,
  savePartBEvaluation,
  signPartBMedia,
  type PartBTask,
} from '../features/testSeries/partB'
import styles from './PartBEvaluationPage.module.css'

/** F048: anonymous Part B evaluation queue for evaluators. */
export function PartBQueuePage() {
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['part-b-queue'],
    queryFn: () => listPartBQueue(client!),
    enabled: Boolean(client),
  })
  const waiting = query.data?.filter((item) => item.status === 'submitted') ?? []
  const done = query.data?.filter((item) => item.status === 'evaluated') ?? []
  return (
    <section className={styles.page} aria-labelledby="part-b-queue-title">
      <p className="eyebrow">Test series</p>
      <h1 id="part-b-queue-title">Part B evaluation</h1>
      <p className={styles.note}>
        Candidates are shown by reference only. Mark every task, then release the result.
      </p>
      {query.isError ? <p className={styles.error}>{query.error.message}</p> : null}
      {query.data && waiting.length === 0 ? (
        <EmptyState title="Nothing to evaluate" description="Submitted Part B work appears here." />
      ) : null}
      {waiting.length ? <QueueTable title="Waiting" items={waiting} /> : null}
      {done.length ? <QueueTable title="Released" items={done} /> : null}
    </section>
  )
}

function QueueTable({
  title,
  items,
}: {
  title: string
  items: Awaited<ReturnType<typeof listPartBQueue>>
}) {
  return (
    <div className={styles.block}>
      <h2>{title}</h2>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col">Paper</th>
            <th scope="col">Submitted</th>
            <th scope="col">Marked</th>
            <th scope="col">Sheets</th>
            <th scope="col">
              <span className={styles.visuallyHidden}>Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.attemptId}>
              <th scope="row">{item.reference}</th>
              <td>{item.paperId.toUpperCase()}</td>
              <td>
                {item.submittedAt
                  ? new Date(item.submittedAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
              </td>
              <td>
                {item.marked} / {item.tasks}
              </td>
              <td>{item.uploads}</td>
              <td>
                <Link to={`/staff/part-b/${item.attemptId}`}>Open</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PartBEvaluationPage() {
  const { attemptId = '' } = useParams()
  const client = getSupabaseClient()
  const queryClient = useQueryClient()
  const key = ['part-b-evaluate', attemptId]
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const partB = await fetchPartB(client!, attemptId)
      return { partB, urls: await signPartBMedia(client!, partB) }
    },
    enabled: Boolean(client),
  })
  const release = useMutation({
    mutationFn: () => releasePartB(client!, attemptId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key })
      void queryClient.invalidateQueries({ queryKey: ['part-b-queue'] })
    },
  })

  if (!query.data) {
    return (
      <section className={styles.page}>
        <h1>Part B evaluation</h1>
        <p className={styles.note}>{query.isError ? query.error.message : 'Loading…'}</p>
      </section>
    )
  }
  const { partB, urls } = query.data
  const allMarked = partB.tasks.every((task) => task.marks !== null)
  return (
    <section className={styles.page} aria-labelledby="part-b-eval-title">
      <Link to="/staff/part-b">← Back to the queue</Link>
      <h1 id="part-b-eval-title">
        {partB.reference} · {partB.paperId.toUpperCase()} Part B
      </h1>
      <p className={styles.note}>
        {partB.status === 'evaluated'
          ? `Released: ${partB.score} / ${partB.maxScore}.`
          : `Status: ${partB.status}. Maximum ${partB.maxScore}.`}
      </p>
      <ol className={styles.tasks}>
        {partB.tasks.map((task, index) => (
          <TaskEvaluation
            key={task.id}
            task={task}
            index={index}
            urls={urls}
            attemptId={attemptId}
            locked={partB.status !== 'submitted'}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: key })}
          />
        ))}
      </ol>
      {partB.status === 'submitted' ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={!allMarked || release.isPending}
            onClick={() => release.mutate()}
          >
            Release Part B result
          </button>
          {!allMarked ? <span className={styles.note}>Mark every task first.</span> : null}
          {release.isError ? <span className={styles.error}>{release.error.message}</span> : null}
        </div>
      ) : null}
    </section>
  )
}

function TaskEvaluation({
  task,
  index,
  urls,
  attemptId,
  locked,
  onSaved,
}: {
  task: PartBTask
  index: number
  urls: Map<string, string>
  attemptId: string
  locked: boolean
  onSaved: () => void
}) {
  const client = getSupabaseClient()
  const [marks, setMarks] = useState(task.marks === null ? '' : String(task.marks))
  const [feedback, setFeedback] = useState(task.feedback ?? '')
  const save = useMutation({
    mutationFn: () => savePartBEvaluation(client!, attemptId, task.id, Number(marks), feedback),
    onSuccess: onSaved,
  })
  const value = Number(marks)
  const valid = marks !== '' && Number.isFinite(value) && value >= 0 && value <= task.maxMarks
  return (
    <li className={styles.task}>
      <h2>
        Task {index + 1} · out of {task.maxMarks}
      </h2>
      <p className={styles.prompt}>{task.prompt}</p>
      <div className={styles.sheets}>
        {task.uploads.length === 0 ? <span className={styles.note}>No sheet uploaded.</span> : null}
        {task.uploads.map((file, fileIndex) =>
          file.mimeType.startsWith('image/') ? (
            <a key={file.path} href={urls.get(file.path)} target="_blank" rel="noreferrer">
              <img src={urls.get(file.path)} alt={`Sheet ${fileIndex + 1} for task ${index + 1}`} />
            </a>
          ) : (
            <a key={file.path} href={urls.get(file.path)} target="_blank" rel="noreferrer">
              PDF sheet {fileIndex + 1}
            </a>
          ),
        )}
      </div>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) save.mutate()
        }}
      >
        <label>
          Marks
          <input
            type="number"
            min={0}
            max={task.maxMarks}
            step={0.5}
            value={marks}
            disabled={locked}
            onChange={(event) => setMarks(event.target.value)}
          />
        </label>
        <label className={styles.feedback}>
          Feedback for the candidate
          <textarea
            rows={2}
            maxLength={4000}
            value={feedback}
            disabled={locked}
            onChange={(event) => setFeedback(event.target.value)}
          />
        </label>
        {locked ? null : (
          <button type="submit" className={styles.secondary} disabled={!valid || save.isPending}>
            {save.isPending ? 'Saving…' : task.marks === null ? 'Save marks' : 'Update marks'}
          </button>
        )}
        {save.isError ? <span className={styles.error}>{save.error.message}</span> : null}
      </form>
    </li>
  )
}
