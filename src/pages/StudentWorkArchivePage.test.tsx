import { screen } from '@testing-library/react'
import { renderApp } from '../test/render'
import { StudentWorkArchivePage } from './StudentWorkArchivePage'
const mocks = vi.hoisted(() => ({ get: vi.fn(), download: vi.fn() }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'student' } } }),
}))
vi.mock('../features/student/workArchive', () => ({
  getWorkArchive: mocks.get,
  getArchiveDownload: mocks.download,
}))
describe('private student work archive', () => {
  it('shows expiry and published feedback without upload or resubmission actions', async () => {
    mocks.get.mockResolvedValue([
      {
        enrollmentId: 'course',
        offeringTitle: 'Fictional course',
        status: 'completed',
        endedAt: '2026-10-14T10:00:00Z',
        expiresAt: '2027-10-14T10:00:00Z',
        attempts: [
          {
            id: 'attempt',
            assignmentTitle: 'Drawing',
            attemptNumber: 1,
            submittedAt: '2026-10-13T10:00:00Z',
            files: [],
            feedback: [
              {
                id: 'feedback',
                text: 'Published drawing advice',
                nextStep: null,
                publishedAt: '2026-10-13T12:00:00Z',
                aiAssisted: false,
                voiceIds: [],
              },
            ],
          },
        ],
      },
    ])
    renderApp(<StudentWorkArchivePage />)
    expect(await screen.findByText('Published drawing advice')).toBeVisible()
    expect(screen.getByText(/Download before/)).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Submit|Upload|Start submission/ }),
    ).not.toBeInTheDocument()
  })
})
