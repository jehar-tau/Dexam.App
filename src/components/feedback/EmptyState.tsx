import type { ReactNode } from 'react'
import { DiscoveryArt } from '../brand/DiscoveryArt'

import styles from './EmptyState.module.css'

export type EmptyStateProps = {
  action?: ReactNode
  description?: string
  icon?: string
  title: string
}

export function EmptyState({ action, description, icon, title }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      {icon ? (
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
      ) : (
        <DiscoveryArt kind="seeing" className={styles.art} />
      )}
      <div className={styles.title}>{title}</div>
      {description ? <div className={styles.description}>{description}</div> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  )
}
