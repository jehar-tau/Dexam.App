import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { TeacherFeedbackPage } from './TeacherFeedbackPage'

const mocks = vi.hoisted(() => ({ getFeedbackReviewQueue: vi.fn() }))

vi.mock('../features/feedback/teacherFeedback', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/feedback/teacherFeedback')>()
  return { ...original, getFeedbackReviewQueue: mocks.getFeedbackReviewQueue }
})

describe('TeacherFeedbackPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.getFeedbackReviewQueue.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('dictates, proofreads, explicitly accepts, and publishes fictional feedback', async () => {
    const user = userEvent.setup()
    renderApp(<TeacherFeedbackPage />, ['/staff/reviews?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Feedback review.' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Aarohi Deshmukh' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Dictate feedback' }))
    expect(screen.getByText('Microphone active')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Stop dictation' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Stop dictation' }))
    expect(screen.getByRole('textbox', { name: 'Written feedback' })).toHaveValue(
      'Your line control is improving and the circles are more confident. Keep the pressure consistent, especially through the longer curves.',
    )

    await user.click(screen.getByRole('button', { name: 'Proofread with AI' }))
    expect(screen.getByRole('heading', { name: 'Proofreading suggestion' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Accept suggestion' }))
    expect(screen.getByText(/suggestion accepted/i)).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Publish & complete review' }))
    expect(screen.getByText(/assignment is now review completed/i)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Kabir Mehta' })).toBeVisible()
    expect(mocks.getFeedbackReviewQueue).not.toHaveBeenCalled()
  })

  it('keeps playable voice feedback gated by a written equivalent confirmation', async () => {
    const user = userEvent.setup()
    renderApp(<TeacherFeedbackPage />, ['/staff/reviews?preview=1'])

    await user.type(
      screen.getByRole('textbox', { name: 'Written feedback' }),
      'Keep the pressure consistent.',
    )
    await user.click(screen.getByRole('button', { name: 'Record voice note' }))
    expect(screen.getByText('Microphone active')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Stop voice note' }))
    await user.click(screen.getByRole('button', { name: 'Publish & complete review' }))
    expect(
      screen.getByText(/Confirm that the writing gives the same essential feedback/),
    ).toBeVisible()

    await user.click(screen.getByLabelText(/same essential feedback/))
    await user.click(screen.getByRole('button', { name: 'Publish & complete review' }))
    expect(screen.getByText(/assignment is now review completed/i)).toBeVisible()
  })

  it('shows a submission thumbnail and expands it without leaving the review page', async () => {
    const user = userEvent.setup()
    renderApp(<TeacherFeedbackPage />, ['/staff/reviews?preview=1'])

    await user.click(await screen.findByRole('button', { name: 'Preview line-practice.jpg' }))
    const dialog = screen.getByRole('dialog', { name: 'line-practice.jpg' })
    expect(dialog).toBeVisible()
    expect(
      screen.getByRole('img', { name: 'Expanded submission: line-practice.jpg' }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(dialog).not.toBeInTheDocument()
  })

  it('dictates and proofreads a correction request before publication', async () => {
    const user = userEvent.setup()
    renderApp(<TeacherFeedbackPage />, ['/staff/reviews?preview=1'])

    await user.click(screen.getByRole('button', { name: 'Dictate correction' }))
    expect(screen.getByText('Microphone active')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Stop correction dictation' }))
    expect(screen.getByRole('textbox', { name: /Correction request/ })).toHaveValue(
      'Please repeat the final row with slower, continuous strokes and keep the pressure consistent from start to finish.',
    )

    await user.click(screen.getByRole('button', { name: 'Proofread correction with AI' }))
    expect(screen.getByText('Correction wording suggestion')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Accept correction suggestion' }))
    expect(screen.getByText(/Correction wording accepted/)).toBeVisible()
  })
})
