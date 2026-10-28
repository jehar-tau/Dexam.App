import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { buildBankPaper, type BankAttemptPayload } from '../../features/testSeries/bankPaper'
import { renderApp } from '../../test/render'
import { TestsMocksPage } from './TestsMocksPage'

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

const uceed = {
  key: 'uceed-2026',
  exam: 'uceed',
  level: 'bdes',
  title: 'UCEED 2026 mock',
  minutes: 120,
  sections: [
    { type: 'nat', count: 14 },
    { type: 'msq', count: 15 },
    { type: 'mcq', count: 28 },
  ],
  available: 40,
  total: 57,
  taken: 1,
  openAttemptId: null,
  canStart: true,
}

function client(handlers: Record<string, () => { data: unknown; error: unknown }>) {
  return {
    rpc: vi.fn((name: string) =>
      Promise.resolve(handlers[name]?.() ?? { data: null, error: { code: 'XX000' } }),
    ),
  }
}

const routes = (
  <Routes>
    <Route path="/tests/mocks" element={<TestsMocksPage />} />
    <Route path="/tests/mock/run/:attemptId" element={<h1>Mock window</h1>} />
  </Routes>
)

describe('Mocks', () => {
  afterEach(() => vi.unstubAllEnvs())
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
  })

  it('lists the level’s mocks, warns about a short pool and builds one', async () => {
    const user = userEvent.setup()
    const mock = client({
      get_test_access: () => ({
        data: {
          kind: 'student',
          displayName: 'S',
          profile: null,
          freeSlots: [],
          entitledPapers: [],
        },
        error: null,
      }),
      list_assessment_mocks: () => ({
        data: [uceed, { ...uceed, key: 'ceed-2026', level: 'mdes', title: 'CEED 2026 mock' }],
        error: null,
      }),
      start_assessment_mock: () => ({
        data: { attemptId: '00000000-0000-4000-8000-0000000000d1' },
        error: null,
      }),
    })
    mocks.client = mock
    renderApp(routes, ['/tests/mocks'])

    const card = await screen.findByRole('region', { name: 'UCEED 2026 mock' })
    expect(screen.queryByRole('region', { name: 'CEED 2026 mock' })).toBeNull()
    expect(within(card).getByText('40 / 57')).toBeVisible()
    expect(within(card).getByText(/the mock will be shorter/)).toBeVisible()
    await user.click(within(card).getByRole('button', { name: 'Start mock' }))
    expect(mock.rpc).toHaveBeenCalledWith('start_assessment_mock', { p_key: 'uceed-2026' })
    expect(await screen.findByRole('heading', { name: 'Mock window' })).toBeVisible()

    renderApp(routes, ['/tests/mocks'])
    await user.click(screen.getAllByRole('button', { name: 'M.Des' }).at(-1)!)
    expect(await screen.findByRole('region', { name: 'CEED 2026 mock' })).toBeVisible()
  })

  it('shows a free candidate’s used mock as locked', async () => {
    mocks.client = client({
      get_test_access: () => ({
        data: {
          kind: 'candidate',
          displayName: 'C',
          profile: { level: 'bdes', exams: [], examYear: null },
          freeSlots: [],
          entitledPapers: [],
        },
        error: null,
      }),
      list_assessment_mocks: () => ({ data: [{ ...uceed, canStart: false }], error: null }),
    })
    renderApp(routes, ['/tests/mocks'])
    const card = await screen.findByRole('region', { name: 'UCEED 2026 mock' })
    expect(within(card).getByRole('button', { name: 'Start mock' })).toBeDisabled()
    expect(within(card).getByText('You have used your free mock for this exam.')).toBeVisible()
    expect(screen.getByText(/first mock of each exam is free/)).toBeVisible()
  })

  it('previews sample mocks without starting one', () => {
    mocks.session = null
    renderApp(routes, ['/tests/mocks?preview=1'])
    expect(screen.getByRole('region', { name: 'UCEED 2026 mock' })).toBeVisible()
    expect(
      within(screen.getByRole('region', { name: 'UCEED 2026 mock' })).getByRole('button', {
        name: 'Start mock',
      }),
    ).toBeDisabled()
  })
})

describe('mock papers', () => {
  it('say how the mock was built and when the time was scaled', () => {
    const payload: BankAttemptPayload = {
      attemptId: '00000000-0000-4000-8000-0000000000d1',
      kind: 'mock',
      title: 'UCEED 2026 mock',
      timed: true,
      paperId: 'mock-uceed-2026',
      exam: 'uceed',
      status: 'open',
      deadline: null,
      durationMinutes: 84,
      objectiveCount: 57,
      marking: { nat: { correct: 4, wrong: 0 } },
      questions: Array.from({ length: 40 }, (_, index) => ({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        number: null,
        type: 'nat' as const,
        prompt: 'x',
        figures: [],
        options: [],
      })),
    }
    const paper = buildBankPaper('ignored', payload, new Map())
    expect(paper.title).toBe('UCEED 2026 mock')
    expect(paper.practiceSet).toBeUndefined()
    expect(paper.notes?.[1]).toMatch(/40 of the 57 questions .* 84 minutes/)
  })
})
