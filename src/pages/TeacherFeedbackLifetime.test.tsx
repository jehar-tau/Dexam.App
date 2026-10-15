import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { TeacherFeedbackPage } from './TeacherFeedbackPage'
const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  audio: vi.fn(),
  transcription: vi.fn(),
}))
vi.mock('../features/feedback/teacherFeedback', () => ({
  getFeedbackReviewQueue: () =>
    Promise.resolve([
      {
        aiAssisted: false,
        assignmentGroup: 'Fictional',
        assignmentInstanceId: 'instance',
        assignmentTitle: 'Drawing',
        displayName: 'Disposable teacher review',
        feedbackRevisionId: null,
        feedbackStatus: null,
        memberId: 'DXM-FICTIONAL',
        sourceKind: 'human',
        submissionAttemptId: 'attempt',
        submissionFileCount: 0,
        submittedAt: '2026-10-14T10:00:00Z',
        voiceEquivalentConfirmed: false,
        writtenText: 'Existing fictional feedback.',
      },
    ]),
  getReviewSubmissionFiles: () => Promise.resolve([]),
  startFeedbackDraft: mocks.start,
  saveFeedbackDraft: mocks.save,
  publishFeedback: mocks.publish,
  uploadFeedbackAudio: mocks.audio,
  requestTranscription: mocks.transcription,
}))
describe('retired teacher workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'false')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  it('cannot continue saving or publishing after its initial draft request finishes on a retired page', async () => {
    let finish!: (value: string) => void
    mocks.start.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const user = userEvent.setup(),
      view = renderApp(<TeacherFeedbackPage />, ['/staff/reviews'])
    await screen.findByRole('heading', { name: 'Feedback review.' })
    await user.click(screen.getByRole('button', { name: 'Publish & complete review' }))
    expect(mocks.start).toHaveBeenCalledOnce()
    view.unmount()
    await act(async () => {
      finish('old-account-revision')
      await Promise.resolve()
    })
    expect(mocks.save).not.toHaveBeenCalled()
    expect(mocks.publish).not.toHaveBeenCalled()
  })
  it('stops a microphone granted after the workspace unmounts', async () => {
    let finish!: (stream: MediaStream) => void
    const permission = new Promise<MediaStream>((resolve) => {
        finish = resolve
      }),
      stop = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, mediaDevices: { getUserMedia: () => permission } })
    vi.stubGlobal('MediaRecorder', vi.fn())
    const user = userEvent.setup(),
      view = renderApp(<TeacherFeedbackPage />, ['/staff/reviews'])
    await screen.findByRole('heading', { name: 'Feedback review.' })
    await user.click(screen.getByRole('button', { name: 'Record voice note' }))
    view.unmount()
    await act(async () => {
      finish({ getTracks: () => [{ stop }] } as unknown as MediaStream)
      await permission
    })
    expect(stop).toHaveBeenCalled()
    expect(mocks.audio).not.toHaveBeenCalled()
    expect(mocks.transcription).not.toHaveBeenCalled()
  })
  it.each(['constructor', 'start'])(
    'stops microphone tracks if recording %s fails',
    async (failure) => {
      const stop = vi.fn(),
        stream = { getTracks: () => [{ stop }] }
      vi.stubGlobal('navigator', {
        ...navigator,
        mediaDevices: { getUserMedia: () => Promise.resolve(stream) },
      })
      vi.stubGlobal(
        'MediaRecorder',
        class {
          stream = stream
          onstop = null
          ondataavailable = null
          constructor() {
            if (failure === 'constructor') throw new Error('Unsupported format')
          }
          start() {
            throw new Error('Recording failed')
          }
        },
      )
      const user = userEvent.setup()
      renderApp(<TeacherFeedbackPage />, ['/staff/reviews'])
      await screen.findByRole('heading', { name: 'Feedback review.' })
      await user.click(screen.getByRole('button', { name: 'Record voice note' }))
      expect(stop).toHaveBeenCalled()
      expect(mocks.audio).not.toHaveBeenCalled()
    },
  )
})
