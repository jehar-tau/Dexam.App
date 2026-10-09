import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

import { Button } from '../../components'
import { useAuth } from '../../features/auth/AuthContext'
import styles from './AppShell.module.css'

export function AppShell() {
  const { session, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState('')

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
            Staff workspace
          </NavLink>
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
