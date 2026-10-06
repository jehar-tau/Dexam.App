import type { HTMLAttributes, ReactNode } from 'react'

import styles from './Card.module.css'

export type CardProps = Omit<HTMLAttributes<HTMLDivElement>, 'onClick'> & {
  children: ReactNode
  interactive?: boolean
  onClick?: () => void
  selected?: boolean
}

export function Card({
  children,
  className = '',
  interactive = false,
  onClick,
  selected = false,
  ...props
}: CardProps) {
  const classes = [
    styles.card,
    interactive || onClick ? styles.interactive : '',
    selected ? styles.selected : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (onClick) {
    return (
      <button className={classes} type="button" onClick={onClick}>
        {children}
      </button>
    )
  }

  return (
    <div className={classes} {...props}>
      {children}
    </div>
  )
}
