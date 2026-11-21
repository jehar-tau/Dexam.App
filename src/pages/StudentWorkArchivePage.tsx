import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import { fileNameFor, saveBlob } from '../features/files/protectedFiles'
import {
  getArchiveDownload,
  getWorkArchive,
  type WorkArchive,
} from '../features/student/workArchive'
import styles from './SignInPage.module.css'
const courseEndLabels: Record<WorkArchive['status'], string> = {
  completed: 'Course completed on',
  withdrawn: 'Withdrawal recorded on',
  expired: 'Coaching expired on',
}

export function StudentWorkArchivePage() {
  const { session } = useAuth()
  const archive = useQuery({
    queryKey: ['student-work-archive', session?.user.id],
    queryFn: getWorkArchive,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  /** Each download re-checks access and the archive window; no link outlives the request. */
  async function requestDownload(id: string, kind: 'submission' | 'voice', name?: string) {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const file = await getArchiveDownload(id, kind)
      saveBlob(file, name ?? fileNameFor('voice-feedback', file.type))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Download unavailable.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout} aria-labelledby="archive-title">
      <div className={styles.intro}>
        <p className="eyebrow">Private work archive</p>
        <h1 id="archive-title">Take your work forward.</h1>
        <p className={styles.lede}>
          You can read your finalized submissions and published feedback for 12 months after your
          coaching expires, or after an earlier course completion or withdrawal. Download any files
          you want to keep before the deadline shown for each course.
        </p>
        <Link to="/student">Back to student workspace</Link>
        <p>
          <Link to="/student/study-checklist">View your private study checklist</Link>
        </p>
      </div>
      <div>
        {archive.isPending ? (
          <p role="status">Loading your private archive…</p>
        ) : archive.isError ? (
          <Card>
            <p role="alert">Your archive could not be loaded.</p>
            <Button onClick={() => void archive.refetch()}>Try again</Button>
          </Card>
        ) : !archive.data.length ? (
          <Card>
            <h2>No retained course archive</h2>
            <p>
              Your eligible courses appear here when coaching expires or the course closes. Each
              archive is available for 12 months.
            </p>
          </Card>
        ) : (
          archive.data.map((course) => (
            <Card key={course.enrollmentId}>
              <h2>{course.offeringTitle}</h2>
              <p>
                {courseEndLabels[course.status]} {new Date(course.endedAt).toLocaleDateString()}
              </p>
              <Callout tone="warning" icon="warning">
                Download before {new Date(course.expiresAt).toLocaleString()}. This is not
                indefinite portfolio storage.
              </Callout>
              {!course.attempts.length ? (
                <p>No finalized submissions were retained for this course.</p>
              ) : (
                course.attempts.map((attempt) => (
                  <section
                    key={attempt.id}
                    aria-label={`${attempt.assignmentTitle} attempt ${attempt.attemptNumber}`}
                  >
                    <h3>
                      {attempt.assignmentTitle} · Attempt {attempt.attemptNumber}
                    </h3>
                    <p>Submitted {new Date(attempt.submittedAt).toLocaleDateString()}</p>
                    {!attempt.files.length ? (
                      <p>No retained files available.</p>
                    ) : (
                      attempt.files.map((file) => (
                        <div key={file.id}>
                          <p>
                            {file.name} · {Math.ceil(file.byteSize / 1024)} KB
                          </p>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void requestDownload(file.id, 'submission', file.name)}
                          >
                            Download {file.name}
                          </Button>
                        </div>
                      ))
                    )}
                    {attempt.feedback.map((feedback) => (
                      <div key={feedback.id}>
                        <h4>Published teacher feedback</h4>
                        <p>{feedback.text}</p>
                        {feedback.nextStep ? (
                          <p>Next step: {feedback.nextStep} (read-only; no resubmission)</p>
                        ) : null}
                        <p>
                          Published {new Date(feedback.publishedAt).toLocaleDateString()}
                          {feedback.aiAssisted ? ' · AI-assisted writing, teacher reviewed' : ''}
                        </p>
                        {feedback.voiceIds.map((id) => (
                          <Button
                            key={id}
                            variant="secondary"
                            disabled={busy}
                            onClick={() => void requestDownload(id, 'voice')}
                          >
                            Download voice feedback
                          </Button>
                        ))}
                      </div>
                    ))}
                  </section>
                ))
              )}
            </Card>
          ))
        )}
        {error ? <p role="alert">{error}</p> : null}
      </div>
    </section>
  )
}
