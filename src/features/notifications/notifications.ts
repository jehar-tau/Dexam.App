import { getSupabaseClient } from '../auth/supabaseClient'

export type NotificationAudience = 'sales' | 'student' | 'teacher'

export type InAppNotification = {
  body: string
  category: 'academic' | 'service'
  createdAt: string
  destinationPath: string
  eventType: string
  id: string
  readAt: string | null
  title: string
}

type Row = Record<string, unknown>

const unavailableMessage = 'Your notifications could not be loaded. Please try again.'

const studentPreviewNotifications: InAppNotification[] = [
  {
    id: 'preview-notification-correction',
    eventType: 'correction_requested',
    category: 'academic',
    title: 'Correction requested',
    body: 'Your teacher has requested another attempt. Open the assignment for details.',
    destinationPath: '/student/assignments?preview=1&assignment=preview-assignment-perspective',
    createdAt: '2026-10-10T14:35:00.000Z',
    readAt: null,
  },
  {
    id: 'preview-notification-feedback',
    eventType: 'feedback_available',
    category: 'academic',
    title: 'Teacher feedback available',
    body: 'Your teacher has published feedback for an assignment.',
    destinationPath: '/student/assignments?preview=1&assignment=preview-assignment-lines',
    createdAt: '2026-10-10T12:10:00.000Z',
    readAt: null,
  },
  {
    id: 'preview-notification-assignment',
    eventType: 'assignment_published',
    category: 'academic',
    title: 'New assignment available',
    body: 'A new assignment is ready in your learning workspace.',
    destinationPath: '/student/assignments?preview=1&assignment=preview-assignment-perspective',
    createdAt: '2026-10-09T09:00:00.000Z',
    readAt: '2026-10-09T10:00:00.000Z',
  },
]

const teacherPreviewNotifications: InAppNotification[] = [
  {
    id: 'preview-notification-submission-one',
    eventType: 'submission_ready_for_review',
    category: 'academic',
    title: 'Submission ready for review',
    body: 'A submitted assignment is waiting in your review queue.',
    destinationPath: '/staff/reviews?preview=1&instance=preview-instance-one',
    createdAt: '2026-10-10T13:20:00.000Z',
    readAt: null,
  },
  {
    id: 'preview-notification-submission-two',
    eventType: 'submission_ready_for_review',
    category: 'academic',
    title: 'Submission ready for review',
    body: 'A submitted assignment is waiting in your review queue.',
    destinationPath: '/staff/reviews?preview=1&instance=preview-instance-two',
    createdAt: '2026-10-09T09:15:00.000Z',
    readAt: null,
  },
]

const salesPreviewNotifications: InAppNotification[] = [
  {
    id: 'preview-notification-follow-up',
    eventType: 'lead_follow_up_due',
    category: 'service',
    title: 'Lead follow-up due',
    body: 'An assigned enquiry is ready for follow-up.',
    destinationPath: '/staff/crm?preview=1&enquiry=preview-enquiry-aarav',
    createdAt: '2026-10-10T06:30:00.000Z',
    readAt: null,
  },
  {
    id: 'preview-notification-lead-assigned',
    eventType: 'lead_assigned',
    category: 'service',
    title: 'New enquiry assigned',
    body: 'A prospective-student enquiry has been assigned to you.',
    destinationPath: '/staff/crm?preview=1&enquiry=preview-enquiry-meera',
    createdAt: '2026-10-09T08:30:00.000Z',
    readAt: null,
  },
]

function clientOrThrow() {
  const client = getSupabaseClient()
  if (!client) throw new Error(unavailableMessage)
  return client
}

function requiredString(value: unknown) {
  if (typeof value !== 'string') throw new Error(unavailableMessage)
  return value
}

function parseNotification(value: unknown): InAppNotification {
  if (!value || typeof value !== 'object') throw new Error(unavailableMessage)
  const row = value as Row
  if (
    (row.category !== 'academic' && row.category !== 'service') ||
    !(row.read_at === null || typeof row.read_at === 'string')
  ) {
    throw new Error(unavailableMessage)
  }
  return {
    id: requiredString(row.id),
    eventType: requiredString(row.event_type),
    category: row.category,
    title: requiredString(row.title),
    body: requiredString(row.body),
    destinationPath: requiredString(row.destination_path),
    createdAt: requiredString(row.created_at),
    readAt: row.read_at,
  }
}

export function getPreviewNotifications(audience: NotificationAudience) {
  const source =
    audience === 'student'
      ? studentPreviewNotifications
      : audience === 'sales'
        ? salesPreviewNotifications
        : teacherPreviewNotifications
  return source.map((notification) => ({ ...notification }))
}

export async function getNotifications(): Promise<InAppNotification[]> {
  const result = await clientOrThrow().rpc('list_my_notifications', { p_limit: 50 })
  if (result.error || !Array.isArray(result.data)) throw new Error(unavailableMessage)
  return result.data.map(parseNotification)
}

export async function getUnreadNotificationCount() {
  const result = await clientOrThrow().rpc('get_my_unread_notification_count')
  if (result.error || typeof result.data !== 'number' || !Number.isInteger(result.data)) {
    throw new Error(unavailableMessage)
  }
  return result.data
}

export async function markNotificationRead(notificationId: string) {
  const result = await clientOrThrow().rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })
  if (result.error) throw new Error('The notification could not be marked as read.')
}

export async function markAllNotificationsRead() {
  const result = await clientOrThrow().rpc('mark_all_notifications_read')
  if (result.error) throw new Error('Notifications could not be marked as read.')
  return Number(result.data ?? 0)
}
