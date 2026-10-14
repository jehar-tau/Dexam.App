import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Callout, Card } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import { getArchiveDownload, getWorkArchive } from '../features/student/workArchive'
import styles from './SignInPage.module.css'
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
  const [download, setDownload] = useState<{ url: string; expiresAt: string } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    if (!download) return
    const timer = window.setTimeout(
      () => setDownload(null),
      Math.max(0, Date.parse(download.expiresAt) - Date.now()),
    )
    return () => window.clearTimeout(timer)
  }, [download])
  async function requestDownload(id: string, kind: 'submission' | 'voice') {
    if (busy) return
    setBusy(true)
    setError('')
    setDownload(null)
    try {
      setDownload(await getArchiveDownload(id, kind))
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
          Your finalized submissions and published feedback remain read-only for 12 months after a
          course ends. Download files before the shown expiry; purged files cannot be recovered.
          Lessons, reference materials and new submissions are not part of this archive.
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
              Eligible completed or withdrawn courses appear here until their 12-month archive
              window ends.
            </p>
          </Card>
        ) : (
          archive.data.map((course) => (
            <Card key={course.enrollmentId}>
              <h2>{course.offeringTitle}</h2>
              <p>
                {course.status} · Ended {new Date(course.endedAt).toLocaleDateString()}
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
                            onClick={() => void requestDownload(file.id, 'submission')}
                          >
                            Prepare download: {file.name}
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
                            Prepare voice feedback download
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
        {download && !archive.isError && !archive.isPending ? (
          <Callout tone="neutral">
            <a href={download.url} target="_blank" rel="noreferrer">
              Download retained file
            </a>
            <p>
              This private link expires in at most 60 seconds. A fresh request checks your access
              again.
            </p>
          </Callout>
        ) : null}
      </div>
    </section>
  )
}
