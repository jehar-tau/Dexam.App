import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { renderApp } from '../../test/render'
import { PracticeRunPage } from './exam/PracticeRunPage'
import { TestsOverviewPage } from './TestsOverviewPage'
import { TestsPracticePage } from './TestsPracticePage'

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

const routes = (
  <Routes>
    <Route path="/tests" element={<TestsOverviewPage />} />
    <Route path="/tests/practice" element={<TestsPracticePage />} />
    <Route path="/tests/practice/run/:attemptId" element={<PracticeRunPage />} />
  </Routes>
)

const rpcClient = (responses: Record<string, { data: unknown; error: unknown }>) => {
  const rpc = vi.fn((name: string) =>
    Promise.resolve(responses[name] ?? { data: null, error: { code: 'XX000' } }),
  )
  return { rpc, storage: { from: () => ({ createSignedUrls: vi.fn() }) } }
}

describe('Overview progress (merged Analytics)', () => {
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    mocks.session = null
    mocks.client = null
  })

  it('shows preview stats, a labelled progress chart, topics and history', () => {
    renderApp(routes, ['/tests?preview=1'])
    expect(screen.getByRole('heading', { name: 'Home' })).toBeVisible()
    expect(screen.getByText('Papers and mocks').nextSibling).toHaveTextContent('6')
    const chart = screen.getByRole('img', { name: /Score percentage over time/ })
    expect(
      within(screen.getByRole('list', { name: 'Exams' })).getAllByRole('listitem'),
    ).toHaveLength(2)
    expect(chart).toHaveTextContent('UCEED 64%')
    expect(chart).toHaveTextContent('NID DAT 55%')

    fireEvent.keyDown(chart, { key: 'ArrowRight' })
    expect(screen.getByRole('status')).toHaveTextContent('38%')
    expect(screen.getByRole('status')).toHaveTextContent('UCEED 2022')
    fireEvent.keyDown(chart, { key: 'Escape' })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Practise Analytical Reasoning' })).toHaveAttribute(
      'href',
      '/tests/practice?topic=analytical-reasoning&preview=1',
    )
    expect(screen.getAllByRole('row')).toHaveLength(8)
    expect(screen.getByRole('columnheader', { name: 'Band' })).toBeVisible()
    expect(screen.getAllByRole('cell', { name: /^(High|Medium|Low)$/ }).length).toBeGreaterThan(0)
  })
})

describe('Practice', () => {
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    localStorage.clear()
    mocks.session = null
    mocks.client = null
  })

  it('lists sample topics in preview but needs sign-in to start', async () => {
    const user = userEvent.setup()
    renderApp(routes, ['/tests/practice?preview=1&topic=materials'])
    expect(screen.getByRole('radio', { name: /Materials/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /Spatial Reasoning/ }))
    expect(screen.getByRole('button', { name: 'Start practice' })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/Sign in as a student/)
  })

  it('builds a set on the server and runs it without the exam-centre login', async () => {
    const user = userEvent.setup()
    mocks.session = { user: { id: 'student-1', email: 'dxm-teststudent2@members.dexam.invalid' } }
    const attemptId = '00000000-0000-4000-8000-0000000000b1'
    const client = rpcClient({
      list_assessment_practice_topics: {
        data: [{ slug: 'spatial', name: 'Spatial', ready_count: 6, unseen_count: 6 }],
        error: null,
      },
      start_assessment_practice: { data: { attemptId }, error: null },
      get_assessment_attempt: {
        data: {
          attemptId,
          kind: 'practice',
          title: 'Practice · Spatial',
          timed: false,
          paperId: 'practice-uceed-spatial',
          exam: 'uceed',
          status: 'open',
          deadline: null,
          durationMinutes: 600,
          objectiveCount: 1,
          marking: { nat: { correct: 4, wrong: 0 } },
          questions: [
            {
              id: '00000000-0000-4000-8000-000000000001',
              number: '3',
              type: 'nat',
              prompt: 'How many faces does a cube have?',
              figures: [],
              options: [],
            },
          ],
        },
        error: null,
      },
      begin_assessment_attempt: {
        data: { deadline: new Date(Date.now() + 600 * 60_000).toISOString() },
        error: null,
      },
    })
    mocks.client = client
    renderApp(routes, ['/tests/practice'])

    await user.click(screen.getByRole('button', { name: 'UCEED' }))
    await user.click(await screen.findByRole('radio', { name: /Spatial/ }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '6 questions on Spatial (all that are ready).',
    )
    await user.click(screen.getByRole('button', { name: 'Untimed' }))
    await user.click(screen.getByRole('button', { name: 'Start practice' }))
    expect(client.rpc).toHaveBeenCalledWith('start_assessment_practice', {
      p_topic: 'spatial',
      p_size: 10,
      p_timed: false,
      p_exam: 'uceed',
    })

    expect(await screen.findByRole('heading', { name: 'Practice set' })).toBeVisible()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/has 1 question in 1 section and is untimed\./)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Start practice' }))
    expect(await screen.findByText('Untimed practice')).toBeVisible()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.getByText('How many faces does a cube have?')).toBeVisible()
  })

  it('explains a practice set that cannot be opened', async () => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
    mocks.client = rpcClient({ get_assessment_attempt: { data: null, error: { code: '42501' } } })
    renderApp(routes, ['/tests/practice/run/00000000-0000-4000-8000-0000000000b1'])
    expect(
      await screen.findByRole('heading', { name: 'This practice set could not be opened' }),
    ).toBeVisible()
  })
})
