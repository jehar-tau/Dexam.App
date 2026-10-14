import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import { renderApp } from '../test/render'
import { NotificationCentrePage } from './NotificationCentrePage'

const mocks = vi.hoisted(() => ({ getNotifications: vi.fn(), userId: 'fictional-first' }))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: mocks.userId } } }),
}))

vi.mock('../features/notifications/notifications', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/notifications/notifications')>()
  return { ...original, getNotifications: mocks.getNotifications }
})

describe('NotificationCentrePage', () => {
  beforeEach(() => {
    mocks.getNotifications.mockReset()
    mocks.userId = 'fictional-first'
  })

  afterEach(() => vi.unstubAllEnvs())

  it('shows, filters, and marks fictional student notifications read', async () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    const user = userEvent.setup()
    renderApp(<NotificationCentrePage />, ['/student/notifications?preview=1'])

    expect(await screen.findByRole('heading', { name: 'Notifications.' })).toBeVisible()
    expect(screen.getByLabelText('2 unread notifications')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Correction requested' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Teacher feedback available' })).toBeVisible()

    await user.click(screen.getAllByRole('button', { name: 'Mark as read' })[0]!)
    expect(screen.getByLabelText('1 unread notifications')).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Unread (1)' }))
    expect(screen.queryByRole('heading', { name: 'Correction requested' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(screen.getByText('You are all caught up')).toBeVisible()
    expect(mocks.getNotifications).not.toHaveBeenCalled()
  })

  it('shows teacher review destinations only in the staff preview', async () => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    renderApp(<NotificationCentrePage />, ['/staff/notifications?preview=1'])

    expect(await screen.findByLabelText('2 unread notifications')).toBeVisible()
    const links = screen.getAllByRole('link', { name: /Open update/ })
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute(
      'href',
      '/staff/reviews?preview=1&instance=preview-instance-one',
    )
    expect(links[1]).toHaveAttribute(
      'href',
      '/staff/reviews?preview=1&instance=preview-instance-two',
    )
  })

  it('shows safe CRM destinations in the Sales preview', async () => {
    vi.stubEnv('VITE_ENABLE_OPERATOR_PREVIEW', 'true')
    renderApp(<NotificationCentrePage />, ['/staff/notifications?preview=1&audience=sales'])

    expect(await screen.findByText('Admissions updates · Local preview')).toBeVisible()
    expect(
      screen.getByText('Important enquiry updates, linked back to their protected source.'),
    ).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Lead follow-up due' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'New enquiry assigned' })).toBeVisible()
    expect(screen.queryByText('Aarav Kulkarni')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Open update/ })[0]).toHaveAttribute(
      'href',
      '/staff/crm?preview=1&enquiry=preview-enquiry-aarav',
    )
  })

  it('fails safely when live notifications cannot be loaded', async () => {
    mocks.getNotifications.mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce([])
    renderApp(<NotificationCentrePage />, ['/student/notifications'])

    expect(
      await screen.findByRole('heading', { name: 'Your notifications could not be loaded.' }),
    ).toBeVisible()
    expect(screen.getByText(/Protected content remains private/)).toBeVisible()
  })

  it('never renders cached first-account updates while the second account loads', async () => {
    const first = {
      id: 'fictional-first-update',
      title: 'First account private update',
      body: 'Fictional only',
      category: 'academic',
      createdAt: '2026-10-14T00:00:00Z',
      readAt: null,
      destinationPath: '/student/agenda',
      eventType: 'class_scheduled',
    }
    mocks.getNotifications.mockResolvedValueOnce([first])
    let resolveSecond!: (value: unknown[]) => void
    mocks.getNotifications.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSecond = resolve
        }),
    )
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = () => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/student/notifications']}>
          <NotificationCentrePage />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const view = render(tree())
    expect(await screen.findByRole('heading', { name: first.title })).toBeVisible()
    mocks.userId = 'fictional-second'
    view.rerender(tree())
    expect(screen.queryByRole('heading', { name: first.title })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Loading your updates…' })).toBeVisible()
    await act(async () => {
      resolveSecond([])
      await Promise.resolve()
    })
    expect(await screen.findByText('No notifications yet')).toBeVisible()
    view.unmount()
    client.clear()
  })

  it('isolates a late response from a previous account', async () => {
    let resolveFirst!: (value: unknown[]) => void
    mocks.getNotifications.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve
        }),
    )
    mocks.getNotifications.mockResolvedValueOnce([])
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tree = () => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/student/notifications']}>
          <NotificationCentrePage />
        </MemoryRouter>
      </QueryClientProvider>
    )
    const view = render(tree())
    mocks.userId = 'fictional-second'
    view.rerender(tree())
    expect(await screen.findByText('No notifications yet')).toBeVisible()
    await act(async () => {
      resolveFirst([
        {
          id: 'fictional-late',
          title: 'Late first-account private update',
          body: 'Fictional only',
          category: 'academic',
          createdAt: '2026-10-14T00:00:00Z',
          readAt: null,
          destinationPath: '/student/agenda',
          eventType: 'class_scheduled',
        },
      ])
      await Promise.resolve()
    })
    expect(screen.queryByText('Late first-account private update')).not.toBeInTheDocument()
    expect(screen.getByText('No notifications yet')).toBeVisible()
    view.unmount()
    client.clear()
  })

  it('refreshes live updates after one minute without a manual action', async () => {
    vi.useFakeTimers()
    mocks.getNotifications.mockResolvedValue([])
    const view = renderApp(<NotificationCentrePage />, ['/student/notifications'])
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })
      expect(mocks.getNotifications).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(mocks.getNotifications).toHaveBeenCalledTimes(2)
    } finally {
      view.unmount()
      vi.useRealTimers()
    }
  })

  it('does not poll the live backend from fictional preview', async () => {
    vi.stubEnv('VITE_ENABLE_STUDENT_PREVIEW', 'true')
    vi.useFakeTimers()
    const view = renderApp(<NotificationCentrePage />, ['/student/notifications?preview=1'])
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(120_000)
      })
      expect(mocks.getNotifications).not.toHaveBeenCalled()
    } finally {
      view.unmount()
      vi.useRealTimers()
    }
  })
})
