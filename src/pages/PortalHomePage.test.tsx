import { screen } from '@testing-library/react'
import { renderApp } from '../test/render'
import { PortalHomePage } from './PortalHomePage'

const mocks = vi.hoisted(() => ({ access: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional-teacher' } } }),
}))
vi.mock('../features/auth/portals', async (original) => ({
  ...(await original<typeof import('../features/auth/portals')>()),
  getPortalAccess: mocks.access,
}))

describe('teacher home', () => {
  beforeEach(() => mocks.access.mockReset())
  it('walks the teacher through create, assign and feedback with only their tools', async () => {
    mocks.access.mockResolvedValue({
      employee: true,
      content: true,
      reviews: true,
      distribution: false,
    })
    renderApp(<PortalHomePage portal="teacher" />, ['/teacher'])
    expect(await screen.findByRole('link', { name: 'Open lessons & assignments' })).toHaveAttribute(
      'href',
      '/teacher/content',
    )
    expect(screen.getByRole('link', { name: 'Open review & feedback' })).toHaveAttribute(
      'href',
      '/teacher/reviews',
    )
    expect(screen.queryByRole('link', { name: 'Open assign to students' })).not.toBeInTheDocument()
  })
  it('says so when no teaching tools are assigned', async () => {
    mocks.access.mockResolvedValue({ employee: true })
    renderApp(<PortalHomePage portal="teacher" />, ['/teacher'])
    expect(await screen.findByText(/No teaching tools are assigned/)).toBeInTheDocument()
  })
})
