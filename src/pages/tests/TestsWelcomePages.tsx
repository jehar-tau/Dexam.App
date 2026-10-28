import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { exams, type ExamKey } from '../../features/testSeries/paperCatalog'
import {
  levelExams,
  provisionCandidate,
  safeTestsReturnTo,
  saveCandidateProfile,
  signInWithGoogle,
  useTestAccess,
  type Level,
} from '../../features/testSeries/testAccess'
import styles from './TestsWelcomePages.module.css'

const currentYear = 2026

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"
      />
    </svg>
  )
}

/** `/tests/sign-in`: Google for new candidates, Member ID for coaching students. */
export function TestsSignInPage() {
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const returnTo = safeTestsReturnTo(searchParams.get('returnTo'))
  const client = getSupabaseClient()
  const google = useMutation({ mutationFn: () => signInWithGoogle(client!, returnTo) })

  if (session) return <Navigate replace to={returnTo} />

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="tests-sign-in-title">
        <p className={styles.eyebrow}>Dexam test series</p>
        <h1 id="tests-sign-in-title" className={styles.title}>
          Practise on real design-entrance papers
        </h1>
        <p className={styles.lede}>
          UCEED, CEED, NID and NIFT papers in an exam window that works like the real one, with
          scores, answer review and progress tracking. Your first paper of each exam is free.
        </p>
        <button
          type="button"
          className={styles.google}
          disabled={!client || google.isPending}
          onClick={() => google.mutate()}
        >
          <GoogleMark />
          {google.isPending ? 'Opening Google…' : 'Continue with Google'}
        </button>
        {google.isError ? (
          <p className={styles.error} role="alert">
            {google.error.message}
          </p>
        ) : null}
        <div className={styles.divider}>
          <span>Dexam coaching student?</span>
        </div>
        <Link className={styles.secondary} to={`/sign-in?returnTo=${encodeURIComponent(returnTo)}`}>
          Sign in with your Member ID
        </Link>
        <p className={styles.fine}>
          Google accounts and coaching Member IDs are separate. Coaching students keep using their
          Member ID and already have every paper.
        </p>
      </section>
    </main>
  )
}

/** `/tests/welcome`: first sign-in setup, then B.Des or M.Des and target exams. */
export function TestsWelcomePage() {
  const { session, initializing, signOut } = useAuth()
  const client = getSupabaseClient()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const returnTo = safeTestsReturnTo(searchParams.get('returnTo'))
  const access = useTestAccess()

  const provision = useMutation({
    mutationFn: () => provisionCandidate(client!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['test-access'] }),
  })
  const needsAccount = access.data?.kind === null
  useEffect(() => {
    if (needsAccount && provision.isIdle) provision.mutate()
  }, [needsAccount, provision])

  const [level, setLevel] = useState<Level | null>(null)
  const [chosen, setChosen] = useState<ExamKey[]>([])
  const [year, setYear] = useState<number | null>(currentYear + 1)
  const save = useMutation({
    mutationFn: () =>
      saveCandidateProfile(client!, { level: level!, exams: chosen, examYear: year }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['test-access'] })
      void navigate(returnTo, { replace: true })
    },
  })

  if (!initializing && !session) {
    return <Navigate replace to={`/tests/sign-in?returnTo=${encodeURIComponent(returnTo)}`} />
  }
  if (
    access.data?.kind === 'student' ||
    (access.data?.kind === 'candidate' && access.data.profile)
  ) {
    return <Navigate replace to={returnTo} />
  }

  if (provision.isError) {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-labelledby="welcome-error-title">
          <h1 id="welcome-error-title" className={styles.title}>
            This login cannot use the test series
          </h1>
          <p className={styles.lede}>{provision.error.message}</p>
          <button type="button" className={styles.secondary} onClick={() => void signOut()}>
            Sign out
          </button>
        </section>
      </main>
    )
  }

  if (access.data?.kind !== 'candidate') {
    return (
      <main className={styles.page}>
        <section className={styles.card} aria-live="polite">
          <h1 className={styles.title}>Setting up your account…</h1>
        </section>
      </main>
    )
  }

  const toggle = (exam: ExamKey) =>
    setChosen((list) =>
      list.includes(exam) ? list.filter((item) => item !== exam) : [...list, exam],
    )

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="welcome-title">
        <p className={styles.eyebrow}>
          Welcome{access.data.displayName ? `, ${access.data.displayName}` : ''}
        </p>
        <h1 id="welcome-title" className={styles.title}>
          What are you preparing for?
        </h1>
        <form
          className={styles.form}
          onSubmit={(event) => {
            event.preventDefault()
            if (level) save.mutate()
          }}
        >
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>Programme</legend>
            <div className={styles.levels}>
              {(['bdes', 'mdes'] as const).map((value) => (
                <label
                  key={value}
                  className={`${styles.level} ${level === value ? styles.levelActive : ''}`}
                >
                  <input
                    type="radio"
                    name="level"
                    value={value}
                    checked={level === value}
                    onChange={() => {
                      setLevel(value)
                      setChosen(levelExams[value])
                    }}
                  />
                  <span className={styles.levelName}>{value === 'bdes' ? 'B.Des' : 'M.Des'}</span>
                  <span className={styles.levelText}>
                    {value === 'bdes'
                      ? 'UCEED, NID DAT and NIFT (after Class 12)'
                      : 'CEED, NID DAT and NIFT (after graduation)'}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {level ? (
            <fieldset className={styles.fieldset}>
              <legend className={styles.legend}>Exams you are taking</legend>
              <div className={styles.exams}>
                {levelExams[level].map((exam) => (
                  <label key={exam} className={styles.exam}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(exam)}
                      onChange={() => toggle(exam)}
                    />
                    {(() => {
                      const info = exams.find((item) => item.key === exam)
                      return info ? `${info.name} (${info.description})` : exam
                    })()}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          {level ? (
            <label className={styles.yearLabel}>
              Exam year
              <select
                className={styles.select}
                value={year ?? ''}
                onChange={(event) =>
                  setYear(event.target.value ? Number(event.target.value) : null)
                }
              >
                {[currentYear + 1, currentYear + 2, currentYear + 3].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
                <option value="">Not sure yet</option>
              </select>
            </label>
          ) : null}

          <p className={styles.fine}>
            {level
              ? `Your first paper of each ${level === 'mdes' ? 'M.Des' : 'B.Des'} exam is free: choose any year.`
              : 'Your first paper of each exam is free: choose any year.'}
          </p>
          {save.isError ? (
            <p className={styles.error} role="alert">
              {save.error.message}
            </p>
          ) : null}
          <button type="submit" className={styles.primary} disabled={!level || save.isPending}>
            {save.isPending ? 'Saving…' : 'Go to my mock tests'}
          </button>
        </form>
      </section>
    </main>
  )
}
