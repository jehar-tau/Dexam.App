import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ChangeEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState } from '../components'
import {
  finalizeStudentAssignmentAttempt,
  getStudentAssignments,
  removeStudentSubmissionFile,
  startStudentAssignmentAttempt,
  type StudentAssignment,
  uploadStudentSubmissionFile,
} from '../features/student/studentAssignments'
import {
  formatFileSize,
  prepareSubmissionFile,
  type PreparedSubmissionFile,
} from '../features/student/prepareSubmissionFile'
import styles from './StudentAssignmentsPage.module.css'

type PendingFile = {
  id: string
  prepared: PreparedSubmissionFile
  source: File
}

const previewAssignments: StudentAssignment[] = [
  {
    id: 'preview-assignment-perspective',
    status: 'assigned',
    assignedAt: '2026-10-10T09:00:00.000Z',
    releaseStatus: 'active',
    dueAt: '2026-10-18T17:30:00.000Z',
    assignmentVersionId: 'preview-version-perspective',
    assignmentCode: 'PERSPECTIVE_ROOM',
    groupName: 'Perspective & Objects',
    title: 'Draw a one-point perspective room',
    instructions:
      'Draw one interior using a clear horizon and vanishing point. Upload clear photographs or a single PDF showing the finished drawing and one construction study.',
    attempts: [],
  },
  {
    id: 'preview-assignment-lines',
    status: 'review_completed',
    assignedAt: '2026-10-04T09:00:00.000Z',
    releaseStatus: 'active',
    dueAt: null,
    assignmentVersionId: 'preview-version-lines',
    assignmentCode: 'LINE_CONTROL',
    groupName: 'Drawing foundations',
    title: 'Line confidence practice',
    instructions: 'Complete one page of straight lines, curves, ovals, and circles.',
    attempts: [
      {
        id: 'preview-attempt-lines',
        attemptNumber: 1,
        status: 'submitted',
        submittedAt: '2026-10-08T11:30:00.000Z',
        submittedLate: false,
        feedback: {
          writtenText:
            'Your line control is improving and the circles are more confident. Keep the pressure consistent, especially through the longer curves.',
          outcome: 'review_completed',
          correctionReason: null,
          publishedAt: '2026-10-10T08:45:00.000Z',
          aiAssisted: true,
          voiceUrl: null,
        },
        files: [
          {
            id: 'preview-file-lines',
            name: 'line-practice.jpg',
            mimeType: 'image/jpeg',
            byteSize: 842000,
            originalByteSize: 4100000,
            wasCompressed: true,
            position: 1,
            status: 'ready',
          },
        ],
      },
    ],
  },
]

function displayStatus(status: string) {
  return status.replaceAll('_', ' ').replace(/^./, (value) => value.toUpperCase())
}

function statusTone(status: string) {
  if (status === 'submitted' || status === 'review_completed') return 'success' as const
  if (status === 'correction_requested') return 'warning' as const
  return 'accent' as const
}

