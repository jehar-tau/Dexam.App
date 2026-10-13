import {
  signOutAllStaffSessions,
  removeStaffTotpFactor,
  cancelStaffTotpEnrollment,
  enrollStaffTotp,
  getStaffMfaState,
  verifyStaffTotp,
} from './staffMfa'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  assurance: vi.fn(),
  factors: vi.fn(),
  enroll: vi.fn(),
  verify: vi.fn(),
  unenroll: vi.fn(),
  rpc: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./employeeAuth', () => ({ getEmployeeAccess: mocks.access }))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
    auth: {
      signOut: mocks.signOut,
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.assurance,
        listFactors: mocks.factors,
        enroll: mocks.enroll,
        challengeAndVerify: mocks.verify,
        unenroll: mocks.unenroll,
      },
    },
  }),
}))

describe('staff MFA', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.access.mockResolvedValue({ activeEmployee: true })
    mocks.assurance.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null })
    mocks.factors.mockResolvedValue({ data: { totp: [], all: [] }, error: null })
    mocks.verify.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    mocks.signOut.mockResolvedValue({ error: null })
  })

  it('denies inactive employees before touching MFA APIs', async () => {
    mocks.access.mockResolvedValue({ activeEmployee: false })
    await expect(enrollStaffTotp('Primary')).rejects.toThrow('verify staff security')
    expect(mocks.enroll).not.toHaveBeenCalled()
  })

  it('does not expose provider errors or enrolment secrets on failure', async () => {
    mocks.enroll.mockResolvedValue({ data: null, error: new Error('secret=fixture-secret') })
    await expect(enrollStaffTotp('Primary')).rejects.toThrow(
      'We could not start authenticator setup. Please try again.',
    )
  })

  it('rejects malformed codes before sending a challenge', async () => {
    await expect(verifyStaffTotp('factor-id', '12345')).rejects.toThrow('six-digit')
    expect(mocks.verify).not.toHaveBeenCalled()
  })

  it('requires confirmed aal2 after a successful challenge', async () => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
    await expect(verifyStaffTotp('factor-id', '123456')).rejects.toThrow('verify staff security')
  })

  it('fails closed when assurance cannot be checked', async () => {
    mocks.assurance.mockResolvedValue({ data: null, error: new Error('provider detail') })
    await expect(getStaffMfaState()).rejects.toThrow('verify staff security')
  })

  it('downgrades stale token assurance when the database reports no live MFA', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    await expect(getStaffMfaState()).resolves.toMatchObject({ currentLevel: 'aal1' })
    expect(mocks.rpc).toHaveBeenCalledWith('current_session_has_live_mfa')
    await expect(verifyStaffTotp('factor-id', '123456')).rejects.toThrow('verify staff security')
  })

  it('fails closed when live session validation is unavailable', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('provider detail') })
    await expect(getStaffMfaState()).rejects.toThrow('verify staff security')
  })

  it('invalidates application sessions before global provider sign-out', async () => {
    await signOutAllStaffSessions()
    expect(mocks.rpc).toHaveBeenCalledWith('invalidate_my_staff_sessions')
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'global' })
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0]!,
    )
  })

  it('does not report global sign-out when the durable barrier fails', async () => {
    mocks.rpc.mockResolvedValue({ error: new Error('provider detail') })
    await expect(signOutAllStaffSessions()).rejects.toThrow('could not block')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('attempts local cleanup when global provider cleanup fails', async () => {
    mocks.signOut
      .mockResolvedValueOnce({ error: new Error('provider detail') })
      .mockResolvedValueOnce({ error: null })
    await expect(signOutAllStaffSessions()).rejects.toThrow('previous sessions are blocked')
    expect(mocks.signOut).toHaveBeenNthCalledWith(1, { scope: 'global' })
    expect(mocks.signOut).toHaveBeenNthCalledWith(2, { scope: 'local' })
  })

  it('guards the final verified factor for staff with sensitive authority', async () => {
    mocks.factors.mockResolvedValue({
      data: { totp: [{ id: 'fixture-factor', status: 'verified' }], all: [] },
      error: null,
    })
    await expect(removeStaffTotpFactor('fixture-factor')).rejects.toThrow('backup authenticator')
    expect(mocks.unenroll).not.toHaveBeenCalled()
  })

  it('allows verified backup-preserving removal', async () => {
    mocks.factors.mockResolvedValue({
      data: {
        totp: [
          { id: 'fixture-factor', status: 'verified' },
          { id: 'backup-factor', status: 'verified' },
        ],
        all: [],
      },
      error: null,
    })
    mocks.unenroll.mockResolvedValue({ error: null })
    await removeStaffTotpFactor('fixture-factor')
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: 'fixture-factor' })
  })

  it('denies factor removal to password-only sessions', async () => {
    mocks.assurance.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null })
    await expect(removeStaffTotpFactor('fixture-factor')).rejects.toThrow(
      'Verify your authenticator',
    )
    expect(mocks.unenroll).not.toHaveBeenCalled()
  })

  it('never removes a verified factor through enrolment cancellation', async () => {
    mocks.factors.mockResolvedValue({
      data: { all: [{ id: 'factor-id', factor_type: 'totp', status: 'verified' }], totp: [] },
      error: null,
    })
    await expect(cancelStaffTotpEnrollment('factor-id')).rejects.toThrow('Only unfinished')
    expect(mocks.unenroll).not.toHaveBeenCalled()
  })

  it('cancels only the selected unfinished TOTP enrolment', async () => {
    mocks.factors.mockResolvedValue({
      data: { all: [{ id: 'factor-id', factor_type: 'totp', status: 'unverified' }], totp: [] },
      error: null,
    })
    mocks.unenroll.mockResolvedValue({ error: null })
    await cancelStaffTotpEnrollment('factor-id')
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: 'factor-id' })
  })
})
