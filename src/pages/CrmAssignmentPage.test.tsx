import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { CrmAssignmentPage } from './CrmAssignmentPage'

const mocks = vi.hoisted(() => ({
  listCrmAssignmentQueue: vi.fn(),
  listCrmEligibleOwners: vi.fn(),
}))

vi.mock('../features/crm/crmAssignment', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/crm/crmAssignment')>()
  return {
    ...original,
    listCrmAssignmentQueue: mocks.listCrmAssignmentQueue,
    listCrmEligibleOwners: mocks.listCrmEligibleOwners,
  }
})

describe('CrmAssignmentPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.listCrmAssignmentQueue.mockReset()
    mocks.listCrmEligibleOwners.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows only minimum allocation details in the fictional unassigned queue', async () => {
    renderApp(<CrmAssignmentPage />, ['/staff/crm/assignments?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Assign enquiries.' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Rohan Desai' })).toBeVisible()
    expect(screen.getByText(/shows only allocation details/)).toBeVisible()
    expect(screen.queryByText(/@example\.test/)).not.toBeInTheDocument()
    expect(mocks.listCrmAssignmentQueue).not.toHaveBeenCalled()
  })

  it('assigns exactly one fictional enquiry with a reason', async () => {
    const user = userEvent.setup()
    renderApp(<CrmAssignmentPage />, ['/staff/crm/assignments?preview=1'])

    await user.selectOptions(screen.getByLabelText('Active Sales owner'), 'preview-owner-sameer')
    await user.type(screen.getByLabelText('Assignment reason'), 'Balanced current workload')
    await user.click(screen.getByRole('button', { name: 'Assign to Sameer Joshi' }))

    expect(screen.getByText(/Rohan Desai was assigned to Sameer Joshi/)).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Rohan Desai' })).not.toBeInTheDocument()
    expect(screen.getByText('1 waiting')).toBeVisible()
  })

  it('explains inactive-owner recovery without restoring prior access', async () => {
    const user = userEvent.setup()
    renderApp(<CrmAssignmentPage />, ['/staff/crm/assignments?preview=1'])

    await user.click(screen.getByRole('button', { name: 'Needs reassignment' }))

    expect(screen.getByRole('heading', { name: 'Anaya Rao' })).toBeVisible()
    expect(screen.getByText('Isha Menon')).toBeVisible()
    expect(screen.getByText(/without restoring the previous employee's access/)).toBeVisible()
  })

  it('fails closed when live assignment data cannot be loaded', async () => {
    vi.unstubAllEnvs()
    mocks.listCrmAssignmentQueue.mockRejectedValueOnce(new Error('unavailable'))
    mocks.listCrmEligibleOwners.mockResolvedValueOnce([])
    renderApp(<CrmAssignmentPage />, ['/staff/crm/assignments'])

    expect(
      await screen.findByRole('heading', { name: 'CRM assignment could not be loaded.' }),
    ).toBeVisible()
    expect(screen.getByText(/No allocation data was exposed/)).toBeVisible()
  })
})
