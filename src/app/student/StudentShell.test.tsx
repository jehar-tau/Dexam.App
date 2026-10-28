import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import type { PortalAccess } from '../../features/auth/portals'
import { renderApp } from '../../test/render'
import { StudentShell } from './StudentShell'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  access: {},
  unread: vi.fn(),
  portals: vi.fn(),
}))
vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, signOut: vi.fn() }),
}))
vi.mock('../../features/auth/supabaseClient', () => ({
  getSupabaseClient: () => ({
    rpc: () => Promise.resolve({ data: mocks.access, error: null }),
  }),
}))
vi.mock('../../features/notifications/notifications', async (original) => ({
  ...(await original<typeof import('../../features/notifications/notifications')>()),
  getUnreadNotificationCount: mocks.unread,
}))
vi.mock('../../features/auth/portals', async (original) => ({
  ...(await original<typeof import('../../features/auth/portals')>()),
  getPortalAccess: mocks.portals,
}))

const noPortals: PortalAccess = {
  student: true,
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

const routes = (
  <Routes>
    <Route path="/student" element={<StudentShell />}>
      <Route index element={<h1>Home page</h1>} />
    </Route>
    <Route path="/tests" element={<StudentShell />}>
      <Route index element={<h1>Overview page</h1>} />
    </Route>
  </Routes>
)

describe('Student portal sidebar', () => {
  beforeEach(() => {
    mocks.unread.mockReset().mockResolvedValue(0)
    mocks.portals.mockReset().mockResolvedValue(noPortals)
  })

  it('gives a coaching student coaching tools and the test series in one sidebar', async () => {
    mocks.session = { user: { id: 'student-1', email: 'dxm-a@members.dexam.invalid' } }
    mocks.access = { kind: 'student', displayName: 'Asha Fictional' }
    mocks.unread.mockResolvedValue(3)
    renderApp(routes, ['/student'])
    const nav = screen.getByRole('navigation', { name: 'Student portal sections' })
    for (const [label, href] of [
      ['Home', '/student'],
      ['Coursework', '/student/coursework'],
      ['Assignments', '/student/assignments'],
      ['Study checklist', '/student/study-checklist'],
      ['Class agenda', '/student/agenda'],
      ['Work archive', '/student/archive'],
      ['Overview', '/tests'],
      ['Practice', '/tests/practice'],
      ['Papers', '/tests/papers'],
      ['Mocks', '/tests/mocks'],
    ] as const) {
      expect(within(nav).getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(await within(nav).findByLabelText('3 unread')).toBeVisible()
    expect(await screen.findByText('Asha Fictional')).toBeVisible()
    for (const brand of screen.getAllByRole('link', { name: 'Dexam Student portal' })) {
      expect(brand).toHaveAttribute('href', '/student')
    }
  })

  it('shows a public candidate the test series only', async () => {
    mocks.session = { user: { id: 'candidate-1', email: 'c@example.invalid' } }
    mocks.access = {
      kind: 'candidate',
      displayName: 'Ravi Fictional',
      profile: { level: 'mdes', exams: ['ceed'], examYear: 2027 },
    }
    renderApp(routes, ['/tests'])
    expect(await screen.findByText('M.Des candidate')).toBeVisible()
    const nav = screen.getByRole('navigation', { name: 'Student portal sections' })
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(within(nav).queryByRole('link', { name: 'Coursework' })).toBeNull()
    expect(within(nav).queryByRole('link', { name: /Notifications/ })).toBeNull()
    for (const brand of screen.getAllByRole('link', { name: 'Dexam Test series' })) {
      expect(brand).toHaveAttribute('href', '/tests')
    }
    expect(mocks.unread).not.toHaveBeenCalled()
    expect(mocks.portals).not.toHaveBeenCalled()
  })

  it('lets a coaching student who is also an employee switch portals', async () => {
    mocks.session = { user: { id: 'student-2', email: 'dxm-b@members.dexam.invalid' } }
    mocks.access = { kind: 'student', displayName: 'Dual Fictional' }
    mocks.portals.mockResolvedValue({ ...noPortals, employee: true, crm: true })
    renderApp(routes, ['/student'])
    expect(await screen.findByRole('link', { name: 'Switch to Staff portal' })).toHaveAttribute(
      'href',
      '/staff',
    )
    expect(screen.queryByRole('link', { name: 'Switch to Admin portal' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'CRM' })).toBeNull()
  })
})
