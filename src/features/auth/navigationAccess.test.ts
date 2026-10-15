import { getNavigationAccess } from './navigationAccess'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
it('rejects provider payloads or extra/private fields without echoing them', async () => {
  mocks.rpc.mockResolvedValue({ data: { student: true, private: 'withheld' }, error: null })
  await expect(getNavigationAccess()).rejects.toThrow('Navigation access could not be verified.')
  expect(mocks.rpc).toHaveBeenCalledWith('get_my_navigation_access')
})
