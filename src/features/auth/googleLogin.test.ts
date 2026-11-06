import {
  finishPortalGoogleLogin,
  passwordSignInEnabled,
  safeGoogleReturnTo,
  startPortalGoogleLogin,
} from './googleLogin'
const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
  assertCurrent: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({ auth: { signInWithOAuth: mocks.oauth, signOut: mocks.signOut } }),
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
  it('lets a listed student in through the App-only claim', async () => {
    mocks.rpc.mockResolvedValue({ error: null, data: { allowed: true, audience: 'student' } })
    await finishPortalGoogleLogin()
    expect(mocks.rpc).toHaveBeenCalledWith('claim_app_google_login')
    expect(mocks.rpc).not.toHaveBeenCalledWith('provision_google_candidate')
    expect(mocks.assertCurrent).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
    expect(mocks.signOut).not.toHaveBeenCalled()
  })
  it('refuses and signs out an unlisted Google account', async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ error: null, data: { allowed: false } })
    await expect(finishPortalGoogleLogin()).rejects.toThrow('not on the Dexam App student list')
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('does not navigate through a canonical identity conflict', async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ error: { code: '40001', message: 'private' } })
    await expect(finishPortalGoogleLogin()).rejects.toThrow('No accounts were merged')
    expect(mocks.dispose).toHaveBeenCalledOnce()
    expect(mocks.signOut).toHaveBeenCalled()
  })
  it('refuses a listed student whose admission fee is not recorded', async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({
      error: null,
      data: { allowed: false, reason: 'admission_fee_pending' },
    })
    await expect(finishPortalGoogleLogin()).rejects.toThrow('admission fee has not been recorded')
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
  it('makes Google the only sign-in once it is switched on', () => {
    expect(passwordSignInEnabled()).toBe(false)
    vi.stubEnv('VITE_ENABLE_PASSWORD_SIGN_IN', 'true')
    expect(passwordSignInEnabled()).toBe(true)
    vi.stubEnv('VITE_ENABLE_PASSWORD_SIGN_IN', '')
    vi.stubEnv('VITE_ENABLE_SHARED_GOOGLE_LOGIN', '')
    expect(passwordSignInEnabled()).toBe(true)
  })
  it('explains when the App switch is off', async () => {
    mocks.signOut.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ error: { code: '55000', message: 'private' } })
    await expect(finishPortalGoogleLogin()).rejects.toThrow('not switched on yet')
  })
})
