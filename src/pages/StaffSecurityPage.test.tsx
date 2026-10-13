import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { StaffSecurityPage } from './StaffSecurityPage'
import { safeSecurityReturn } from '../features/auth/securityReturn'

const mocks = vi.hoisted(() => ({
  allOut: vi.fn(),
  remove: vi.fn(),
  state: vi.fn(),
  enroll: vi.fn(),
  verify: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fixture-user' } } }),
}))
vi.mock('../features/auth/staffMfa', () => ({
  getStaffMfaState: mocks.state,
  enrollStaffTotp: mocks.enroll,
  verifyStaffTotp: mocks.verify,
  cancelStaffTotpEnrollment: mocks.cancel,
  signOutAllStaffSessions: mocks.allOut,
  removeStaffTotpFactor: mocks.remove,
}))

describe('staff authenticator screen', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.state.mockResolvedValue({ currentLevel: 'aal1', factors: [] })
    mocks.enroll.mockResolvedValue({
      id: 'fixture-factor',
      qrCode: '<svg xmlns="http://www.w3.org/2000/svg"/>',
      secret: 'FICTIONAL-KEY',
    })
    mocks.verify.mockResolvedValue(undefined)
    mocks.cancel.mockResolvedValue(undefined)
    mocks.allOut.mockResolvedValue(undefined)
    mocks.remove.mockResolvedValue(undefined)
  })

  it('shows setup material only after deliberate enrolment and hides the key initially', async () => {
    const user = userEvent.setup()
    renderApp(<StaffSecurityPage />)
    await user.click(await screen.findByRole('button', { name: 'Start authenticator setup' }))
    expect(await screen.findByAltText('Authenticator setup QR code')).toBeVisible()
    expect(screen.queryByText('FICTIONAL-KEY')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show manual setup key' }))
    expect(screen.getByText('FICTIONAL-KEY')).toBeVisible()
  })

  it('clears enrolment material and the entered code after verification', async () => {
    const user = userEvent.setup()
    renderApp(<StaffSecurityPage />)
    await user.click(await screen.findByRole('button', { name: 'Start authenticator setup' }))
    await user.type(await screen.findByLabelText('Six-digit code'), '123456')
    mocks.state.mockResolvedValue({ currentLevel: 'aal2', factors: [{ id: 'fixture-factor' }] })
    await user.click(screen.getByRole('button', { name: 'Verify authenticator' }))
    expect(await screen.findByRole('button', { name: 'Continue to workspace' })).toBeVisible()
    expect(screen.queryByAltText('Authenticator setup QR code')).not.toBeInTheDocument()
    expect(mocks.verify).toHaveBeenCalledWith('fixture-factor', '123456')
  })

  it('shows a challenge for enrolled password-only staff without creating another factor', async () => {
    mocks.state.mockResolvedValue({
      currentLevel: 'aal1',
      factors: [{ id: 'fixture-factor', friendly_name: 'Primary' }],
    })
    renderApp(<StaffSecurityPage />)
    expect(await screen.findByLabelText('Six-digit code')).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Start authenticator setup' }),
    ).not.toBeInTheDocument()
    expect(mocks.enroll).not.toHaveBeenCalled()
  })

  it('retains setup and displays the safe failure when cancellation fails', async () => {
    const user = userEvent.setup()
    mocks.cancel.mockRejectedValue(new Error('We could not cancel setup. Please try again.'))
    renderApp(<StaffSecurityPage />)
    await user.click(await screen.findByRole('button', { name: 'Start authenticator setup' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel setup' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not cancel setup.')
    expect(screen.getByAltText('Authenticator setup QR code')).toBeVisible()
  })

  it('fails closed with retry when security state cannot be checked', async () => {
    mocks.state.mockRejectedValue(new Error('provider failure'))
    renderApp(<StaffSecurityPage />)
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeVisible()
    expect(screen.queryByLabelText('Six-digit code')).not.toBeInTheDocument()
  })

  it('rejects external and recursive return destinations', () => {
    for (const value of [
      'https://example.com',
      '//example.com',
      '/staff/security',
      '/staff/sign-in',
      '/staff/\\example.com',
    ]) {
      expect(safeSecurityReturn(value)).toBe('/staff/notifications')
    }
    expect(safeSecurityReturn('/staff/crm/privacy?case=fictional')).toBe(
      '/staff/crm/privacy?case=fictional',
    )
  })

  it('presents a final-factor guard error without hiding the factor', async () => {
    const user = userEvent.setup()
    mocks.state.mockResolvedValue({
      currentLevel: 'aal2',
      factors: [{ id: 'fixture-factor', friendly_name: 'Primary' }],
    })
    mocks.remove.mockRejectedValue(
      new Error('Add and verify a backup authenticator before removing your last one.'),
    )
    renderApp(<StaffSecurityPage />)
    await user.click(await screen.findByRole('button', { name: 'Remove Primary' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('backup authenticator')
    expect(screen.getByText('Primary')).toBeVisible()
  })

  it('invokes all-device sign-out and displays a safe failure', async () => {
    const user = userEvent.setup()
    mocks.allOut.mockRejectedValue(
      new Error('Your previous sessions are blocked. Sign in again to continue.'),
    )
    renderApp(<StaffSecurityPage />)
    await user.click(await screen.findByRole('button', { name: 'Sign out all devices' }))
    expect(mocks.allOut).toHaveBeenCalledOnce()
    expect(await screen.findByRole('alert')).toHaveTextContent('previous sessions are blocked')
  })
})
