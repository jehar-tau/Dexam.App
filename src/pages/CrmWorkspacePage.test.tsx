import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { CrmWorkspacePage } from './CrmWorkspacePage'

const mocks = vi.hoisted(() => ({ listCrmEnquiries: vi.fn() }))

vi.mock('../features/crm/crm', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/crm/crm')>()
  return { ...original, listCrmEnquiries: mocks.listCrmEnquiries }
})

describe('CrmWorkspacePage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.listCrmEnquiries.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows the assigned fictional queue and privacy boundary', async () => {
    renderApp(<CrmWorkspacePage />, ['/staff/crm?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Assigned enquiries.' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Aarav Kulkarni' })).toBeVisible()
    expect(screen.getByText('+91 98765 43210')).toBeVisible()
    expect(screen.getByText(/not promotional marketing consent/)).toBeVisible()
    expect(mocks.listCrmEnquiries).not.toHaveBeenCalled()
  })

  it('requests enrolment review without claiming student access was created', async () => {
    const user = userEvent.setup()
    renderApp(<CrmWorkspacePage />, ['/staff/crm?preview=1'])

    await user.click(screen.getByRole('button', { name: /Meera Patel/ }))
    expect(screen.getByRole('heading', { name: 'Meera Patel' })).toBeVisible()
    expect(screen.getByText('Possible existing person')).toBeVisible()
    await user.type(
      screen.getByLabelText('Handoff note'),
      'Prospect requested the fictional foundation programme.',
    )
    await user.click(screen.getByRole('button', { name: 'Request review' }))

    expect(screen.getByText(/Student access has not been created/)).toBeVisible()
    expect(screen.getByText('Enrolment Review Requested')).toBeVisible()
  })

  it('creates a fictional assigned enquiry without creating an account', async () => {
    const user = userEvent.setup()
    renderApp(<CrmWorkspacePage />, ['/staff/crm?preview=1'])

    await user.click(screen.getByRole('button', { name: 'Add enquiry' }))
    await user.type(screen.getByLabelText('Prospect name'), 'Ishaan Verma')
    await user.type(screen.getByLabelText('Phone'), '+919812345678')
    await user.type(screen.getByLabelText('Target intake'), '2027 entrance')
    await user.type(screen.getByLabelText('Area of interest'), 'UCEED foundation preparation')
    await user.click(screen.getByRole('button', { name: 'Create assigned enquiry' }))

    expect(screen.getByText(/No student account was created/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Ishaan Verma' })).toBeVisible()
  })

  it('moves an enquiry to the seven-day dead area and restores the same record', async () => {
    const user = userEvent.setup()
    renderApp(<CrmWorkspacePage />, ['/staff/crm?preview=1'])

    await user.type(
      screen.getByLabelText('Why is this enquiry dead?'),
      'No response after the agreed follow-up period.',
    )
    await user.click(screen.getByRole('button', { name: 'Move to dead enquiries' }))

    expect(screen.getByText(/moved to Recently dead/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Recently dead' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Dead enquiry')).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Log activity' })).not.toBeInTheDocument()

    await user.type(
      screen.getByLabelText('Why are you restoring this enquiry?'),
      'The prospect contacted Dexam again.',
    )
    await user.click(screen.getByRole('button', { name: 'Restore to active queue' }))

    expect(screen.getByText(/restored to the active queue/)).toBeVisible()
    expect(screen.getAllByText('Contact In Progress')).toHaveLength(2)
    expect(screen.getByRole('heading', { name: 'Log activity' })).toBeVisible()
  })

  it('keeps dead enquiries older than seven days in the common archive', async () => {
    const user = userEvent.setup()
    renderApp(<CrmWorkspacePage />, ['/staff/crm?preview=1'])

    await user.click(screen.getByRole('button', { name: 'Dead archive' }))

    expect(screen.getByRole('heading', { name: 'Dev Malhotra' })).toBeVisible()
    expect(screen.getByText(/Archived 6 Oct 2026/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Restore to active queue' })).toBeDisabled()
  })

  it('fails safely when the live CRM queue cannot be loaded', async () => {
    vi.unstubAllEnvs()
    mocks.listCrmEnquiries.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([])
    renderApp(<CrmWorkspacePage />, ['/staff/crm'])

    expect(
      await screen.findByRole('heading', { name: 'The CRM workspace could not be loaded.' }),
    ).toBeVisible()
  })
})
