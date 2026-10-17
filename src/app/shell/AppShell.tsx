import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Button } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import {
  getPreviewNotifications,
  getUnreadNotificationCount,
  type NotificationAudience,
} from '../../features/notifications/notifications'
import { PortalNavigation } from './PortalNavigation'
import { PortalFrame } from '../../components/layout/PortalFrame'
import { portalForPath } from '../../features/auth/portals'
import styles from './AppShell.module.css'

export function AppShell() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const portal = portalForPath(location.pathname)
  const [signingOut, setSigningOut] = useState(false),
    [signOutError, setSignOutError] = useState('')
  const notificationAudience: NotificationAudience | null = location.pathname.startsWith('/student')
    ? 'student'
    : location.pathname.startsWith('/staff/crm') ||
        new URLSearchParams(location.search).get('audience') === 'sales'
      ? 'sales'
      : portal === 'teacher' || portal === 'admin' || portal === 'staff'
        ? 'teacher'
        : null
  const previewEnabled =
    portal !== 'admin' &&
    portal !== null &&
    new URLSearchParams(location.search).get('preview') === '1' &&
    (notificationAudience === 'student'
      ? import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true'
      : import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true')
  const unread = useQuery({
    queryKey: ['notification-unread-count', notificationAudience, previewEnabled, session?.user.id],
    queryFn: () =>
      previewEnabled
        ? Promise.resolve(
            getPreviewNotifications(notificationAudience!).filter((n) => !n.readAt).length,
          )
        : getUnreadNotificationCount(),
    enabled: Boolean(notificationAudience) && (Boolean(session) || previewEnabled),
    retry: false,
    refetchInterval: previewEnabled ? false : 60_000,
    gcTime: 0,
  })
  const notificationParams = new URLSearchParams()
  if (previewEnabled) notificationParams.set('preview', '1')
  if (notificationAudience === 'sales') notificationParams.set('audience', 'sales')
  async function handleSignOut() {
    setSignOutError('')
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSignOutError('Sign-out failed. Please try again.')
    } finally {
      setSigningOut(false)
    }
  }
  return (
    <PortalFrame
      portal={portal}
      banner={
        import.meta.env.VITE_APP_ENV === 'staging' ? (
          <span role="status">Staging environment · Fictional data only</span>
        ) : undefined
      }
      navigation={
        <>
          <PortalNavigation
            portal={portal}
            notificationSearch={notificationParams.size ? `?${notificationParams.toString()}` : ''}
            previewEnabled={previewEnabled}
            unreadCount={unread.data ?? 0}
          />
          {session ? (
            <Button
              disabled={signingOut}
              onClick={() => void handleSignOut()}
              size="sm"
              variant="ghost"
            >
              {signingOut ? 'Signing out…' : 'Sign out'}
            </Button>
          ) : null}
          {signOutError ? (
            <span className={styles.sessionError} role="alert">
              {signOutError}
            </span>
          ) : null}
        </>
      }
    >
      <Outlet />
    </PortalFrame>
  )
}
