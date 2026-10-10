import { screen } from '@testing-library/react'

import { renderApp } from '../test/render'
import { StudentWorkspacePage } from './StudentWorkspacePage'

const mocks = vi.hoisted(() => ({ getStudentWorkspace: vi.fn() }))

vi.mock('../features/student/getStudentWorkspace', () => ({
  getStudentWorkspace: mocks.getStudentWorkspace,
}))

describe('StudentWorkspacePage', () => {
  beforeEach(() => mocks.getStudentWorkspace.mockReset())

  afterEach(() => vi.unstubAllEnvs())

  it('shows only the signed-in student identity and enrolments', async () => {
    mocks.getStudentWorkspace.mockResolvedValue({
      displayName: 'Aarohi Deshmukh',
      memberId: 'DXM-2K3M9Q2RW5TY',
      enrollments: [
        {
          enrollmentId: 'enrolment-id',
          offeringTitle: 'Design Entrance Foundation',
          cohortName: 'Studio Batch',
          status: 'active',
          approvedAt: null,
          activatedAt: null,
        },
      ],
    })
    renderApp(<StudentWorkspacePage />, ['/student'])

    expect(await screen.findByRole('heading', { name: 'Welcome, Aarohi.' })).toBeVisible()
    expect(screen.getByText('DXM-2K3M9Q2RW5TY')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Design Entrance Foundation' })).toBeVisible()
    expect(screen.getByText('Studio Batch')).toBeVisible()
    expect(screen.getByRole('link', { name: /Open coursework/ })).toHaveAttribute(
      'href',
      '/student/coursework',
    )
    expect(screen.getByRole('link', { name: /Open assignments/ })).toHaveAttribute(
      'href',
      '/student/assignments',
    )
  })

  it('shows a helpful empty state before the first enrolment', async () => {
    mocks.getStudentWorkspace.mockResolvedValue({
      displayName: null,
      memberId: 'DXM-2K3M9Q2RW5TY',
      enrollments: [],
    })
    renderApp(<StudentWorkspacePage />)

    expect(await screen.findByText('No enrolments yet')).toBeVisible()
  })

  it('uses explicit fictional data only in enabled preview mode', async () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    renderApp(<StudentWorkspacePage />, ['/student?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Welcome, Aarohi.' })).toBeVisible()
    expect(screen.getByText(/Student workspace · Local preview/)).toBeVisible()
    expect(screen.getByRole('link', { name: /Open coursework/ })).toHaveAttribute(
      'href',
      '/student/coursework?preview=1',
    )
    expect(screen.getByRole('link', { name: /Open assignments/ })).toHaveAttribute(
      'href',
      '/student/assignments?preview=1',
    )
    expect(mocks.getStudentWorkspace).not.toHaveBeenCalled()
  })
})
