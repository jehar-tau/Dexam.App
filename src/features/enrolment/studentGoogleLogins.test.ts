import {
  approveStudentGoogleLogin,
  getStudentGoogleLogins,
  revokeStudentGoogleLogin,
} from './studentGoogleLogins'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
const person = '00000000-0000-4000-8000-0000000000d1'
const key = '00000000-0000-4000-8000-0000000000e1'
describe('student Google sign-in list service', () => {
  beforeEach(() => mocks.rpc.mockReset())
  it('maps the list and fails closed on malformed rows', async () => {
    mocks.rpc.mockResolvedValue({
      error: null,
      data: [
        {
          person_id: person,
          member_id: 'DXM-2K3M9Q2RW5TY',
          display_name: 'Fictional Student',
          email: 'student@fixture.invalid',
          state: 'approved',
          linked: false,
          revision: 1,
          revoked_at: null,
        },
      ],
    })
    expect((await getStudentGoogleLogins('  fict ')).at(0)?.state).toBe('approved')
    expect(mocks.rpc).toHaveBeenCalledWith('list_student_google_logins', { p_search: 'fict' })
    mocks.rpc.mockResolvedValue({ error: null, data: [{ person_id: person, state: 'owner' }] })
    await expect(getStudentGoogleLogins('')).rejects.toThrow('could not be loaded')
  })
  it('adds an email with a reason and explains duplicates', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: 1 })
    await approveStudentGoogleLogin({
      requestKey: key,
      personId: person,
      email: 'student@fixture.invalid',
      reason: 'Paid full course',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('approve_student_google_login', {
      p_request_key: key,
      p_person_id: person,
      p_email: 'student@fixture.invalid',
      p_reason: 'Paid full course',
    })
    mocks.rpc.mockResolvedValue({ error: { code: '23505', message: 'private' }, data: null })
    await expect(
      approveStudentGoogleLogin({
        requestKey: key,
        personId: person,
        email: 'x@y.z',
        reason: 'abc',
      }),
    ).rejects.toThrow('already listed for another person')
  })
  it('revokes with the expected revision and explains denial', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: 2 })
    await revokeStudentGoogleLogin({
      requestKey: key,
      personId: person,
      expectedRevision: 1,
      reason: 'Fees refunded',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('revoke_student_google_login', {
      p_request_key: key,
      p_person_id: person,
      p_expected_revision: 1,
      p_reason: 'Fees refunded',
    })
    mocks.rpc.mockResolvedValue({ error: { code: '42501', message: 'private' }, data: null })
    await expect(
      revokeStudentGoogleLogin({
        requestKey: key,
        personId: person,
        expectedRevision: 1,
        reason: 'Fees refunded',
      }),
    ).rejects.toThrow('Only an admin')
  })
})
