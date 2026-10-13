import {
  completeEmployeeActivation,
  clearEmployeeActivationProof,
  parseEmployeeActivationProof,
  verifyEmployeeActivation,
} from './employeeActivation'
const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  rpc: vi.fn(),
  invoke: vi.fn(),
  sharedUpdateUser: vi.fn(),
}))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: { signOut: mocks.signOut, updateUser: mocks.sharedUpdateUser },
  }),
  createEmployeeActivationClient: () => ({
    auth: mocks,
    rpc: mocks.rpc,
    functions: { invoke: mocks.invoke },
  }),
}))
const proof = {
  requestId: 'fd500000-0000-4000-8000-000000000001',
  proof: 'a'.repeat(64),
  tokenHash: 'b'.repeat(64),
  type: 'invite' as const,
}
const fragment = `#request=${proof.requestId}&proof=${proof.proof}&token_hash=${proof.tokenHash}&type=invite`
describe('employee activation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    clearEmployeeActivationProof()
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({
      data: [{ status: 'delivered', expires_at: new Date(Date.now() + 60000).toISOString() }],
      error: null,
    })
  })
  it('accepts only a bounded exact invitation fragment', () => {
    expect(parseEmployeeActivationProof(fragment)).toEqual(proof)
    expect(parseEmployeeActivationProof(`${fragment}&type=invite`)).toBeNull()
    expect(parseEmployeeActivationProof(`${fragment}&returnTo=https://evil.invalid`)).toBeNull()
    expect(parseEmployeeActivationProof(fragment.replace(proof.proof, 'short'))).toBeNull()
    expect(parseEmployeeActivationProof(fragment.replace('type=invite', 'type=signup'))).toBeNull()
  })
  it('replaces any existing local session before provider verification', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({
      data: [{ status: 'delivered', expires_at: new Date(Date.now() + 60000).toISOString() }],
      error: null,
    })
    await verifyEmployeeActivation(proof)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: proof.tokenHash, type: 'invite' })
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.verifyOtp.mock.invocationCallOrder[0]!,
    )
  })
  it('cleans up a cancelled invitation session', async () => {
    mocks.verifyOtp.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({
      data: [{ status: 'cancelled', expires_at: new Date(Date.now() + 60000).toISOString() }],
      error: null,
    })
    await expect(verifyEmployeeActivation(proof)).rejects.toThrow('no longer available')
    expect(mocks.signOut).toHaveBeenCalledTimes(2)
  })
  it('keeps the password at the provider and sends only request proof to activation', async () => {
    mocks.updateUser.mockResolvedValue({ error: null })
    mocks.invoke.mockResolvedValue({ error: null })
    await verifyEmployeeActivation(proof)
    await completeEmployeeActivation(proof, 'fictional-password-only')
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'fictional-password-only' })
    expect(mocks.invoke).toHaveBeenCalledWith('employee-activate', {
      body: { requestId: proof.requestId, proof: proof.proof },
    })
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.sharedUpdateUser).not.toHaveBeenCalled()
  })
  it('never reports activation success after an ambiguous worker result', async () => {
    mocks.updateUser.mockResolvedValue({ error: null })
    mocks.invoke.mockResolvedValue({ error: new Error('private detail') })
    await verifyEmployeeActivation(proof)
    await expect(completeEmployeeActivation(proof, 'fictional-password-only')).rejects.toThrow(
      'could not be completed',
    )
  })
  it('never changes a shared account after another tab switches the persistent session', async () => {
    await verifyEmployeeActivation(proof)
    mocks.sharedUpdateUser.mockRejectedValue(new Error('unrelated account must never be touched'))
    mocks.updateUser.mockResolvedValue({ error: null })
    mocks.invoke.mockResolvedValue({ error: null })
    await completeEmployeeActivation(proof, 'fictional-password-only')
    expect(mocks.sharedUpdateUser).not.toHaveBeenCalled()
    expect(mocks.updateUser).toHaveBeenCalledOnce()
  })
  it('refuses password mutation before invitation verification', async () => {
    await expect(completeEmployeeActivation(proof, 'fictional-password-only')).rejects.toThrow(
      'Verify this invitation',
    )
    expect(mocks.updateUser).not.toHaveBeenCalled()
    expect(mocks.sharedUpdateUser).not.toHaveBeenCalled()
  })
})
