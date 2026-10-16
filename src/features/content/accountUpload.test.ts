import { uploadAssignmentMaterial } from './contentWorkspace'
const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  rpc: vi.fn<
    (
      name: string,
      args: Record<string, string | number>,
    ) => Promise<{ error: { message: string } | null; data?: unknown }>
  >(),
  remove: vi.fn(),
  assertCurrent: vi.fn(),
  dispose: vi.fn(),
}))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({}) }))
vi.mock('../auth/accountOperation', () => ({
  captureAccountOperation: () =>
    Promise.resolve({
      client: {
        storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
        rpc: mocks.rpc,
      },
      assertCurrent: mocks.assertCurrent,
      dispose: mocks.dispose,
    }),
}))
const run = () =>
  uploadAssignmentMaterial(
    'offering',
    'version',
    new File(['fictional'], 'drawing.pdf', { type: 'application/pdf' }),
    0,
  )
describe('tracked assignment uploads', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.upload.mockResolvedValue({ error: null })
    mocks.rpc.mockImplementation((name, args) =>
      Promise.resolve(
        name === 'reserve_assignment_upload'
          ? {
              error: null,
              data: [
                {
                  upload_id: args.p_request_id,
                  object_path: `offering/version/${args.p_request_id}.pdf`,
                  state: 'reserved',
                },
              ],
            }
          : { error: null, data: 'material-id' },
      ),
    )
  })
  it('reserves before upload and attaches without direct metadata writes', async () => {
    await run()
    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual([
      'reserve_assignment_upload',
      'attach_assignment_upload',
    ])
    expect(mocks.remove).not.toHaveBeenCalled()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('never continues as a replacement account or deletes uncertain bytes', async () => {
    mocks.upload.mockImplementation(() => {
      mocks.assertCurrent.mockImplementation(() => {
        throw new Error('Session changed')
      })
      return Promise.resolve({ error: null })
    })
    await expect(run()).rejects.toThrow('Session changed')
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('retries attachment using the same reservation after lost confirmation', async () => {
    const original = mocks.rpc.getMockImplementation()!
    let attempted = false
    mocks.rpc.mockImplementation((name, args) => {
      if (name === 'attach_assignment_upload' && !attempted) {
        attempted = true
        return Promise.resolve({ error: { message: 'lost' } })
      }
      return original(name, args)
    })
    await run()
    expect(mocks.rpc.mock.calls[1]).toEqual(mocks.rpc.mock.calls[2])
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('retains unresolved files for authorized review', async () => {
    const original = mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementation((name, args) =>
      name === 'attach_assignment_upload'
        ? Promise.resolve({ error: { message: 'lost' } })
        : original(name, args),
    )
    await expect(run()).rejects.toThrow('authorized review')
    expect(mocks.remove).not.toHaveBeenCalled()
  })
  it('does not upload when reservation fails', async () => {
    mocks.rpc.mockResolvedValue({ error: { message: 'private provider detail' } })
    await expect(run()).rejects.toThrow('could not be reserved')
    expect(mocks.upload).not.toHaveBeenCalled()
  })
  it('retries a lost reservation response using the same request ID', async () => {
    const original = mocks.rpc.getMockImplementation()!
    mocks.rpc.mockImplementationOnce(() => Promise.resolve({ error: { message: 'lost' } }))
    mocks.rpc.mockImplementation(original)
    await run()
    expect(mocks.rpc.mock.calls[0]).toEqual(mocks.rpc.mock.calls[1])
    expect(mocks.upload).toHaveBeenCalledOnce()
  })
})
