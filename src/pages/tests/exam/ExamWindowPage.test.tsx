import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { attemptStorageKey } from '../../../features/testSeries/examAttempt'
import { renderApp } from '../../../test/render'
import { ExamWindowPage } from './ExamWindowPage'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  client: null as null | object,
}))

vi.mock('../../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, signOut: vi.fn() }),
}))

vi.mock('../../../features/auth/supabaseClient', () => ({
  getSupabaseClient: () => mocks.client,
}))

function renderExam(path = '/tests/exam/uceed-2025?preview=1') {
  return renderApp(
    <Routes>
      <Route path="/tests/exam/:paperId" element={<ExamWindowPage />} />
      <Route path="/tests/mock-test" element={<h1>Mock test</h1>} />
      <Route path="/tests/results/:attemptId" element={<h1>Result page</h1>} />
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
    mocks.session = null
    mocks.client = null
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
    expect(screen.getByRole('link', { name: 'Back to Mock test' })).toHaveAttribute(
      'href',
      '/tests/mock-test?preview=1',
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

describe('Exam window with the question bank', () => {
  const attemptId = '00000000-0000-4000-8000-0000000000a1'
  const questionId = '00000000-0000-4000-8000-000000000001'
  const opened = {
    attemptId,
    paperId: 'uceed-2025',
    exam: 'uceed',
    status: 'open',
    deadline: null,
    durationMinutes: 40,
    objectiveCount: 3,
    marking: { mcq: { correct: 3, wrong: -0.71 } },
    questions: [
      {
        id: questionId,
        number: '4',
        type: 'mcq',
        prompt: 'Which bank shape has four equal sides?',
        figures: [{ path: 'ab/figure.png', width: 320, height: 200 }],
        options: [
          { key: 'A', text: 'Triangle', imagePath: null },
          { key: 'B', text: 'Square', imagePath: null },
        ],
      },
    ],
  }

  function bankClient(responses: Record<string, { data: unknown; error: unknown }>) {
    const rpc = vi.fn((name: string) =>
      Promise.resolve(responses[name] ?? { data: null, error: { code: 'XX000' } }),
    )
    return {
      rpc,
      storage: {
        from: () => ({
          createSignedUrls: () =>
            Promise.resolve({
              data: [
                { path: 'ab/figure.png', signedUrl: 'http://127.0.0.1/signed/ab', error: null },
              ],
              error: null,
            }),
        }),
      },
    }
  }

  beforeEach(() => {
    localStorage.clear()
    mocks.session = {
      user: { id: 'student-1', email: 'dxm-teststudent2@members.dexam.invalid' },
    }
  })

  it('opens, begins on the server, and submits for scoring', async () => {
    const user = userEvent.setup()
    const deadline = new Date(Date.now() + 40 * 60_000).toISOString()
    const client = bankClient({
      open_assessment_attempt: { data: opened, error: null },
      begin_assessment_attempt: { data: { deadline }, error: null },
      submit_assessment_attempt: { data: { score: 3, maxScore: 3 }, error: null },
    })
    mocks.client = client
    renderExam('/tests/exam/uceed-2025')

    expect(await screen.findByRole('heading', { name: 'Candidate login' })).toBeVisible()
    expect(screen.getAllByText('DXM-TESTSTUDENT2').length).toBeGreaterThan(0)
    expect(screen.getByText(/1 of the 3 objective questions/)).toBeVisible()
    expect(screen.queryByText(/fictional/i)).not.toBeInTheDocument()

    await startExam(user)
    expect(client.rpc).toHaveBeenCalledWith('begin_assessment_attempt', { p_attempt_id: attemptId })
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent(/00:(40:00|39:5\d)/)
    expect(screen.getByRole('img', { name: 'Figure 1 for question 1' })).toHaveAttribute(
      'src',
      'http://127.0.0.1/signed/ab',
    )
    await user.click(screen.getByRole('radio', { name: /Square/ }))
    await user.click(screen.getByRole('button', { name: 'Save & Next' }))
    expect(localStorage.getItem(attemptStorageKey('student-1', 'uceed-2025'))).toContain(attemptId)

    await user.click(screen.getByRole('button', { name: 'Submit' }))
    await user.click(screen.getByRole('button', { name: 'Yes, submit' }))
    expect(await screen.findByRole('heading', { name: 'Result page' })).toBeVisible()
    expect(client.rpc).toHaveBeenCalledWith('submit_assessment_attempt', {
      p_attempt_id: attemptId,
      p_responses: { [questionId]: 'B' },
      p_reason: 'candidate',
    })
    expect(localStorage.getItem(attemptStorageKey('student-1', 'uceed-2025'))).toBeNull()
  })

  it('resumes a started attempt with the server deadline', async () => {
    const deadline = new Date(Date.now() + 10 * 60_000).toISOString()
    mocks.client = bankClient({
      open_assessment_attempt: {
        data: { ...opened, status: 'in_progress', deadline },
        error: null,
      },
    })
    renderExam('/tests/exam/uceed-2025')
    expect(await screen.findByRole('heading', { name: 'Question 1' })).toBeVisible()
    expect(screen.getByRole('timer', { name: 'Time left' })).toHaveTextContent(/00:(10:00|09:5\d)/)
  })

  it('keeps answers and offers a retry when submission fails', async () => {
    const user = userEvent.setup()
    const deadline = new Date(Date.now() + 10 * 60_000).toISOString()
    const client = bankClient({
      open_assessment_attempt: {
        data: { ...opened, status: 'in_progress', deadline },
        error: null,
      },
      submit_assessment_attempt: { data: null, error: { code: '08006' } },
    })
    mocks.client = client
    renderExam('/tests/exam/uceed-2025')
    await user.click(await screen.findByRole('button', { name: 'Submit' }))
    await user.click(screen.getByRole('button', { name: 'Yes, submit' }))
    expect(await screen.findByRole('heading', { name: /has not reached Dexam yet/ })).toBeVisible()
    client.rpc.mockImplementation(() => Promise.resolve({ data: {}, error: null }))
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('heading', { name: 'Result page' })).toBeVisible()
  })

  it('says when a paper has no reviewed questions yet', async () => {
    mocks.client = bankClient({
      open_assessment_attempt: { data: null, error: { code: 'P0002' } },
    })
    renderExam('/tests/exam/uceed-2025')
    expect(
      await screen.findByRole('heading', { name: 'This paper is still being reviewed' }),
    ).toBeVisible()

    renderExam('/tests/exam/nift-bdes-2013')
    expect(
      screen.getAllByRole('heading', { name: 'This paper is still being reviewed' }).length,
    ).toBe(2)
  })

  it('explains when the paper cannot be opened', async () => {
    mocks.client = bankClient({
      open_assessment_attempt: { data: null, error: { code: '42501' } },
    })
    renderExam('/tests/exam/uceed-2025')
    expect(
      await screen.findByRole('heading', { name: 'This paper could not be opened' }),
    ).toBeVisible()
    expect(screen.getByText(/could not be loaded for your account/)).toBeVisible()
  })
})
