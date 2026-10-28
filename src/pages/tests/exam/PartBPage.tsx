import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { getSupabaseClient } from '../../../features/auth/supabaseClient'
import { formatClock } from '../../../features/testSeries/examAttempt'
import {
  beginPartB,
  fetchPartB,
  PART_B_MAX_FILES,
  partBFileProblem,
  partBStatusLabel,
  signPartBMedia,
  startPartBUpload,
  submitPartB,
  uploadPartBFile,
  type PartB,
  type PartBTask,
} from '../../../features/testSeries/partB'
import { PreStartFrame } from './ExamPreStart'
import { PrintedBlock } from './PrintedBlock'
import styles from './ExamWindow.module.css'

/** F043: Part B after Part A — drawing on paper, then a short window to upload the sheets. */
export function PartBPage() {
  const { attemptId = '' } = useParams()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const queryClient = useQueryClient()
  const key = ['part-b', session?.user.id, attemptId]
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const partB = await fetchPartB(client!, attemptId)
      return { partB, urls: await signPartBMedia(client!, partB) }
    },
    enabled: Boolean(client && session),
    refetchOnWindowFocus: false,
    retry: false,
  })
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const refresh = (partB: PartB) =>
    queryClient.setQueryData(key, (current: typeof query.data) => ({
      partB,
      urls: current?.urls ?? new Map<string, string>(),
    }))
  const begin = useMutation({
    mutationFn: () => beginPartB(client!, attemptId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  })
  const toUpload = useMutation({
    mutationFn: () => startPartBUpload(client!, attemptId),
    onSuccess: refresh,
  })
  const submit = useMutation({
    mutationFn: () => submitPartB(client!, attemptId),
    onSuccess: refresh,
  })

  const label = query.data?.partB.kind === 'drawing' ? 'Drawing paper' : 'Part B'
  if (query.isError || !client) {
    return (
      <PreStartFrame paperLabel={label}>
        <section className={styles.instructions}>
          <h1 className={styles.instructionsTitle}>Part B could not be opened</h1>
          <div className={styles.instructionsBody}>
            <p>{query.error?.message ?? 'The question bank is not connected.'}</p>
          </div>
        </section>
      </PreStartFrame>
    )
  }
  if (!query.data) {
    return (
      <PreStartFrame paperLabel={label}>
        <section className={styles.instructions}>
          <h1 className={styles.instructionsTitle}>Loading Part B…</h1>
        </section>
      </PreStartFrame>
    )
  }

  const { partB, urls } = query.data
  const drawingEnds = partB.drawingDeadline ? Date.parse(partB.drawingDeadline) : null
  const uploadEnds = partB.uploadDeadline ? Date.parse(partB.uploadDeadline) : null
  // A standalone drawing paper has no Part A result; it returns to the drawing papers.
  const drawingPaper = partB.kind === 'drawing'
  const resultPath = drawingPaper ? '/tests/drawing' : `/tests/results/${attemptId}`
  const backLabel = drawingPaper ? 'Back to drawing papers' : 'Back to result'

  if (partB.status === 'none') {
    return (
      <PreStartFrame paperLabel={label}>
        <section className={styles.instructions} aria-labelledby="part-b-title">
          <h1 id="part-b-title" className={styles.instructionsTitle}>
            {drawingPaper ? 'Drawing paper' : 'Part B: drawing'}
          </h1>
          <div className={styles.instructionsBody}>
            {partB.available ? (
              <>
                <p>
                  This paper has {partB.available} drawing{' '}
                  {partB.available === 1 ? 'task' : 'tasks'}
                  {partB.minutes ? ` and ${partB.minutes} minutes of drawing time` : ''}. Draw your
                  answers on paper. The clock starts when you begin.
                </p>
                <ol>
                  <li>Keep A4 sheets, pencils and colours ready before you begin.</li>
                  <li>
                    When you finish, or when drawing time ends, a 10-minute upload window opens.
                  </li>
                  <li>
                    Photograph or scan each sheet clearly and upload it under its task: JPEG, PNG or
                    PDF, up to 10 MB, five files a task.
                  </li>
                  <li>Your Part B is marked by a Dexam evaluator, who does not see your name.</li>
                </ol>
              </>
            ) : (
              <p>
                {drawingPaper
                  ? 'This paper has no drawing tasks ready yet.'
                  : 'This paper has no Part B tasks ready yet. Your Part A result is complete.'}
              </p>
            )}
            {begin.isError ? (
              <p className={styles.error} role="alert">
                {begin.error.message}
              </p>
            ) : null}
          </div>
          <div className={styles.instructionsFooter}>
            <Link className={styles.secondaryAction} to={resultPath}>
              {backLabel}
            </Link>
            {partB.available ? (
              <button
                type="button"
                className={styles.primaryAction}
                disabled={begin.isPending || partB.partAStatus !== 'submitted'}
                onClick={() => begin.mutate()}
              >
                {begin.isPending ? 'Starting…' : drawingPaper ? 'Begin drawing' : 'Begin Part B'}
              </button>
            ) : null}
          </div>
        </section>
      </PreStartFrame>
    )
  }

  const phaseEnds = partB.status === 'drawing' ? drawingEnds : uploadEnds
  const remaining = phaseEnds ? Math.max(0, phaseEnds - now) : 0
  const open = partB.status === 'drawing' || partB.status === 'uploading'

  return (
    <PreStartFrame paperLabel={label}>
      <section className={styles.instructions} aria-labelledby="part-b-title">
        <h1 id="part-b-title" className={styles.instructionsTitle}>
          Part B · {partBStatusLabel[partB.status]}
        </h1>
        <div className={styles.instructionsBody}>
          {open ? (
            <div
              className={`${styles.timer} ${remaining <= 5 * 60_000 ? styles.timerWarning : ''}`}
              role="timer"
              aria-label={partB.status === 'drawing' ? 'Drawing time left' : 'Upload time left'}
            >
              <span className={styles.timerLabel}>
                {partB.status === 'drawing' ? 'Drawing time left' : 'Upload time left'}
              </span>
              <span className={styles.timerValue}>{formatClock(remaining)}</span>
            </div>
          ) : (
            <p>
              {partB.status === 'evaluated'
                ? `Your Part B has been evaluated: ${partB.score ?? 0} out of ${partB.maxScore ?? 0}.`
                : drawingPaper
                  ? 'Your drawing paper has been submitted. A Dexam evaluator will mark it; the marks and feedback appear under Drawing papers.'
                  : 'Your Part B has been submitted. A Dexam evaluator will mark it; the marks and feedback appear on your result.'}
            </p>
          )}
          {partB.status === 'drawing' ? (
            <p>
              Draw on paper now. When you finish, choose “I have finished drawing” to upload your
              sheets. The upload window also opens on its own when drawing time ends.
            </p>
          ) : null}
          <ol className={styles.partBTasks}>
            {partB.tasks.map((task, index) => (
              <PartBTaskCard
                key={task.id}
                task={task}
                index={index}
                urls={urls}
                canUpload={
                  partB.status === 'uploading' || (partB.status === 'drawing' && remaining === 0)
                }
                attemptId={attemptId}
                onUploaded={() => void queryClient.invalidateQueries({ queryKey: key })}
              />
            ))}
          </ol>
          {toUpload.isError || submit.isError ? (
            <p className={styles.error} role="alert">
              {(toUpload.error ?? submit.error)?.message}
            </p>
          ) : null}
        </div>
        <div className={styles.instructionsFooter}>
          {open ? (
            <Link className={styles.secondaryAction} to={resultPath}>
              {backLabel}
            </Link>
          ) : null}
          {partB.status === 'drawing' && remaining > 0 ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={toUpload.isPending}
              onClick={() => toUpload.mutate()}
            >
              I have finished drawing
            </button>
          ) : open ? (
            <button
              type="button"
              className={styles.primaryAction}
              disabled={submit.isPending}
              onClick={() => submit.mutate()}
            >
              {submit.isPending ? 'Submitting…' : 'Submit Part B'}
            </button>
          ) : (
            <Link className={styles.primaryAction} to={resultPath}>
              {backLabel}
            </Link>
          )}
        </div>
      </section>
    </PreStartFrame>
  )
}

