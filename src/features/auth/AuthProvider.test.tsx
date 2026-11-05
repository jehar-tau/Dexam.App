import { act, render } from '@testing-library/react'

import { ObjectUrlBundle } from '../files/protectedFiles'
import { AuthProvider } from './AuthProvider'

const mocks = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: unknown) => void),
}))
vi.mock('./supabaseClient', () => {
  const client = {
    auth: {
      getSession: () => new Promise(() => {}),
      onAuthStateChange: (listener: (event: string, session: unknown) => void) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  }
  return { getSupabaseClient: () => client }
})

const session = (id: string) => ({ user: { id } })

describe('auth provider private files', () => {
  it('keeps private files across token refresh and revokes them when the account changes', () => {
    render(<AuthProvider>content</AuthProvider>)
    act(() => mocks.listener!('INITIAL_SESSION', session('fictional-a')))
    const opened = new ObjectUrlBundle()
    opened.retain()
    opened.add(new Blob(['a']))
    act(() => mocks.listener!('TOKEN_REFRESHED', session('fictional-a')))
    expect(opened.revoked).toBe(false)
    act(() => mocks.listener!('SIGNED_IN', session('fictional-b')))
    expect(opened.revoked).toBe(true)

    const next = new ObjectUrlBundle()
    next.retain()
    act(() => mocks.listener!('SIGNED_OUT', null))
    expect(next.revoked).toBe(true)
  })
})
