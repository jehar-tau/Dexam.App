import { Link } from 'react-router-dom'
import { Card } from '../components'
import { portalLabels, portalSignIn, type EmployeePortal } from '../features/auth/portals'

export function PortalHomePage({ portal }: { portal: EmployeePortal }) {
  const copy = {
    teacher: [
      'Your teaching workspace.',
      'Review submitted work batch by batch, prepare content, distribute assignments and place students into batches. Each tool appears only with your current course-scoped permissions; publishing does not distribute assignments.',
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
      <Card>
        <p>{copy[portal][1]}</p>
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
