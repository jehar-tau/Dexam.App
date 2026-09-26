import { type FormEvent, useState } from 'react'

import styles from './StudentActivationPage.module.css'
import { activateStudent } from '../features/auth/activateStudent'

const memberIdPattern = /^DXM-[2-9A-HJKMNP-Z]{12}$/

function normalizeMemberId(value: string) {
  return value.trim().toUpperCase().replaceAll(' ', '')
}

function normalizeActivationCode(value: string) {
  return value.trim().toUpperCase().replaceAll(/[-\s]/g, '')
}

export function StudentActivationPage() {
  const [memberId, setMemberId] = useState('')
  const [activationCode, setActivationCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    const normalizedMemberId = normalizeMemberId(memberId)
    const normalizedCode = normalizeActivationCode(activationCode)

    if (!memberIdPattern.test(normalizedMemberId)) {
      setError('Check the Dexam Member ID printed in your activation pack.')
      return
    }
    if (normalizedCode.length !== 10) {
      setError('Enter the 10-character activation code from your activation pack.')
      return
    }
    if (password.length < 12) {
      setError('Create a password with at least 12 characters.')
      return
    }
    if (password !== confirmation) {
      setError('The passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const successMessage = await activateStudent({
        memberId: normalizedMemberId,
        activationCode: normalizedCode,
        password,
      })
      setMessage(successMessage)
      setPassword('')
      setConfirmation('')
      setActivationCode('')
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'Activation is temporarily unavailable. Please try again later.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className={styles.layout} aria-labelledby="activation-title">
      <div className={styles.introduction}>
        <p className="eyebrow">Student account</p>
        <h1 id="activation-title">Activate your Dexam account.</h1>
        <p>
          Use the Member ID and one-time code from your activation pack. A Dexam employee will never
          ask you to share the password you create here.
        </p>
      </div>

      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <div className={styles.field}>
          <label htmlFor="member-id">Dexam Member ID</label>
          <input
            id="member-id"
            name="memberId"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck="false"
            placeholder="DXM-7K3M9Q2RW5TY"
            value={memberId}
            onChange={(event) => setMemberId(event.target.value)}
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="activation-code">One-time activation code</label>
          <input
            id="activation-code"
            name="activationCode"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck="false"
            value={activationCode}
            onChange={(event) => setActivationCode(event.target.value)}
            required
          />
          <p className={styles.hint}>The code contains 10 characters and can be used only once.</p>
        </div>

        <div className={styles.field}>
          <label htmlFor="password">Create password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className={styles.hint}>
            Use at least 12 characters. A long phrase is easier to remember.
          </p>
        </div>

        <div className={styles.field}>
          <label htmlFor="password-confirmation">Confirm password</label>
          <input
            id="password-confirmation"
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className={styles.success} role="status">
            {message} You can now sign in using your Member ID.
          </p>
        ) : null}

        <button className={styles.submit} type="submit" disabled={submitting || Boolean(message)}>
          {submitting ? 'Activating…' : 'Activate account'}
        </button>
      </form>
    </section>
  )
}
