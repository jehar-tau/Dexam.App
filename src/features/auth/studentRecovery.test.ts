import {
  decideStudentRecovery,
  issueStudentRecoveryPack,
  parseStudentRecoveryFragment,
  proposeStudentRecovery,
  resetStudentPassword,
} from './studentRecovery'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), signOut: vi.fn() }))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
    auth: { signOut: mocks.signOut },
    functions: { invoke: mocks.invoke },
  }),
  createEmployeeActivationClient: () => ({ functions: { invoke: mocks.invoke } }),
}))
describe('student recovery service', () => {
  beforeEach(() => vi.resetAllMocks())
  it('never echoes malformed credential-bearing pack responses', async () => {
    mocks.invoke.mockResolvedValue({
      error: null,
      data: {
        recoveryURL: 'PRIVATE-PROOF-MUST-NOT-ECHO',
        backupCode: 'PRIVATE-CODE-MUST-NOT-ECHO',
      },
    })
    await expect(issueStudentRecoveryPack('request')).rejects.toThrow(
      'Recovery pack response could not be verified.',
    )
    try {
      await issueStudentRecoveryPack('request')
    } catch (failure) {
      expect(String(failure)).not.toContain('PRIVATE-PROOF')
      expect(String(failure)).not.toContain('PRIVATE-CODE')
    }
  })
  it('accepts exact fragment credentials only', () => {
    expect(
      parseStudentRecoveryFragment(`#memberId=DXM-7K3M9Q2RW5T2&token=${'a'.repeat(64)}`),
    ).toEqual({ memberId: 'DXM-7K3M9Q2RW5T2', token: 'a'.repeat(64) })
    expect(parseStudentRecoveryFragment('#memberId=DXM-7K3M9Q2RW5T2&token=short')).toBeNull()
    expect(
      parseStudentRecoveryFragment(
        `#memberId=DXM-7K3M9Q2RW5T2&token=${'a'.repeat(64)}&token=${'b'.repeat(64)}`,
      ),
    ).toBeNull()
    expect(
      parseStudentRecoveryFragment(
        `#memberId=DXM-7K3M9Q2RW5T2&token=${'a'.repeat(64)}&next=https://evil.invalid`,
      ),
    ).toBeNull()
  })
  it('uses exact approved RPC parameters for evidence', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    await proposeStudentRecovery('target', true, true)
    expect(mocks.rpc).toHaveBeenCalledWith('propose_student_recovery', {
      p_person_id: 'target',
      p_reason_code: 'forgotten_password',
      p_identity_verified: true,
      p_enrollment_reviewed: true,
    })
    await decideStudentRecovery('request', true, true, true)
    expect(mocks.rpc).toHaveBeenCalledWith('decide_student_recovery', {
      p_request_id: 'request',
      p_approve: true,
      p_identity_rechecked: true,
      p_enrollment_rechecked: true,
    })
  })
  it('uses the isolated client without mutating the shared Auth session password', async () => {
    mocks.invoke.mockResolvedValue({ error: null })
    await resetStudentPassword(
      ' dxm-7k3m9q2rw5t2 ',
      '23456789AB',
      'backup',
      'fictional-student-password',
    )
    expect(mocks.invoke).toHaveBeenCalledWith('student-reset-password', {
      body: {
        memberId: 'DXM-7K3M9Q2RW5T2',
        proof: '23456789AB',
        credentialType: 'backup',
        password: 'fictional-student-password',
      },
    })
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
