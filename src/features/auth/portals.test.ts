import {
  canOpenPortal,
  getPortalAccess,
  portalForPath,
  safePortalReturn,
  type PortalAccess,
} from './portals'
import { safeSecurityReturn } from './securityReturn'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), navigation: vi.fn() }))
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
vi.mock('./navigationAccess', () => ({ getNavigationAccess: mocks.navigation }))
const denied: PortalAccess = {
  student: false,
  employee: false,
  administrator: false,
  crm: false,
  crmAssignments: false,
  privacy: false,
  enrolments: false,
  content: false,
  distribution: false,
  reviews: false,
  closeout: false,
  classes: false,
  curriculumImpact: false,
  employees: false,
  studentRecovery: false,
  staffRecovery: false,
}
describe('portal presentation access', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.navigation.mockReset()
  })
  it('requires established membership and scope, not a portal selection', () => {
    expect(canOpenPortal('admin', { ...denied, employee: true })).toBe(false)
    expect(canOpenPortal('teacher', { ...denied, employee: true })).toBe(false)
    expect(canOpenPortal('student', { ...denied, employee: true })).toBe(false)
    expect(canOpenPortal('admin', { ...denied, administrator: true })).toBe(false)
    expect(canOpenPortal('teacher', { ...denied, employee: true, reviews: true })).toBe(true)
    expect(canOpenPortal('admin', { ...denied, employee: true, administrator: true })).toBe(true)
  })
  it('does not query employee roles for a student-only account', async () => {
    mocks.navigation.mockResolvedValue({ ...denied, student: true })
    expect((await getPortalAccess()).administrator).toBe(false)
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('checks only the current established admin role', async () => {
    mocks.navigation.mockResolvedValue({ ...denied, employee: true })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    expect((await getPortalAccess()).administrator).toBe(true)
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('current_person_has_role', {
      p_role_key: 'elevated_admin',
    })
  })
  it.each([
    { data: 'true', error: null },
    { data: {}, error: null },
    { data: true, error: {} },
  ])('fails closed on unavailable/malformed role evidence', async (result) => {
    mocks.navigation.mockResolvedValue({ ...denied, employee: true })
    mocks.rpc.mockResolvedValue(result)
    await expect(getPortalAccess()).rejects.toThrow('could not be verified')
  })
  it.each([
    ['/sign-in', 'student'],
    ['/student/coursework', 'student'],
    ['/teacher/reviews', 'teacher'],
    ['/staff/reviews', 'teacher'],
    ['/staff/crm', 'staff'],
    ['/staff/employees', 'admin'],
    ['/admin/recovery', 'admin'],
    ['/health', null],
  ])('classifies %s without changing its route', (path, portal) =>
    expect(portalForPath(path)).toBe(portal),
  )
})
describe('portal return paths', () => {
  it.each([
    'https://evil.invalid/admin',
    '//evil.invalid/admin',
    '/admin/../staff/crm',
    '/admin/%2e%2e/staff/crm',
    '/admin/%2fsign-in',
    '/admin\\evil',
    '/admin/\nsign-in',
    '/administrator',
    '/staff/crm',
    '/admin/sign-in',
    '/admin/sign-in?returnTo=/admin',
    '/admin?proof=abc#secret',
  ])('rejects unsafe/cross-portal return %s', (path) =>
    expect(safePortalReturn(path, 'admin')).toBe('/admin'),
  )
  it('keeps the protected admin recovery alias distinct from public recovery', () => {
    expect(safePortalReturn('/admin/recovery?request=fixture', 'admin')).toBe(
      '/admin/recovery?request=fixture',
    )
    expect(safePortalReturn('/staff/recover', 'staff')).toBe('/staff')
    expect(safePortalReturn('/teacher/reviews?instance=fixture', 'teacher')).toBe(
      '/teacher/reviews?instance=fixture',
    )
  })
  it.each(['/teacher/reviews?instance=fixture', '/admin/recovery', '/admin', '/staff/crm/privacy'])(
    'preserves protected MFA return %s',
    (path) => expect(safeSecurityReturn(path)).toBe(path),
  )
  it.each([
    '/admin/security',
    '/teacher/sign-in',
    '/teacher/../sign-in',
    '//evil.invalid/admin',
    '/admin/%2f%2fevil',
  ])('rejects unsafe/security-loop MFA return %s', (path) =>
    expect(safeSecurityReturn(path)).toBe('/staff/notifications'),
  )
})
