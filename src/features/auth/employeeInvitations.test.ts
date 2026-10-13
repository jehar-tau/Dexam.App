import {
  deliverEmployeeInvitation,
  getEmployeeInvitationWorkspace,
  prepareEmployeeInvitation,
  searchInvitationPeople,
} from './employeeInvitations'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc, functions: { invoke: mocks.invoke } }),
}))
describe('employee invitation service', () => {
  beforeEach(() => vi.resetAllMocks())
  it('does not load the private queue without current authority', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect(await getEmployeeInvitationWorkspace()).toEqual({ authorized: false, invitations: [] })
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it('rejects malformed queue data', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: [{ private: 'detail' }], error: null })
    await expect(getEmployeeInvitationWorkspace()).rejects.toThrow('could not be loaded')
  })
  it('rejects malformed duplicate review data', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ unexpected: true }], error: null })
    await expect(searchInvitationPeople('Person')).rejects.toThrow('could not be loaded')
  })
  it('requires explicit canonical disposition and duplicate review', async () => {
    mocks.rpc.mockResolvedValue({ data: 'fd500000-0000-4000-8000-000000000001', error: null })
    await prepareEmployeeInvitation(
      'fd100000-0000-4000-8000-000000000002',
      'ignored',
      ' Employee@Delivery.invalid ',
      true,
    )
    expect(mocks.rpc).toHaveBeenCalledWith('prepare_employee_invitation', {
      p_person_id: 'fd100000-0000-4000-8000-000000000002',
      p_display_name: null,
      p_email: 'employee@delivery.invalid',
      p_duplicates_reviewed: true,
    })
  })
  it('does not send an email, role, password, or Auth override to delivery', async () => {
    mocks.invoke.mockResolvedValue({ error: null })
    await deliverEmployeeInvitation('request')
    expect(mocks.invoke).toHaveBeenCalledWith('staff-employee-invite', {
      body: { requestId: 'request' },
    })
  })
  it('shows an uncertain outcome instead of inventing delivery success', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('private detail') })
    await expect(deliverEmployeeInvitation('request')).rejects.toThrow('Refresh the queue')
  })
})
