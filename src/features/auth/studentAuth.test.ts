import { getStudentAccess, normalizeMemberId, signInStudent } from './studentAuth'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  setSession: vi.fn(),
  signOut: vi.fn(),
  sharedSetSession: vi.fn(),
  sharedSignOut: vi.fn(),
  listener: undefined as ((event: string) => void) | undefined,
}))

vi.mock('./supabaseClient', () => ({
  getSupabaseClient: () => ({
    auth: {
      setSession: mocks.sharedSetSession,
      signOut: mocks.sharedSignOut,
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
    rpc: mocks.rpc,
  }),
  createEmployeeActivationClient: () => ({
    auth: {
      setSession: mocks.setSession,
      signOut: mocks.signOut,
    },
    rpc: mocks.rpc,
  }),
}))

describe('studentAuth', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-anon-key')
    mocks.rpc.mockReset()
    mocks.setSession.mockReset()
    mocks.signOut.mockReset().mockResolvedValue({ error: null })
    mocks.sharedSetSession
      .mockReset()
      .mockImplementation((args: unknown) => mocks.setSession(args) as Promise<unknown>)
    mocks.sharedSignOut.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('does not commit a late login response after another account signs in', async () => {
    let finish!: (value: Response) => void
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve
        }),
    )
    mocks.setSession.mockResolvedValue({
      data: { session: { access_token: 'fictional', refresh_token: 'fictional' } },
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    const pending = signInStudent('DXM-7K3M9Q2RW5TY', 'fictional')
    mocks.listener?.('SIGNED_IN')
    finish(
      new Response(JSON.stringify({ accessToken: 'fictional', refreshToken: 'fictional' }), {
        status: 200,
      }),
    )
    await expect(pending).rejects.toThrow('session changed')
    expect(mocks.sharedSetSession).not.toHaveBeenCalled()
    expect(mocks.sharedSignOut).not.toHaveBeenCalled()
  })

  it('normalizes Member IDs without exposing an internal email identity', () => {
    expect(normalizeMemberId('  dxm-7k3m 9q2rw5ty ')).toBe('DXM-7K3M9Q2RW5TY')
  })

  it('uses one generic error for invalid credentials', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(signInStudent('DXM-7K3M9Q2RW5TY', 'wrong password')).rejects.toThrow(
      'We could not sign you in. Check your details and try again.',
    )
    expect(mocks.setSession).not.toHaveBeenCalled()
  })

  it('sets the returned session and checks live student membership', async () => {
    const session = { access_token: 'access-token', refresh_token: 'refresh-token' }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    mocks.setSession.mockResolvedValue({ data: { session }, error: null })
    mocks.rpc.mockResolvedValue({ data: true, error: null })

    await expect(signInStudent(' dxm-7k3m9q2rw5ty ', 'password phrase')).resolves.toBe(session)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/functions/v1/student-sign-in',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          memberId: 'DXM-7K3M9Q2RW5TY',
          password: 'password phrase',
        }),
      }),
    )
    expect(mocks.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('current_person_has_active_student_membership')
  })

  it('removes the local session when current student membership is inactive', async () => {
    mocks.setSession.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: false, error: null })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'access-token', refreshToken: 'refresh-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(signInStudent('DXM-7K3M9Q2RW5TY', 'password phrase')).rejects.toThrow(
      'We could not sign you in. Check your details and try again.',
    )
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('fails closed when the live membership check is unavailable', async () => {
    mocks.setSession.mockResolvedValue({
      data: { session: { access_token: 'access-token' } },
      error: null,
    })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'network' } })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'access-token', refreshToken: 'refresh-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(signInStudent('DXM-7K3M9Q2RW5TY', 'password phrase')).rejects.toThrow(
      'We could not verify student access. Please try again.',
    )
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})

describe('getStudentAccess', () => {
  it('returns the current membership result', async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null })
    await expect(getStudentAccess()).resolves.toBe(true)
  })
})
