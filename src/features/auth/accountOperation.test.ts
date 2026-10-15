import type { SupabaseClient } from '@supabase/supabase-js'
import { captureAccountOperation } from './accountOperation'
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), unsubscribe: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))
describe('account-bound operation', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fictional-key')
    vi.clearAllMocks()
  })
  afterEach(() => vi.unstubAllEnvs())
  it('pins authorization and blocks a continuation after account change, but not refresh', async () => {
    let event!: (event: string) => void
    const bound = { rpc: vi.fn() }
    mocks.createClient.mockReturnValue(bound)
    const source = {
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { access_token: 'fictional-starting-token' } },
            error: null,
          }),
        onAuthStateChange: (listener: typeof event) => {
          event = listener
          return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
        },
      },
    } as unknown as SupabaseClient
    const operation = await captureAccountOperation(source)
    expect(operation.client).toBe(bound)
    expect(mocks.createClient).toHaveBeenCalledWith(
      'http://127.0.0.1:54321',
      'fictional-key',
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer fictional-starting-token' } },
      }),
    )
    event('TOKEN_REFRESHED')
    expect(() => operation.assertCurrent()).not.toThrow()
    event('SIGNED_IN')
    expect(() => operation.assertCurrent()).toThrow('session changed')
    operation.dispose()
    expect(mocks.unsubscribe).toHaveBeenCalledOnce()
  })
})
