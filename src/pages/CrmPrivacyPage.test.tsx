import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderApp } from '../test/render'
import { CrmPrivacyPage } from './CrmPrivacyPage'

const mocks = vi.hoisted(() => ({
  listCrmPrivacyCases: vi.fn(),
  previewCrmErasure: vi.fn(),
}))

vi.mock('../features/crm/crmPrivacy', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/crm/crmPrivacy')>()
  return {
    ...original,
    listCrmPrivacyCases: mocks.listCrmPrivacyCases,
    previewCrmErasure: mocks.previewCrmErasure,
  }
})

describe('CrmPrivacyPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    mocks.listCrmPrivacyCases.mockReset()
    mocks.previewCrmErasure.mockReset()
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows masked case data and the protected erasure boundary', async () => {
    renderApp(<CrmPrivacyPage />, ['/staff/crm/privacy?preview=1'])

    expect(
      await screen.findByRole('heading', {
        name: 'Protect every enquiry through its full lifecycle.',
      }),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Kabir Mehta' })).toBeVisible()
    expect(screen.getByText('•••• 4018')).toBeVisible()
    expect(screen.getByText(/does not delete a canonical student/)).toBeVisible()
    expect(screen.getByText('Enrolment handoff')).toBeVisible()
    expect(screen.queryByText('+91 98111 14018')).not.toBeInTheDocument()
    expect(mocks.listCrmPrivacyCases).not.toHaveBeenCalled()
  })

  it('applies a field-scoped correction without retaining readable prior content', async () => {
    const user = userEvent.setup()
    renderApp(<CrmPrivacyPage />, ['/staff/crm/privacy?preview=1'])

    await user.click(screen.getByRole('button', { name: /Mira Kulkarni/ }))
    await user.selectOptions(screen.getByLabelText('Field to correct'), 'interest_summary')
    await user.type(screen.getByLabelText('Corrected value'), 'UCEED preparation')
    await user.type(
      screen.getByLabelText('Correction reason'),
      'Requester confirmed the intended exam',
    )
    await user.click(screen.getByRole('button', { name: 'Apply verified correction' }))

    expect(screen.getByText(/readable prior value was not copied/)).toBeVisible()
  })

  it('records an independent erasure approval after the dry run', async () => {
    const user = userEvent.setup()
    renderApp(<CrmPrivacyPage />, ['/staff/crm/privacy?preview=1'])

    await user.type(
      screen.getByLabelText('Decision note'),
      'Scope and protected student boundary independently confirmed',
    )
    await user.click(screen.getByRole('button', { name: 'Approve erasure' }))

    expect(screen.getByText(/Erasure approved for the trusted worker/)).toBeVisible()
    expect(screen.getByText(/Approved by You/)).toBeVisible()
  })

  it('releases a temporary hold without erasing its history', async () => {
    const user = userEvent.setup()
    renderApp(<CrmPrivacyPage />, ['/staff/crm/privacy?preview=1'])

    await user.click(screen.getByRole('button', { name: /Rhea Sen/ }))
    await user.type(
      screen.getByLabelText('Hold release reason'),
      'Review completed without a continuing retention purpose',
    )
    await user.click(screen.getByRole('button', { name: 'Release hold' }))

    expect(screen.getByText(/Temporary hold released/)).toBeVisible()
  })

  it('fails closed when the protected live queue cannot be loaded', async () => {
    vi.unstubAllEnvs()
    mocks.listCrmPrivacyCases.mockRejectedValueOnce(new Error('unavailable'))
    renderApp(<CrmPrivacyPage />, ['/staff/crm/privacy'])

    expect(
      await screen.findByRole('heading', { name: 'Privacy operations could not be loaded.' }),
    ).toBeVisible()
    expect(screen.getByText(/No case or personal data was exposed/)).toBeVisible()
  })
})
