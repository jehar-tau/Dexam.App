import { getStudentAgenda, getSchedulingContext, saveClass } from './classSchedule'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
describe('class scheduling service', () => {
  beforeEach(() => vi.resetAllMocks())
  it('validates agenda and scope responses', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await getStudentAgenda()).toEqual([])
    expect(await getSchedulingContext()).toEqual([])
    mocks.rpc.mockResolvedValue({ data: [{ private: 'payload' }], error: null })
    await expect(getStudentAgenda()).rejects.toThrow('Your class schedule could not be loaded.')
  })
  it('does not expose database permission or private error details', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'private provider data' } })
    await expect(saveClass({ p_cancel: true })).rejects.toThrow(
      'The class change could not be saved.',
    )
  })
})
