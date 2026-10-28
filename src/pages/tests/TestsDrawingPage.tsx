import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import {
  drawingGroup,
  drawingLevel,
  drawingTitle,
  fetchDrawingPapers,
  startDrawingPaper,
  type DrawingGroup,
  type DrawingPaper,
} from '../../features/testSeries/drawingPapers'
import { partBStatusLabel } from '../../features/testSeries/partB'
import { previewSearch } from '../../features/testSeries/previewSearch'
import { useTestAccess } from '../../features/testSeries/testAccess'
import styles from './TestsMocksPage.module.css'

// Fictional preview list; real availability is computed per student by the server.
const previewPapers: DrawingPaper[] = [
  {
    paperId: 'nid-bdes-dat-mock-01',
    exam: 'nid',
    tasks: 6,
    minutes: 180,
    totalMarks: 100,
    original: true,
    locked: false,
    latest: null,
  },
  {
    paperId: 'uceed-2025',
    exam: 'uceed',
    tasks: 1,
    minutes: 60,
    totalMarks: 100,
    original: false,
    locked: false,
    latest: null,
  },
  {
    paperId: 'nid-mdes-dat-mock-01',
    exam: 'nid',
    tasks: 6,
    minutes: 180,
    totalMarks: 100,
    original: true,
    locked: false,
    latest: null,
  },
  {
    paperId: 'ceed-2026',
    exam: 'ceed',
    tasks: 5,
    minutes: 120,
    totalMarks: 100,
    original: false,
    locked: false,
    latest: null,
  },
]

const groups: { key: DrawingGroup; title: string; note: string }[] = [
  {
    key: 'nid-mock',
    title: 'NID DAT drawing mocks',
    note: 'The 2026 Prelims pattern: one 3-hour, 100-mark paper of six drawing tasks with sub-parts, and no objective section.',
  },
  {
    key: 'part-b',
    title: 'Part B drawing papers',
    note: 'Each year’s Part B on its own clock: UCEED 60 minutes, CEED 120 minutes.',
  },
  {
    key: 'nift-cat',
    title: 'NIFT CAT',
    note: 'The Creative Ability Test on its own clock: 3 hours.',
  },
  {
    key: 'nid-past',
    title: 'NID past-paper drawing tasks',
    note: 'The drawing tasks from earlier NID DAT papers, timed at 20 minutes a task.',
  },
]

/** D-060: timed drawing papers, answered on paper and uploaded for a Dexam evaluator. */
export function TestsDrawingPage() {
  const search = previewSearch(useLocation().search)
  const preview = search !== ''
  const navigate = useNavigate()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const access = useTestAccess(!preview)
  const query = useQuery({
    queryKey: ['drawing-papers', session?.user.id],
    queryFn: () => fetchDrawingPapers(client!),
    enabled: !preview && Boolean(client && session),
  })
  const [chosenLevel, setLevel] = useState<'bdes' | 'mdes' | null>(null)
  const level = chosenLevel ?? access.data?.profile?.level ?? 'bdes'
  const start = useMutation({
    mutationFn: (paperId: string) => startDrawingPaper(client!, paperId),
    onSuccess: (attemptId) => void navigate(`/tests/part-b/${attemptId}`),
  })

  const list = (preview ? previewPapers : (query.data ?? [])).filter(
    (paper) => drawingLevel(paper.paperId) === level,
  )

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <div>
          <h1 className={styles.title}>Drawing papers</h1>
          <p className={styles.note}>
            Timed drawing papers. Draw on paper, then photograph or scan your sheets and upload them
            in the 10-minute window after the clock ends. A Dexam evaluator marks them without
            seeing your name.
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

      {query.isError ? <p className={styles.note}>{query.error.message}</p> : null}
      {!preview && query.isPending && client && session ? (
        <p className={styles.note}>Loading drawing papers…</p>
      ) : null}
      {start.isError ? (
        <p className={styles.error} role="alert">
          {start.error.message}
        </p>
      ) : null}

      {groups.map((group) => {
        const papers = list.filter((paper) => drawingGroup(paper) === group.key)
        if (!papers.length) return null
        return (
          <section key={group.key} aria-labelledby={`drawing-${group.key}`}>
            <h2 id={`drawing-${group.key}`} className={styles.cardTitle}>
              {group.title}
            </h2>
            <p className={styles.note}>{group.note}</p>
            <div className={styles.grid}>
              {papers.map((paper) => (
                <DrawingCard
                  key={paper.paperId}
                  paper={paper}
                  preview={preview}
                  starting={start.isPending && start.variables === paper.paperId}
                  disabled={start.isPending}
                  onStart={() => start.mutate(paper.paperId)}
                />
              ))}
            </div>
          </section>
        )
      })}
      {!preview && query.data && !list.length ? (
        <p className={styles.note}>No drawing papers are ready for this level yet.</p>
      ) : null}
      {preview ? (
        <p className={styles.note}>Preview shows sample drawing papers. Sign in to take one.</p>
      ) : null}
    </div>
  )
}

function DrawingCard({
  paper,
  preview,
  starting,
  disabled,
  onStart,
}: {
  paper: DrawingPaper
  preview: boolean
  starting: boolean
  disabled: boolean
  onStart: () => void
}) {
  const title = drawingTitle(paper.paperId)
  const latest = paper.latest
  const open = latest && ['none', 'drawing', 'uploading'].includes(latest.status)
  return (
    <section className={styles.card} aria-label={title}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.meta}>
        {paper.tasks} {paper.tasks === 1 ? 'task' : 'tasks'} · {paper.minutes} minutes ·{' '}
        {paper.totalMarks} marks
      </p>
      {latest ? (
        <dl className={styles.facts}>
          <div>
            <dt>Last sitting</dt>
            <dd>
              {latest.status === 'evaluated' && latest.score !== null
                ? `${latest.score} / ${latest.maxScore}`
                : partBStatusLabel[latest.status]}
            </dd>
          </div>
        </dl>
      ) : null}
      {open ? (
        <Link className={styles.primary} to={`/tests/part-b/${latest.attemptId}`}>
          Continue
        </Link>
      ) : (
        <button
          type="button"
          className={styles.primary}
          disabled={preview || paper.locked || disabled}
          onClick={onStart}
        >
          {starting ? 'Starting…' : latest ? 'Take again' : 'Start'}
        </button>
      )}
      {latest && !open ? (
        <Link className={styles.note} to={`/tests/part-b/${latest.attemptId}`}>
          View sheets and feedback
        </Link>
      ) : null}
      {paper.locked ? (
        <p className={styles.note}>
          Not included in your access. <Link to="/tests/plans">See plans</Link>
        </p>
      ) : null}
    </section>
  )
}
