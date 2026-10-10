import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { AssignmentDistributionPage } from './AssignmentDistributionPage'

const mocks = vi.hoisted(() => ({
  getAssignmentDistributionTargets: vi.fn(),
  getAssignmentDistributionWorkspace: vi.fn(),
}))

vi.mock('../features/content/assignmentDistribution', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../features/content/assignmentDistribution')>()
  return {
    ...original,
    getAssignmentDistributionTargets: mocks.getAssignmentDistributionTargets,
    getAssignmentDistributionWorkspace: mocks.getAssignmentDistributionWorkspace,
  }
})

describe('AssignmentDistributionPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.getAssignmentDistributionTargets.mockReset()
    mocks.getAssignmentDistributionWorkspace.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('previews a deliberate cohort release without contacting live data', async () => {
    const user = userEvent.setup()
    renderApp(<AssignmentDistributionPage />, ['/staff/assignments?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Assignment distribution.' })).toBeVisible()
    expect(screen.getByLabelText('Published assignment')).toHaveValue('preview-assignment-version')
    await user.type(screen.getByLabelText('Release note'), 'Weekly perspective practice')
    await user.click(screen.getByRole('button', { name: 'Release assignment' }))

    expect(screen.getByText('Assignment released to the cohort.')).toBeVisible()
    expect(mocks.getAssignmentDistributionWorkspace).not.toHaveBeenCalled()
  })
})
