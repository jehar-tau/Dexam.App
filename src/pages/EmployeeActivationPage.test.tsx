import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { EmployeeActivationPage } from './EmployeeActivationPage'
const mocks = vi.hoisted(() => ({
  proof: null as object | null,
  verify: vi.fn(),
  complete: vi.fn(),
}))
vi.mock('../features/auth/employeeActivation', () => ({
  getPendingEmployeeActivationProof: () => mocks.proof,
  verifyEmployeeActivation: mocks.verify,
  completeEmployeeActivation: mocks.complete,
}))
describe('employee activation page', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.proof = null
  })
  it('explains how to recover from a missing link', () => {
    renderApp(<EmployeeActivationPage />)
    expect(screen.getByText(/Open the complete link/)).toBeVisible()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
  it('verifies before accepting matching employee-chosen passwords', async () => {
    mocks.proof = { requestId: 'fictional' }
    mocks.verify.mockResolvedValue(undefined)
    mocks.complete.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderApp(<EmployeeActivationPage />)
    await user.click(screen.getByRole('button', { name: 'Verify invitation' }))
    await user.type(await screen.findByLabelText('New password'), 'fictional-password')
    await user.type(screen.getByLabelText('Confirm password'), 'different-password')
    await user.click(screen.getByRole('button', { name: 'Activate employee account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('passwords must match')
    expect(mocks.complete).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'fictional-password')
    await user.click(screen.getByRole('button', { name: 'Activate employee account' }))
    expect(await screen.findByRole('heading', { name: 'Account activated' })).toBeVisible()
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
})
