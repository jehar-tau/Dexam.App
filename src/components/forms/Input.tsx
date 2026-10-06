import { useId } from 'react'
import type { InputHTMLAttributes } from 'react'

import styles from './Input.module.css'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  error?: string
  hint?: string
  label: string
}

export function Input({
  'aria-describedby': ariaDescribedBy,
  className = '',
  error,
  hint,
  id,
  label,
  ...props
}: InputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = error ? `${inputId}-error` : undefined
  const hintId = hint ? `${inputId}-hint` : undefined
  const descriptionIds = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input
        aria-describedby={descriptionIds}
        aria-invalid={Boolean(error)}
        className={`${styles.input} ${error ? styles.invalid : ''} ${className}`.trim()}
        id={inputId}
        {...props}
      />
      {hint ? (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  )
}
