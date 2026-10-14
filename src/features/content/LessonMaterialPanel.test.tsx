import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../../test/render'
import { LessonFiles } from './LessonMaterialPanel'
const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  upload: vi.fn(),
}))
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('./lessonFiles', () => ({
  listLessonFiles: mocks.list,
  removeLessonFile: mocks.remove,
  getLessonDownload: mocks.download,
  uploadLessonFile: mocks.upload,
}))
describe('lesson material panel', () => {
  beforeEach(() => vi.resetAllMocks())
  it('lists downloads for students without mutation controls', async () => {
    mocks.list.mockResolvedValue([{ id: 'fictional', file_name: 'notes.pdf', byte_size: 20 }])
    renderApp(<LessonFiles lessonId="fictional-lesson" />)
    expect(await screen.findByRole('button', { name: 'Download notes.pdf' })).toBeVisible()
    expect(screen.queryByLabelText('Attach lesson file')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove notes.pdf' })).not.toBeInTheDocument()
  })
  it('lets editors remove a draft reference and refresh the list', async () => {
    mocks.list
      .mockResolvedValueOnce([{ id: 'fictional', file_name: 'notes.pdf', byte_size: 20 }])
      .mockResolvedValue([])
    mocks.remove.mockResolvedValue(undefined)
    renderApp(<LessonFiles lessonId="fictional-lesson" editable />)
    await userEvent.click(await screen.findByRole('button', { name: 'Remove notes.pdf' }))
    expect(mocks.remove).toHaveBeenCalledWith('fictional-lesson', 'fictional')
    expect(await screen.findByLabelText('Attach lesson file')).toBeEnabled()
  })
  it('does not contact live files in preview', () => {
    renderApp(<LessonFiles lessonId="fictional-lesson" editable preview />)
    expect(mocks.list).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('Attach lesson file')).not.toBeInTheDocument()
  })
})
