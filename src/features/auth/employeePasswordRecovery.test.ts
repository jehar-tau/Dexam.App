import {
  clearEmployeeRecoveryProof,
  completeEmployeePasswordRecovery,
  requestEmployeePasswordRecovery,
  verifyEmployeeRecovery,
} from './employeePasswordRecovery'
const mocks = vi.hoisted(() => ({
  verifyOtp: vi.fn(),
  invoke: vi.fn(),
  sharedInvoke: vi.fn(),
  signOut: vi.fn(),
  sharedUpdate: vi.fn(),
}))
vi.mock('./supabaseClient', () => ({
  createEmployeeActivationClient: () => ({
    auth: { verifyOtp: mocks.verifyOtp, signOut: mocks.signOut },
    functions: { invoke: mocks.invoke },
  }),
  getSupabaseClient: () => ({
    auth: { signOut: mocks.signOut, updateUser: mocks.sharedUpdate },
    functions: { invoke: mocks.sharedInvoke },
  }),
}))
const proof = {
  requestId: 'fe500000-0000-4000-8000-000000000001',
  proof: 'a'.repeat(64),
  tokenHash: 'b'.repeat(64),
  type: 'recovery' as const,
}
describe('employee password recovery service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearEmployeeRecoveryProof()
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.signOut.mockResolvedValue({ error: null })
  })
  it('requests recovery without a user identity or password override', async () => {
    mocks.sharedInvoke.mockResolvedValue({ error: null })
    await requestEmployeePasswordRecovery(' Employee@Fixture.invalid ')
    expect(mocks.sharedInvoke).toHaveBeenCalledWith('employee-request-password-recovery', {
      body: { email: 'employee@fixture.invalid' },
    })
  })
  it('keeps delivery-unavailable failure generic', async () => {
    mocks.sharedInvoke.mockResolvedValue({ error: new Error('private detail') })
    await expect(requestEmployeePasswordRecovery('employee@fixture.invalid')).rejects.toThrow(
      'unavailable in this environment',
    )
  })
  it('does not accept an invitation token as password recovery', async () => {
    await expect(verifyEmployeeRecovery({ ...proof, type: 'invite' })).rejects.toThrow(
      'invalid or unavailable',
    )
    expect(mocks.verifyOtp).not.toHaveBeenCalled()
  })
  it('requires owned recovery verification before any password mutation', async () => {
    await expect(completeEmployeePasswordRecovery(proof, 'fictional-password')).rejects.toThrow(
      'Verify the recovery link first',
    )
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.sharedUpdate).not.toHaveBeenCalled()
  })
  it('sends exact proof to the trusted worker through only the isolated session', async () => {
    await verifyEmployeeRecovery(proof)
    mocks.invoke.mockResolvedValue({ error: null })
    await completeEmployeePasswordRecovery(proof, 'fictional-password')
    expect(mocks.invoke).toHaveBeenCalledWith('employee-reset-password', {
      body: { requestId: proof.requestId, proof: proof.proof, password: 'fictional-password' },
    })
    expect(mocks.sharedInvoke).not.toHaveBeenCalled()
    expect(mocks.sharedUpdate).not.toHaveBeenCalled()
    await expect(completeEmployeePasswordRecovery(proof, 'another-password')).rejects.toThrow(
      'Verify the recovery link first',
    )
  })
  it('does not claim success after an ambiguous mutation', async () => {
    await verifyEmployeeRecovery(proof)
    mocks.invoke.mockResolvedValue({ error: new Error('private detail') })
    await expect(completeEmployeePasswordRecovery(proof, 'fictional-password')).rejects.toThrow(
      'Previous sessions may already be blocked',
    )
  })
})
