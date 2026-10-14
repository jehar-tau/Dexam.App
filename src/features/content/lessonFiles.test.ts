import { getLessonDownload, listLessonFiles, removeLessonFile } from './lessonFiles'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc, functions: { invoke: mocks.invoke } }),
}))
describe('lesson file client', () => {
  beforeEach(() => vi.resetAllMocks())
  afterEach(() => vi.unstubAllEnvs())
  it('validates safe metadata and hides provider errors', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    expect(await listLessonFiles('fictional')).toEqual([])
    mocks.rpc.mockResolvedValue({ data: [{ id: 'wrong', file_name: 'file' }], error: null })
    await expect(listLessonFiles('fictional')).rejects.toThrow('could not be verified')
    mocks.rpc.mockResolvedValue({ error: { message: 'private provider details' } })
    await expect(removeLessonFile('fictional', 'file')).rejects.toThrow('could not be removed')
  })
  it('accepts only signed lesson bucket paths on configured origin', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://fictional.test')
    const path =
      '/storage/v1/object/sign/lesson-materials/10000000-0000-4000-8000-000000000001?token=fictional'
    mocks.invoke.mockResolvedValue({ data: { path }, error: null })
    expect(await getLessonDownload('lesson', 'file')).toBe('https://fictional.test' + path)
    for (const unsafe of [
      'https://other.test' + path,
      '//other.test' + path,
      path + '#fragment',
      '/storage/v1/object/sign/student-submissions/id?token=fake',
      path.replace('?token=fictional', '?other=1'),
    ]) {
      mocks.invoke.mockResolvedValue({ data: { path: unsafe }, error: null })
      await expect(getLessonDownload('lesson', 'file')).rejects.toThrow('could not be verified')
    }
  })
})
