import { finishPortalGoogleLogin, safeGoogleReturnTo, startPortalGoogleLogin } from './googleLogin'
const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  rpc: vi.fn(),
  assertCurrent: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { signInWithOAuth: mocks.oauth } }),
}))
vi.mock('./accountOperation', () => ({
  captureAccountOperation: () =>
    Promise.resolve({
      client: { rpc: mocks.rpc },
      assertCurrent: mocks.assertCurrent,
      dispose: mocks.dispose,
    }),
}))
describe('portal Google login', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('VITE_ENABLE_SHARED_GOOGLE_LOGIN', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())
  it.each([
    'https://evil.invalid',
    '//evil.invalid',
    '/\\evil.invalid',
    '/student/../../outside',
    '/student#access_token=bad',
    '/student\n/anything',
    '/sign-in',
    '/administer',
    'javascript:alert(1)',
  ])('refuses unsafe return %s', (value) => {
    expect(safeGoogleReturnTo(value)).toBe('/student')
  })
  it.each([
    '/student',
    '/student/assignments?topic=perspective',
    '/teacher/reviews',
    '/staff/crm',
    '/admin/admissions',
    '/tests/mock-test',
  ])('keeps internal portal return %s without granting it', (value) => {
    expect(safeGoogleReturnTo(value)).toBe(value)
  })
  it('uses the current origin callback and only identity scopes', async () => {
    mocks.oauth.mockResolvedValue({ error: null })
    await startPortalGoogleLogin('/teacher/reviews')
    expect(mocks.oauth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        scopes: 'openid email profile',
        redirectTo: `${window.location.origin}/auth/google?returnTo=%2Fteacher%2Freviews`,
      },
    })
  })
  it('is off unless explicitly enabled', async () => {
    vi.stubEnv('VITE_ENABLE_SHARED_GOOGLE_LOGIN', '')
    await expect(startPortalGoogleLogin('/student')).rejects.toThrow('not enabled')
    expect(mocks.oauth).not.toHaveBeenCalled()
  })
  it('calls the approved-claim-before-candidate server operation', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { created: false } })
    await finishPortalGoogleLogin()
    expect(mocks.rpc).toHaveBeenCalledWith('provision_google_candidate')
    expect(mocks.assertCurrent).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('does not navigate through a canonical identity conflict', async () => {
    mocks.rpc.mockResolvedValue({ error: { code: '40001', message: 'private' } })
    await expect(finishPortalGoogleLogin()).rejects.toThrow('No accounts were merged')
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
})
