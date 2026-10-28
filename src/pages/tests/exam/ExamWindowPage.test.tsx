import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { attemptStorageKey } from '../../../features/testSeries/examAttempt'
import { renderApp } from '../../../test/render'
import { ExamWindowPage } from './ExamWindowPage'

vi.mock('../../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: null, signOut: vi.fn() }),
}))

function renderExam(path = '/tests/exam/uceed-2025?preview=1') {
  return renderApp(
    <Routes>
      <Route path="/tests/exam/:paperId" element={<ExamWindowPage />} />
      <Route path="/tests/papers" element={<h1>Papers</h1>} />
    </Routes>,
    [path],
  )
}

async function startExam(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  await user.click(screen.getByRole('button', { name: 'Next' }))
  await user.click(screen.getByRole('checkbox', { name: /I have read and understood/ }))
  await user.click(screen.getByRole('button', { name: 'I am ready to begin' }))
}

const palette = () => within(screen.getByRole('complementary', { name: 'Question palette' }))

describe('Exam window', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    localStorage.clear()
  })

  it('walks from login through instructions and the declaration into the exam', async () => {
    const user = userEvent.setup()
    renderExam()

    expect(screen.getByRole('heading', { name: 'Candidate login' })).toBeVisible()
    expect(screen.getByText('Fictional Student')).toBeVisible()
    expect(screen.getAllByText('UCEED 2025').length).toBeGreaterThan(0)
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')

    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('heading', { name: 'General instructions' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Next' }))

    const begin = screen.getByRole('button', { name: 'I am ready to begin' })
    expect(begin).toBeDisabled()
    expect(screen.getByRole('table', { name: 'Marking scheme' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Previous' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('checkbox', { name: /I have read and understood/ }))
    await user.click(screen.getByRole('button', { name: 'I am ready to begin' }))

    expect(screen.getByRole('heading', { name: 'Question 1' })).toBeVisible()
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('00:20:00')
  })

  it('saves only through Save & Next, and the palette shows each status', async () => {
    const user = userEvent.setup()
    renderExam()
    await startExam(user)

    const keypad = within(screen.getByRole('group', { name: 'Number keypad' }))
    await user.click(keypad.getByRole('button', { name: '1' }))
    await user.click(keypad.getByRole('button', { name: '2' }))
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveValue('12')
    await user.click(screen.getByRole('button', { name: 'Save & Next' }))

    expect(screen.getByRole('heading', { name: 'Question 2' })).toBeVisible()
    expect(palette().getByRole('button', { name: 'Question 1, answered' })).toBeVisible()

    // An answer typed and then abandoned through the palette is not kept.
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '9')
    await user.click(palette().getByRole('button', { name: 'Question 3, not visited' }))
    expect(palette().getByRole('button', { name: 'Question 2, not answered' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Mark for Review & Next' }))
    expect(palette().getByRole('button', { name: 'Question 3, marked for review' })).toBeVisible()

    await user.click(palette().getByRole('button', { name: 'Question 1, answered' }))
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveValue('12')
    await user.click(screen.getByRole('button', { name: 'Clear Response' }))
    expect(screen.getByRole('textbox', { name: 'Your answer' })).toHaveValue('')
    expect(palette().getByRole('button', { name: 'Question 1, not answered' })).toBeVisible()
  })

  it('switches sections and answers multiple-select and multiple-choice questions', async () => {
    const user = userEvent.setup()
    renderExam()
    await startExam(user)

    const sections = within(screen.getByRole('navigation', { name: 'Sections' }))
    await user.click(sections.getByRole('button', { name: /MSQ/ }))
    expect(screen.getByRole('heading', { name: 'Question 5' })).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: /High contrast/ }))
    await user.click(screen.getByRole('checkbox', { name: /line of sight/ }))
    await user.click(screen.getByRole('button', { name: 'Mark for Review & Next' }))
    expect(
      palette().getByRole('button', { name: 'Question 5, answered and marked for review' }),
    ).toBeVisible()
    expect(sections.getByRole('button', { name: /MSQ/ })).toHaveTextContent('1/4')

    await user.click(sections.getByRole('button', { name: /MCQ/ }))
    await user.click(screen.getByRole('radio', { name: /Isometric view/ }))
    await user.click(screen.getByRole('radio', { name: /Section/ }))
    expect(screen.getByRole('radio', { name: /Isometric view/ })).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save & Next' }))
    expect(palette().getByRole('button', { name: 'Question 9, answered' })).toBeVisible()
  })

  it('confirms before submitting and shows the summary afterwards', async () => {
    const user = userEvent.setup()
    renderExam()
    await startExam(user)

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    const dialog = screen.getByRole('dialog', { name: 'Submit the paper?' })
    expect(within(dialog).getByText(/14 questions are not answered/)).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'No, go back' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await user.click(screen.getByRole('button', { name: 'Yes, submit' }))
    expect(screen.getByRole('heading', { name: 'Your paper has been submitted.' })).toBeVisible()
    expect(screen.getByRole('table', { name: 'Responses by section' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to papers' })).toHaveAttribute(
      'href',
      '/tests/papers?preview=1',
    )

    await user.click(screen.getByRole('button', { name: 'Take it again' }))
    expect(screen.getByRole('heading', { name: 'Candidate login' })).toBeVisible()
  })

  it('counts down and submits automatically when time runs out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    renderExam()
    await startExam(user)

    act(() => {
      vi.advanceTimersByTime(61_000)
    })
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent('00:18:59')

    act(() => {
      vi.advanceTimersByTime(20 * 60_000)
    })
    expect(
      screen.getByRole('heading', { name: 'Time is up. Your paper has been submitted.' }),
    ).toBeVisible()
  })

  it('resumes a stored attempt and ignores storage it cannot trust', async () => {
    const user = userEvent.setup()
    const first = renderExam()
    await startExam(user)
    await user.type(screen.getByRole('textbox', { name: 'Your answer' }), '4')
    await user.click(screen.getByRole('button', { name: 'Save & Next' }))
    first.unmount()

    renderExam()
    expect(screen.getByRole('heading', { name: 'Question 2' })).toBeVisible()
    expect(palette().getByRole('button', { name: 'Question 1, answered' })).toBeVisible()

    localStorage.setItem(attemptStorageKey('preview', 'uceed-2024'), '{"stage":"submitted"}')
    renderExam('/tests/exam/uceed-2024?preview=1')
    expect(screen.getByRole('heading', { name: 'Candidate login' })).toBeVisible()
  })

  it('shows a not-found page for an unknown paper', () => {
    renderExam('/tests/exam/not-a-paper?preview=1')
    expect(screen.getByRole('heading', { name: 'Paper not found' })).toBeVisible()
    expect(localStorage.getItem(attemptStorageKey('preview', 'not-a-paper'))).toBeNull()
  })
})
