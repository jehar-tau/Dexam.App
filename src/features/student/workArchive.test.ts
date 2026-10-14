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
  it('rejects external download destinations and does not expose provider errors', async () => {
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
