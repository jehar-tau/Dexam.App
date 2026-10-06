import type { ReactNode } from 'react'

import styles from './Callout.module.css'

const marks = {
  note: '◆',
  success: '✓',
  tip: '✦',
  warning: '▲',
} as const

export type CalloutProps = {
  children: ReactNode
  icon?: keyof typeof marks
  tone?: 'neutral' | 'accent' | 'success' | 'warning'
}

export function Callout({ children, icon = 'note', tone = 'accent' }: CalloutProps) {
  return (
    <div className={`${styles.callout} ${styles[tone]}`}>
      <span className={styles.mark} aria-hidden="true">
        {marks[icon]}
      </span>
      <div>{children}</div>
    </div>
  )
}
