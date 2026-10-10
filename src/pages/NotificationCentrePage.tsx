import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, EmptyState } from '../components'
import {
  getNotifications,
  getPreviewNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type InAppNotification,
  type NotificationAudience,
} from '../features/notifications/notifications'
import styles from './NotificationCentrePage.module.css'

function notificationTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

export function NotificationCentrePage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const audience: NotificationAudience = location.pathname.startsWith('/staff')
    ? 'teacher'
    : 'student'
  const previewEnabled =
    searchParams.get('preview') === '1' &&
    (audience === 'teacher'
      ? import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true'
      : import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true')
  const queryKey = ['notifications', audience, previewEnabled]
  const notificationsQuery = useQuery({
    queryKey,
    queryFn: () =>
      previewEnabled ? Promise.resolve(getPreviewNotifications(audience)) : getNotifications(),
    retry: false,
  })
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [error, setError] = useState('')
  const notifications = notificationsQuery.data ?? []
  const unreadCount = notifications.filter((notification) => !notification.readAt).length
  const visibleNotifications =
    filter === 'unread'
      ? notifications.filter((notification) => !notification.readAt)
      : notifications

  function updatePreview(updater: (current: InAppNotification[]) => InAppNotification[]) {
    const current =
      queryClient.getQueryData<InAppNotification[]>(queryKey) ?? getPreviewNotifications(audience)
    const updated = updater(current)
    queryClient.setQueryData(queryKey, updated)
    queryClient.setQueryData(
      ['notification-unread-count', audience, previewEnabled],
      updated.filter((notification) => !notification.readAt).length,
    )
  }

  async function refreshNotificationState() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({
        queryKey: ['notification-unread-count', audience, previewEnabled],
      }),
    ])
  }

  async function markRead(notificationId: string) {
    setError('')
    try {
      if (previewEnabled) {
        updatePreview((current) =>
          current.map((notification) =>
            notification.id === notificationId && !notification.readAt
              ? { ...notification, readAt: new Date().toISOString() }
              : notification,
          ),
        )
      } else {
        await markNotificationRead(notificationId)
        await refreshNotificationState()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The notification could not be updated.')
    }
  }

  async function markAllRead() {
    setError('')
    try {
      if (previewEnabled) {
        const readAt = new Date().toISOString()
        updatePreview((current) =>
          current.map((notification) => ({
            ...notification,
            readAt: notification.readAt ?? readAt,
          })),
        )
      } else {
        await markAllNotificationsRead()
        await refreshNotificationState()
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Notifications could not be updated.')
    }
  }

  if (notificationsQuery.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Notification centre</p>
        <h1>Loading your updates…</h1>
      </section>
    )
  }

  if (notificationsQuery.isError) {
    return (
      <section className={styles.state} aria-labelledby="notifications-error-title">
        <p className="eyebrow">Notification centre</p>
        <h1 id="notifications-error-title">Your notifications could not be loaded.</h1>
        <Callout tone="warning" icon="warning">
          Protected content remains private. Check your connection and try again.
        </Callout>
        <Button onClick={() => void notificationsQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-labelledby="notifications-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            {audience === 'student' ? 'Student' : 'Teaching'} updates ·{' '}
            {previewEnabled ? 'Local preview' : 'Live account'}
          </p>
          <h1 id="notifications-title">Notifications.</h1>
          <p>Important academic updates, linked back to their protected source.</p>
        </div>
        <div className={styles.unreadSummary} aria-label={`${unreadCount} unread notifications`}>
          <strong>{unreadCount}</strong>
          <span>Unread</span>
        </div>
      </header>

      <div className={styles.controls}>
        <div className={styles.filters} aria-label="Filter notifications">
          <Button onClick={() => setFilter('all')} variant={filter === 'all' ? undefined : 'ghost'}>
            All ({notifications.length})
          </Button>
          <Button
            onClick={() => setFilter('unread')}
            variant={filter === 'unread' ? undefined : 'ghost'}
          >
            Unread ({unreadCount})
          </Button>
        </div>
        <Button disabled={unreadCount === 0} onClick={() => void markAllRead()} variant="secondary">
          Mark all as read
        </Button>
      </div>

      {error ? (
        <Callout tone="warning" icon="warning">
          {error}
        </Callout>
      ) : null}

      {visibleNotifications.length === 0 ? (
        <EmptyState
          title={filter === 'unread' ? 'You are all caught up' : 'No notifications yet'}
          description={
            filter === 'unread'
              ? 'Read updates remain available under All.'
              : 'New academic updates will appear here.'
          }
        />
      ) : (
        <div className={styles.list}>
          {visibleNotifications.map((notification) => (
            <article
              className={notification.readAt ? styles.notification : styles.unreadNotification}
              key={notification.id}
            >
              <span className={styles.statusDot} aria-hidden="true" />
              <div className={styles.notificationBody}>
                <div className={styles.notificationHeading}>
                  <div>
                    <Badge tone={notification.readAt ? 'neutral' : 'accent'}>
                      {notification.readAt ? 'Read' : 'New'}
                    </Badge>
                    <span>{notificationTime(notification.createdAt)}</span>
                  </div>
                  <Badge tone="neutral">{notification.category}</Badge>
                </div>
                <h2>{notification.title}</h2>
                <p>{notification.body}</p>
                <div className={styles.actions}>
                  <Link
                    className={styles.openLink}
                    onClick={() => void markRead(notification.id)}
                    to={notification.destinationPath}
                  >
                    Open update <span aria-hidden="true">→</span>
                  </Link>
                  {!notification.readAt ? (
                    <Button
                      onClick={() => void markRead(notification.id)}
                      size="sm"
                      variant="ghost"
                    >
                      Mark as read
                    </Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
