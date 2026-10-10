import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

import { Button } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import {
  getPreviewNotifications,
  getUnreadNotificationCount,
  type NotificationAudience,
} from '../../features/notifications/notifications'
import styles from './AppShell.module.css'

export function AppShell() {
  const { session, signOut } = useAuth()
  const location = useLocation()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const notificationAudience: NotificationAudience | null = location.pathname.startsWith('/student')
    ? 'student'
    : location.pathname.startsWith('/staff/crm') ||
        new URLSearchParams(location.search).get('audience') === 'sales'
      ? 'sales'
      : location.pathname.startsWith('/staff')
        ? 'teacher'
        : null
  const previewEnabled =
    new URLSearchParams(location.search).get('preview') === '1' &&
    (notificationAudience === 'student'
      ? import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true'
      : import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true')
  const unreadCountQuery = useQuery({
    queryKey: ['notification-unread-count', notificationAudience, previewEnabled],
    queryFn: () =>
      previewEnabled
        ? Promise.resolve(
            getPreviewNotifications(notificationAudience!).filter(
              (notification) => !notification.readAt,
            ).length,
          )
        : getUnreadNotificationCount(),
    enabled: Boolean(notificationAudience) && (Boolean(session) || previewEnabled),
    retry: false,
  })
  const unreadCount = unreadCountQuery.data ?? 0
  const notificationParams = new URLSearchParams()
  if (previewEnabled) notificationParams.set('preview', '1')
  if (notificationAudience === 'sales') notificationParams.set('audience', 'sales')
  const notificationSearch = notificationParams.size ? `?${notificationParams.toString()}` : ''

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
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <NavLink className={styles.brand} to="/" aria-label="Dexam platform home">
          Dexam
        </NavLink>
        <nav aria-label="Main navigation" className={styles.navigation}>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/staff/crm"
          >
            CRM
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/activate"
          >
            Activate account
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/student"
          >
            Student portal
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/health"
          >
            System status
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/staff/enrolments"
          >
            Enrolments
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/staff/content"
          >
            Content
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/staff/assignments"
          >
            Distribution
          </NavLink>
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/staff/reviews"
          >
            Reviews
          </NavLink>
          {notificationAudience ? (
            <NavLink
              className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
              to={`${notificationAudience === 'student' ? '/student' : '/staff'}/notifications${notificationSearch}`}
            >
              Notifications
              {unreadCount > 0 ? (
                <span className={styles.notificationCount} aria-label={`${unreadCount} unread`}>
                  {unreadCount}
                </span>
              ) : null}
            </NavLink>
          ) : null}
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
        </nav>
      </header>
      <main className={styles.main} id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