function PartBTaskCard({
  task,
  index,
  urls,
  canUpload,
  attemptId,
  onUploaded,
}: {
  task: PartBTask
  index: number
  urls: Map<string, string>
  canUpload: boolean
  attemptId: string
  onUploaded: () => void
}) {
  const client = getSupabaseClient()
  const [problems, setProblems] = useState<string[]>([])
  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const room = PART_B_MAX_FILES - task.uploads.length
      const issues = files.map(partBFileProblem).filter((issue): issue is string => issue !== null)
      if (files.length > room)
        issues.push(`You can add ${room} more file${room === 1 ? '' : 's'} to this task.`)
      setProblems(issues)
      if (issues.length) return
      for (const file of files) await uploadPartBFile(client!, attemptId, task.id, file)
    },
    onSettled: onUploaded,
  })

  return (
    <li className={styles.partBTask}>
      <h2 className={styles.partBTaskTitle}>
        Task {index + 1} · {task.maxMarks} marks
      </h2>
      {task.display === 'block' && task.figures[0] && urls.get(task.figures[0].path) ? (
        <PrintedBlock
          image={{
            src: urls.get(task.figures[0].path)!,
            width: task.figures[0].width,
            height: task.figures[0].height,
          }}
          prompt={task.prompt}
          label={`Task ${index + 1}`}
        />
      ) : (
        <p className={styles.prompt}>{task.prompt}</p>
      )}
      {(task.display === 'block' ? task.figures.slice(1) : task.figures).map((figure) =>
        urls.get(figure.path) ? (
          <img
            key={figure.path}
            className={styles.figureImage}
            src={urls.get(figure.path)}
            alt={`Figure for task ${index + 1}`}
          />
        ) : null,
      )}
      {task.uploads.length ? (
        <ul className={styles.partBUploads} aria-label={`Uploaded sheets for task ${index + 1}`}>
          {task.uploads.map((file, fileIndex) => (
            <li key={file.path}>
              {file.mimeType.startsWith('image/') && urls.get(file.path) ? (
                <img
                  src={urls.get(file.path)}
                  alt={`Sheet ${fileIndex + 1} for task ${index + 1}`}
                />
              ) : (
                <span className={styles.partBPdf}>PDF sheet {fileIndex + 1}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {task.marks !== null ? (
        <p className={styles.notice}>
          {task.marks} / {task.maxMarks}
          {task.feedback ? ` · ${task.feedback}` : ''}
        </p>
      ) : null}
      {canUpload && task.uploads.length < PART_B_MAX_FILES ? (
        <label className={styles.partBUpload}>
          <span>{upload.isPending ? 'Uploading…' : `Upload sheets for task ${index + 1}`}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            multiple
            disabled={upload.isPending}
            onChange={(event) => {
              const files = [...(event.target.files ?? [])]
              event.target.value = ''
              if (files.length) upload.mutate(files)
            }}
          />
        </label>
      ) : null}
      {[...problems, ...(upload.isError ? [upload.error.message] : [])].map((issue) => (
        <p key={issue} className={styles.error} role="alert">
          {issue}
        </p>
      ))}
    </li>
  )
}
