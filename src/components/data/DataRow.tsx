import type { ReactNode } from 'react'

import styles from './DataRow.module.css'

export type DataRowProps = {
  meta?: ReactNode
  onClick?: () => void
  primary: ReactNode
  secondary?: ReactNode
}

function RowContent({ meta, primary, secondary }: Omit<DataRowProps, 'onClick'>) {
  return (
    <>
      <span className={styles.content}>
        <span className={styles.primary}>{primary}</span>
        {secondary ? <span className={styles.secondary}>{secondary}</span> : null}
      </span>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </>
  )
}

export function DataRow({ meta, onClick, primary, secondary }: DataRowProps) {
  if (onClick) {
    return (
      <button className={styles.row} type="button" onClick={onClick}>
        <RowContent meta={meta} primary={primary} secondary={secondary} />
      </button>
    )
  }

  return (
    <div className={styles.row}>
      <RowContent meta={meta} primary={primary} secondary={secondary} />
    </div>
  )
}
