import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { useTestsTheme } from '../../features/testSeries/useTestsTheme'
import styles from './TestsShell.module.css'

type NavItem = { label: string; path: string; icon: ReactNode }

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

const navItems: NavItem[] = [
  {
    label: 'Overview',
    path: '/tests',
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
    label: 'Analytics',
    path: '/tests/analytics',
    icon: (
      <svg {...iconProps}>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    label: 'Practice',
    path: '/tests/practice',
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
    icon: (
      <svg {...iconProps}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l3 2M9 2h6" />
      </svg>
    ),
  },
  {
    label: 'Bookmarks',
    path: '/tests/bookmarks',
    icon: (
      <svg {...iconProps}>
        <path d="M6 3h12v18l-6-4-6 4z" />
      </svg>
    ),
  },
  {
    label: 'Sketches',
    path: '/tests/sketches',
    icon: (
      <svg {...iconProps}>
        <path d="M4 20l4-1 11-11-3-3L5 16z" />
        <path d="M14 6l3 3" />
      </svg>
    ),
  },
]

function memberIdFromEmail(email: string | undefined): string | null {
  if (!email) return null
  const [local, domain] = email.split('@')
  return domain === 'members.dexam.invalid' && local ? local.toUpperCase() : null
}

export function TestsShell() {
  const location = useLocation()
  const { session, signOut } = useAuth()
  const { theme, toggleTheme } = useTestsTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [signOutError, setSignOutError] = useState('')
  const search = previewSearch(location.search)
  const preview = search !== ''
  const memberId = memberIdFromEmail(session?.user.email)
  const displayName = preview ? 'Fictional Student' : (memberId ?? 'Student')
  const subtitle = preview ? 'B.Des · Preview' : memberId ? 'Dexam member' : ''

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

  return (
    <div className={styles.frame} data-testid="tests-shell">
      <a className={styles.skip} href="#tests-main">
        Skip to content
      </a>
      <header className={styles.topBar}>
        <Link className={styles.brand} to={`/tests${search}`}>
          <span className={styles.mark} aria-hidden="true">
            D
          </span>
          <span>
            Dexam <span className={styles.brandSub}>Test series</span>
          </span>
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="tests-sidebar"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>
      </header>

      <aside
        id="tests-sidebar"
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}
        aria-label="Test series"
      >
        <Link
          className={`${styles.brand} ${styles.sidebarBrand}`}
          to={`/tests${search}`}
          onClick={closeMenu}
        >
          <span className={styles.mark} aria-hidden="true">
            D
          </span>
          <span>
            Dexam <span className={styles.brandSub}>Test series</span>
          </span>
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

        <nav ref={navRef} className={styles.nav} aria-label="Test series sections">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={`${item.path}${search}`}
              end={item.path === '/tests'}
              onClick={closeMenu}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navItemActive : ''}`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link className={styles.footerLink} to={`/student${search}`} onClick={closeMenu}>
            ← Student portal
          </Link>
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
              <span className={styles.footerNote}>{preview ? 'Preview mode' : ''}</span>
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

      <main id="tests-main" className={styles.main} tabIndex={-1} inert={menuOpen}>
        <Outlet />
      </main>
    </div>
  )
}
