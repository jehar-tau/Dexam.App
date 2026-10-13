import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { StudentPasswordRecoveryPage } from './StudentPasswordRecoveryPage'
const mocks = vi.hoisted(() => ({
  proof: null as { memberId: string; token: string } | null,
  reset: vi.fn(),
  clear: vi.fn(),
}))
vi.mock('../features/auth/studentRecovery', () => ({
  takeStudentRecoveryProof: () => mocks.proof,
  clearStudentRecoveryProof: mocks.clear,
  resetStudentPassword: mocks.reset,
}))
describe('student password recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.proof = null
  })
  it('requires matching private passwords and clears credentials on success', async () => {
    mocks.reset.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderApp(<StudentPasswordRecoveryPage />)
    await user.type(screen.getByLabelText('Dexam Member ID'), 'DXM-7K3M9Q2RW5T2')
    await user.type(screen.getByLabelText('Recovery backup code'), '23456789AB')
    await user.type(screen.getByLabelText('New password'), 'fictional-student-password')
    await user.type(screen.getByLabelText('Confirm password'), 'different-student-password')
    await user.click(screen.getByRole('button', { name: 'Update password and block old sessions' }))
    expect(screen.getByRole('alert')).toHaveTextContent('passwords must match')
    expect(mocks.reset).not.toHaveBeenCalled()
    await user.clear(screen.getByLabelText('Confirm password'))
    await user.type(screen.getByLabelText('Confirm password'), 'fictional-student-password')
    await user.click(screen.getByRole('button', { name: 'Update password and block old sessions' }))
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeVisible()
    expect(mocks.reset).toHaveBeenCalledWith(
      'DXM-7K3M9Q2RW5T2',
      '23456789AB',
      'backup',
      'fictional-student-password',
    )
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument()
  })
  it('uses only the captured link proof and explains uncertain failure', async () => {
    mocks.proof = { memberId: 'DXM-7K3M9Q2RW5T2', token: 'a'.repeat(64) }
    mocks.reset.mockRejectedValue(new Error('Outcome uncertain; contact your administrator.'))
    const user = userEvent.setup()
    renderApp(<StudentPasswordRecoveryPage />)
    expect(screen.getByLabelText('Dexam Member ID')).toBeDisabled()
    expect(screen.queryByLabelText('Recovery backup code')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('New password'), 'fictional-student-password')
    await user.type(screen.getByLabelText('Confirm password'), 'fictional-student-password')
    await user.click(screen.getByRole('button', { name: 'Update password and block old sessions' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Outcome uncertain')
    expect(mocks.reset).toHaveBeenCalledWith(
      'DXM-7K3M9Q2RW5T2',
      'a'.repeat(64),
      'link',
      'fictional-student-password',
    )
  })
})
