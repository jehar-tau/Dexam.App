import type { ReactNode } from 'react'

import styles from './Badge.module.css'

export type BadgeProps = {
  children: ReactNode
  pill?: boolean
  tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
}

export function Badge({ children, pill = false, tone = 'neutral' }: BadgeProps) {
  const className = [styles.badge, styles[tone], pill ? styles.pill : ''].filter(Boolean).join(' ')

  return <span className={className}>{children}</span>
}
