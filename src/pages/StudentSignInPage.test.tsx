import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '../features/auth/AuthContext'
import { renderApp } from '../test/render'
import { StudentSignInPage } from './StudentSignInPage'

const auth = vi.hoisted(() => ({ value: undefined as AuthContextValue | undefined }))

vi.mock('../features/auth/AuthContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/auth/AuthContext')>()
  return { ...original, useAuth: () => auth.value }
})

describe('StudentSignInPage', () => {
  beforeEach(() => {
    auth.value = {
      configured: true,
      initializing: false,
      session: null,
      signInEmployee: vi.fn().mockResolvedValue(undefined),
      signInStudent: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('submits the Member ID and password to the student auth service', async () => {
    const user = userEvent.setup()
    renderApp(<StudentSignInPage />, ['/sign-in'])

    await user.type(screen.getByLabelText('Dexam Member ID'), 'dxm-7k3m9q2rw5ty')
    await user.type(screen.getByLabelText('Password'), 'a secure password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(auth.value?.signInStudent).toHaveBeenCalledWith('dxm-7k3m9q2rw5ty', 'a secure password')
  })

  it('shows the generic auth-service error', async () => {
    const user = userEvent.setup()
    auth.value!.signInStudent = vi
      .fn()
      .mockRejectedValue(new Error('We could not sign you in. Check your details and try again.'))
    renderApp(<StudentSignInPage />)

    await user.type(screen.getByLabelText('Dexam Member ID'), 'DXM-7K3M9Q2RW5TY')
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you in. Check your details and try again.',
    )
  })

  it('keeps sign in disabled when auth is not configured', () => {
    auth.value!.configured = false
    renderApp(<StudentSignInPage />)

    expect(
      screen.getByText('Student sign-in is not configured in this environment yet.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
})
