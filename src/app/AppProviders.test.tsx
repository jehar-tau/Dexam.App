import { act, fireEvent, render, screen } from '@testing-library/react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { StrictMode, useState } from 'react'
import { AppProviders } from './AppProviders'
import { useAuth } from '../features/auth/AuthContext'

const mocks = vi.hoisted(() => ({
  listener: undefined as ((event: string, session: Session | null) => void) | undefined,
  load: vi.fn<(id: string) => Promise<string>>(),
  signInEmployee: vi.fn(),
  signInStudent: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn<() => Promise<{ data: { session: Session | null } }>>(),
}))
vi.mock('../features/auth/employeeAuth', () => ({
  signInEmployee: mocks.signInEmployee,
  signOutCurrentSession: mocks.signOut,
}))
vi.mock('../features/auth/studentAuth', () => ({ signInStudent: mocks.signInStudent }))
vi.mock('../features/auth/supabaseClient', () => {
  const client = {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: (listener: typeof mocks.listener) => {
        mocks.listener = listener
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      },
    },
  }
  return { getSupabaseClient: () => client }
})
const clients: QueryClient[] = []
function Workspace() {
  const { session, signInEmployee, signInStudent, signOut } = useAuth()
  const client = useQueryClient()
  if (!clients.includes(client)) clients.push(client)
  const [draft, setDraft] = useState('')
  const query = useQuery({
    queryKey: ['legacy-private-key'],
    queryFn: () => mocks.load(session!.user.id),
    enabled: Boolean(session),
    staleTime: Infinity,
    retry: false,
  })
  return (
    <>
      <p>{session?.user.id ?? 'signed out'}</p>
      <button onClick={() => void signInEmployee('fictional', 'fictional')}>
        Employee sign in
      </button>
      <button onClick={() => void signInStudent('fictional', 'fictional')}>Student sign in</button>
      <button onClick={() => void signOut()}>Sign out</button>
      <p>{query.data ?? 'No private result'}</p>
      <input aria-label="Private draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
    </>
  )
}
async function authenticate(id: string | null, expiresAt = 1) {
  await act(async () => {
    await Promise.resolve()
    mocks.listener?.(
      id ? 'SIGNED_IN' : 'SIGNED_OUT',
      id ? ({ user: { id }, expires_at: expiresAt } as Session) : null,
    )
  })
}
describe('account workspace isolation', () => {
  beforeEach(() => {
    clients.length = 0
    mocks.load.mockReset().mockImplementation((id) => Promise.resolve(`Private result for ${id}`))
    mocks.signInEmployee.mockReset()
    mocks.signInStudent.mockReset()
    mocks.signOut.mockReset()
    mocks.getSession.mockReset().mockResolvedValue({ data: { session: null } })
  })
  it('does not restore an older startup lookup after a newer event, including StrictMode', async () => {
    let finish!: (value: { data: { session: Session } }) => void
    const pending = new Promise<{ data: { session: Session } }>((resolve) => {
      finish = resolve
    })
    mocks.getSession.mockReturnValue(pending)
    render(
      <StrictMode>
        <AppProviders>
          <Workspace />
        </AppProviders>
      </StrictMode>,
    )
    await authenticate('second')
    expect(await screen.findByText('Private result for second')).toBeVisible()
    await act(async () => {
      finish({ data: { session: { user: { id: 'first' } } as Session } })
      await pending
    })
    expect(screen.getByText('second')).toBeVisible()
    expect(screen.queryByText('first')).not.toBeInTheDocument()
  })
  it.each(['Employee', 'Student'])(
    'ignores late %s sign-in completion after a newer auth event',
    async (kind) => {
      let finish!: (value: Session) => void
      const operation = kind === 'Employee' ? mocks.signInEmployee : mocks.signInStudent
      operation.mockImplementation(
        () =>
          new Promise<Session>((resolve) => {
            finish = resolve
          }),
      )
      render(
        <AppProviders>
          <Workspace />
        </AppProviders>,
      )
      fireEvent.click(screen.getByText(`${kind} sign in`))
      await authenticate('second')
      expect(await screen.findByText('Private result for second')).toBeVisible()
      await act(async () => {
        await Promise.resolve()
        finish({ user: { id: 'first' } } as Session)
      })
      expect(screen.getByText('second')).toBeVisible()
      expect(screen.queryByText('first')).not.toBeInTheDocument()
    },
  )
  it('ignores late sign-out completion after a newer sign-in event', async () => {
    let finish!: () => void
    mocks.signOut.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        }),
    )
    render(
      <AppProviders>
        <Workspace />
      </AppProviders>,
    )
    await authenticate('first')
    fireEvent.click(screen.getByText('Sign out'))
    await authenticate('second')
    expect(await screen.findByText('Private result for second')).toBeVisible()
    await act(async () => {
      await Promise.resolve()
      finish()
    })
    expect(screen.getByText('second')).toBeVisible()
  })
  it('isolates legacy query keys and local drafts on direct account switch', async () => {
    render(
      <AppProviders>
        <Workspace />
      </AppProviders>,
    )
    await authenticate('first')
    expect(await screen.findByText('Private result for first')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Private draft'), { target: { value: 'first draft' } })
    const retired = clients.at(-1)!
    await authenticate('second')
    expect(screen.queryByText('Private result for first')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Private draft')).toHaveValue('')
    expect(await screen.findByText('Private result for second')).toBeVisible()
    expect(retired.getQueryCache().getAll()).toHaveLength(0)
    expect(clients.at(-1)).not.toBe(retired)
  })
  it('clears sign-out and cannot restore an old pending response into a new account', async () => {
    let finish!: (value: string) => void
    mocks.load.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    render(
      <AppProviders>
        <Workspace />
      </AppProviders>,
    )
    await authenticate('first')
    await authenticate(null)
    expect(screen.getByText('No private result')).toBeVisible()
    await authenticate('second')
    expect(await screen.findByText('Private result for second')).toBeVisible()
    await act(async () => {
      await Promise.resolve()
      finish('Late private result for first')
    })
    expect(screen.queryByText('Late private result for first')).not.toBeInTheDocument()
    expect(clients.at(-1)!.getQueryData(['legacy-private-key'])).toBe('Private result for second')
  })
  it('preserves drafts and the same cache on routine same-account refresh', async () => {
    render(
      <AppProviders>
        <Workspace />
      </AppProviders>,
    )
    await authenticate('first')
    expect(await screen.findByText('Private result for first')).toBeVisible()
    const current = clients.at(-1)
    fireEvent.change(screen.getByLabelText('Private draft'), { target: { value: 'unfinished' } })
    await authenticate('first', 2)
    expect(screen.getByLabelText('Private draft')).toHaveValue('unfinished')
    expect(clients.at(-1)).toBe(current)
    expect(mocks.load).toHaveBeenCalledTimes(1)
  })
})
