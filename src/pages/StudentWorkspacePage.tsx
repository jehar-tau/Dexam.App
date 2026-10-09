import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState } from '../components'
import {
  getStudentWorkspace,
  type StudentEnrollment,
  type StudentWorkspace,
} from '../features/student/getStudentWorkspace'
import styles from './StudentWorkspacePage.module.css'

const previewWorkspace: StudentWorkspace = {
  displayName: 'Aarohi Deshmukh',
  memberId: 'DXM-2K3M9Q2RW5TY',
  enrollments: [
    {
      enrollmentId: '94000000-0000-4000-8000-000000000001',
      offeringTitle: 'Design Entrance Foundation',
      cohortName: 'Studio Batch · Autumn 2026',
      status: 'active',
      approvedAt: '2026-10-05T10:00:00.000Z',
      activatedAt: '2026-10-06T10:00:00.000Z',
    },
  ],
}

function enrollmentTone(status: string) {
  if (status === 'active') return 'success' as const
  if (status === 'suspended') return 'danger' as const
  return 'neutral' as const
}

function displayStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1).replaceAll('_', ' ')
}

function EnrollmentCard({ enrollment }: { enrollment: StudentEnrollment }) {
  return (
    <Card className={styles.enrollmentCard}>
      <div className={styles.enrollmentHeading}>
        <div>
          <p className={styles.label}>Programme</p>
          <h3>{enrollment.offeringTitle}</h3>
        </div>
        <Badge pill tone={enrollmentTone(enrollment.status)}>
          {displayStatus(enrollment.status)}
        </Badge>
      </div>
      <dl className={styles.enrollmentDetails}>
        <div>
          <dt>Cohort</dt>
          <dd>{enrollment.cohortName ?? 'Independent enrolment'}</dd>
        </div>
        <div>
          <dt>Access</dt>
          <dd>
            {enrollment.status === 'active'
              ? 'Learning access is available'
              : 'Contact Dexam support'}
          </dd>
        </div>
      </dl>
    </Card>
  )
}

export function StudentWorkspacePage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const workspaceQuery = useQuery({
    queryKey: ['student-workspace', previewEnabled],
    queryFn: () => (previewEnabled ? Promise.resolve(previewWorkspace) : getStudentWorkspace()),
    retry: false,
  })

  if (workspaceQuery.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Student workspace</p>
        <h1>Preparing your learning space…</h1>
        <p>We are loading your current Dexam enrolments.</p>
      </section>
    )
  }

  if (workspaceQuery.isError) {
    return (
      <section className={styles.state} aria-labelledby="student-workspace-error-title">
        <p className="eyebrow">Student workspace</p>
        <h1 id="student-workspace-error-title">Your workspace could not be loaded.</h1>
        <Callout tone="warning" icon="warning">
          Check your connection and try again. Your account remains protected.
        </Callout>
        <Button onClick={() => void workspaceQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  const workspace = workspaceQuery.data
  const firstName = workspace.displayName?.trim().split(/\s+/)[0]

  return (
    <section className={styles.workspace} aria-labelledby="student-workspace-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Student workspace · {previewEnabled ? 'Local preview' : 'Live account'}
          </p>
          <h1 id="student-workspace-title">Welcome{firstName ? `, ${firstName}` : ''}.</h1>
          <p className={styles.lede}>
            Your learning journey, enrolments, and future Dexam services will live here.
          </p>
        </div>
        <div className={styles.identity} aria-label="Dexam identity">
          <span>Dexam Member ID</span>
          <strong>{workspace.memberId}</strong>
          <small>Keep this ID for every stage of your journey.</small>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.primary}>
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Your learning</p>
              <h2>Current enrolments</h2>
            </div>
            <span className={styles.count}>{workspace.enrollments.length}</span>
          </div>

          {workspace.enrollments.length === 0 ? (
            <EmptyState
              title="No enrolments yet"
              description="When Dexam confirms an enrolment, it will appear here automatically."
            />
          ) : (
            <div className={styles.enrollmentList}>
              {workspace.enrollments.map((enrollment) => (
                <EnrollmentCard enrollment={enrollment} key={enrollment.enrollmentId} />
              ))}
            </div>
          )}
        </div>

        <aside className={styles.aside} aria-labelledby="coming-next-title">
          <p className="eyebrow">Built to grow with you</p>
          <h2 id="coming-next-title">More value, one identity.</h2>
          <p>
            Assignments, class updates, workshops, and opportunities can be added here without
            asking you to create another account.
          </p>
          <Callout tone="neutral">
            This first release shows only your identity and current enrolments.
          </Callout>
        </aside>
      </div>
    </section>
  )
}
