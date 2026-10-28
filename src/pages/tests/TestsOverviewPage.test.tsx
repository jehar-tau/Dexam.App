import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import { dayStreak } from '../../features/testSeries/progressView'
import { renderApp } from '../../test/render'
import { TestsOverviewPage } from './TestsOverviewPage'

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

const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

function client(handlers: Record<string, unknown>) {
  return {
    rpc: vi.fn((name: string) =>
      Promise.resolve(
        name in handlers
          ? { data: handlers[name], error: null }
          : { data: null, error: { code: 'XX000' } },
      ),
    ),
  }
}

const routes = (
  <Routes>
    <Route path="/tests" element={<TestsOverviewPage />} />
  </Routes>
)

describe('Overview', () => {
  it('counts a day streak ending today or yesterday', () => {
    const now = Date.now()
    expect(dayStreak([ago(0), ago(1), ago(2), ago(4)], now)).toBe(3)
    expect(dayStreak([ago(1), ago(2)], now)).toBe(2)
    expect(dayStreak([ago(2)], now)).toBe(0)
    expect(dayStreak([], now)).toBe(0)
  })

  it('shows where the student stands and what to do next', async () => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
    mocks.client = client({
      get_test_access: {
        kind: 'student',
        displayName: 'Asha Fictional',
        profile: null,
        freeSlots: [],
        entitledPapers: [],
      },
      get_assessment_progress: {
        attempts: [
          {
            attemptId: '00000000-0000-4000-8000-0000000000b1',
            kind: 'practice',
            title: 'Practice · Spatial',
            paperId: 'practice-uceed-spatial',
            exam: 'uceed',
            submittedAt: ago(1),
            score: 8,
            maxScore: 12,
            questionCount: 3,
          },
          {
            attemptId: '00000000-0000-4000-8000-0000000000b2',
            kind: 'mock',
            title: 'UCEED 2026 mock',
            paperId: 'mock-uceed-2026',
            exam: 'uceed',
            submittedAt: ago(0),
            score: 90,
            maxScore: 200,
            questionCount: 57,
          },
        ],
        topics: [
          { slug: 'language', name: 'Language', total: 10, scored: 9 },
          { slug: 'spatial', name: 'Spatial Reasoning', total: 8, scored: 2 },
        ],
      },
      list_live_events: [],
    })
    renderApp(routes, ['/tests'])
    expect(await screen.findByRole('heading', { name: 'Welcome back, Asha' })).toBeVisible()
    const stats = await screen.findByText('Papers and mocks')
    expect(stats.parentElement).toHaveTextContent('1')
    expect(screen.getByText('Latest score').parentElement).toHaveTextContent('45%')
    expect(screen.getByText('Shortlisting band').parentElement).toHaveTextContent('High')
    expect(screen.getByText('Questions marked right').parentElement).toHaveTextContent('61%')
    expect(screen.getByText('Day streak').parentElement).toHaveTextContent('2')
    expect(
      screen.getByRole('link', { name: /Practise Spatial Reasoning.*weakest/ }),
    ).toHaveAttribute('href', '/tests/practice?topic=spatial')
    const results = screen.getByRole('region', { name: 'Results' })
    const rows = within(results).getAllByRole('row')
    expect(rows[1]).toHaveTextContent('UCEED 2026 mock')
    expect(rows[1]).toHaveTextContent('High')
    expect(within(rows[1]!).getByRole('link', { name: 'View result' })).toHaveAttribute(
      'href',
      '/tests/results/00000000-0000-4000-8000-0000000000b2',
    )
  })

  it('points a new student to the papers', async () => {
    mocks.session = { user: { id: 'student-2', email: 'y@members.dexam.invalid' } }
    mocks.client = client({
      get_assessment_progress: { attempts: [], topics: [] },
      list_live_events: [],
    })
    renderApp(routes, ['/tests'])
    expect(await screen.findByText('No results yet')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Go to Papers' })).toHaveAttribute(
      'href',
      '/tests/papers',
    )
  })
})
