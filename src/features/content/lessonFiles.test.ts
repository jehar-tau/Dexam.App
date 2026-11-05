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
  it('accepts only the bytes themselves, typed from the checked stored-type header', async () => {
    const response = (type: string) =>
      new Response(null, { headers: { 'X-Dexam-File-Type': type } })
    mocks.invoke.mockResolvedValue({
      data: new Blob(['fictional']),
      error: null,
      response: response('application/pdf'),
    })
    const file = await getLessonDownload('lesson', 'file')
    expect(file).toBeInstanceOf(Blob)
    expect(file.type).toBe('application/pdf')
    mocks.invoke.mockResolvedValue({
      data: new Blob(['<script>']),
      error: null,
      response: response('text/html'),
    })
    expect((await getLessonDownload('lesson', 'file')).type).toBe('application/octet-stream')
    for (const unsafe of [
      { data: { path: '/storage/v1/object/sign/lesson-materials/id?token=old' }, error: null },
      { data: 'text body', error: null },
      { data: null, error: { message: 'private provider details' } },
    ]) {
      mocks.invoke.mockResolvedValue(unsafe)
      await expect(getLessonDownload('lesson', 'file')).rejects.toThrow('could not be verified')
    }
  })
})
