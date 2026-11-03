import styles from './Brand.module.css'

export function Brand({ subtitle = 'Design Exam Academy' }: { subtitle?: string }) {
  return (
    <span className={styles.brand}>
      <span className={styles.word}>
        DEX<span>A</span>M
      </span>{' '}
      <span className={styles.subtitle}>{subtitle}</span>
    </span>
  )
}
