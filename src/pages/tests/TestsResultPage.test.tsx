import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import {
  beginExam,
  createAttempt,
  goToQuestion,
  saveAndNext,
  storeAttempt,
  submitAttempt,
} from '../../features/testSeries/examAttempt'
import { practicePaper } from '../../features/testSeries/examPaper'
import { renderApp } from '../../test/render'
import { TestsResultPage } from './TestsResultPage'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; email: string } },
  client: null as null | object,
}))

vi.mock('../../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: mocks.session, signOut: vi.fn() }),
}))

vi.mock('../../features/auth/supabaseClient', () => ({
  getSupabaseClient: () => mocks.client,
}))

const renderResult = (path: string) =>
  renderApp(
    <Routes>
      <Route path="/tests/results/:attemptId" element={<TestsResultPage />} />
    </Routes>,
    [path],
  )

describe('Results page', () => {
  afterEach(() => vi.unstubAllEnvs())

  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    localStorage.clear()
    mocks.session = null
    mocks.client = null
  })

  it('scores the stored preview attempt with the fictional keys', async () => {
    let attempt = beginExam(createAttempt(practicePaper), practicePaper, Date.now())
    attempt = saveAndNext(attempt, practicePaper, '12') // NAT 1: correct, +4
    attempt = goToQuestion(attempt, 'msq-1')
    attempt = saveAndNext(attempt, practicePaper, ['A', 'B']) // part marks, +2
    attempt = goToQuestion(attempt, 'mcq-1')
    attempt = saveAndNext(attempt, practicePaper, 'A') // wrong, −1
    storeAttempt('preview', 'uceed-2025', submitAttempt(attempt, Date.now(), 'candidate'))

    const user = userEvent.setup()
    renderResult('/tests/results/preview-uceed-2025?preview=1')
    expect(screen.getByRole('heading', { name: 'UCEED 2025' })).toBeVisible()
    expect(screen.getByLabelText('Score 5 out of 50')).toBeVisible()

    const sections = within(screen.getByRole('table'))
    expect(sections.getByRole('row', { name: /NAT 1 0 0 3 4 \/ 16/ })).toBeVisible()
    expect(sections.getByRole('row', { name: /MSQ 0 1 0 3 2 \/ 16/ })).toBeVisible()
    expect(sections.getByRole('row', { name: /MCQ 0 0 1 5 -1 \/ 18/ })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Wrong or part (2)' }))
    const review = screen.getByRole('list', { name: 'Questions' })
    expect(within(review).getAllByText(/^Question \d+ · /)).toHaveLength(2)
    expect(screen.getAllByText('Your answer').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Correct').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Take it again' })).toHaveAttribute(
      'href',
      '/tests/exam/uceed-2025?preview=1',
    )
  })

  it('shows not found for a preview paper that was not submitted', () => {
    renderResult('/tests/results/preview-uceed-2024?preview=1')
    expect(screen.getByRole('heading', { name: 'Result not found' })).toBeVisible()
  })

  it('loads a released server result for a signed-in student', async () => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
    mocks.client = {
      rpc: vi.fn(() =>
        Promise.resolve({
          data: {
            attemptId: '00000000-0000-4000-8000-0000000000a1',
            paperId: 'uceed-2025',
            startedAt: null,
            submittedAt: '2026-10-28T10:00:00+00:00',
            submitReason: 'time',
            late: false,
            durationMinutes: 45,
            score: 2.29,
            maxScore: 7,
            marking: { nat: { correct: 4, wrong: 0 }, mcq: { correct: 3, wrong: -0.71 } },
            questions: [
              {
                id: '00000000-0000-4000-8000-000000000001',
                number: '1',
                type: 'nat',
                prompt: 'How many corners does a cube have?',
                figures: [],
                options: [],
                response: '8',
                outcome: 'correct',
                marks: 4,
                key: { kind: 'numeric', accepted: [{ exact: 8 }] },
                explanation: 'Count the corners on the top and bottom faces.',
                topic: 'spatial-reasoning',
                topicName: 'Spatial Reasoning',
              },
              {
                id: '00000000-0000-4000-8000-000000000002',
                number: '2',
                type: 'mcq',
                prompt: 'Which word means comfortable to use?',
                figures: [],
                options: [
                  { key: 'A', text: 'Decorative', imagePath: null },
                  { key: 'B', text: 'Ergonomic', imagePath: null },
                ],
                response: 'A',
                outcome: 'wrong',
                marks: -0.71,
                key: { kind: 'choice', correct: ['B'] },
                explanation: null,
                topic: 'language',
                topicName: 'Language',
              },
            ],
          },
          error: null,
        }),
      ),
      storage: { from: () => ({ createSignedUrls: vi.fn() }) },
    }
    renderResult('/tests/results/00000000-0000-4000-8000-0000000000a1')
    expect(await screen.findByRole('heading', { name: 'UCEED 2025' })).toBeVisible()
    expect(screen.getByLabelText('Score 2.29 out of 7')).toBeVisible()
    expect(screen.getByText(/automatically when time ran out/)).toBeVisible()
    expect(screen.getByText('Count the corners on the top and bottom faces.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Areas to improve' })).toBeVisible()
  })

  it('reports a result that cannot be loaded', async () => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
    mocks.client = {
      rpc: vi.fn(() => Promise.resolve({ data: null, error: { code: '42501' } })),
    }
    renderResult('/tests/results/00000000-0000-4000-8000-0000000000a1')
    expect(await screen.findByRole('heading', { name: 'Result not found' })).toBeVisible()
    expect(screen.getByText('This result is not available to your account.')).toBeVisible()
  })
})
