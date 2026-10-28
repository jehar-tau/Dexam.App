import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import {
  canOpenPortal,
  getPortalAccess,
  portalLabels,
  type Portal,
} from '../../features/auth/portals'
import {
  getPreviewNotifications,
  getUnreadNotificationCount,
} from '../../features/notifications/notifications'
import { memberIdFromEmail } from '../../features/testSeries/candidate'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { useTestAccess } from '../../features/testSeries/testAccess'
import { useTestsTheme } from '../../features/testSeries/useTestsTheme'
import styles from './StudentShell.module.css'

/** `preview`: the destination also works in the fictional student preview. */
type NavItem = { label: string; path: string; icon: ReactNode; preview?: boolean }

const iconProps = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Coaching tools: only for Dexam coaching students. */
const coachingItems: NavItem[] = [
  {
    label: 'Home',
    path: '/student',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <path d="M3 11l9-7 9 7" />
        <path d="M5 10v10h14V10" />
      </svg>
    ),
  },
  {
    label: 'Coursework',
    path: '/student/coursework',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 21V5M9 7h6" />
      </svg>
    ),
  },
  {
    label: 'Assignments',
    path: '/student/assignments',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Study checklist',
    path: '/student/study-checklist',
    icon: (
      <svg {...iconProps}>
        <path d="M9 6h11M9 12h11M9 18h11" />
        <path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
      </svg>
    ),
  },
  {
    label: 'Class agenda',
    path: '/student/agenda',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    label: 'Work archive',
    path: '/student/archive',
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="18" height="5" rx="1" />
        <path d="M5 9v11h14V9M10 13h4" />
      </svg>
    ),
  },
]

/** The test series: coaching students and public candidates alike. */
const testItems: NavItem[] = [
  {
    label: 'Overview',
    path: '/tests',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: 'Practice',
    path: '/tests/practice',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </svg>
    ),
  },
  {
    label: 'Papers',
    path: '/tests/papers',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M14 3v5h5M10 13h6M10 17h6" />
      </svg>
    ),
  },
  {
    label: 'Mocks',
    path: '/tests/mocks',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2M9 2h6" />
      </svg>
    ),
  },
  {
    label: 'Drawing',
    path: '/tests/drawing',
    preview: true,
    icon: (
      <svg {...iconProps}>
        <path d="M4 20l4-1 11-11-3-3L5 16z" />
        <path d="M14 6l3 3" />
      </svg>
    ),
  },
]

const bellIcon = (
  <svg {...iconProps}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
    <path d="M10 21h4" />
  </svg>
)

/**
 * The student portal: one left sidebar for coaching tools and the test series (D-059).
 * Public candidates (Google sign-in) see the test series only.
 */
