import { getEmployeeAccess, signInEmployee } from './employeeAuth'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
    rpc: mocks.rpc,
  }),
}))

describe('employeeAuth', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
    mocks.signInWithPassword.mockReset()
    mocks.signOut.mockReset().mockResolvedValue({ error: null })
  })

  it('uses the same safe error for invalid employee credentials', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new Error('Invalid login credentials'),
    })

    await expect(signInEmployee('unknown@dexam.test', 'wrong password')).rejects.toThrow(
      'We could not sign you in. Check your details and try again.',
    )
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('ends a newly created session when current employee membership is inactive', async () => {
    const session = { access_token: 'not-a-real-token' }
    const user = { email_confirmed_at: '2026-10-07T00:00:00.000Z' }
    mocks.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null })
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null })

    await expect(signInEmployee('former@dexam.test', 'password phrase')).rejects.toThrow(
      'We could not sign you in. Check your details and try again.',
    )
    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('ends a session when the employee email is not verified', async () => {
    const session = { access_token: 'not-a-real-token' }
    mocks.signInWithPassword.mockResolvedValue({
      data: { session, user: { email_confirmed_at: undefined } },
      error: null,
    })

    await expect(signInEmployee('pending@dexam.test', 'password phrase')).rejects.toThrow(
      'We could not sign you in. Check your details and try again.',
    )
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('checks the current capability after confirming active employment', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null })

    await expect(getEmployeeAccess('enrollment.operate')).resolves.toEqual({
      activeEmployee: true,
      hasCapability: false,
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'current_person_has_active_employee_membership')
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'current_person_has_capability', {
      p_capability_key: 'enrollment.operate',
    })
  })
})
