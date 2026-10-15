import { uploadAssignmentMaterial } from './contentWorkspace'
const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  rpc: vi.fn(),
  insert: vi.fn(),
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
        from: () => ({ insert: mocks.insert }),
      },
      assertCurrent: mocks.assertCurrent,
      dispose: mocks.dispose,
    }),
}))
describe('assignment upload identity continuation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.remove.mockResolvedValue({ error: null })
  })
  it('does not create replacement-account metadata after an old upload finishes', async () => {
    let finish!: (value: { error: null }) => void
    mocks.upload.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    const pending = uploadAssignmentMaterial(
      'fictional-offering',
      'fictional-version',
      new File(['fictional'], 'drawing.pdf', { type: 'application/pdf' }),
      0,
    )
    await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalled())
    mocks.assertCurrent.mockImplementation(() => {
      throw new Error('Session changed')
    })
    finish({ error: null })
    await expect(pending).rejects.toThrow('Session changed')
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('reports initiating-identity cleanup denial without borrowing another account', async () => {
    mocks.upload.mockResolvedValue({ error: null })
    mocks.assertCurrent
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw new Error('Session changed')
      })
    mocks.remove.mockResolvedValue({ error: { code: '42501' } })
    await expect(
      uploadAssignmentMaterial(
        'fictional-offering',
        'fictional-version',
        new File(['fictional'], 'drawing.pdf', { type: 'application/pdf' }),
        0,
      ),
    ).rejects.toThrow('authorized cleanup')
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('never deletes a possibly referenced file when metadata confirmation is lost', async () => {
    mocks.upload.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ data: 'fictional-person', error: null })
    mocks.insert.mockResolvedValue({ error: { message: 'Network response lost' } })
    await expect(
      uploadAssignmentMaterial(
        'fictional-offering',
        'fictional-version',
        new File(['fictional'], 'drawing.pdf', { type: 'application/pdf' }),
        0,
      ),
    ).rejects.toThrow('authorized review')
    expect(mocks.remove).not.toHaveBeenCalled()
  })
})
