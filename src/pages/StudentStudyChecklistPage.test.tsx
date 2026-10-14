import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { StudentStudyChecklistPage } from './StudentStudyChecklistPage'
const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'student' } } }),
}))
vi.mock('../features/student/studyChecklist', () => ({
  getStudyChecklist: mocks.get,
  setTopicStudied: mocks.set,
}))
const course = {
  enrollmentId: 'course',
  offeringTitle: 'Fictional course',
  readOnly: false,
  expiresAt: null,
  topics: [{ id: 'topic', title: 'Perspective', sectionTitle: 'Drawing', markedAt: null }],
}
describe('student self-reported checklist', () => {
  beforeEach(() => vi.resetAllMocks())
  it('offers an explicit study choice without achievement claims', async () => {
    mocks.get.mockResolvedValue([course])
    mocks.set.mockResolvedValue(undefined)
    renderApp(<StudentStudyChecklistPage />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Mark as studied: Perspective' }),
    )
    expect(mocks.set).toHaveBeenCalledWith('course', 'topic', true)
    expect(screen.getByText(/not a grade, attendance record/)).toBeVisible()
  })
  it('shows archived marks and expiry without editing controls', async () => {
    mocks.get.mockResolvedValue([
      {
        ...course,
        readOnly: true,
        expiresAt: '2027-10-14T10:00:00Z',
        topics: [{ ...course.topics[0], markedAt: '2026-10-14T10:00:00Z' }],
      },
    ])
    renderApp(<StudentStudyChecklistPage />)
    expect(await screen.findByText('Read-only archive')).toBeVisible()
    expect(screen.getByText(/Checklist available until/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Mark as studied|Undo study mark/ }),
    ).not.toBeInTheDocument()
  })
})
