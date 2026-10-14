import { getCurriculumImpact, getCurriculumPreviewContext } from './curriculumPreview'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
describe('curriculum impact client', () => {
  beforeEach(() => vi.resetAllMocks())
  it('requires valid minimal scope metadata', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await getCurriculumPreviewContext()).toEqual([])
    mocks.rpc.mockResolvedValue({
      data: [{ id: 'wrong', title: 'offering', versions: [] }],
      error: null,
    })
    await expect(getCurriculumPreviewContext()).rejects.toThrow('could not be verified')
  })
  it('returns generic failures without provider payloads', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'private provider payload' } })
    await expect(getCurriculumImpact('o', 's', 't')).rejects.toThrow(
      'Check your current access and versions',
    )
    expect(mocks.rpc).toHaveBeenCalledWith('preview_curriculum_upgrade', {
      p_offering_id: 'o',
      p_source_id: 's',
      p_target_id: 't',
    })
  })
})
