import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'

import { partBFileProblem } from '../../features/testSeries/partB'
import { renderApp } from '../../test/render'
import { PartBEvaluationPage, PartBQueuePage } from '../PartBEvaluationPage'
import { PartBPage } from './exam/PartBPage'
import { PartBResultCard } from './PartBResultCard'

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

const attemptId = '00000000-0000-4000-8000-0000000000c1'
const taskId = '00000000-0000-4000-8000-000000000001'

const partB = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  attemptId,
  paperId: 'ceed-2024',
  exam: 'ceed',
  kind: 'paper',
  partAStatus: 'submitted',
  status: 'none',
  available: 1,
  startedAt: null,
  drawingDeadline: null,
  uploadDeadline: null,
  submittedAt: null,
  score: null,
  maxScore: null,
  reference: 'CAND-ABCD1234',
  tasks: [] as unknown[],
  ...overrides,
})

const task = (overrides: Record<string, unknown> = {}) => ({
  id: taskId,
  number: 'B1',
  type: 'descriptive',
  prompt: 'Draw a fictional lamp.',
  figures: [],
  options: [],
  maxMarks: 100,
  marks: null,
  feedback: null,
  uploads: [],
  ...overrides,
})

function client(handlers: Record<string, (args: Record<string, unknown>) => unknown>) {
  const upload = vi.fn(() => Promise.resolve({ data: {}, error: null }))
  return {
    upload,
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      const handler = handlers[name]
      return Promise.resolve(
        handler ? { data: handler(args), error: null } : { data: null, error: { code: 'XX000' } },
      )
    }),
    storage: {
      from: () => ({
        upload,
        createSignedUrls: (paths: string[]) =>
          Promise.resolve({
            data: paths.map((path) => ({ path, signedUrl: `https://local/${path}`, error: null })),
            error: null,
          }),
      }),
    },
  }
}

const routes = (
  <Routes>
    <Route path="/tests/part-b/:attemptId" element={<PartBPage />} />
    <Route path="/tests/results/:attemptId" element={<PartBResultCard attemptId={attemptId} />} />
    <Route path="/staff/part-b" element={<PartBQueuePage />} />
    <Route path="/staff/part-b/:attemptId" element={<PartBEvaluationPage />} />
  </Routes>
)

describe('Part B files', () => {
  it('accepts JPEG, PNG and PDF up to 10 MB', () => {
    expect(partBFileProblem(new File(['x'], 'a.png', { type: 'image/png' }))).toBeNull()
    expect(partBFileProblem(new File(['x'], 'a.svg', { type: 'image/svg+xml' }))).toMatch(
      /only JPEG/,
    )
    expect(partBFileProblem(new File([], 'a.pdf', { type: 'application/pdf' }))).toMatch(/empty/)
    const big = new File(['x'], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 })
    expect(partBFileProblem(big)).toMatch(/10 MB/)
  })
})

