import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { Button } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import { getNavigationAccess, type NavigationAccess } from '../../features/auth/navigationAccess'
import type { NotificationAudience } from '../../features/notifications/notifications'
import styles from './AppShell.module.css'

const staffLinks: [keyof NavigationAccess, string, string][] = [
  ['crm', 'CRM', '/staff/crm'],
  ['crmAssignments', 'CRM assignment', '/staff/crm/assignments'],
  ['privacy', 'Privacy', '/staff/crm/privacy'],
  ['enrolments', 'Handoffs', '/staff/enrolment-handoffs'],
  ['enrolments', 'Enrolments', '/staff/enrolments'],
  ['content', 'Content', '/staff/content'],
  ['distribution', 'Distribution', '/staff/assignments'],
  ['reviews', 'Reviews', '/staff/reviews'],
  ['employees', 'Employees', '/staff/employees'],
  ['studentRecovery', 'Student recovery', '/staff/student-recovery'],
  ['staffRecovery', 'Recovery investigations', '/staff/security/incidents'],
  ['closeout', 'Course closeout', '/staff/enrolment-closeout'],
  ['classes', 'Classes', '/staff/classes'],
  ['curriculumImpact', 'Curriculum preview', '/staff/curriculum-impact'],
  ['staffRecovery', 'Staff recovery', '/staff/security/recovery'],
]
const studentLinks: [string, string][] = [
  ['Student portal', '/student'],
  ['Coursework', '/student/coursework'],
  ['Assignments', '/student/assignments'],
  ['Study checklist', '/student/study-checklist'],
  ['Class agenda', '/student/agenda'],
  ['Work archive', '/student/archive'],
]
export function WorkspaceNavigation({
  audience,
  notificationSearch,
  previewEnabled,
  unreadCount,
}: {
  audience: NotificationAudience | null
  notificationSearch: string
  previewEnabled: boolean
  unreadCount: number
}) {
  const { session } = useAuth()
  const access = useQuery({
    queryKey: ['navigation-access', session?.user.id],
    queryFn: getNavigationAccess,
    enabled: Boolean(session) && !previewEnabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: 30_000,
  })
  const current = !previewEnabled && !access.isError ? access.data : undefined
  function link(label: string, path: string, demo = false) {
    return (
      <NavLink
        key={path}
        end
        className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
        to={path + (demo ? '?preview=1' : '')}
      >
        {label}
      </NavLink>
    )
  }
  const demoStudent = previewEnabled && audience === 'student'
  const demoStaff = previewEnabled && !demoStudent
  return (
    <>
      {!session && !previewEnabled ? (
        <>
          {link('Student portal', '/student')}
          {link('Staff sign in', '/staff/sign-in')}
          {link('Activate account', '/activate')}
        </>
      ) : null}
      {previewEnabled ? <span role="status">Fictional preview</span> : null}
      {current?.student || demoStudent
        ? studentLinks
            .filter(
              ([, path]) =>
                !demoStudent ||
                ['/student', '/student/coursework', '/student/assignments'].includes(path),
            )
            .map(([label, path]) => link(label, path, demoStudent))
        : null}
      {staffLinks
        .filter(([key]) =>
          demoStaff
            ? [
                'crm',
                'crmAssignments',
                'privacy',
                'enrolments',
                'content',
                'distribution',
                'reviews',
              ].includes(key)
            : current?.employee && current[key],
        )
        .map(([, label, path]) => link(label, path, demoStaff))}
      {current?.employee ? link('Staff security', '/staff/security') : null}
      {current?.student || current?.employee || previewEnabled ? (
        <NavLink
          end
          className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
          to={`${demoStudent || (current?.student && (audience === 'student' || !current.employee)) ? '/student' : '/staff'}/notifications${notificationSearch}`}
        >
          Notifications
          {unreadCount > 0 ? (
            <span className={styles.notificationCount} aria-label={`${unreadCount} unread`}>
              {unreadCount}
            </span>
          ) : null}
        </NavLink>
      ) : null}
      {session && !previewEnabled && access.isPending ? (
        <span role="status">Checking navigation…</span>
      ) : null}
      {session && !previewEnabled && access.isError ? (
        <>
          <span role="status">Navigation access could not be verified.</span>
          <Button size="sm" variant="ghost" onClick={() => void access.refetch()}>
            Retry navigation
          </Button>
        </>
      ) : null}
      {link('System status', '/health')}
    </>
  )
}
