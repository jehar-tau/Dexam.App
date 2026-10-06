import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import type { AuthContextValue } from '../features/auth/AuthContext'
import { renderApp } from '../test/render'
import { StaffSignInPage } from './StaffSignInPage'

const auth = vi.hoisted(() => ({
  value: undefined as AuthContextValue | undefined,
}))

vi.mock('../features/auth/AuthContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/auth/AuthContext')>()
  return {
    ...original,
    useAuth: () => auth.value,
  }
})

describe('StaffSignInPage', () => {
  beforeEach(() => {
    auth.value = {
      configured: true,
      initializing: false,
      session: null,
      signIn: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    }
  })

  it('submits the employee email and password without exposing account existence', async () => {
    const user = userEvent.setup()
    renderApp(<StaffSignInPage />, ['/staff/sign-in'])

    await user.type(screen.getByLabelText('Employee email'), 'operator@dexam.test ')
    await user.type(screen.getByLabelText('Password'), 'a secure password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(auth.value?.signIn).toHaveBeenCalledWith('operator@dexam.test', 'a secure password')
  })

  it('shows the safe generic error returned by the auth service', async () => {
    const user = userEvent.setup()
    auth.value!.signIn = vi
      .fn()
      .mockRejectedValue(new Error('We could not sign you in. Check your details and try again.'))
    renderApp(<StaffSignInPage />)

    await user.type(screen.getByLabelText('Employee email'), 'unknown@dexam.test')
    await user.type(screen.getByLabelText('Password'), 'wrong password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not sign you in. Check your details and try again.',
    )
  })

  it('keeps the form visible but disabled when auth is not configured', () => {
    auth.value!.configured = false
    renderApp(<StaffSignInPage />)

    expect(
      screen.getByText('Employee sign-in is not configured in this environment yet.'),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
  })
})
