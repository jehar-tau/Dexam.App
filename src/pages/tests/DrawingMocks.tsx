import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  fetchDrawingMocks,
  startDrawingMock,
  type DrawingMock,
} from '../../features/testSeries/drawingPapers'
import styles from './TestsMocksPage.module.css'

// Fictional preview cards; the server builds the real mock for each student.
const previewDrawingMocks: DrawingMock[] = [
  {
    key: 'nid-dat-bdes-2026',
    level: 'bdes',
    title: 'NID DAT B.Des drawing mock',
    minutes: 180,
    tasks: 6,
    totalMarks: 100,
    pool: 320,
    unseen: 320,
    taken: 0,
    openAttemptId: null,
    canStart: true,
  },
  {
    key: 'nid-dat-mdes-2026',
    level: 'mdes',
    title: 'NID DAT M.Des drawing mock',
    minutes: 180,
    tasks: 6,
    totalMarks: 100,
    pool: 310,
    unseen: 310,
    taken: 0,
    openAttemptId: null,
    canStart: true,
  },
]

/**
 * D-061: NID DAT drawing mocks, mixed for the student from the common drawing pool. The 3-hour
 * clock runs on the Part B screen once they begin.
 */
export function DrawingMockCards({ level, preview }: { level: 'bdes' | 'mdes'; preview: boolean }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['drawing-mocks', session?.user.id],
    queryFn: () => fetchDrawingMocks(client!),
    enabled: !preview && Boolean(client && session),
  })
  const start = useMutation({
    mutationFn: (key: string) => startDrawingMock(client!, key),
    onSuccess: (attemptId) => void navigate(`/tests/part-b/${attemptId}`),
  })
  const mocks = (preview ? previewDrawingMocks : (query.data ?? [])).filter(
    (mock) => mock.level === level,
  )

  return (
    <>
      {query.isError ? <p className={styles.note}>{query.error.message}</p> : null}
      {mocks.map((mock) => (
        <section key={mock.key} className={styles.card} aria-label={mock.title}>
          <h3 className={styles.cardTitle}>{mock.title}</h3>
          <p className={styles.meta}>
            {mock.tasks} drawing tasks · {mock.minutes / 60} hours · {mock.totalMarks} marks
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>New tasks for you</dt>
              <dd>{mock.unseen}</dd>
            </div>
            <div>
              <dt>Taken</dt>
              <dd>{mock.taken}</dd>
            </div>
          </dl>
          <p className={styles.note}>
            Built for you from the whole drawing bank: one task of each kind (scene, story, product,
            communication…), never one you have had before.
          </p>
          {mock.openAttemptId ? (
            <Link className={styles.primary} to={`/tests/part-b/${mock.openAttemptId}`}>
              Continue mock
            </Link>
          ) : (
            <button
              type="button"
              className={styles.primary}
              disabled={preview || !mock.canStart || mock.pool < 4 || start.isPending}
              onClick={() => start.mutate(mock.key)}
            >
              {start.isPending && start.variables === mock.key
                ? 'Building your mock…'
                : 'Start mock'}
            </button>
          )}
          {!mock.canStart && !mock.openAttemptId ? (
            <p className={styles.note}>
              You have used your free drawing mock. <Link to="/tests/plans">See plans</Link>
            </p>
          ) : null}
          {start.isError && start.variables === mock.key ? (
            <p className={styles.error} role="alert">
              {start.error.message}
            </p>
          ) : null}
        </section>
      ))}
    </>
  )
}
