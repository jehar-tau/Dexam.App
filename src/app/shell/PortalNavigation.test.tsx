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
    expect(screen.getByRole('link', { name: 'Switch to Staff portal' })).toHaveAttribute(
      'href',
      '/staff',
    )
    expect(screen.queryByRole('link', { name: 'Switch to Admin portal' })).not.toBeInTheDocument()
  })
  it('shows only review tools in the teacher portal', async () => {
    mocks.access.mockResolvedValue({ ...denied, employee: true, reviews: true, content: true })
    renderApp(nav('teacher'))
    expect(await screen.findByRole('link', { name: 'Reviews' })).toHaveAttribute(
      'href',
      '/teacher/reviews',
    )
    expect(screen.queryByRole('link', { name: 'Content' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Staff security' })).toHaveAttribute(
      'href',
      '/teacher/security',
    )
  })
  it('does not expose admin operations to a non-admin employee', async () => {
    mocks.access.mockResolvedValue({ ...denied, employee: true, employees: true })
    renderApp(nav('admin'))
    await screen.findByRole('link', { name: 'Switch to Staff portal' })
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
