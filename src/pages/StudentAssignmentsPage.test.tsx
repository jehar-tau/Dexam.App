import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { StudentAssignmentsPage } from './StudentAssignmentsPage'

const mocks = vi.hoisted(() => ({ getStudentAssignments: vi.fn() }))

vi.mock('../features/student/studentAssignments', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/student/studentAssignments')>()
  return { ...original, getStudentAssignments: mocks.getStudentAssignments }
})

describe('StudentAssignmentsPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    mocks.getStudentAssignments.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows the fictional assignment and starts a private draft in preview', async () => {
    const user = userEvent.setup()
    renderApp(<StudentAssignmentsPage />, ['/student/assignments?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Your assignments.' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Draw a one-point perspective room' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Start submission' }))
    expect(screen.getByRole('heading', { name: 'Submission files' })).toBeVisible()
    expect(screen.getByText(/Images are optimized on this device/)).toBeVisible()
    expect(mocks.getStudentAssignments).not.toHaveBeenCalled()
  })

  it('shows immutable attempt history for submitted work', async () => {
    const user = userEvent.setup()
    renderApp(<StudentAssignmentsPage />, ['/student/assignments?preview=1'])
    await user.click(screen.getByRole('button', { name: /Line confidence practice/ }))

    expect(screen.getByRole('heading', { name: 'Attempt history' })).toBeVisible()
    expect(screen.getByText('Attempt 1')).toBeVisible()
    expect(screen.getByText(/1 file/)).toBeVisible()
  })
})