describe('Part B page', () => {
  beforeEach(() => {
    mocks.session = { user: { id: 'student-1', email: 'x@members.dexam.invalid' } }
  })

  it('begins, finishes drawing, uploads a sheet and submits', async () => {
    const user = userEvent.setup()
    let state = partB()
    const soon = () => new Date(Date.now() + 60 * 60_000).toISOString()
    const mock = client({
      get_part_b: () => state,
      begin_part_b: () =>
        (state = partB({ status: 'drawing', drawingDeadline: soon(), tasks: [task()] })),
      start_part_b_upload: () =>
        (state = { ...state, status: 'uploading', uploadDeadline: soon() }),
      register_part_b_upload: (args) => {
        state = {
          ...state,
          tasks: [
            task({ uploads: [{ path: args.p_storage_path, mimeType: 'image/png', bytes: 3 }] }),
          ],
        }
        return null
      },
      submit_part_b: () => (state = { ...state, status: 'submitted' }),
    })
    mocks.client = mock
    renderApp(routes, [`/tests/part-b/${attemptId}`])

    expect(await screen.findByText(/This paper has 1 drawing task/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Begin Part B' }))
    expect(await screen.findByRole('timer', { name: 'Drawing time left' })).toBeVisible()
    expect(screen.getByText('Draw a fictional lamp.')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'I have finished drawing' }))
    expect(await screen.findByRole('timer', { name: 'Upload time left' })).toBeVisible()
    await user.upload(
      screen.getByLabelText('Upload sheets for task 1'),
      new File(['png'], 'sheet.png', { type: 'image/png' }),
    )
    expect(await screen.findByRole('img', { name: 'Sheet 1 for task 1' })).toBeVisible()
    expect(mock.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${attemptId}/${taskId}/[0-9a-f-]{36}\\.png$`)),
      expect.any(File),
      { contentType: 'image/png', upsert: false },
    )

    await user.click(screen.getByRole('button', { name: 'Submit Part B' }))
    expect(await screen.findByText(/A Dexam evaluator will mark it/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to result' })).toHaveAttribute(
      'href',
      `/tests/results/${attemptId}`,
    )
  })

  it('runs a standalone drawing paper on its own clock and shows printed tasks', async () => {
    const user = userEvent.setup()
    const soon = new Date(Date.now() + 180 * 60_000).toISOString()
    let state = partB({
      kind: 'drawing',
      paperId: 'nid-bdes-dat-mock-01',
      exam: 'nid',
      available: 6,
      minutes: 180,
    })
    mocks.client = client({
      get_part_b: () => state,
      begin_part_b: () =>
        (state = {
          ...state,
          status: 'drawing',
          drawingDeadline: soon,
          tasks: [
            task({
              display: 'block',
              figures: [{ path: 'ab/printed.png', width: 600, height: 300 }],
            }),
          ],
        }),
    })
    renderApp(routes, [`/tests/part-b/${attemptId}`])
    expect(await screen.findByRole('heading', { name: 'Drawing paper' })).toBeVisible()
    expect(screen.getByText(/6 drawing tasks and 180 minutes of drawing time/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Back to drawing papers' })).toHaveAttribute(
      'href',
      '/tests/drawing',
    )
    await user.click(screen.getByRole('button', { name: 'Begin drawing' }))
    expect(await screen.findByRole('img', { name: 'Task 1, as printed' })).toHaveAttribute(
      'src',
      'https://local/ab/printed.png',
    )
  })

  it('refuses unsupported files before uploading', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const soon = new Date(Date.now() + 60 * 60_000).toISOString()
    const mock = client({
      get_part_b: () => partB({ status: 'uploading', uploadDeadline: soon, tasks: [task()] }),
    })
    mocks.client = mock
    renderApp(routes, [`/tests/part-b/${attemptId}`])
    await user.upload(
      await screen.findByLabelText('Upload sheets for task 1'),
      new File(['<svg/>'], 'drawing.svg', { type: 'image/svg+xml' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(/only JPEG, PNG or PDF/)
    expect(mock.upload).not.toHaveBeenCalled()
  })
})

describe('Part B results and evaluation', () => {
  beforeEach(() => {
    mocks.session = { user: { id: 'staff-1', email: 'x@dexam.invalid' } }
  })

  it('shows released marks, feedback and sheets on the result page', async () => {
    mocks.client = client({
      get_part_b: () =>
        partB({
          status: 'evaluated',
          score: 72,
          maxScore: 100,
          submittedAt: '2026-10-28T10:00:00+00:00',
          tasks: [
            task({
              marks: 72,
              feedback: 'Strong perspective.',
              uploads: [{ path: `${attemptId}/${taskId}/a.png`, mimeType: 'image/png', bytes: 3 }],
            }),
          ],
        }),
    })
    renderApp(routes, [`/tests/results/${attemptId}`])
    const card = await screen.findByRole('region', { name: 'Part B: drawing' })
    expect(within(card).getAllByText('72 / 100')).toHaveLength(2)
    expect(within(card).getByText(/Strong perspective/)).toBeVisible()
    expect(within(card).getByRole('img', { name: 'Sheet 1 for task 1' })).toBeVisible()
  })

  it('lets an evaluator mark anonymously and release', async () => {
    const user = userEvent.setup()
    let state = partB({ status: 'submitted', maxScore: 100, tasks: [task()] })
    const mock = client({
      list_part_b_queue: () => [
        {
          attemptId,
          paperId: 'ceed-2024',
          exam: 'ceed',
          status: 'submitted',
          submittedAt: '2026-10-28T10:00:00+00:00',
          reference: 'CAND-ABCD1234',
          tasks: 1,
          marked: 0,
          uploads: 1,
        },
      ],
      get_part_b: () => state,
      save_part_b_evaluation: () => {
        state = { ...state, tasks: [task({ marks: 64, feedback: 'Good.' })] }
        return null
      },
      release_part_b: () => {
        state = { ...state, status: 'evaluated', score: 64 }
        return null
      },
    })
    mocks.client = mock
    renderApp(routes, ['/staff/part-b'])
    expect(await screen.findByRole('rowheader', { name: 'CAND-ABCD1234' })).toBeVisible()

    renderApp(routes, [`/staff/part-b/${attemptId}`])
    const release = await screen.findByRole('button', { name: 'Release Part B result' })
    expect(release).toBeDisabled()
    await user.type(screen.getByRole('spinbutton', { name: 'Marks' }), '120')
    expect(screen.getByRole('button', { name: 'Save marks' })).toBeDisabled()
    await user.clear(screen.getByRole('spinbutton', { name: 'Marks' }))
    await user.type(screen.getByRole('spinbutton', { name: 'Marks' }), '64')
    await user.type(screen.getByRole('textbox', { name: 'Feedback for the candidate' }), 'Good.')
    await user.click(screen.getByRole('button', { name: 'Save marks' }))
    expect(mock.rpc).toHaveBeenCalledWith('save_part_b_evaluation', {
      p_attempt_id: attemptId,
      p_question_id: taskId,
      p_marks: 64,
      p_feedback: 'Good.',
    })
    await user.click(await screen.findByRole('button', { name: 'Release Part B result' }))
    expect(await screen.findByText('Released: 64 / 100.')).toBeVisible()
  })
})
