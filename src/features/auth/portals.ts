import { getSupabaseClient } from './supabaseClient'
import { getNavigationAccess, type NavigationAccess } from './navigationAccess'

export type Portal = 'student' | 'teacher' | 'staff' | 'admin'
export type EmployeePortal = Exclude<Portal, 'student'>
export const portalLabels: Record<Portal, string> = {
  student: 'Student portal',
  teacher: 'Teacher portal',
  staff: 'Staff portal',
  admin: 'Admin portal',
}
export const portalSignIn: Record<Portal, string> = {
  student: '/sign-in',
  teacher: '/teacher/sign-in',
  staff: '/staff/sign-in',
  admin: '/admin/sign-in',
}
export type PortalAccess = NavigationAccess & { administrator: boolean; teacher?: boolean }

export function portalForPath(path: string): Portal | null {
  if (
    path === '/sign-in' ||
    path === '/activate' ||
    path === '/student' ||
    path.startsWith('/student/')
  )
    return 'student'
  if (path === '/teacher' || path.startsWith('/teacher/') || path === '/staff/reviews')
    return 'teacher'
  if (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    [
      '/staff/employees',
      '/staff/student-recovery',
      '/staff/security/recovery',
      '/staff/security/incidents',
    ].includes(path)
  )
    return 'admin'
  if (path === '/staff' || path.startsWith('/staff/')) return 'staff'
  return null
}

export function canOpenPortal(portal: Portal, access: PortalAccess): boolean {
  if (portal === 'student') return access.student
  if (portal === 'admin') return access.employee && access.administrator
  if (portal === 'teacher')
    return access.employee && (access.reviews || Boolean(access.teacher && access.content))
  return access.employee
}

export async function getPortalAccess(): Promise<PortalAccess> {
  const client = getSupabaseClient()
  if (!client) throw new Error('Portal access could not be verified.')
  const access = await getNavigationAccess()
  if (!access.employee) return { ...access, administrator: false }
  const role = await client.rpc('current_person_has_role', { p_role_key: 'elevated_admin' })
  if (role.error || typeof role.data !== 'boolean')
    throw new Error('Portal access could not be verified.')
  const teacher = await client.rpc('current_person_can_open_teacher_content')
  if (teacher.error || typeof teacher.data !== 'boolean')
    throw new Error('Portal access could not be verified.')
  return { ...access, administrator: role.data, teacher: teacher.data }
}

export function safePortalReturn(value: string | null, portal: EmployeePortal): string {
  const fallback = `/${portal}`
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n\t]/.test(value))
    return fallback
  try {
    const url = new URL(value, 'https://dexam.invalid')
    if (url.origin !== 'https://dexam.invalid' || url.hash || /%|\\/.test(url.pathname))
      return fallback
    if (url.pathname !== `/${portal}` && !url.pathname.startsWith(`/${portal}/`)) return fallback
    if (['sign-in', 'activate', 'recover'].includes(url.pathname.split('/')[2] ?? ''))
      return fallback
    return `${url.pathname}${url.search}`
  } catch {
    return fallback
  }
}
