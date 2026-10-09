import { issueActivationPack } from './issueActivationPack'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { getSession: mocks.getSession } }),
}))

describe('issueActivationPack', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-public-anon-key')
    mocks.getSession.mockReset().mockResolvedValue({
      data: { session: { access_token: 'fictional-employee-access-token' } },
      error: null,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('uses the current employee session for the trusted issuance function', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          memberId: 'DXM-2K3M9Q2RW5TY',
          activationUrl: 'http://127.0.0.1:5173/activate?token=fictional',
          backupCode: '7K3M9Q2RW5',
          expiresAt: '2026-10-09T10:00:00.000Z',
          reissued: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )

    await expect(issueActivationPack('94000000-0000-4000-8000-000000000001')).resolves.toEqual(
      expect.objectContaining({ memberId: 'DXM-2K3M9Q2RW5TY' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/functions/v1/staff-issue-activation',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer fictional-employee-access-token',
        }),
      }),
    )
  })

  it('does not call the function without a current employee session', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })

    await expect(issueActivationPack('94000000-0000-4000-8000-000000000001')).rejects.toThrow(
      'The activation pack could not be issued. Check access and try again.',
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
