import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchMocks, startMock, type MockBlueprint } from '../../features/testSeries/bankPaper'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { useTestAccess } from '../../features/testSeries/testAccess'
import styles from './TestsMocksPage.module.css'

// Fictional preview list; real availability is computed per student by the server.
const previewMocks: MockBlueprint[] = [
  {
    key: 'uceed-2026',
    exam: 'uceed',
    level: 'bdes',
    title: 'UCEED 2026 mock',
    minutes: 120,
    sections: [
      { type: 'nat', count: 14 },
      { type: 'msq', count: 15 },
      { type: 'mcq', count: 28 },
    ],
    available: 57,
    total: 57,
    taken: 1,
    openAttemptId: null,
    canStart: true,
  },
  {
    key: 'nift-bdes-2026',
    exam: 'nift',
    level: 'bdes',
    title: 'NIFT B.Des GAT 2026 mock',
    minutes: 120,
    sections: [{ type: 'mcq', count: 100 }],
    available: 100,
    total: 100,
    taken: 0,
    openAttemptId: null,
    canStart: true,
  },
  {
    key: 'ceed-2026',
    exam: 'ceed',
    level: 'mdes',
    title: 'CEED 2026 mock',
    minutes: 60,
    sections: [
      { type: 'nat', count: 8 },
      { type: 'msq', count: 10 },
      { type: 'mcq', count: 26 },
    ],
    available: 44,
    total: 44,
    taken: 0,
    openAttemptId: null,
    canStart: true,
  },
  {
    key: 'nift-mdes-2026',
    exam: 'nift',
    level: 'mdes',
    title: 'NIFT M.Des GAT 2026 mock',
    minutes: 150,
    sections: [{ type: 'mcq', count: 120 }],
    available: 120,
    total: 120,
    taken: 0,
    openAttemptId: null,
    canStart: true,
  },
]

const sectionText = (mock: MockBlueprint) =>
  mock.sections.map((section) => `${section.count} ${section.type.toUpperCase()}`).join(' · ')

/** F040: full mocks built from the common bank, never repeating a question for the student. */
export function TestsMocksPage() {
  const search = previewSearch(useLocation().search)
  const preview = search !== ''
  const navigate = useNavigate()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const access = useTestAccess(!preview)
  const query = useQuery({
    queryKey: ['mocks', session?.user.id],
    queryFn: () => fetchMocks(client!),
    enabled: !preview && Boolean(client && session),
  })
  const [chosenLevel, setLevel] = useState<'bdes' | 'mdes' | null>(null)
  const level = chosenLevel ?? access.data?.profile?.level ?? 'bdes'
  const start = useMutation({
    mutationFn: (key: string) => startMock(client!, key),
    onSuccess: (attemptId) => {
      if (attemptId) void navigate(`/tests/mock/run/${attemptId}`)
    },
  })

  const list = (preview ? previewMocks : (query.data ?? [])).filter((mock) => mock.level === level)
  const candidate = access.data?.kind === 'candidate'

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Mocks</h1>
          <p className={styles.note}>
            Full-length mocks on the 2026 pattern, built for you from Dexam&apos;s common question
            bank. You never see a question twice across papers, practice and mocks.
          </p>
        </div>
        <div className={styles.levels} role="group" aria-label="Programme level">
          {(['bdes', 'mdes'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={`${styles.level} ${level === value ? styles.levelActive : ''}`}
              aria-pressed={level === value}
              onClick={() => setLevel(value)}
            >
              {value === 'bdes' ? 'B.Des' : 'M.Des'}
            </button>
          ))}
        </div>
      </div>

      {candidate ? (
        <p className={styles.callout}>
          Your first mock of each exam is free. More mocks unlock with a plan.
        </p>
      ) : null}
      {query.isError ? <p className={styles.note}>{query.error.message}</p> : null}
      {!preview && query.isPending && client && session ? (
        <p className={styles.note}>Loading mocks…</p>
      ) : null}

      <div className={styles.grid}>
        {list.map((mock) => {
          const short = mock.available < mock.total
          return (
            <section key={mock.key} className={styles.card} aria-label={mock.title}>
              <h2 className={styles.cardTitle}>{mock.title}</h2>
              <p className={styles.meta}>
                {sectionText(mock)} · {mock.minutes} minutes
              </p>
              <dl className={styles.facts}>
                <div>
                  <dt>Ready for you</dt>
                  <dd>
                    {mock.available} / {mock.total}
                  </dd>
                </div>
                <div>
                  <dt>Taken</dt>
                  <dd>{mock.taken}</dd>
                </div>
              </dl>
              {short && mock.available > 0 ? (
                <p className={styles.note}>
                  The bank has {mock.available} unseen questions for this pattern; the mock will be
                  shorter, with the time scaled.
                </p>
              ) : null}
              {mock.openAttemptId ? (
                <Link className={styles.primary} to={`/tests/mock/run/${mock.openAttemptId}`}>
                  Continue mock
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={preview || !mock.canStart || mock.available === 0 || start.isPending}
                  onClick={() => start.mutate(mock.key)}
                >
                  {start.isPending && start.variables === mock.key
                    ? 'Building your mock…'
                    : 'Start mock'}
                </button>
              )}
              {!mock.canStart && !mock.openAttemptId ? (
                <p className={styles.note}>You have used your free mock for this exam.</p>
              ) : null}
              {mock.available === 0 ? (
                <p className={styles.note}>
                  You have seen every reviewed question for this pattern.
                </p>
              ) : null}
            </section>
          )
        })}
      </div>
      {preview ? (
        <p className={styles.note}>Preview shows sample mocks. Sign in to build yours.</p>
      ) : null}
      {start.isError ? (
        <p className={styles.error} role="alert">
          {start.error.message}
        </p>
      ) : null}
      {start.data === null ? (
        <p className={styles.error} role="alert">
          You have seen every reviewed question for this pattern.
        </p>
      ) : null}
      <p className={styles.note}>
        NID DAT mocks arrive once the 2026 NID format is confirmed. The all-India live mock is
        listed under its own event when registration opens.
      </p>
    </div>
  )
}
