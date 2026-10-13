import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { StudentRecoveryAdminPage } from './StudentRecoveryAdminPage'
const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  find: vi.fn(),
  propose: vi.fn(),
  decide: vi.fn(),
  cancel: vi.fn(),
  issue: vi.fn(),
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'admin' } } }),
}))
vi.mock('../features/auth/studentRecovery', () => ({
  getStudentRecoveryWorkspace: mocks.workspace,
  findStudentRecoveryTarget: mocks.find,
  proposeStudentRecovery: mocks.propose,
  decideStudentRecovery: mocks.decide,
  cancelStudentRecovery: mocks.cancel,
  issueStudentRecoveryPack: mocks.issue,
}))
const request = {
  id: 'request',
  target_person_id: 'student',
  proposer_person_id: 'proposer',
  member_id: 'DXM-7K3M9Q2RW5T2',
  display_name: 'Fictional student',
  status: 'pending',
  expires_at: new Date(Date.now() + 600000).toISOString(),
  pack_expires_at: null,
}
describe('student assisted recovery administration', () => {
  beforeEach(() => vi.resetAllMocks())
  it('never offers self-approval to the proposer', async () => {
    mocks.workspace.mockResolvedValue({ actorPersonId: 'proposer', requests: [request] })
    renderApp(<StudentRecoveryAdminPage />)
    expect(await screen.findByText(/You cannot approve your own proposal/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Independently review evidence' }),
    ).not.toBeInTheDocument()
  })
  it('requires both independent evidence acknowledgments before approval', async () => {
    mocks.workspace.mockResolvedValue({ actorPersonId: 'different-admin', requests: [request] })
    mocks.decide.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderApp(<StudentRecoveryAdminPage />)
    await user.click(await screen.findByRole('button', { name: 'Independently review evidence' }))
    const approve = screen.getByRole('button', { name: 'Approve this recovery' })
    expect(approve).toBeDisabled()
    await user.click(screen.getByLabelText('I independently rechecked established identity.'))
    expect(approve).toBeDisabled()
    await user.click(
      screen.getByLabelText('I independently rechecked admitted enrolment evidence.'),
    )
    await user.click(approve)
    expect(mocks.decide).toHaveBeenCalledWith('request', true, true, true)
  })
  it('hides a transient pack explicitly after private handover', async () => {
    mocks.workspace.mockResolvedValue({
      actorPersonId: 'different-admin',
      requests: [{ ...request, status: 'approved' }],
    })
    mocks.issue.mockResolvedValue({
      memberId: request.member_id,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      recoveryURL: 'http://127.0.0.1:5173/student/recover#fictional',
      backupCode: '23456789AB',
    })
    const user = userEvent.setup()
    renderApp(<StudentRecoveryAdminPage />)
    await user.click(await screen.findByRole('button', { name: 'Issue one-time recovery pack' }))
    expect(await screen.findByLabelText('Backup code')).toHaveValue('23456789AB')
    await user.click(screen.getByRole('button', { name: 'Handover complete — hide credentials' }))
    expect(screen.queryByLabelText('Backup code')).not.toBeInTheDocument()
  })
})
