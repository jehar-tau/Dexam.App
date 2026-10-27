import { useId, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { previewSearch } from '../../features/testSeries/previewSearch'
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
  search,
}: {
  paper: CatalogPaper
  progress?: PaperProgress
  isFree: boolean
  isNew: boolean
  search: string
}) {
  const title = paper.year ? String(paper.year) : 'Sample'
  const detail = [paper.variant, paper.sample && paper.year ? 'Sample' : null]
    .filter(Boolean)
    .join(' · ')
  const accessible = [
    title,
    detail,
    isNew ? 'new' : '',
    isFree ? 'free' : '',
    progress
      ? `best ${progress.bestScore} of ${paper.maxMarks}, ${progress.attempts} attempt${progress.attempts > 1 ? 's' : ''}`
      : 'not attempted',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Link
      className={`${styles.tile} ${progress ? styles.tileAttempted : ''}`}
      to={`/tests/papers/${paper.id}${search}`}
      aria-label={accessible}
    >
      <span className={styles.tileTop}>
        <span className={styles.tileYear}>{title}</span>
        <span className={styles.tileBadges}>
          {isNew ? <span className={`${styles.badge} ${styles.badgeNew}`}>New</span> : null}
          {isFree ? <span className={`${styles.badge} ${styles.badgeFree}`}>Free</span> : null}
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
          <span className={styles.tileStart}>Start →</span>
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
  search,
}: {
  exam: ExamKey
  name: string
  description: string
  progress: Record<string, PaperProgress>
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
            isFree={paper.id === free}
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
  const [level, setLevel] = useState<ProgrammeLevel>('bdes')
  const [examFilter, setExamFilter] = useState<'all' | ExamKey>('all')
  const filterId = useId()

  const levelExams = examsForLevel(level)
  const visibleExams =
    examFilter === 'all' ? levelExams : levelExams.filter((exam) => exam.key === examFilter)
  const progress = preview ? previewProgress : {}
  const stats = preview ? previewStats : null

  const statTiles = [
    { label: 'Papers attempted', value: stats ? String(stats.papersAttempted) : '0' },
    { label: 'Overall accuracy', value: stats ? `${stats.accuracyPercent}%` : '—' },
    { label: 'Questions attempted', value: stats ? String(stats.questionsAttempted) : '0' },
    { label: 'Timed practice', value: stats ? formatMinutes(stats.minutesPractised) : '0m' },
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
            Each exam gives you one free paper. Scores appear after you submit.
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
          search={search}
        />
      ))}
    </div>
  )
}
