import { getArchiveDownload, getWorkArchive } from './workArchive'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc, functions: { invoke: mocks.invoke } }),
}))
describe('private work archive service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
  })
  afterEach(() => vi.unstubAllEnvs())
  it('returns only a validated archive and sanitizes malformed data', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: [] })
    expect(await getWorkArchive()).toEqual([])
    mocks.rpc.mockResolvedValue({ error: null, data: [{ secret: 'do-not-echo' }] })
    await expect(getWorkArchive()).rejects.toThrow('Your work archive could not be loaded.')
  })
  it('returns the retained bytes typed from the checked header, never a link', async () => {
    mocks.invoke.mockResolvedValue({
      error: null,
      data: new Blob(['voice']),
      response: new Response(null, { headers: { 'X-Dexam-File-Type': 'audio/webm' } }),
    })
    const file = await getArchiveDownload('file', 'voice')
    expect(file.type).toBe('audio/webm')
    expect(mocks.invoke).toHaveBeenCalledWith('student-work-archive-file', {
      body: { fileId: 'file', kind: 'voice' },
    })
  })
  it('rejects old link responses and does not expose provider errors', async () => {
    mocks.invoke.mockResolvedValue({
      error: null,
      data: { path: 'https://evil.invalid/private', expiresAt: '2026-10-14T10:00:00Z' },
    })
    await expect(getArchiveDownload('file', 'submission')).rejects.toThrow(
      'retained file could not be downloaded',
    )
    mocks.invoke.mockResolvedValue({ error: { message: 'private-provider-payload' } })
    await expect(getArchiveDownload('file', 'submission')).rejects.toThrow(
      'retained file could not be downloaded',
    )
  })
})
