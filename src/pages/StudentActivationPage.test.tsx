import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { StudentActivationPage } from './StudentActivationPage'
import { renderApp } from '../test/render'

describe('StudentActivationPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'local-anon-key')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('validates password confirmation before contacting the activation service', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    renderApp(<StudentActivationPage />)

    await user.type(screen.getByLabelText('Dexam Member ID'), 'DXM-7K3M9Q2RW5TY')
    await user.type(screen.getByLabelText('One-time activation code'), 'ABCD234567')
    await user.type(screen.getByLabelText('Create password'), 'a long password phrase')
    await user.type(screen.getByLabelText('Confirm password'), 'a different password')
    await user.click(screen.getByRole('button', { name: 'Activate account' }))

    expect(screen.getByRole('alert')).toHaveTextContent('The passwords do not match.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('submits normalized activation details and confirms success', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Your Dexam account is ready.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    renderApp(<StudentActivationPage />)

    await user.type(screen.getByLabelText('Dexam Member ID'), 'dxm-7k3m9q2rw5ty')
    await user.type(screen.getByLabelText('One-time activation code'), 'abcd-234-567')
    await user.type(screen.getByLabelText('Create password'), 'a long password phrase')
    await user.type(screen.getByLabelText('Confirm password'), 'a long password phrase')
    await user.click(screen.getByRole('button', { name: 'Activate account' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Your Dexam account is ready.')
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:54321/functions/v1/student-activate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          memberId: 'DXM-7K3M9Q2RW5TY',
          credential: 'ABCD234567',
          credentialType: 'backup',
          password: 'a long password phrase',
        }),
      }),
    )
  })
})
