import { useQuery } from '@tanstack/react-query'
import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../../features/auth/AuthContext'
import { getSupabaseClient } from '../../features/auth/supabaseClient'
import { fetchProgress } from '../../features/testSeries/bankPaper'
import { previewSearch } from '../../features/testSeries/previewSearch'
import {
  paperAccess,
  useTestAccess,
  type PaperAccess,
  type TestAccess,
} from '../../features/testSeries/testAccess'
import {
  currentCycleYear,
  examsForLevel,
  formatMinutes,
  freePaperId,
  latestYear,
  papersForExam,
  previewProgress,
  previewStats,
  type CatalogPaper,
  type ExamKey,
  type PaperProgress,
  type ProgrammeLevel,
} from '../../features/testSeries/paperCatalog'
import styles from './TestsPapersPage.module.css'

const levels: { key: ProgrammeLevel; label: string }[] = [
  { key: 'bdes', label: 'B.Des' },
  { key: 'mdes', label: 'M.Des' },
]

function PaperTile({
  paper,
  progress,
  isFree,
  isNew,
  access = 'open',
  search,
}: {
  paper: CatalogPaper
  progress?: PaperProgress
  isFree: boolean
  isNew: boolean
  /** Candidates only: free choice, their claimed free paper, or locked. */
  access?: PaperAccess
  search: string
}) {
  const locked = access === 'locked'
  const title = paper.year ? String(paper.year) : 'Sample'
  const detail = [paper.variant, paper.sample && paper.year ? 'Sample' : null]
    .filter(Boolean)
    .join(' · ')
  const accessible = [
    title,
    detail,
    isNew ? 'new' : '',
    isFree ? 'free' : '',
    access === 'free-claimed' ? 'your free paper' : '',
    locked ? 'locked' : '',
    progress
      ? `best ${progress.bestScore} of ${paper.maxMarks}, ${progress.attempts} attempt${progress.attempts > 1 ? 's' : ''}`
      : 'not attempted',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      className={`${styles.tile} ${progress ? styles.tileAttempted : ''} ${locked ? styles.tileLocked : ''}`}
      to={`/tests/papers/${paper.id}${search}`}
      aria-label={accessible}
    >
      <span className={styles.tileTop}>
        <span className={styles.tileYear}>{title}</span>
        <span className={styles.tileBadges}>
          {isNew ? <span className={`${styles.badge} ${styles.badgeNew}`}>New</span> : null}
          {isFree ? <span className={`${styles.badge} ${styles.badgeFree}`}>Free</span> : null}
          {access === 'free-claimed' ? (
            <span className={`${styles.badge} ${styles.badgeFree}`}>Your free paper</span>
          ) : null}
          {locked ? <span className={`${styles.badge} ${styles.badgeLocked}`}>Locked</span> : null}
        </span>
      </span>
      {detail ? <span className={styles.tileDetail}>{detail}</span> : null}
      <span className={styles.tileBottom}>
        {progress ? (
          <>
            <span className={styles.tileScore}>
              {progress.bestScore}
              <span className={styles.tileMax}>/{paper.maxMarks}</span>
            </span>
            <span className={styles.tileAttempts} title="Attempts">
              {progress.attempts}
            </span>
          </>
        ) : (
          <span className={styles.tileStart}>{locked ? 'View' : 'Start →'}</span>
        )}
      </span>
    </Link>
  )
}

function ExamGroup({
  exam,
  name,
  description,
  progress,
  access,
  search,
}: {
  exam: ExamKey
  name: string
  description: string
  progress: Record<string, PaperProgress>
  /** Real (non-preview) access; undefined in preview. */
  access?: TestAccess
  search: string
}) {
  const headingId = useId()
  const list = papersForExam(exam)
  const free = freePaperId(exam)
  const newest = latestYear(exam)
  return (
    <section className={styles.group} aria-labelledby={headingId}>
      <header className={styles.groupHeader}>
        <div>
          <h2 id={headingId} className={styles.groupTitle}>
            {name}
          </h2>
          <p className={styles.groupDescription}>{description}</p>
        </div>
        <span className={styles.groupCount}>
          {list.length} paper{list.length === 1 ? '' : 's'}
        </span>
      </header>
      <div className={styles.grid}>
        {list.map((paper) => (
          <PaperTile
            key={paper.id}
            paper={paper}
            progress={progress[paper.id]}
            // Preview shows the catalogue's free paper; candidates choose their own free paper.
            isFree={access ? paperAccess(paper, access) === 'free-choice' : paper.id === free}
            access={access ? paperAccess(paper, access) : 'open'}
            isNew={!paper.sample && paper.year === newest && newest === currentCycleYear}
            search={search}
          />
        ))}
      </div>
    </section>
  )
}

