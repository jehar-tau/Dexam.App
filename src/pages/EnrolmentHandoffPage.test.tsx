import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { EnrolmentHandoffPage } from './EnrolmentHandoffPage'

const mocks = vi.hoisted(() => ({
  listChoices: vi.fn(),
  listHandoffs: vi.fn(),
  listCandidates: vi.fn(),
}))

vi.mock('../features/enrolment/enrolmentHandoff', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/enrolment/enrolmentHandoff')>()
  return {
    ...original,
    listEnrolmentHandoffChoices: mocks.listChoices,
    listEnrolmentHandoffs: mocks.listHandoffs,
    listEnrolmentIdentityCandidates: mocks.listCandidates,
  }
})

describe('EnrolmentHandoffPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.listChoices.mockReset()
    mocks.listHandoffs.mockReset()
    mocks.listCandidates.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows a fictional pending request and never auto-merges a weak match', async () => {
    renderApp(<EnrolmentHandoffPage />, ['/staff/enrolment-handoffs?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Review enrolment handoffs.' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Meera Kulkarni' })).toBeVisible()
    expect(screen.getByText(/never merges people automatically/)).toBeVisible()
    expect(screen.getByLabelText('Different people')).not.toBeChecked()
    expect(screen.getByLabelText('Same person')).not.toBeChecked()
    expect(mocks.listHandoffs).not.toHaveBeenCalled()
  })

  it('approves one new student only after identity, course, and reason are confirmed', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentHandoffPage />, ['/staff/enrolment-handoffs?preview=1'])

    await user.click(screen.getByLabelText('Different people'))
    await user.selectOptions(
      screen.getByLabelText('Course and cohort'),
      'preview-offering-foundation|preview-cohort-weekend',
    )
    await user.type(screen.getByLabelText('Approval reason'), 'Identity and course confirmed.')
    await user.click(screen.getByRole('button', { name: 'Approve enrolment' }))

    expect(screen.getByText(/added to the activation queue/)).toBeVisible()
    expect(screen.getByText(/DXM-3F7K9M2RW5TY/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Meera Kulkarni' })).not.toBeInTheDocument()
  })

  it('searches and reuses an existing claimed student', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentHandoffPage />, ['/staff/enrolment-handoffs?preview=1'])

    await user.click(screen.getByLabelText('Use an existing student'))
    await user.type(screen.getByLabelText('Find existing student'), 'Anika')
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.click(screen.getByLabelText(/Anika Kulkarni/))
    await user.click(screen.getByLabelText('Same person'))
    await user.selectOptions(
      screen.getByLabelText('Course and cohort'),
      'preview-offering-foundation|preview-cohort-weekend',
    )
    await user.type(screen.getByLabelText('Approval reason'), 'Canonical account confirmed.')
    await user.click(screen.getByRole('button', { name: 'Approve enrolment' }))

    expect(
      screen.getByText(/linked to the existing account and enrolled immediately/),
    ).toBeVisible()
    expect(screen.getByText(/DXM-7K3M9Q2RW5TY/)).toBeVisible()
  })

  it('returns a request to Sales without creating access', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentHandoffPage />, ['/staff/enrolment-handoffs?preview=1'])

    await user.type(screen.getByLabelText('Return reason'), 'Confirm the intended cohort.')
    await user.click(screen.getByRole('button', { name: 'Return request' }))

    expect(screen.getByText(/returned to Sales. No student access was created/)).toBeVisible()
  })

  it('fails closed when live protected data cannot be loaded', async () => {
    vi.unstubAllEnvs()
    mocks.listHandoffs.mockRejectedValueOnce(new Error('unavailable'))
    mocks.listChoices.mockResolvedValueOnce([])
    renderApp(<EnrolmentHandoffPage />, ['/staff/enrolment-handoffs'])

    expect(await screen.findByText('The handoff inbox could not be loaded.')).toBeVisible()
    expect(screen.getByText(/No protected identity data was exposed/)).toBeVisible()
  })
})
