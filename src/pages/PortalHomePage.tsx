import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from 'react-router-dom'
import { Card } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import type { NavigationAccess } from '../features/auth/navigationAccess'
import {
  getPortalAccess,
  portalLabels,
  portalSignIn,
  type EmployeePortal,
} from '../features/auth/portals'

// The teacher workflow, in order. Each step shows only when the teacher holds that permission.
const teacherSteps: [keyof NavigationAccess, string, string, string, string][] = [
  [
    'content',
    '1. Create',
    'Lessons & assignments',
    'Write lessons, attach files and create assignments with instructions and a marking rubric. Publishing alone sends nothing to students.',
    '/teacher/content',
  ],
  [
    'distribution',
    '2. Assign',
    'Assign to students',
    'Send a published assignment to a whole batch or to chosen students, with a due date.',
    '/teacher/distribution',
  ],
  [
    'reviews',
    '3. Give feedback',
    'Review & feedback',
    'Open each submitted assignment batch by batch, write or dictate feedback for that student and publish it to them.',
    '/teacher/reviews',
  ],
  [
    'batchAssign',
    'Batches',
    'Place students in batches',
    'Move an enrolled student to another batch of the same course.',
    '/teacher/batches',
  ],
]

function TeacherSteps() {
  const { session } = useAuth()
  const location = useLocation()
  const preview =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' &&
    new URLSearchParams(location.search).get('preview') === '1'
  const access = useQuery({
    queryKey: ['portal-access', session?.user.id],
    queryFn: getPortalAccess,
    enabled: Boolean(session) && !preview,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const steps = teacherSteps.filter(([key]) => preview || access.data?.[key])
  if (!preview && access.isPending) return <p role="status">Checking your teaching tools…</p>
  if (!steps.length)
    return (
      <p>
        No teaching tools are assigned to your account yet. Ask an admin to give you access to your
        courses.
      </p>
    )
  return (
    <ul
      aria-label="Teaching tools"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))',
        gap: 'var(--space-4)',
        padding: 0,
        margin: 'var(--space-6) 0 0',
        listStyle: 'none',
      }}
    >
      {steps.map(([key, step, title, description, path]) => (
        <li key={key}>
          <Card>
            <p className="eyebrow">{step}</p>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link to={preview ? `${path}?preview=1` : path}>Open {title.toLowerCase()}</Link>
          </Card>
        </li>
      ))}
    </ul>
  )
}

export function PortalHomePage({ portal }: { portal: EmployeePortal }) {
  const copy = {
    teacher: [
      'Your teaching workspace.',
      'Create lessons and assignments, assign them to your batches, then give each student feedback on what they submit. You see only the courses you teach.',
    ],
    staff: [
      'Your sales workspace.',
      'Work your leads, hand converted students to admissions and create batches by course, service type and start date. Tools appear only when your current account has the required authority.',
    ],
    admin: [
      'Your administration workspace.',
      'Use independently authorized security and account operations. Sensitive actions retain recent MFA and independent approval where required.',
    ],
  } as const
  return (
    <section>
      <p className="eyebrow">{portalLabels[portal]}</p>
      <h1>{copy[portal][0]}</h1>
      {portal === 'teacher' ? (
        <>
          <p>{copy.teacher[1]}</p>
          <TeacherSteps />
        </>
      ) : null}
      <Card>
        {portal === 'teacher' ? null : <p>{copy[portal][1]}</p>}
        <p>
          Changing portals does not change your identity or grant permissions. Sign out to use
          another person’s account.
        </p>
      </Card>
    </section>
  )
}
export function PortalEntrances() {
  return (
    <section aria-label="Choose a portal">
      <h2>Choose your Dexam portal</h2>
      <p>Separate workspaces. One secure identity platform.</p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        {(Object.keys(portalSignIn) as (keyof typeof portalSignIn)[]).map((portal) => (
          <Card key={portal}>
            <h3>{portalLabels[portal]}</h3>
            <Link to={portalSignIn[portal]}>Open {portalLabels[portal]}</Link>
          </Card>
        ))}
      </div>
    </section>
  )
}
