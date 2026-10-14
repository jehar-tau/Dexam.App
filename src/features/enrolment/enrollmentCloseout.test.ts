import { closeEnrollment, listEnrollmentCloseouts } from './enrollmentCloseout'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
describe('enrolment closeout service', () => {
  beforeEach(() => vi.resetAllMocks())
  it('binds deliberate outcome and stable retry key without supplying an end date', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: '2026-10-14T10:00:00Z' })
    await closeEnrollment('course', 'withdrawn', true, 'request')
    expect(mocks.rpc).toHaveBeenCalledWith('close_enrollment', {
      p_enrollment_id: 'course',
      p_outcome: 'withdrawn',
      p_reason_code: 'student_withdrew',
      p_confirmed: true,
      p_request_key: 'request',
    })
  })
  it('sanitizes malformed private queue responses', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: [{ private: 'do-not-echo' }] })
    await expect(listEnrollmentCloseouts('name')).rejects.toThrow('Enrolments could not be loaded.')
  })
})
