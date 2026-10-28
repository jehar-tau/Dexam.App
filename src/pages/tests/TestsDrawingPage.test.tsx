import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { drawingGroup, drawingLevel, drawingTitle } from '../../features/testSeries/drawingPapers'
import { renderApp } from '../../test/render'
import { TestsDrawingPage } from './TestsDrawingPage'

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

const attemptId = '00000000-0000-4000-8000-0000000000d1'
const routes = (
  <Routes>
    <Route path="/tests/drawing" element={<TestsDrawingPage />} />
    <Route path="/tests/part-b/:attemptId" element={<h1>Part B screen</h1>} />
  </Routes>
)

const paper = (paperId: string, exam: string, overrides: Record<string, unknown> = {}) => ({
  paperId,
  exam,
  tasks: 6,
  minutes: 180,
  totalMarks: 100,
  original: exam === 'nid',
  locked: false,
  latest: null,
  ...overrides,
})

describe('drawing paper names and groups', () => {
  it('names mocks, Part B papers and CAT papers for students', () => {
    expect(drawingTitle('nid-bdes-dat-mock-03')).toBe('NID DAT B.Des drawing mock 3')
    expect(drawingTitle('ceed-2024')).toBe('CEED 2024 · Part B')
    expect(drawingTitle('nift-2014-mdes-cat')).toBe('NIFT M.Des CAT 2014')
    expect(drawingGroup({ paperId: 'nid-mdes-dat-mock-01', exam: 'nid' })).toBe('nid-mock')
    expect(drawingGroup({ paperId: 'nid-bdes-2017', exam: 'nid' })).toBe('nid-past')
    expect(drawingGroup({ paperId: 'uceed-2025', exam: 'uceed' })).toBe('part-b')
    expect(drawingLevel('ceed-2024')).toBe('mdes')
    expect(drawingLevel('nid-bdes-dat-mock-01')).toBe('bdes')
  })
})

describe('Drawing papers page', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('shows sample drawing papers in preview, without starting one', () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    mocks.session = null
    mocks.client = null
    renderApp(routes, ['/tests/drawing?preview=1'])
    const mock = screen.getByRole('region', { name: 'NID DAT B.Des drawing mock 1' })
    expect(within(mock).getByText('6 tasks · 180 minutes · 100 marks')).toBeVisible()
    expect(within(mock).getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(screen.getByRole('region', { name: 'UCEED 2025 · Part B' })).toBeVisible()
  })

  it('starts a drawing paper and opens its Part B screen; locked papers stay locked', async () => {
    const user = userEvent.setup()
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
    const rpc = vi.fn((name: string) =>
      Promise.resolve(
        name === 'list_drawing_papers'
          ? {
              data: [
                paper('nid-bdes-dat-mock-01', 'nid'),
                paper('uceed-2025', 'uceed', { tasks: 1, minutes: 60, locked: true }),
                paper('ceed-2024', 'ceed', { tasks: 5, minutes: 120 }),
              ],
              error: null,
            }
          : name === 'start_drawing_paper'
            ? { data: { attemptId }, error: null }
            : { data: null, error: { code: 'XX000' } },
      ),
    )
    mocks.client = { rpc }
    renderApp(routes, ['/tests/drawing'])
    const locked = await screen.findByRole('region', { name: 'UCEED 2025 · Part B' })
    expect(within(locked).getByRole('button', { name: 'Start' })).toBeDisabled()
    expect(within(locked).getByText(/Not included in your access/)).toBeVisible()
    // M.Des papers sit behind the level switch.
    expect(screen.queryByRole('region', { name: 'CEED 2024 · Part B' })).toBeNull()

    const mock = screen.getByRole('region', { name: 'NID DAT B.Des drawing mock 1' })
    await user.click(within(mock).getByRole('button', { name: 'Start' }))
    expect(rpc).toHaveBeenCalledWith('start_drawing_paper', { p_paper_id: 'nid-bdes-dat-mock-01' })
    expect(await screen.findByRole('heading', { name: 'Part B screen' })).toBeVisible()
  })
})
