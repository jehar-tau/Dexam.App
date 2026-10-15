import { act, screen } from '@testing-library/react'
import type { AuthContextValue } from '../../features/auth/AuthContext'
import type { NavigationAccess } from '../../features/auth/navigationAccess'
import { renderApp } from '../../test/render'
import { WorkspaceNavigation } from './WorkspaceNavigation'
const mocks = vi.hoisted(() => ({
  auth: undefined as AuthContextValue | undefined,
  navigation: vi.fn(),
}))
vi.mock('../../features/auth/AuthContext', async (original) => ({
  ...(await original<typeof import('../../features/auth/AuthContext')>()),
  useAuth: () => mocks.auth,
}))
vi.mock('../../features/auth/navigationAccess', () => ({ getNavigationAccess: mocks.navigation }))
const denied: NavigationAccess = {
  student: false,
  employee: false,
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
function navigation(preview = false, student = true) {
  return (
    <WorkspaceNavigation
      audience={student ? 'student' : 'teacher'}
      notificationSearch={preview ? '?preview=1' : ''}
      previewEnabled={preview}
      unreadCount={0}
    />
  )
}
describe('workspace navigation', () => {
  beforeEach(() => {
    mocks.auth = { session: { user: { id: 'fixture-user' } } } as AuthContextValue
    mocks.navigation.mockReset()
  })
  afterEach(() => vi.useRealTimers())
  it('shows student tools without staff destinations', async () => {
    mocks.navigation.mockResolvedValue({ ...denied, student: true })
    renderApp(navigation())
    expect(await screen.findByRole('link', { name: 'Coursework' })).toHaveAttribute(
      'href',
      '/student/coursework',
    )
    expect(screen.getByRole('link', { name: 'Work archive' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'CRM' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Staff security' })).not.toBeInTheDocument()
  })
  it('keeps only allowed staff tools and security entry before MFA', async () => {
    mocks.navigation.mockResolvedValue({ ...denied, employee: true, reviews: true })
    renderApp(navigation(false, false))
    expect(await screen.findByRole('link', { name: 'Reviews' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Staff security' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Employees' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Coursework' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Content' })).not.toBeInTheDocument()
  })
  it('keeps both existing sets for dual memberships', async () => {
    mocks.navigation.mockResolvedValue({ ...denied, student: true, employee: true, crm: true })
    renderApp(navigation())
    expect(await screen.findByRole('link', { name: 'CRM' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Coursework' })).toBeVisible()
  })
  it('hides cached private destinations on failed foreground refresh', async () => {
    vi.useFakeTimers()
    mocks.navigation.mockResolvedValue({ ...denied, employee: true, crm: true })
    renderApp(navigation(false, false))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByRole('link', { name: 'CRM' })).toBeVisible()
    mocks.navigation.mockRejectedValue(new Error('withheld provider payload'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010)
    })
    expect(screen.queryByRole('link', { name: 'CRM' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Staff security' })).not.toBeInTheDocument()
    expect(screen.getByText('Navigation access could not be verified.')).toBeVisible()
  })
  it('does not use a previous account result while a new account check is pending', async () => {
    mocks.navigation
      .mockResolvedValueOnce({ ...denied, employee: true, crm: true })
      .mockImplementation(() => new Promise(() => {}))
    const view = renderApp(navigation())
    expect(await screen.findByRole('link', { name: 'CRM' })).toBeVisible()
    mocks.auth = {
      ...mocks.auth!,
      session: { user: { id: 'second' } } as AuthContextValue['session'],
    }
    view.rerender(navigation())
    expect(screen.queryByRole('link', { name: 'CRM' })).not.toBeInTheDocument()
  })
  it('marks demo links explicitly and never targets non-preview private workspaces', () => {
    mocks.auth = { ...mocks.auth!, session: null }
    renderApp(navigation(true))
    expect(screen.getByText('Fictional preview')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Coursework' })).toHaveAttribute(
      'href',
      '/student/coursework?preview=1',
    )
    expect(screen.queryByRole('link', { name: 'Work archive' })).not.toBeInTheDocument()
    expect(mocks.navigation).not.toHaveBeenCalled()
  })
  it('shows only public entry points while signed out', () => {
    mocks.auth = { ...mocks.auth!, session: null }
    renderApp(navigation())
    expect(screen.getByRole('link', { name: 'Staff sign in' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Reviews' })).not.toBeInTheDocument()
    expect(mocks.navigation).not.toHaveBeenCalled()
  })
})
