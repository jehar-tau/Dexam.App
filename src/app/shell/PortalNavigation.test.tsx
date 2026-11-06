import { act, screen } from '@testing-library/react'
import type { AuthContextValue } from '../../features/auth/AuthContext'
import type { Portal, PortalAccess } from '../../features/auth/portals'
import { renderApp } from '../../test/render'
import { PortalNavigation } from './PortalNavigation'
const mocks = vi.hoisted(() => ({
  auth: undefined as AuthContextValue | undefined,
  access: vi.fn(),
}))
vi.mock('../../features/auth/AuthContext', async (original) => ({
  ...(await original<typeof import('../../features/auth/AuthContext')>()),
  useAuth: () => mocks.auth,
}))
vi.mock('../../features/auth/portals', async (original) => ({
  ...(await original<typeof import('../../features/auth/portals')>()),
  getPortalAccess: mocks.access,
}))
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
  batches: false,
  batchAssign: false,
  studentLogins: false,
  studentLoginRevoke: false,
  courses: false,
  payments: false,
  paymentLedger: false,
  employees: false,
  studentRecovery: false,
  staffRecovery: false,
}
const nav = (portal: Portal, previewEnabled = false) => (
  <PortalNavigation
    portal={portal}
    previewEnabled={previewEnabled}
    notificationSearch={previewEnabled ? '?preview=1' : ''}
    unreadCount={0}
  />
)
describe('separate portal navigation', () => {
  beforeEach(() => {
    mocks.auth = { session: { user: { id: 'first' } } } as AuthContextValue
    mocks.access.mockReset()
  })
  afterEach(() => vi.useRealTimers())
  it('keeps student tools separate even for a dual-member employee', async () => {
    mocks.access.mockResolvedValue({ ...denied, student: true, employee: true, crm: true })
    renderApp(nav('student'))
    expect(await screen.findByRole('link', { name: 'Coursework' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'CRM' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch to Sales portal' })).toHaveAttribute(
      'href',
      '/staff',
    )
    expect(screen.queryByRole('link', { name: 'Switch to Admin portal' })).not.toBeInTheDocument()
  })
  it('shows separately authorized content alongside teacher reviews', async () => {
    mocks.access.mockResolvedValue({ ...denied, employee: true, reviews: true, content: true })
    renderApp(nav('teacher'))
    expect(await screen.findByRole('link', { name: 'Review & feedback' })).toHaveAttribute(
      'href',
      '/teacher/reviews',
    )
    expect(screen.getByRole('link', { name: 'Lessons & assignments' })).toHaveAttribute(
      'href',
      '/teacher/content',
    )
    expect(screen.getByRole('link', { name: 'Staff security' })).toHaveAttribute(
      'href',
      '/teacher/security',
    )
  })
  it('does not expose admin operations to a non-admin employee', async () => {
    mocks.access.mockResolvedValue({ ...denied, employee: true, employees: true })
    renderApp(nav('admin'))
    await screen.findByRole('link', { name: 'Switch to Sales portal' })
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
  })
  it('splits Sales and Teacher tools (D-066)', async () => {
    mocks.access.mockResolvedValue({
      ...denied,
      employee: true,
      crm: true,
      batches: true,
      batchAssign: true,
      distribution: true,
      content: true,
      privacy: true,
    })
    const sales = renderApp(nav('staff'))
    expect(await screen.findByRole('link', { name: 'Batches' })).toHaveAttribute(
      'href',
      '/staff/batches',
    )
    expect(screen.getByRole('link', { name: 'CRM' })).toBeVisible()
    for (const name of ['Content', 'Distribution', 'Privacy'])
      expect(screen.queryByRole('link', { name })).not.toBeInTheDocument()
    sales.unmount()
    renderApp(nav('teacher'))
    expect(await screen.findByRole('link', { name: 'Assign to students' })).toHaveAttribute(
      'href',
      '/teacher/distribution',
    )
    expect(screen.getByRole('link', { name: 'Batches' })).toHaveAttribute(
      'href',
      '/teacher/batches',
    )
    expect(screen.queryByRole('link', { name: 'CRM' })).not.toBeInTheDocument()
  })
  it('shows Privacy in the admin portal only', async () => {
    mocks.access.mockResolvedValue({ ...denied, employee: true, privacy: true })
    renderApp(nav('admin'))
    expect(await screen.findByRole('link', { name: 'Privacy' })).toHaveAttribute(
      'href',
      '/admin/privacy',
    )
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
  })
  it('shows only current authorized admin operations', async () => {
    mocks.access.mockResolvedValue({
      ...denied,
      employee: true,
      administrator: true,
      employees: true,
    })
    renderApp(nav('admin'))
    expect(await screen.findByRole('link', { name: 'Employees' })).toHaveAttribute(
      'href',
      '/admin/employees',
    )
    expect(screen.queryByRole('link', { name: 'Staff recovery' })).not.toBeInTheDocument()
  })
  it('adds Payments for Sales and Courses and the ledger for admins (D-068)', async () => {
    mocks.access.mockResolvedValue({ ...denied, employee: true, payments: true })
    const { unmount } = renderApp(nav('staff'))
    expect(await screen.findByRole('link', { name: 'Payments' })).toHaveAttribute(
      'href',
      '/staff/payments',
    )
    unmount()
    mocks.access.mockResolvedValue({
      ...denied,
      employee: true,
      administrator: true,
      courses: true,
      paymentLedger: true,
    })
    renderApp(nav('admin'))
    expect(await screen.findByRole('link', { name: 'Courses' })).toHaveAttribute(
      'href',
      '/admin/courses',
    )
    expect(screen.getByRole('link', { name: 'Payment ledger' })).toHaveAttribute(
      'href',
      '/admin/payments',
    )
  })
  it('hides password recovery tools while sign-in is Google-only', async () => {
    vi.stubEnv('VITE_ENABLE_SHARED_GOOGLE_LOGIN', 'true')
    mocks.access.mockResolvedValue({
      ...denied,
      employee: true,
      administrator: true,
      studentRecovery: true,
      staffRecovery: true,
    })
    renderApp(nav('admin'))
    expect(await screen.findByRole('link', { name: 'Recovery investigations' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Student recovery' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Staff recovery' })).not.toBeInTheDocument()
    vi.unstubAllEnvs()
  })
  it('retires portal tools on failed foreground refresh', async () => {
    vi.useFakeTimers()
    mocks.access.mockResolvedValue({
      ...denied,
      employee: true,
      administrator: true,
      employees: true,
    })
    renderApp(nav('admin'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByRole('link', { name: 'Employees' })).toBeVisible()
    mocks.access.mockRejectedValue(new Error('unavailable'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010)
    })
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.getByText('Navigation access could not be verified.')).toBeVisible()
  })
  it('never displays previous account destinations during a replacement-account lookup', async () => {
    mocks.access
      .mockResolvedValueOnce({ ...denied, employee: true, administrator: true, employees: true })
      .mockImplementation(() => new Promise(() => {}))
    const view = renderApp(nav('admin'))
    await screen.findByRole('link', { name: 'Employees' })
    mocks.auth = { session: { user: { id: 'second' } } } as AuthContextValue
    view.rerender(nav('admin'))
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
  })
  it('offers four public entrances without private links', () => {
    mocks.auth = { session: null } as AuthContextValue
    renderApp(nav('student'))
    expect(screen.getByRole('link', { name: 'Teacher portal sign in' })).toHaveAttribute(
      'href',
      '/teacher/sign-in',
    )
    expect(screen.getByRole('link', { name: 'Admin portal sign in' })).toHaveAttribute(
      'href',
      '/admin/sign-in',
    )
    expect(mocks.access).not.toHaveBeenCalled()
  })
  it('does not give staff demo links to protected non-preview tools', () => {
    mocks.auth = { session: null } as AuthContextValue
    renderApp(nav('staff', true))
    expect(screen.getByRole('link', { name: 'CRM' })).toHaveAttribute(
      'href',
      '/staff/crm?preview=1',
    )
    expect(screen.queryByRole('link', { name: 'Classes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Course closeout' })).not.toBeInTheDocument()
  })
})
