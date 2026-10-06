import { screen } from '@testing-library/react'

import type { AuthContextValue } from './AuthContext'
import { renderApp } from '../../test/render'
import { StaffAccessBoundary } from './StaffAccessBoundary'

const mocks = vi.hoisted(() => ({
  auth: undefined as AuthContextValue | undefined,
  getEmployeeAccess: vi.fn(),
}))

vi.mock('./AuthContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('./AuthContext')>()
  return { ...original, useAuth: () => mocks.auth }
})

vi.mock('./employeeAuth', () => ({
  getEmployeeAccess: mocks.getEmployeeAccess,
}))

describe('StaffAccessBoundary', () => {
  beforeEach(() => {
    mocks.auth = {
      configured: true,
      initializing: false,
      session: { user: { id: 'employee-auth-id' } } as AuthContextValue['session'],
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    }
    mocks.getEmployeeAccess.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('opens the workspace only after a current capability check succeeds', async () => {
    mocks.getEmployeeAccess.mockResolvedValue({ activeEmployee: true, hasCapability: true })
    renderApp(
      <StaffAccessBoundary capability="enrollment.operate">
        <h1>Protected workspace</h1>
      </StaffAccessBoundary>,
      ['/staff/enrolments'],
    )

    expect(await screen.findByRole('heading', { name: 'Protected workspace' })).toBeVisible()
    expect(mocks.getEmployeeAccess).toHaveBeenCalledWith('enrollment.operate')
  })

  it('denies access when the current employee role lacks the capability', async () => {
    mocks.getEmployeeAccess.mockResolvedValue({ activeEmployee: true, hasCapability: false })
    renderApp(
      <StaffAccessBoundary capability="enrollment.operate">
        <h1>Protected workspace</h1>
      </StaffAccessBoundary>,
    )

    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this workspace.' }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Protected workspace' })).not.toBeInTheDocument()
  })

  it('allows the explicit fictional preview without a staff session', () => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.auth = {
      ...mocks.auth!,
      configured: false,
      session: null,
    }
    renderApp(
      <StaffAccessBoundary capability="enrollment.operate">
        <h1>Fictional preview</h1>
      </StaffAccessBoundary>,
      ['/staff/enrolments?preview=1'],
    )

    expect(screen.getByRole('heading', { name: 'Fictional preview' })).toBeVisible()
    expect(mocks.getEmployeeAccess).not.toHaveBeenCalled()
  })
})
