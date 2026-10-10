import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notifications'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc }),
}))

describe('notifications data access', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('maps only the bounded current-person notification fields', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'notification-id',
          event_type: 'feedback_available',
          category: 'academic',
          title: 'Teacher feedback available',
          body: 'Your teacher has published feedback for an assignment.',
          destination_path: '/student/assignments?assignment=assignment-id',
          created_at: '2026-10-10T12:10:00.000Z',
          read_at: null,
        },
      ],
      error: null,
    })

    await expect(getNotifications()).resolves.toEqual([
      {
        id: 'notification-id',
        eventType: 'feedback_available',
        category: 'academic',
        title: 'Teacher feedback available',
        body: 'Your teacher has published feedback for an assignment.',
        destinationPath: '/student/assignments?assignment=assignment-id',
        createdAt: '2026-10-10T12:10:00.000Z',
        readAt: null,
      },
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_my_notifications', { p_limit: 50 })
  })

  it('fails closed when the protected response is incomplete', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [{ id: 'notification-id', category: 'academic', read_at: null }],
      error: null,
    })

    await expect(getNotifications()).rejects.toThrow(
      'Your notifications could not be loaded. Please try again.',
    )
  })

  it('uses protected RPCs for individual and bulk read state', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 3, error: null })
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    mocks.rpc.mockResolvedValueOnce({ data: 3, error: null })

    await expect(getUnreadNotificationCount()).resolves.toBe(3)
    await expect(markNotificationRead('notification-id')).resolves.toBeUndefined()
    await expect(markAllNotificationsRead()).resolves.toBe(3)
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'get_my_unread_notification_count')
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'mark_notification_read', {
      p_notification_id: 'notification-id',
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, 'mark_all_notifications_read')
  })
})
