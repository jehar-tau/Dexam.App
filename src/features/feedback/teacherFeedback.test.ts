import { fictionalDownload } from '../../test/storage'
import { getReviewSubmissionFiles } from './teacherFeedback'

const mocks = vi.hoisted(() => ({ order: vi.fn(), download: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      is: () => chain,
      order: mocks.order,
    }
    return { from: () => chain, storage: { from: () => ({ download: mocks.download }) } }
  },
}))

const rows = [
  { id: 'f1', object_path: 'i/a/1.png', original_file_name: 'one.png', mime_type: 'image/png' },
  {
    id: 'f2',
    object_path: 'i/a/2.pdf',
    original_file_name: 'two.pdf',
    mime_type: 'application/pdf',
  },
]

describe('teacher review files', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.order.mockResolvedValue({ data: rows, error: null })
  })

  it('reads every submitted file through the reviewer session into private addresses', async () => {
    mocks.download.mockImplementation(fictionalDownload())
    const { files, media } = await getReviewSubmissionFiles('attempt')
    expect(files).toEqual([
      { id: 'f1', name: 'one.png', mimeType: 'image/png', url: 'blob:fictional/i/a/1.png' },
      { id: 'f2', name: 'two.pdf', mimeType: 'application/pdf', url: 'blob:fictional/i/a/2.pdf' },
    ])
    expect(mocks.download).toHaveBeenCalledWith('i/a/1.png', {}, { cache: 'no-store' })
    media!.revoke()
  })

  it('fails the whole set, keeping nothing, when any file is unreadable', async () => {
    mocks.download.mockImplementation(fictionalDownload((path) => path.endsWith('.pdf')))
    await expect(getReviewSubmissionFiles('attempt')).rejects.toThrow(
      'feedback review workspace could not be loaded',
    )
  })
})
