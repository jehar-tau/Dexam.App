import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchMocks, startMock } from '../../features/testSeries/bankPaper'
import { fetchDrawingMocks, startDrawingMock } from '../../features/testSeries/drawingPapers'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { useTestAccess } from '../../features/testSeries/testAccess'
import styles from './TestsMockTestPage.module.css'

type Level = 'bdes' | 'mdes'

type ExamCard = {
  exam: 'uceed' | 'ceed' | 'nid' | 'nift'
  name: string
  /** The blueprint key; NID and NIFT depend on the B.Des / M.Des choice. */
  key: (level: Level) => string
  drawing: boolean
  pattern: (level: Level) => string
}

// D-062: one mock per exam, built fresh from the common bank on the 2026 pattern.
const cards: ExamCard[] = [
  {
    exam: 'uceed',
    name: 'UCEED',
    key: () => 'uceed-2026',
    drawing: false,
    pattern: () => 'B.Des · Part A 2 hours (NAT, MSQ, MCQ), then Part B drawing 1 hour',
  },
  {
    exam: 'ceed',
    name: 'CEED',
    key: () => 'ceed-2026',
    drawing: false,
    pattern: () => 'M.Des · Part A 1 hour (NAT, MSQ, MCQ), then Part B drawing 2 hours',
  },
  {
    exam: 'nid',
    name: 'NID DAT',
    key: (level) => `nid-dat-${level}-2026`,
    drawing: true,
    pattern: (level) =>
      `${level === 'bdes' ? 'B.Des' : 'M.Des'} · six drawing tasks in 3 hours, 100 marks`,
  },
  {
    exam: 'nift',
    name: 'NIFT',
    key: (level) => `nift-${level}-2026`,
    drawing: false,
    pattern: (level) =>
      level === 'bdes'
        ? 'B.Des GAT · 100 questions in 2 hours'
        : 'M.Des GAT · 120 questions in 2½ hours',
  },
]

/** Mock test: pick UCEED, CEED, NID or NIFT and the paper starts. */
export function TestsMockTestPage() {
  const search = previewSearch(useLocation().search)
  const preview = search !== ''
  const navigate = useNavigate()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const access = useTestAccess(!preview)
  const enabled = !preview && Boolean(client && session)
  const mocks = useQuery({
    queryKey: ['mocks', session?.user.id],
    queryFn: () => fetchMocks(client!),
    enabled,
  })
  const drawing = useQuery({
    queryKey: ['drawing-mocks', session?.user.id],
    queryFn: () => fetchDrawingMocks(client!),
    enabled,
  })
  const [chosenLevel, setLevel] = useState<Level | null>(null)
  const level = chosenLevel ?? access.data?.profile?.level ?? 'bdes'

  const start = useMutation({
    mutationFn: async (card: ExamCard) => {
      const key = card.key(level)
      if (card.drawing) return `/tests/part-b/${await startDrawingMock(client!, key)}`
      const attemptId = await startMock(client!, key)
      if (!attemptId) throw new Error('You have seen every reviewed question for this exam.')
      return `/tests/mock/run/${attemptId}`
    },
    onSuccess: (path) => void navigate(path),
  })

  const statusFor = (card: ExamCard) => {
    const key = card.key(level)
    if (card.drawing) {
      const mock = drawing.data?.find((item) => item.key === key)
      return mock
        ? {
            open: mock.openAttemptId ? `/tests/part-b/${mock.openAttemptId}` : null,
            canStart: mock.canStart && mock.pool >= 4,
            taken: mock.taken,
          }
        : null
    }
    const mock = mocks.data?.find((item) => item.key === key)
    return mock
      ? {
          open: mock.openAttemptId ? `/tests/mock/run/${mock.openAttemptId}` : null,
          canStart: mock.canStart && mock.available > 0,
          taken: mock.taken,
        }
      : null
  }

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Mock test</h1>
          <p className={styles.note}>
            Choose an exam and the paper starts: a new paper each time, built from Dexam&apos;s
            common question bank on the 2026 pattern, with questions you have not seen.
          </p>
        </div>
        <div className={styles.levels} role="group" aria-label="Programme level for NID and NIFT">
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

      {mocks.isError || drawing.isError ? (
        <p className={styles.error} role="alert">
          {(mocks.error ?? drawing.error)?.message}
        </p>
      ) : null}
      {start.isError ? (
        <p className={styles.error} role="alert">
          {start.error.message}
        </p>
      ) : null}

      <div className={styles.grid}>
        {cards.map((card) => {
          const status = statusFor(card)
          const loading = enabled && !status && (mocks.isPending || drawing.isPending)
          return (
            <section key={card.exam} className={styles.card} aria-label={card.name}>
              <h2 className={styles.cardTitle}>{card.name}</h2>
              <p className={styles.meta}>{card.pattern(level)}</p>
              {status?.taken ? (
                <p className={styles.note}>
                  Taken {status.taken} {status.taken === 1 ? 'time' : 'times'}
                </p>
              ) : null}
              {status?.open ? (
                <Link className={styles.primary} to={status.open}>
                  Continue
                </Link>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={preview || loading || !status?.canStart || start.isPending}
                  onClick={() => start.mutate(card)}
                >
                  {start.isPending && start.variables?.exam === card.exam
                    ? 'Building your paper…'
                    : 'Start'}
                </button>
              )}
              {status && !status.canStart && !status.open ? (
                <p className={styles.note}>
                  Not available on your plan right now. <Link to="/tests/plans">See plans</Link>
                </p>
              ) : null}
            </section>
          )
        })}
      </div>
      {preview ? <p className={styles.note}>Preview: sign in to start a mock test.</p> : null}
    </div>
  )
}
