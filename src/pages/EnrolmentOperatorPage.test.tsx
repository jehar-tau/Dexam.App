import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { EnrolmentOperatorPage } from './EnrolmentOperatorPage'
import { renderApp } from '../test/render'

describe('EnrolmentOperatorPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('requires a final review before issuing an activation pack', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments?preview=1'])

    expect(screen.getByRole('heading', { name: 'Activation queue' })).toBeVisible()
    expect(screen.getByText('Aarohi Deshmukh')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Review enrolment' }))

    expect(screen.getByRole('heading', { name: 'Issue activation pack?' })).toBeVisible()
    expect(screen.getByText('The student creates their own password.')).toBeVisible()
  })

  it('shows the one-time credentials after confirmed issuance', async () => {
    const user = userEvent.setup()
    renderApp(<EnrolmentOperatorPage />, ['/staff/enrolments?preview=1'])

    await user.click(screen.getByRole('button', { name: 'Review enrolment' }))
    await user.click(screen.getByRole('button', { name: 'Issue activation pack' }))

    expect(
      await screen.findByRole('heading', { name: 'Hand this directly to the student.' }),
    ).toBeVisible()
    expect(screen.getByText('DXM-2K3M9Q2RW5TY')).toBeVisible()
    expect(screen.getByText('7K3M9Q2RW5')).toBeVisible()
  })
})