export function TestsPapersPage() {
  const location = useLocation()
  const search = previewSearch(location.search)
  const preview = search !== ''
  const access = useTestAccess(!preview)
  const { session } = useAuth()
  const client = getSupabaseClient()
  const progressQuery = useQuery({
    queryKey: ['bank-progress', session?.user.id],
    queryFn: () => fetchProgress(client!),
    enabled: !preview && Boolean(client && session),
    staleTime: 30_000,
  })
  const [chosenLevel, setLevel] = useState<ProgrammeLevel | null>(null)
  const level: ProgrammeLevel = chosenLevel ?? access.data?.profile?.level ?? 'bdes'
  const candidate = !preview && access.data?.kind === 'candidate' ? access.data : undefined
  const [examFilter, setExamFilter] = useState<'all' | ExamKey>('all')
  const filterId = useId()

  const levelExams = examsForLevel(level)
  const visibleExams =
    examFilter === 'all' ? levelExams : levelExams.filter((exam) => exam.key === examFilter)
  const progress = preview ? previewProgress : {}
  const stats = preview ? previewStats : null

  const real = progressQuery.data
  const realPapers = real?.attempts.filter((attempt) => attempt.kind !== 'practice') ?? []
  const realTotals = real?.topics.reduce(
    (sum, topic) => ({ total: sum.total + topic.total, scored: sum.scored + topic.scored }),
    { total: 0, scored: 0 },
  )
  const statTiles = stats
    ? [
        { label: 'Papers attempted', value: String(stats.papersAttempted) },
        { label: 'Overall accuracy', value: `${stats.accuracyPercent}%` },
        { label: 'Questions attempted', value: String(stats.questionsAttempted) },
        { label: 'Timed practice', value: formatMinutes(stats.minutesPractised) },
      ]
    : [
        { label: 'Papers attempted', value: String(realPapers.length) },
        {
          label: 'Overall accuracy',
          value: realTotals?.total
            ? `${Math.round((realTotals.scored / realTotals.total) * 100)}%`
            : '—',
        },
        {
          label: 'Best paper score',
          value: realPapers.length
            ? `${Math.round(Math.max(...realPapers.map((attempt) => (attempt.maxScore ? attempt.score / attempt.maxScore : 0))) * 100)}%`
            : '—',
        },
        {
          label: 'Practice sets',
          value: String(
            real?.attempts.filter((attempt) => attempt.kind === 'practice').length ?? 0,
          ),
        },
      ]

  return (
    <div className={styles.page}>
      <div className={styles.titleRow}>
        <h1 className={styles.greeting}>
          {preview ? 'Ready for a timed paper?' : 'Pick a paper to practise'}
        </h1>
        <div className={styles.levelSwitch} role="group" aria-label="Programme level">
          {levels.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`${styles.levelButton} ${level === item.key ? styles.levelActive : ''}`}
              aria-pressed={level === item.key}
              onClick={() => {
                setLevel(item.key)
                setExamFilter('all')
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <section className={styles.hero} aria-labelledby="papers-hero-title">
        <p className={styles.eyebrow}>Previous-year papers</p>
        <h2 id="papers-hero-title" className={styles.heroTitle}>
          Your paper dashboard
        </h2>
        <p className={styles.heroText}>
          Sit full papers under exam conditions, then review every question and track your score
          over time.
        </p>
        <dl className={styles.stats}>
          {statTiles.map((tile) => (
            <div key={tile.label} className={styles.stat}>
              <dt className={styles.statLabel}>{tile.label}</dt>
              <dd className={styles.statValue}>{tile.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.filterBar} aria-label="Filter papers">
        <div>
          <h2 className={styles.filterTitle}>
            {level === 'bdes' ? 'B.Des papers' : 'M.Des papers'}
          </h2>
          <p className={styles.filterText}>
            {access.data?.kind === 'student'
              ? 'Your coaching enrolment includes every paper. Scores appear after you submit.'
              : candidate
                ? 'One free paper per exam: choose any year. Other papers unlock with a plan.'
                : 'Each exam gives you one free paper. Scores appear after you submit.'}
          </p>
        </div>
        <label className={styles.filterLabel} htmlFor={filterId}>
          <span className={styles.visuallyHidden}>Exam</span>
          <select
            id={filterId}
            className={styles.select}
            value={examFilter}
            onChange={(event) => setExamFilter(event.target.value as 'all' | ExamKey)}
          >
            <option value="all">All exams</option>
            {levelExams.map((exam) => (
              <option key={exam.key} value={exam.key}>
                {exam.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {visibleExams.map((exam) => (
        <ExamGroup
          key={exam.key}
          exam={exam.key}
          name={exam.name}
          description={exam.description}
          progress={progress}
          access={candidate}
          search={search}
        />
      ))}
    </div>
  )
}
