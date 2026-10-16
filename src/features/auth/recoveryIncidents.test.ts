import {
  getRecoveryIncidents,
  openRecoveryIncident,
  reviewRecoveryIncident,
} from './recoveryIncidents'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), assertCurrent: vi.fn(), dispose: vi.fn() }))
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({}) }))
vi.mock('./accountOperation', () => ({
  captureAccountOperation: () =>
    Promise.resolve({
      client: { rpc: mocks.rpc },
      assertCurrent: mocks.assertCurrent,
      dispose: mocks.dispose,
    }),
}))
describe('recovery incident service boundary', () => {
  beforeEach(() => vi.resetAllMocks())
  it('requires current verified authority before loading data', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: false })
    await expect(getRecoveryIncidents()).rejects.toThrow('Recent Elevated Admin')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('rejects malformed data without exposing provider content', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ error: null, data: true })
      .mockResolvedValue({ error: null, data: 'PRIVATE-PAYLOAD' })
    await expect(getRecoveryIncidents()).rejects.toThrow('Incident queue could not be verified')
  })
  it('never accepts execution credentials from a caller', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: null })
    await openRecoveryIncident('student', 'request', true)
    await reviewRecoveryIncident('incident', true)
    expect(mocks.rpc).toHaveBeenCalledWith('open_recovery_incident', {
      p_kind: 'student',
      p_request_id: 'request',
      p_reason_code: 'uncertain_password_update',
      p_fence_acknowledged: true,
    })
    expect(mocks.rpc).toHaveBeenCalledWith('review_recovery_incident', {
      p_incident_id: 'incident',
      p_fence_acknowledged: true,
    })
  })
  it('discards results if the account changes during the action', async () => {
    mocks.rpc.mockImplementation(() => {
      mocks.assertCurrent.mockImplementation(() => {
        throw new Error('Session changed')
      })
      return Promise.resolve({ error: null })
    })
    await expect(openRecoveryIncident('employee', 'request', true)).rejects.toThrow(
      'Session changed',
    )
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
})
