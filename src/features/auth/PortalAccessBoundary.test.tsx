import { act, screen } from '@testing-library/react'
import { renderApp } from '../../test/render'
import type { AuthContextValue } from './AuthContext'
import type { PortalAccess } from './portals'
import { PortalAccessBoundary } from './PortalAccessBoundary'
const mocks = vi.hoisted(() => ({
  auth: undefined as AuthContextValue | undefined,
  access: vi.fn(),
}))
vi.mock('./AuthContext', async (original) => ({
  ...(await original<typeof import('./AuthContext')>()),
  useAuth: () => mocks.auth,
}))
vi.mock('./portals', async (original) => ({
  ...(await original<typeof import('./portals')>()),
  getPortalAccess: mocks.access,
}))
const employee = { employee: true, administrator: false, reviews: false } as PortalAccess
const boundary = () => (
  <PortalAccessBoundary portal="admin">
    <h1>Private administration</h1>
  </PortalAccessBoundary>
)
describe('portal entrance boundary', () => {
  beforeEach(() => {
    mocks.auth = { session: { user: { id: 'first' } } } as AuthContextValue
    mocks.access.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })
  it('does not open the admin portal merely for an active employee', async () => {
    mocks.access.mockResolvedValue(employee)
    renderApp(boundary())
    expect(
      await screen.findByRole('heading', { name: 'This portal is not available to your account.' }),
    ).toBeVisible()
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument()
  })
  it('fails closed during lookup and on a lookup error', async () => {
    mocks.access.mockRejectedValue(new Error('unavailable'))
    renderApp(boundary())
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument()
    expect(
      await screen.findByRole('heading', { name: 'Portal access could not be verified.' }),
    ).toBeVisible()
  })
  it('hides open portal children after current role revocation', async () => {
    vi.useFakeTimers()
    mocks.access.mockResolvedValue({ ...employee, administrator: true })
    renderApp(boundary())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10)
    })
    expect(screen.getByText('Private administration')).toBeVisible()
    mocks.access.mockResolvedValue(employee)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_010)
    })
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument()
  })
  it('never allows an admin preview even if the generic preview prop is supplied', async () => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.access.mockResolvedValue(employee)
    renderApp(
      <PortalAccessBoundary portal="admin" allowPreview>
        <h1>Private administration</h1>
      </PortalAccessBoundary>,
      ['/admin?preview=1'],
    )
    await screen.findByText('This portal is not available to your account.')
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument()
  })
  it('permits explicitly enabled fictional teacher preview without real reads', () => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.auth = { session: null } as AuthContextValue
    renderApp(
      <PortalAccessBoundary portal="teacher" allowPreview>
        <h1>Fictional teaching</h1>
      </PortalAccessBoundary>,
      ['/teacher?preview=1'],
    )
    expect(screen.getByText('Fictional teaching')).toBeVisible()
    expect(mocks.access).not.toHaveBeenCalled()
  })
  it('does not carry an administrator result to a replacement account', async () => {
    mocks.access
      .mockResolvedValueOnce({ ...employee, administrator: true })
      .mockImplementation(() => new Promise(() => {}))
    const view = renderApp(boundary())
    await screen.findByText('Private administration')
    mocks.auth = { session: { user: { id: 'second' } } } as AuthContextValue
    view.rerender(boundary())
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument()
  })
})
