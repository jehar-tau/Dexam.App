import { screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'

import type { AuthContextValue } from './AuthContext'
import { renderApp } from '../../test/render'
import { StaffAccessBoundary } from './StaffAccessBoundary'

const mocks = vi.hoisted(() => ({
  auth: undefined as AuthContextValue | undefined,
  getEmployeeAccess: vi.fn(),
  getStaffMfaState: vi.fn(),
}))

vi.mock('./AuthContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('./AuthContext')>()
  return { ...original, useAuth: () => mocks.auth }
})

vi.mock('./employeeAuth', () => ({
  getEmployeeAccess: mocks.getEmployeeAccess,
}))

vi.mock('./staffMfa', () => ({ getStaffMfaState: mocks.getStaffMfaState }))

describe('StaffAccessBoundary', () => {
  function CurrentPath() {
    const location = useLocation()
    return (
      <p>
        {location.pathname}
        {location.search}
      </p>
    )
  }
  beforeEach(() => {
    mocks.auth = {
      configured: true,
      initializing: false,
      session: { user: { id: 'employee-auth-id' } } as AuthContextValue['session'],
      signInEmployee: vi.fn().mockResolvedValue(undefined),
      signInStudent: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    }
    mocks.getEmployeeAccess.mockReset()
    mocks.getStaffMfaState.mockReset().mockResolvedValue({ currentLevel: 'aal1', factors: [] })
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

  it('routes an enrolled password-only employee to the authenticator challenge', async () => {
    mocks.getEmployeeAccess.mockResolvedValue({ activeEmployee: true, hasCapability: true })
    mocks.getStaffMfaState.mockResolvedValue({
      currentLevel: 'aal1',
      factors: [{ id: 'fixture-factor' }],
    })
    renderApp(
      <>
        <CurrentPath />
        <StaffAccessBoundary capability="enrollment.operate">
          <h1>Protected workspace</h1>
        </StaffAccessBoundary>
      </>,
      ['/staff/enrolments'],
    )
    expect(await screen.findByText('/staff/security?returnTo=%2Fstaff%2Fenrolments')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Protected workspace' })).not.toBeInTheDocument()
  })

  it('routes required MFA to enrolment even without an existing factor', async () => {
    mocks.getEmployeeAccess.mockResolvedValue({ activeEmployee: true, hasCapability: false })
    renderApp(
      <>
        <CurrentPath />
        <StaffAccessBoundary capability="privacy.manage" requireMfa>
          <h1>Protected workspace</h1>
        </StaffAccessBoundary>
      </>,
      ['/staff/crm/privacy'],
    )
    expect(
      await screen.findByText('/staff/security?returnTo=%2Fstaff%2Fcrm%2Fprivacy'),
    ).toBeVisible()
  })

  it('fails closed on an MFA provider error', async () => {
    mocks.getEmployeeAccess.mockResolvedValue({ activeEmployee: true, hasCapability: true })
    mocks.getStaffMfaState.mockRejectedValue(new Error('provider error'))
    renderApp(
      <StaffAccessBoundary>
        <h1>Protected workspace</h1>
      </StaffAccessBoundary>,
    )
    expect(
      await screen.findByRole('heading', { name: 'We could not verify your access.' }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Protected workspace' })).not.toBeInTheDocument()
  })

  it('checks active employment even on the security route that skips challenge routing', async () => {
    mocks.getEmployeeAccess.mockResolvedValue({ activeEmployee: false, hasCapability: false })
    renderApp(
      <StaffAccessBoundary skipMfa>
        <h1>Protected workspace</h1>
      </StaffAccessBoundary>,
    )
    expect(
      await screen.findByRole('heading', { name: 'You do not have access to this workspace.' }),
    ).toBeVisible()
    expect(mocks.getStaffMfaState).not.toHaveBeenCalled()
  })
})
