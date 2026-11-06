import { useQuery } from '@tanstack/react-query'
import { NavLink, useLocation } from 'react-router-dom'
import { Button } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import {
  canOpenPortal,
  getPortalAccess,
  portalLabels,
  portalSignIn,
  type Portal,
} from '../../features/auth/portals'
import { passwordSignInEnabled } from '../../features/auth/googleLogin'
import type { NavigationAccess } from '../../features/auth/navigationAccess'
import styles from './AppShell.module.css'

const studentLinks = [
  ['Student portal', '/student'],
  ['Coursework', '/student/coursework'],
  ['Assignments', '/student/assignments'],
  ['Test series', '/tests'],
  ['Study checklist', '/student/study-checklist'],
  ['Class agenda', '/student/agenda'],
  ['Work archive', '/student/archive'],
] as const
// D-066: the staff entrance is the Sales portal; teaching tools live in the Teacher portal.
const staffLinks: [keyof NavigationAccess, string, string][] = [
  ['crm', 'CRM', '/staff/crm'],
  ['crmAssignments', 'CRM assignment', '/staff/crm/assignments'],
  ['enrolments', 'Handoffs', '/staff/enrolment-handoffs'],
  ['enrolments', 'Enrolments', '/staff/enrolments'],
  ['batches', 'Batches', '/staff/batches'],
  ['studentLogins', 'Google sign-in list', '/staff/google-access'],
  ['payments', 'Payments', '/staff/payments'],
  ['closeout', 'Course closeout', '/staff/enrolment-closeout'],
]
const teacherLinks: [keyof NavigationAccess, string, string][] = [
  // Plain task names: teachers create work, assign it, then give feedback.
  ['content', 'Lessons & assignments', '/teacher/content'],
  ['distribution', 'Assign to students', '/teacher/distribution'],
  ['reviews', 'Review & feedback', '/teacher/reviews'],
  ['batchAssign', 'Batches', '/teacher/batches'],
  ['classes', 'Classes', '/teacher/classes'],
  ['curriculumImpact', 'Curriculum preview', '/teacher/curriculum-impact'],
]
const adminLinks: [keyof NavigationAccess, string, string][] = [
  ['enrolments', 'Admissions', '/admin/admissions'],
  ['employees', 'Employees', '/admin/employees'],
  ['courses', 'Courses', '/admin/courses'],
  ['paymentLedger', 'Payment ledger', '/admin/payments'],
  ['studentLoginRevoke', 'Google sign-in list', '/admin/google-access'],
  ['privacy', 'Privacy', '/admin/privacy'],
  ['studentRecovery', 'Student recovery', '/admin/student-recovery'],
  ['staffRecovery', 'Staff recovery', '/admin/recovery'],
  ['staffRecovery', 'Recovery investigations', '/admin/incidents'],
]
// D-068: password and authenticator recovery tools leave the menu while sign-in is Google-only.
const passwordRecoveryPaths = new Set(['/admin/student-recovery', '/admin/recovery'])
export function PortalNavigation({
  portal,
  previewEnabled,
  notificationSearch,
  unreadCount,
}: {
  portal: Portal | null
  previewEnabled: boolean
  notificationSearch: string
  unreadCount: number
}) {
  const { session } = useAuth()
  const location = useLocation()
  const query = useQuery({
    queryKey: ['portal-access', session?.user.id],
    queryFn: getPortalAccess,
    enabled: Boolean(session) && !previewEnabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const current = !previewEnabled && !query.isError ? query.data : undefined
  const demo = previewEnabled && portal !== 'admin'
  const link = (label: string, path: string, search = '') => (
    <NavLink
      key={path}
      end
      to={path + search}
      className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
    >
      {label}
    </NavLink>
  )
  if (!session && !demo)
    return (
      <>
        {(Object.keys(portalSignIn) as Portal[]).map((kind) =>
          link(`${portalLabels[kind]} sign in`, portalSignIn[kind]),
        )}
        {link('System status', '/health')}
      </>
    )
  const allowed = (key: keyof NavigationAccess) =>
    demo
      ? [
          'crm',
          'crmAssignments',
          'enrolments',
          'batches',
          'studentLogins',
          'reviews',
          'content',
          'distribution',
          'batchAssign',
        ].includes(key)
      : Boolean(current?.employee && current[key])
  const active = portal && (demo || (current && canOpenPortal(portal, current)))
  const demoSearch = demo ? '?preview=1' : ''
  return (
    <>
      {demo ? <span role="status">Fictional preview</span> : null}
      {active && portal === 'student'
        ? studentLinks
            .filter(
              ([, path]) =>
                !demo ||
                ['/student', '/student/coursework', '/student/assignments', '/tests'].includes(
                  path,
                ),
            )
            .map(([label, path]) => link(label, path, demoSearch))
        : null}
      {active && portal === 'teacher' ? (
        <>
          {link('Teacher home', '/teacher', demoSearch)}
          {teacherLinks
            .filter(([key]) => allowed(key))
            .map(([, label, path]) => link(label, path, demoSearch))}
        </>
      ) : null}
      {active && portal === 'staff' ? (
        <>
          {link('Sales home', '/staff', demoSearch)}
          {staffLinks
            .filter(([key]) => allowed(key))
            .map(([, label, path]) => link(label, path, demoSearch))}
        </>
      ) : null}
      {active && portal === 'admin' ? (
        <>
          {link('Admin home', '/admin')}
          {adminLinks
            .filter(
              ([key, , path]) =>
                allowed(key) && (passwordSignInEnabled() || !passwordRecoveryPaths.has(path)),
            )
            .map(([, label, path]) => link(label, path))}
        </>
      ) : null}
      {active && portal ? (
        <NavLink
          end
          to={`/${portal}/notifications${notificationSearch}`}
          className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
        >
          Notifications
          {unreadCount > 0 ? (
            <span className={styles.notificationCount} aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          ) : null}
        </NavLink>
      ) : null}
      {current?.employee && portal !== 'student'
        ? link('Staff security', `/${portal ?? 'staff'}/security`)
        : null}
      {current
        ? (Object.keys(portalLabels) as Portal[])
            .filter((kind) => kind !== portal && canOpenPortal(kind, current))
            .map((kind) => link(`Switch to ${portalLabels[kind]}`, `/${kind}`))
        : null}
      {session && !demo && query.isPending ? <span role="status">Checking navigation…</span> : null}
      {session && !demo && query.isError ? (
        <>
          <span role="status">Navigation access could not be verified.</span>
          <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
            Retry navigation
          </Button>
        </>
      ) : null}
      {link('System status', '/health')}
      {location.pathname === '/staff/security' && current?.administrator
        ? link('Admin portal', '/admin')
        : null}
    </>
  )
}
