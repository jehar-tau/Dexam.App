import { getStudyChecklist, setTopicStudied } from './studyChecklist'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
describe('private study checklist', () => {
  beforeEach(() => vi.resetAllMocks())
  it('validates curated records and hides malformed/provider payloads', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await getStudyChecklist()).toEqual([])
    mocks.rpc.mockResolvedValue({ data: [{ secret: 'private payload' }], error: null })
    await expect(getStudyChecklist()).rejects.toThrow(
      'Your private study checklist could not be loaded.',
    )
  })
  it('sends explicit desired state against the exact enrolment and topic', async () => {
    mocks.rpc.mockResolvedValue({ error: null })
    await setTopicStudied('course', 'topic', false)
    expect(mocks.rpc).toHaveBeenCalledWith('set_student_topic_mark', {
      p_enrollment_id: 'course',
      p_topic_id: 'topic',
      p_studied: false,
    })
  })
  it('does not expose private rejection details', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'private session/person data' } })
    await expect(setTopicStudied('course', 'topic', true)).rejects.toThrow(
      'Your study choice could not be saved.',
    )
  })
})
