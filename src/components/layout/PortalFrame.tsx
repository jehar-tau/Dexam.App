import type { ReactNode } from 'react'
import type { Portal } from '../../features/auth/portals'
import styles from './PortalFrame.module.css'

export type PortalFrameProps = {
  portal: Portal | null
  navigation: ReactNode
  children: ReactNode
  banner?: ReactNode
}
const descriptions = {
  student: ['Learn at your pace', 'Your courses, your work, your next step.'],
  teacher: ['Teaching workspace', 'Focused reviews. Thoughtful feedback.'],
  staff: ['Dexam operations', 'Admissions, content and course delivery.'],
  admin: ['Protected administration', 'Account security and accountable operations.'],
} as const
export function PortalFrame({ portal, navigation, children, banner }: PortalFrameProps) {
  const copy = portal ? descriptions[portal] : ['Dexam', 'Choose your workspace.']
  return (
    <div className={styles.frame} data-portal={portal ?? 'public'}>
      <a className={styles.skip} href="#main-content">
        Skip to content
      </a>
      {banner ? <div className={styles.banner}>{banner}</div> : null}
      <header className={styles.header}>
        <a className={styles.brand} href="/">
          Dexam
        </a>
        <div>
          <strong>{copy[0]}</strong>
          <p>{copy[1]}</p>
        </div>
      </header>
      <div className={styles.body}>
        <nav className={styles.navigation} aria-label="Main navigation">
          {navigation}
        </nav>
        <main className={styles.main} id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
