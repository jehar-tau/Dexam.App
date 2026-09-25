import { NavLink, Outlet } from 'react-router-dom'

import styles from './AppShell.module.css'

export function AppShell() {
  return (
    <div className={styles.app}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <NavLink className={styles.brand} to="/" aria-label="Dexam platform home">
          Dexam
        </NavLink>
        <nav aria-label="Foundation navigation">
          <NavLink
            className={({ isActive }) => (isActive ? styles.activeLink : styles.link)}
            to="/health"
          >
            System status
          </NavLink>
        </nav>
      </header>
      <main className={styles.main} id="main-content">
        <Outlet />
      </main>
    </div>
  )
}
