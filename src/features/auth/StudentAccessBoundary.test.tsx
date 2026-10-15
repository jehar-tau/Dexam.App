import { act, screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'

import type { AuthContextValue } from './AuthContext'
import { renderApp } from '../../test/render'
import { StudentAccessBoundary } from './StudentAccessBoundary'

const mocks = vi.hoisted(() => ({
  auth: undefined as AuthContextValue | undefined,
  getStudentAccess: vi.fn(),
}))

vi.mock('./AuthContext', async (importOriginal) => {
  const original = await importOriginal<typeof import('./AuthContext')>()
  return { ...original, useAuth: () => mocks.auth }
})

vi.mock('./studentAuth', () => ({ getStudentAccess: mocks.getStudentAccess }))

function renderBoundary(path = '/student') {
  return renderApp(
    <Routes>
      <Route
        path="/student/*"
        element={
          <StudentAccessBoundary>
            <h1>Protected student workspace</h1>
          </StudentAccessBoundary>
        }
      />
      <Route path="/sign-in" element={<h1>Student sign in</h1>} />
    </Routes>,
    [path],
  )
}

describe('StudentAccessBoundary', () => {
  beforeEach(() => {
    mocks.auth = {
      configured: true,
      initializing: false,
      session: { user: { id: 'student-auth-id' } } as AuthContextValue['session'],
      signInEmployee: vi.fn().mockResolvedValue(undefined),
      signInStudent: vi.fn().mockResolvedValue(undefined),
      signOut: vi.fn().mockResolvedValue(undefined),
    }
    mocks.getStudentAccess.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it.each(['revoked', 'unverifiable'])(
    'hides an open workspace when membership becomes %s',
    async (state) => {
      vi.useFakeTimers()
      mocks.getStudentAccess.mockResolvedValue(true)
      renderBoundary()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })
      expect(screen.getByText('Protected student workspace')).toBeVisible()
      if (state === 'revoked') mocks.getStudentAccess.mockResolvedValue(false)
      else mocks.getStudentAccess.mockRejectedValue(new Error('Offline'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_010)
      })
      expect(screen.queryByText('Protected student workspace')).not.toBeInTheDocument()
      expect(
        screen.getByRole('heading', {
          name:
            state === 'revoked'
              ? 'This student workspace is not available.'
              : 'We could not verify your access.',
        }),
      ).toBeVisible()
    },
  )

  it('redirects a signed-out visitor to student sign in', async () => {
    mocks.auth = { ...mocks.auth!, session: null }
    renderBoundary()

    expect(await screen.findByRole('heading', { name: 'Student sign in' })).toBeVisible()
    expect(mocks.getStudentAccess).not.toHaveBeenCalled()
  })

  it('opens only after current student membership is confirmed', async () => {
    mocks.getStudentAccess.mockResolvedValue(true)
    renderBoundary()

    expect(
      await screen.findByRole('heading', { name: 'Protected student workspace' }),
    ).toBeVisible()
  })

  it('blocks a stale session whose student membership is no longer active', async () => {
    mocks.getStudentAccess.mockResolvedValue(false)
    renderBoundary()

    expect(
      await screen.findByRole('heading', { name: 'This student workspace is not available.' }),
    ).toBeVisible()
    expect(screen.queryByRole('heading', { name: 'Protected student workspace' })).toBeNull()
  })

  it('allows the explicit fictional preview without a session', () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    mocks.auth = { ...mocks.auth!, configured: false, session: null }
    renderBoundary('/student?preview=1')

    expect(screen.getByRole('heading', { name: 'Protected student workspace' })).toBeVisible()
    expect(mocks.getStudentAccess).not.toHaveBeenCalled()
  })
})
