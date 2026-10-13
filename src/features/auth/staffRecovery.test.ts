import {
  cancelStaffRecovery,
  decideStaffRecovery,
  executeStaffRecovery,
  getStaffRecoveryWorkspace,
  proposeStaffRecovery,
} from './staffRecovery'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc, functions: { invoke: mocks.invoke } }),
}))
describe('staff recovery service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  it('does not request private queue data without recent authority', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    expect(await getStaffRecoveryWorkspace()).toMatchObject({
      authorized: false,
      targets: [],
      requests: [],
    })
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })
  it('fails safely when the authority check fails', async () => {
    mocks.rpc.mockResolvedValue({ error: new Error('private provider detail') })
    await expect(getStaffRecoveryWorkspace()).rejects.toThrow(
      'We could not check staff recovery access.',
    )
  })
  it('does not accept malformed privileged queue responses', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: 'fc000000-0000-4000-8000-000000000001', error: null })
      .mockResolvedValueOnce({ data: [{ unexpected: 'private provider detail' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
    await expect(getStaffRecoveryWorkspace()).rejects.toThrow('We could not load staff recovery.')
  })
  it('sends only the approved target identifiers and non-content reason', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    await proposeStaffRecovery('person', 'factor', 'lost_authenticator')
    expect(mocks.rpc).toHaveBeenCalledWith('propose_staff_mfa_reset', {
      p_person_id: 'person',
      p_factor_id: 'factor',
      p_reason_code: 'lost_authenticator',
    })
    await decideStaffRecovery('request', false)
    expect(mocks.rpc).toHaveBeenCalledWith('decide_staff_mfa_reset', {
      p_request_id: 'request',
      p_approve: false,
    })
    await cancelStaffRecovery('request')
    expect(mocks.rpc).toHaveBeenCalledWith('cancel_staff_mfa_reset', { p_request_id: 'request' })
  })
  it('sends no target user, factor, secret, or approval override to the execution worker', async () => {
    mocks.invoke.mockResolvedValue({ error: null })
    await executeStaffRecovery('request')
    expect(mocks.invoke).toHaveBeenCalledWith('staff-reset-mfa', { body: { requestId: 'request' } })
  })
  it('does not claim success after an ambiguous worker failure', async () => {
    mocks.invoke.mockResolvedValue({ error: new Error('private provider detail') })
    await expect(executeStaffRecovery('request')).rejects.toThrow(
      'Check the request state before retrying',
    )
  })
})
