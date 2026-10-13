import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { EmployeePasswordRecoveryPage } from './EmployeePasswordRecoveryPage'
const mocks = vi.hoisted(() => ({
  proof: null as object | null,
  request: vi.fn(),
  verify: vi.fn(),
  complete: vi.fn(),
}))
vi.mock('../features/auth/employeePasswordRecovery', () => ({
  getPendingEmployeeRecoveryProof: () => mocks.proof,
  requestEmployeePasswordRecovery: mocks.request,
  verifyEmployeeRecovery: mocks.verify,
  completeEmployeePasswordRecovery: mocks.complete,
}))
describe('employee password recovery page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.proof = null
  })
  it('uses a generic acknowledgment without confirming account existence', async () => {
    mocks.request.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderApp(<EmployeePasswordRecoveryPage />)
    await user.type(screen.getByLabelText('Employee email'), 'unknown@fixture.invalid')
    await user.click(screen.getByRole('button', { name: 'Request recovery link' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If this is an eligible employee account',
    )
    expect(screen.getByLabelText('Employee email')).toHaveValue('')
  })
  it('keeps existing MFA explicit and requires matching chosen passwords', async () => {
    mocks.proof = { requestId: 'fictional' }
    mocks.verify.mockResolvedValue(undefined)
    mocks.complete.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderApp(<EmployeePasswordRecoveryPage />)
    await user.click(screen.getByRole('button', { name: 'Verify recovery link' }))
    await user.type(await screen.findByLabelText('New password'), 'fictional-password')
    await user.type(screen.getByLabelText('Confirm password'), 'different-password')
    await user.click(
      screen.getByRole('button', { name: 'Update password and block previous sessions' }),
    )
    expect(screen.getByRole('alert')).toHaveTextContent('passwords must match')
    expect(mocks.complete).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'fictional-password')
    await user.click(
      screen.getByRole('button', { name: 'Update password and block previous sessions' }),
    )
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeVisible()
    expect(screen.getByText(/your existing authenticator is still required/)).toBeVisible()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})