function dueLabel(value: string | null) {
  if (!value) return 'No deadline'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

export function StudentAssignmentsPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const queryClient = useQueryClient()
  const assignmentsQuery = useQuery({
    queryKey: ['student-assignments'],
    queryFn: getStudentAssignments,
    enabled: !previewEnabled,
    retry: false,
  })
  const [localAssignments, setLocalAssignments] = useState(previewAssignments)
  const [selectedId, setSelectedId] = useState(
    searchParams.get('assignment') ?? 'preview-assignment-perspective',
  )
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [busyMessage, setBusyMessage] = useState('')
  const [error, setError] = useState('')

  const assignments = previewEnabled ? localAssignments : (assignmentsQuery.data ?? [])
  const selected = assignments.find((assignment) => assignment.id === selectedId) ?? assignments[0]
  const draftAttempt = selected?.attempts.find((attempt) => attempt.status === 'draft')
  const totalPendingBytes = useMemo(
    () => pendingFiles.reduce((total, pending) => total + pending.prepared.file.size, 0),
    [pendingFiles],
  )

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['student-assignments'] })
  }

  async function startAttempt() {
    if (!selected) return
    setError('')
    setBusyMessage('Starting your private submission…')
    try {
      if (previewEnabled) {
        setLocalAssignments((current) =>
          current.map((assignment) =>
            assignment.id === selected.id
              ? {
                  ...assignment,
                  status: 'in_progress',
                  attempts: [
                    {
                      id: 'preview-attempt-perspective',
                      attemptNumber: 1,
                      status: 'draft',
                      submittedAt: null,
                      submittedLate: null,
                      feedback: null,
                      files: [],
                    },
                    ...assignment.attempts,
                  ],
                }
              : assignment,
          ),
        )
      } else {
        await startStudentAssignmentAttempt(selected.id)
        await refresh()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The attempt could not be started.')
    } finally {
      setBusyMessage('')
    }
  }

  async function prepareFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!draftAttempt || files.length === 0) return
    if (pendingFiles.length + draftAttempt.files.length + files.length > 10) {
      setError('A submission can contain at most 10 files.')
      return
    }
    setError('')
    setBusyMessage('Optimizing images on this device…')
    try {
      const prepared = await Promise.all(
        files.map(async (source) => ({
          id: crypto.randomUUID(),
          source,
          prepared: await prepareSubmissionFile(source),
        })),
      )
      const nextTotal =
        totalPendingBytes +
        draftAttempt.files.reduce((total, file) => total + file.byteSize, 0) +
        prepared.reduce((total, file) => total + file.prepared.file.size, 0)
      if (nextTotal > 50 * 1024 * 1024) {
        prepared.forEach((item) => {
          if (item.prepared.previewUrl) URL.revokeObjectURL(item.prepared.previewUrl)
        })
        throw new Error('The complete attempt must remain within 50 MB.')
      }
      setPendingFiles((current) => [...current, ...prepared])
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The selected files could not be prepared.',
      )
    } finally {
      setBusyMessage('')
    }
  }

  async function keepHigherQuality(id: string) {
    const pending = pendingFiles.find((file) => file.id === id)
    if (!pending) return
    setError('')
    setBusyMessage('Preparing the higher-quality version…')
    try {
      const prepared = await prepareSubmissionFile(pending.source, 'original')
      if (pending.prepared.previewUrl) URL.revokeObjectURL(pending.prepared.previewUrl)
      setPendingFiles((current) =>
        current.map((file) => (file.id === id ? { ...file, prepared } : file)),
      )
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The higher-quality file could not be prepared.',
      )
    } finally {
      setBusyMessage('')
    }
  }

  function removePending(id: string) {
    setPendingFiles((current) => {
      const removed = current.find((file) => file.id === id)
      if (removed?.prepared.previewUrl) URL.revokeObjectURL(removed.prepared.previewUrl)
      return current.filter((file) => file.id !== id)
    })
  }

  async function uploadPreparedFiles() {
    if (!selected || !draftAttempt || pendingFiles.length === 0) return
    setError('')
    setBusyMessage(
      `Uploading ${pendingFiles.length} private ${pendingFiles.length === 1 ? 'file' : 'files'}…`,
    )
    try {
      if (previewEnabled) {
        const previewFiles = pendingFiles.map((pending, index) => ({
          id: pending.id,
          name: pending.prepared.originalFileName,
          mimeType: pending.prepared.file.type,
          byteSize: pending.prepared.file.size,
          originalByteSize: pending.prepared.originalByteSize,
          wasCompressed: pending.prepared.wasCompressed,
          position: draftAttempt.files.length + index + 1,
          status: 'ready',
        }))
        setLocalAssignments((current) =>
          current.map((assignment) =>
            assignment.id === selected.id
              ? {
                  ...assignment,
                  attempts: assignment.attempts.map((attempt) =>
                    attempt.id === draftAttempt.id
                      ? { ...attempt, files: [...attempt.files, ...previewFiles] }
                      : attempt,
                  ),
                }
              : assignment,
          ),
        )
      } else {
        for (const pending of pendingFiles) {
          await uploadStudentSubmissionFile(draftAttempt.id, pending.prepared)
        }
        await refresh()
      }
      pendingFiles.forEach((pending) => {
        if (pending.prepared.previewUrl) URL.revokeObjectURL(pending.prepared.previewUrl)
      })
      setPendingFiles([])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The files could not be uploaded.')
    } finally {
      setBusyMessage('')
    }
  }

  async function removeUploadedFile(fileId: string) {
    if (!selected || !draftAttempt) return
    setError('')
    setBusyMessage('Removing the private file…')
    try {
      if (previewEnabled) {
        setLocalAssignments((current) =>
          current.map((assignment) =>
            assignment.id === selected.id
              ? {
                  ...assignment,
                  attempts: assignment.attempts.map((attempt) =>
                    attempt.id === draftAttempt.id
                      ? { ...attempt, files: attempt.files.filter((file) => file.id !== fileId) }
                      : attempt,
                  ),
                }
              : assignment,
          ),
        )
      } else {
        await removeStudentSubmissionFile(fileId)
        await refresh()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The file could not be removed.')
    } finally {
      setBusyMessage('')
    }
  }

  async function submitAttempt() {
    if (!selected || !draftAttempt || draftAttempt.files.length === 0 || pendingFiles.length > 0)
      return
    setError('')
    setBusyMessage('Locking and submitting your attempt…')
    try {
      if (previewEnabled) {
        setLocalAssignments((current) =>
          current.map((assignment) =>
            assignment.id === selected.id
              ? {
                  ...assignment,
                  status: 'submitted',
                  attempts: assignment.attempts.map((attempt) =>
                    attempt.id === draftAttempt.id
                      ? {
                          ...attempt,
                          status: 'submitted',
                          submittedAt: new Date().toISOString(),
                          submittedLate: false,
                        }
                      : attempt,
                  ),
                }
              : assignment,
          ),
        )
      } else {
        await finalizeStudentAssignmentAttempt(draftAttempt.id)
        await refresh()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assignment could not be submitted.')
    } finally {
      setBusyMessage('')
    }
  }

  if (!previewEnabled && assignmentsQuery.isPending) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Assignments</p>
        <h1>Loading your assignments…</h1>
      </section>
    )
  }
  if (!previewEnabled && assignmentsQuery.isError) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Assignments</p>
        <h1>Your assignments could not be loaded.</h1>
        <Callout tone="warning">Check your connection and try again.</Callout>
        <Button onClick={() => void assignmentsQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  const workspaceUrl = previewEnabled ? '/student?preview=1' : '/student'
  if (!selected) {
    return (
      <section className={styles.assignments}>
        <Link className={styles.backLink} to={workspaceUrl}>
          ← Student workspace
        </Link>
        <p className="eyebrow">Assignments</p>
        <h1>Your assignments.</h1>
        <EmptyState
          title="No assignments yet"
          description="Assignments released to your active enrolment will appear here."
        />
      </section>
    )
  }

  return (
    <section className={styles.assignments} aria-labelledby="assignments-title">
      <Link className={styles.backLink} to={workspaceUrl}>
        ← Student workspace
      </Link>
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Assignments · {previewEnabled ? 'Local preview' : 'Live account'}
          </p>
          <h1 id="assignments-title">Your assignments.</h1>
          <p>Prepare, review, and privately submit your work.</p>
        </div>
        <dl>
          <div>
            <dt>Assigned</dt>
            <dd>{assignments.length}</dd>
          </div>
          <div>
            <dt>Needs action</dt>
            <dd>
              {
                assignments.filter(
                  (assignment) => !['submitted', 'review_completed'].includes(assignment.status),
                ).length
              }
            </dd>
          </div>
        </dl>
      </header>

      <div className={styles.layout}>
        <aside className={styles.assignmentList} aria-label="Assignment list">
          {assignments.map((assignment) => (
            <button
              className={
                assignment.id === selected.id ? styles.selectedAssignment : styles.assignmentButton
              }
              key={assignment.id}
              onClick={() => {
                setSelectedId(assignment.id)
                setError('')
                setPendingFiles([])
              }}
              type="button"
            >
              <span>{assignment.groupName}</span>
              <strong>{assignment.title}</strong>
              <small>{dueLabel(assignment.dueAt)}</small>
            </button>
          ))}
        </aside>

        <article className={styles.detail} aria-labelledby="assignment-title">
          <div className={styles.detailHeader}>
            <div>
              <Badge tone={statusTone(selected.status)}>{displayStatus(selected.status)}</Badge>
              <span>{selected.assignmentCode}</span>
            </div>
            <h2 id="assignment-title">{selected.title}</h2>
            <p>{selected.instructions}</p>
            <dl>
              <div>
                <dt>Group</dt>
                <dd>{selected.groupName}</dd>
              </div>
              <div>
                <dt>Due</dt>
                <dd>{dueLabel(selected.dueAt)}</dd>
              </div>
            </dl>
          </div>

          {error ? (
            <Callout tone="warning" icon="warning">
              {error}
            </Callout>
          ) : null}
          {busyMessage ? (
            <p className={styles.busy} aria-live="polite">
              {busyMessage}
            </p>
          ) : null}

          {!draftAttempt && ['assigned', 'correction_requested'].includes(selected.status) ? (
            <Card className={styles.startCard}>
              <h3>
                {selected.status === 'correction_requested'
                  ? 'Prepare your revision'
                  : 'Start your submission'}
              </h3>
              <p>
                Your files remain private. Starting creates a draft that only you and an assigned
                teacher can access.
              </p>
              <Button disabled={Boolean(busyMessage)} onClick={() => void startAttempt()}>
                Start submission
              </Button>
            </Card>
          ) : null}

          {draftAttempt ? (
            <div className={styles.submissionBuilder}>
              <div className={styles.builderHeader}>
                <div>
                  <p className="eyebrow">Attempt {draftAttempt.attemptNumber}</p>
                  <h3>Submission files</h3>
                </div>
                <Badge tone="neutral">Draft</Badge>
              </div>
              <Callout tone="neutral">
                Images are optimized on this device before upload. Review every preview; submitted
                files cannot be replaced unless a teacher requests a revision.
              </Callout>
              <label className={styles.filePicker}>
                <span>Add PDF or images</span>
                <small>Maximum 10 files · 10 MB each · 50 MB total</small>
                <input
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  disabled={Boolean(busyMessage)}
                  multiple
                  onChange={(event) => void prepareFiles(event)}
                  type="file"
                />
              </label>

              {pendingFiles.length > 0 ? (
                <div className={styles.pendingArea}>
                  <h4>Review before upload</h4>
                  {pendingFiles.map((pending) => (
                    <div className={styles.fileRow} key={pending.id}>
                      {pending.prepared.previewUrl ? (
                        <img
                          alt={`Preview of ${pending.prepared.originalFileName}`}
                          src={pending.prepared.previewUrl}
                        />
                      ) : (
                        <span className={styles.pdfIcon}>PDF</span>
                      )}
                      <div>
                        <strong>{pending.prepared.originalFileName}</strong>
                        <small>
                          {formatFileSize(pending.prepared.originalByteSize)} →{' '}
                          {formatFileSize(pending.prepared.file.size)}
                          {pending.prepared.wasCompressed ? ' optimized' : ' privacy-cleaned'}
                        </small>
                      </div>
                      <div className={styles.fileActions}>
                        {pending.prepared.previewUrl ? (
                          <Button
                            variant="secondary"
                            onClick={() => void keepHigherQuality(pending.id)}
                          >
                            Keep higher quality
                          </Button>
                        ) : null}
                        <Button variant="ghost" onClick={() => removePending(pending.id)}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button
                    disabled={Boolean(busyMessage)}
                    onClick={() => void uploadPreparedFiles()}
                  >
                    Upload reviewed files
                  </Button>
                </div>
              ) : null}

              {draftAttempt.files.length > 0 ? (
                <div className={styles.uploadedFiles}>
                  <h4>Uploaded privately</h4>
                  {draftAttempt.files.map((file) => (
                    <div className={styles.uploadedRow} key={file.id}>
                      <div>
                        <strong>{file.name}</strong>
                        <small>
                          {formatFileSize(file.byteSize)}
                          {file.wasCompressed
                            ? ` · saved ${formatFileSize(file.originalByteSize - file.byteSize)}`
                            : ''}
                        </small>
                      </div>
                      <Button variant="ghost" onClick={() => void removeUploadedFile(file.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className={styles.submitArea}>
                <p>Submitting locks this attempt permanently.</p>
                <Button
                  disabled={
                    draftAttempt.files.length === 0 ||
                    pendingFiles.length > 0 ||
                    Boolean(busyMessage)
                  }
                  onClick={() => void submitAttempt()}
                >
                  Submit assignment
                </Button>
              </div>
            </div>
          ) : null}

          {!draftAttempt && selected.attempts.length > 0 ? (
            <div className={styles.history}>
              <h3>Attempt history</h3>
              {selected.attempts.map((attempt) => (
                <Card key={attempt.id}>
                  <div>
                    <strong>Attempt {attempt.attemptNumber}</strong>
                    <Badge tone={attempt.status === 'submitted' ? 'success' : 'neutral'}>
                      {displayStatus(attempt.status)}
                    </Badge>
                  </div>
                  <p>
                    {attempt.files.length} {attempt.files.length === 1 ? 'file' : 'files'}
                    {attempt.submittedAt
                      ? ` · Submitted ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(attempt.submittedAt))}`
                      : ''}
                  </p>
                  {attempt.submittedLate ? <Badge tone="warning">Late</Badge> : null}
                  {attempt.feedback ? (
                    <section
                      className={styles.feedback}
                      aria-label={`Feedback for attempt ${attempt.attemptNumber}`}
                    >
                      <div>
                        <h4>Teacher feedback</h4>
                        <Badge tone="success">{displayStatus(attempt.feedback.outcome)}</Badge>
                      </div>
                      <p>{attempt.feedback.writtenText}</p>
                      {attempt.feedback.correctionReason ? (
                        <Callout tone="warning" icon="warning">
                          <strong>What to correct:</strong> {attempt.feedback.correctionReason}
                        </Callout>
                      ) : null}
                      {attempt.feedback.voiceUrl ? (
                        <audio
                          aria-label={`Voice feedback for attempt ${attempt.attemptNumber}`}
                          controls
                          src={attempt.feedback.voiceUrl}
                        />
                      ) : null}
                      <small>
                        Published{' '}
                        {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(
                          new Date(attempt.feedback.publishedAt),
                        )}
                        {attempt.feedback.aiAssisted
                          ? ' · AI-assisted writing, reviewed and published by your teacher'
                          : ' · Written and published by your teacher'}
                      </small>
                    </section>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : null}
        </article>
      </div>
    </section>
  )
}