export function StudentShell() {
  const location = useLocation()
  const { session, signOut } = useAuth()
  const { theme, toggleTheme } = useTestsTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const search = previewSearch(location.search)
  const preview = search !== ''
  const memberId = memberIdFromEmail(session?.user.email)
  const access = useTestAccess(!preview)
  const candidate = access.data?.kind === 'candidate' ? access.data : null
  // /student routes sit behind the student boundary, so the coaching tools are already proven.
  const coaching =
    preview || location.pathname.startsWith('/student') || access.data?.kind === 'student'
  const displayName = preview
    ? 'Fictional Student'
    : (access.data?.displayName ?? memberId ?? 'Student')
  const subtitle = preview
    ? 'B.Des · Preview'
    : candidate
      ? `${candidate.profile?.level === 'mdes' ? 'M.Des' : 'B.Des'} candidate`
      : memberId
        ? 'Dexam member'
        : ''
  const home = coaching ? '/student' : '/tests'

  const unread = useQuery({
    queryKey: ['notification-unread-count', 'student', preview, session?.user.id],
    queryFn: () =>
      preview
        ? Promise.resolve(getPreviewNotifications('student').filter((n) => !n.readAt).length)
        : getUnreadNotificationCount(),
    enabled: coaching && (Boolean(session) || preview),
    retry: false,
    refetchInterval: preview ? false : 60_000,
    gcTime: 0,
  })
  // A coaching student who is also an employee can switch to their staff portals.
  const portals = useQuery({
    queryKey: ['portal-access', session?.user.id],
    queryFn: getPortalAccess,
    enabled: Boolean(session) && !preview && coaching,
    retry: false,
    staleTime: 30_000,
  })
  const otherPortals = portals.data
    ? (Object.keys(portalLabels) as Portal[]).filter(
        (kind) => kind !== 'student' && canOpenPortal(kind, portals.data),
      )
    : []

  const navRef = useRef<HTMLElement>(null)

  // While the mobile menu is open: Escape closes it, focus moves into it and the page
  // behind stops scrolling. (`inert` on <main> keeps keyboard focus out of the page.)
  useEffect(() => {
    if (!menuOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKey)
    navRef.current?.querySelector<HTMLElement>('a')?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [menuOpen])

  // Design-system aliases (page background, surfaces, text) are declared on the root
  // element, so the theme must be set there; restore whatever was there on leaving.
  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-theme')
    root.setAttribute('data-theme', theme)
    return () => {
      if (previous === null) root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', previous)
    }
  }, [theme])

  // Close the mobile menu when a link inside it is followed.
  const closeMenu = () => setMenuOpen(false)

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
    } catch {
      setSignOutError('Sign-out failed. Please try again.')
    }
  }

  const navLink = (item: NavItem, extra?: ReactNode) => (
    <NavLink
      key={item.path}
      to={`${item.path}${search}`}
      end={item.path === '/student' || item.path === '/tests'}
      onClick={closeMenu}
      className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
    >
      {item.icon}
      <span>{item.label}</span>
      {extra}
    </NavLink>
  )
  const visible = (items: NavItem[]) => items.filter((item) => !preview || item.preview)
  const unreadCount = unread.data ?? 0

  const brand = (
    <>
      <span className={styles.mark} aria-hidden="true">
        D
      </span>
      <span>
        Dexam <span className={styles.brandSub}>{coaching ? 'Student portal' : 'Test series'}</span>
      </span>
    </>
  )

  return (
    <div className={styles.frame} data-portal="student" data-testid="student-shell">
      <a className={styles.skip} href="#student-main">
        Skip to content
      </a>
      <header className={styles.topBar}>
        <Link className={styles.brand} to={`${home}${search}`}>
          {brand}
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="student-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        id="student-sidebar"
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}
        aria-label="Student portal"
      >
        <Link
          className={`${styles.brand} ${styles.sidebarBrand}`}
          to={`${home}${search}`}
          onClick={closeMenu}
        >
          {brand}
        </Link>

        <div className={styles.profile}>
          <span className={styles.avatar} aria-hidden="true">
            {displayName.slice(0, 1)}
          </span>
          <span className={styles.profileText}>
            <span className={styles.profileName}>{displayName}</span>
            {subtitle ? <span className={styles.profileSub}>{subtitle}</span> : null}
          </span>
        </div>

        <nav ref={navRef} className={styles.nav} aria-label="Student portal sections">
          {coaching ? (
            <>
              {visible(coachingItems.slice(0, 1)).map((item) => navLink(item))}
              {navLink(
                {
                  label: 'Notifications',
                  path: '/student/notifications',
                  icon: bellIcon,
                  preview: true,
                },
                unreadCount > 0 ? (
                  <span className={styles.count} aria-label={`${unreadCount} unread`}>
                    {unreadCount}
                  </span>
                ) : null,
              )}
              <p className={styles.groupLabel}>Coaching</p>
              {visible(coachingItems.slice(1)).map((item) => navLink(item))}
            </>
          ) : null}
          <p className={styles.groupLabel}>Test series</p>
          {visible(testItems).map((item) => navLink(item))}
        </nav>

        <div className={styles.sidebarFooter}>
          {otherPortals.map((kind) => (
            <Link key={kind} className={styles.footerLink} to={`/${kind}`} onClick={closeMenu}>
              Switch to {portalLabels[kind]}
            </Link>
          ))}
          <div className={styles.footerRow}>
            {session && !preview ? (
              <button
                type="button"
                className={styles.footerButton}
                onClick={() => void handleSignOut()}
              >
                Sign out
              </button>
            ) : (
              <span className={styles.footerNote}>{preview ? 'Fictional preview' : ''}</span>
            )}
            <button
              type="button"
              className={styles.themeButton}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-pressed={theme === 'dark'}
            >
              {theme === 'dark' ? (
                <svg {...iconProps}>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg {...iconProps}>
                  <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
                </svg>
              )}
            </button>
          </div>
          {signOutError ? (
            <p className={styles.error} role="alert">
              {signOutError}
            </p>
          ) : null}
        </div>
      </aside>

      {menuOpen ? (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <main id="student-main" className={styles.main} tabIndex={-1} inert={menuOpen}>
        {import.meta.env.VITE_APP_ENV === 'staging' ? (
          <p className={styles.banner} role="status">
            Staging environment · Fictional data only
          </p>
        ) : null}
        <Outlet />
      </main>
    </div>
  )
}
