import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { StaffRecoveryPage } from './StaffRecoveryPage'
const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  propose: vi.fn(),
  decide: vi.fn(),
  execute: vi.fn(),
  cancel: vi.fn(),
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fixture-auth' } } }),
}))
vi.mock('../features/auth/staffRecovery', () => ({
  getStaffRecoveryWorkspace: mocks.workspace,
  proposeStaffRecovery: mocks.propose,
  decideStaffRecovery: mocks.decide,
  executeStaffRecovery: mocks.execute,
  cancelStaffRecovery: mocks.cancel,
}))
const person = 'fc100000-0000-4000-8000-000000000001'
const target = 'fc100000-0000-4000-8000-000000000002'
const factor = 'fc200000-0000-4000-8000-000000000002'
const request = {
  id: 'fc300000-0000-4000-8000-000000000002',
  target_person_id: target,
  target_name: 'Fictional employee',
  factor_id: factor,
  proposer_person_id: person,
  reason_code: 'lost_authenticator',
  status: 'pending',
  expires_at: '2099-01-01T00:00:00Z',
}
describe('staff recovery screen', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.propose.mockResolvedValue(undefined)
    mocks.decide.mockResolvedValue(undefined)
    mocks.execute.mockResolvedValue(undefined)
    mocks.cancel.mockResolvedValue(undefined)
    mocks.workspace.mockResolvedValue({
      authorized: true,
      personId: person,
      targets: [
        {
          person_id: target,
          display_name: 'Fictional employee',
          factor_id: factor,
          factor_name: 'Lost device',
        },
      ],
      requests: [request],
    })
  })
  it('guides stale assurance back to explicit verification without revealing the queue', async () => {
    mocks.workspace.mockResolvedValue({
      authorized: false,
      personId: null,
      targets: [],
      requests: [],
    })
    renderApp(<StaffRecoveryPage />)
    expect(await screen.findByText(/Recent Elevated Admin verification is required/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Propose recovery' })).not.toBeInTheDocument()
  })
  it('does not offer self approval but permits cancellation by the proposer', async () => {
    renderApp(<StaffRecoveryPage />)
    expect(
      await screen.findByText('A different administrator must decide this request.'),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Approve reset' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeVisible()
  })
  it('proposes a selected canonical employee factor with a safe reason code', async () => {
    const user = userEvent.setup()
    renderApp(<StaffRecoveryPage />)
    await user.selectOptions(
      await screen.findByLabelText('Employee authenticator'),
      `${target}:${factor}`,
    )
    await user.click(screen.getByRole('button', { name: 'Propose recovery' }))
    expect(mocks.propose).toHaveBeenCalledWith(target, factor, 'lost_authenticator')
    expect(await screen.findByText('Recovery proposed for independent review.')).toBeVisible()
  })
  it('lets a different administrator approve and then execute the reviewed request', async () => {
    const user = userEvent.setup()
    mocks.workspace.mockResolvedValue({
      authorized: true,
      personId: 'fc100000-0000-4000-8000-000000000003',
      targets: [],
      requests: [request],
    })
    renderApp(<StaffRecoveryPage />)
    const approvalButton = await screen.findByRole('button', { name: 'Approve reset' })
    mocks.workspace.mockResolvedValue({
      authorized: true,
      personId: 'fc100000-0000-4000-8000-000000000003',
      targets: [],
      requests: [{ ...request, status: 'approved' }],
    })
    await user.click(approvalButton)
    expect(mocks.decide).toHaveBeenCalledWith(request.id, true)
    await user.click(await screen.findByRole('button', { name: 'Execute approved reset' }))
    expect(mocks.execute).toHaveBeenCalledWith(request.id)
  })
  it('never offers execution for an expired approval', async () => {
    mocks.workspace.mockResolvedValue({
      authorized: true,
      personId: person,
      targets: [],
      requests: [{ ...request, status: 'approved', expires_at: '2000-01-01T00:00:00Z' }],
    })
    renderApp(<StaffRecoveryPage />)
    expect(await screen.findByText(/lost authenticator · expired/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Execute approved reset' })).not.toBeInTheDocument()
  })
})
