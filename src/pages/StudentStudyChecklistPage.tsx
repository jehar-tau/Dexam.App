import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Callout, Card } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import { getStudyChecklist, setTopicStudied } from '../features/student/studyChecklist'
import styles from './SignInPage.module.css'

export function StudentStudyChecklistPage() {
  const { session } = useAuth()
  const checklist = useQuery({
    queryKey: ['student-study-checklist', session?.user.id],
    queryFn: getStudyChecklist,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function choose(enrollmentId: string, topicId: string, studied: boolean) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await setTopicStudied(enrollmentId, topicId, studied)
      await checklist.refetch()
      setMessage(studied ? 'Your topic is marked as studied.' : 'Your study mark was removed.')
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Your study choice could not be saved.')
      await checklist.refetch()
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className={styles.layout} aria-labelledby="study-checklist-title">
      <div className={styles.intro}>
        <p className="eyebrow">Private study checklist</p>
        <h1 id="study-checklist-title">Plan your learning.</h1>
        <p className={styles.lede}>
          Mark a topic when you have studied it. This is your private self-report, not a grade,
          attendance record, teacher endorsement or proof of mastery. It does not complete your
          course.
        </p>
        <Link to="/student">Back to student workspace</Link>
      </div>
      <div>
        {message ? <p role="status">{message}</p> : null}
        {error ? (
          <Callout tone="warning" icon="warning">
            <p role="alert">{error}</p>
          </Callout>
        ) : null}
        {checklist.isPending ? (
          <p role="status">Loading your study checklist…</p>
        ) : checklist.isError ? (
          <Card>
            <p role="alert">Your private study checklist could not be loaded.</p>
            <Button onClick={() => void checklist.refetch()}>Try again</Button>
          </Card>
        ) : !checklist.data.length ? (
          <Card>
            <h2>No checklist available</h2>
            <p>
              Your assigned published topics appear here while your course is active, and read-only
              within its archive window.
            </p>
          </Card>
        ) : (
          checklist.data.map((course) => (
            <Card key={course.enrollmentId}>
              <h2>{course.offeringTitle}</h2>
              <Badge>{course.readOnly ? 'Read-only archive' : 'Private self-report'}</Badge>
              {course.readOnly && course.expiresAt ? (
                <Callout tone="warning" icon="warning">
                  Checklist available until {new Date(course.expiresAt).toLocaleString()}. Marks
                  cannot be changed after course end; identifiable checklist records expire after
                  this window.
                </Callout>
              ) : null}
              {course.topics.map((topic) => (
                <div key={topic.id}>
                  <h3>{topic.title}</h3>
                  <p>{topic.sectionTitle}</p>
                  <p>
                    {topic.markedAt
                      ? `Marked as studied on ${new Date(topic.markedAt).toLocaleDateString()}`
                      : 'Not marked as studied'}
                  </p>
                  {!course.readOnly ? (
                    <Button
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void choose(course.enrollmentId, topic.id, !topic.markedAt)}
                    >
                      {topic.markedAt ? 'Undo study mark' : 'Mark as studied'}: {topic.title}
                    </Button>
                  ) : null}
                </div>
              ))}
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
