import { useEffect, useMemo, useRef, useState } from 'react'

import type { ExamResponse } from '../../features/testSeries/examAttempt'
import type { ExamQuestion } from '../../features/testSeries/examPaper'
import { ResponseInput } from '../tests/exam/ExamScreen'
import { PrintedBlock } from '../tests/exam/PrintedBlock'
import exam from '../tests/exam/ExamWindow.module.css'
import styles from './QuestionReviewPage.module.css'

/**
 * D-060 owner question review (local dev server only). Every bank question as a candidate would
 * see it in the exam window, with its source page, answer key and the cropper's flags, and a
 * verdict that is saved back to the content workstation.
 */

type ReviewQuestion = {
  id: string
  paperId: string
  paperTitle: string
  exam: string
  year: number | null
  number: string
  type: 'NAT' | 'MSQ' | 'MCQ' | 'DESCRIPTIVE'
  prompt: string
  options: { key: string; text: string }[]
  answer: string | null
  answerStatus: string
  block: string | null
  blockFlags: string[]
  figures: string[]
  sourcePages: string[]
  page: number | null
  cropReview: string
  holds: string[]
  taskMarks: number | null
  original: boolean
  ownerProvided?: boolean
  drawingType?: string | null
}

type ReviewData = {
  exportedAt: string
  papers: { id: string; exam: string; year: number | null; title: string; original: boolean }[]
  questions: ReviewQuestion[]
}

type Verdict = { verdict: 'ok' | 'fix'; reasons: string[]; note: string; reviewedAt: string }

const reasonLabels: Record<string, string> = {
  'crop-cut-off': 'Crop cuts off part of the question',
  'crop-extra-content': 'Crop includes another question or extra text',
  'wrong-question': 'Wrong question or number',
  'missing-figure': 'Figure or options missing',
  'wrong-answer-key': 'Answer key looks wrong',
  'text-or-options': 'Text or options need fixing',
  other: 'Other',
}

const flagLabels: Record<string, string> = {
  'continues-on-next-page': 'Joined across a page break',
  'marker-not-found': 'Question start not found',
  'very-tall': 'Very tall crop',
  'very-short': 'Very short crop',
  'spans-many-pages': 'Spans several pages',
  'page-differs-from-bank': 'Found on a different page',
  'empty-block': 'Empty crop',
  'no-page-renders': 'No page images',
}

const examNames: Record<string, string> = { uceed: 'UCEED', ceed: 'CEED', nid: 'NID', nift: 'NIFT' }
const typeLabels: Record<ReviewQuestion['type'], string> = {
  NAT: 'Numerical answer',
  MSQ: 'Multiple select',
  MCQ: 'Multiple choice',
  DESCRIPTIVE: 'Drawing task',
}
const PAGE = 20
const examRank: Record<string, number> = { uceed: 0, ceed: 1, nid: 2, nift: 3 }
const numberOf = (value: string) => Number(/\d+/.exec(value)?.[0] ?? 0)

/** Newest papers first, exams in UCEED, CEED, NID, NIFT order, questions in paper order. */
function byPaper(a: ReviewQuestion, b: ReviewQuestion) {
  return (
    (examRank[a.exam] ?? 9) - (examRank[b.exam] ?? 9) ||
    (b.year ?? 0) - (a.year ?? 0) ||
    a.paperId.localeCompare(b.paperId) ||
    Number(a.type === 'DESCRIPTIVE') - Number(b.type === 'DESCRIPTIVE') ||
    numberOf(a.number) - numberOf(b.number) ||
    a.number.localeCompare(b.number)
  )
}
const media = (path: string) =>
  `/__review/media/${path.split('/').map(encodeURIComponent).join('/')}`

type StatusFilter = 'all' | 'todo' | 'ok' | 'fix' | 'flagged'

export function QuestionReviewPage() {
  const [data, setData] = useState<ReviewData | null>(null)
  const [error, setError] = useState('')
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({})
  const [examFilter, setExam] = useState('all')
  const [paperFilter, setPaper] = useState('all')
  const [typeFilter, setType] = useState('all')
  const [status, setStatus] = useState<StatusFilter>('todo')
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const more = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void Promise.all([fetch('/__review/bank.json'), fetch('/__review/verdicts')])
      .then(async ([bank, saved]) => {
        if (!bank.ok) throw new Error('The review export is not available on this server.')
        const loaded = (await bank.json()) as ReviewData
        loaded.questions.sort(byPaper)
        setData(loaded)
        setVerdicts(saved.ok ? ((await saved.json()) as Record<string, Verdict>) : {})
      })
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : 'The review data could not be loaded.'),
      )
  }, [])

  const papers = useMemo(
    () =>
      (data?.papers ?? [])
        .filter((paper) => examFilter === 'all' || paper.exam === examFilter)
        .sort((a, b) => a.id.localeCompare(b.id)),
    [data, examFilter],
  )

  const list = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.questions ?? []).filter((question) => {
      if (examFilter !== 'all' && question.exam !== examFilter) return false
      if (paperFilter !== 'all' && question.paperId !== paperFilter) return false
      if (typeFilter !== 'all' && question.type !== typeFilter) return false
      const verdict = verdicts[question.id]?.verdict
      if (status === 'todo' && verdict) return false
      if (status === 'ok' && verdict !== 'ok') return false
      if (status === 'fix' && verdict !== 'fix') return false
      if (
        status === 'flagged' &&
        !(question.blockFlags.some((flag) => flag !== 'continues-on-next-page') || !question.block)
      )
        return false
      if (needle && !`${question.id} ${question.prompt}`.toLowerCase().includes(needle))
        return false
      return true
    })
  }, [data, examFilter, paperFilter, typeFilter, status, query, verdicts])

  // Load the next page of cards as the end of the list scrolls into view.
  useEffect(() => {
    const target = more.current
    if (!target) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + PAGE)
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [list.length])

  const resetPaging = () => setShown(PAGE)

  async function save(id: string, verdict: Omit<Verdict, 'reviewedAt'>) {
    const response = await fetch('/__review/verdicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...verdict }),
    })
    if (!response.ok) throw new Error('Not saved')
    const stored = (await response.json()) as Verdict & { id: string }
    setVerdicts((current) => ({ ...current, [id]: stored }))
  }

  if (error) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Question review</h1>
        <p role="alert">{error}</p>
      </main>
    )
  }
  if (!data) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>Question review</h1>
        <p>Loading every question…</p>
      </main>
    )
  }

  const total = data.questions.length
  const reviewed = data.questions.filter((question) => verdicts[question.id]).length
  const fixes = data.questions.filter((question) => verdicts[question.id]?.verdict === 'fix').length

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Question review</h1>
          <p className={styles.note}>
            Each question as a student sees it in the exam window. Mark it right, or say what to
            fix; your notes are saved to the content workstation and applied to the rest.
          </p>
        </div>
        <dl className={styles.counts}>
          <div>
            <dt>Questions</dt>
            <dd>{total}</dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>{reviewed}</dd>
          </div>
          <div>
            <dt>Need a fix</dt>
            <dd>{fixes}</dd>
          </div>
        </dl>
        <progress className={styles.progress} max={total} value={reviewed} aria-label="Reviewed" />
      </header>

      <div className={styles.filters} role="group" aria-label="Filters">
        <label>
          Exam
          <select
            value={examFilter}
            onChange={(event) => {
              setExam(event.target.value)
              setPaper('all')
              resetPaging()
            }}
          >
            <option value="all">All exams</option>
            {Object.entries(examNames).map(([key, name]) => (
              <option key={key} value={key}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paper
          <select
            value={paperFilter}
            onChange={(event) => {
              setPaper(event.target.value)
              resetPaging()
            }}
          >
            <option value="all">All papers</option>
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Type
          <select
            value={typeFilter}
            onChange={(event) => {
              setType(event.target.value)
              resetPaging()
            }}
          >
            <option value="all">All types</option>
            {Object.entries(typeLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as StatusFilter)
              resetPaging()
            }}
          >
            <option value="todo">Not reviewed yet</option>
            <option value="all">Everything</option>
            <option value="flagged">Flagged by the cropper</option>
            <option value="fix">Marked to fix</option>
            <option value="ok">Marked right</option>
          </select>
        </label>
        <label className={styles.search}>
          Search
          <input
            type="search"
            value={query}
            placeholder="Text or question id"
            onChange={(event) => {
              setQuery(event.target.value)
              resetPaging()
            }}
          />
        </label>
      </div>
      <p className={styles.note}>
        {list.length} {list.length === 1 ? 'question' : 'questions'} match.
      </p>

      <ol className={styles.list}>
        {list.slice(0, shown).map((question) => (
          <ReviewCard
            key={question.id}
            question={question}
            verdict={verdicts[question.id]}
            onSave={(verdict) => save(question.id, verdict)}
          />
        ))}
      </ol>
      {shown < list.length ? (
        <div ref={more} className={styles.more}>
          <button type="button" onClick={() => setShown((count) => count + PAGE)}>
            Show more
          </button>
        </div>
      ) : null}
    </main>
  )
}

// Holds that an approved crop clears: the printed block then carries the figure and options.
const CROP_HOLDS = new Set([
  'visual-crop-awaiting-review',
  'visual-crop-missing',
  'visual-crop-file-missing',
  'visual-crop-rejected',
  'structured-options-missing',
  'image-only-no-semantic-text',
])

/** What marking this question right does for students. */
function goLive(question: ReviewQuestion): string {
  if (question.original) return 'Dexam original: live for students now.'
  if (question.ownerProvided)
    return question.holds.includes('figure-missing-in-source')
      ? 'Mentions a picture the source does not include; marking it right uses it as text anyway.'
      : 'Goes into NID drawing mocks once marked right.'
  const remaining = question.block
    ? question.holds.filter((hold) => !CROP_HOLDS.has(hold))
    : question.holds
  const needsKey = question.type !== 'DESCRIPTIVE' && !question.answer
  if (!remaining.length && !needsKey)
    return question.block
      ? 'Goes to students, exactly as shown, once marked right.'
      : 'Already shown to students as text.'
  return `Also held for: ${[...(needsKey ? ['answer key'] : []), ...remaining].join(', ')}.`
}

function toExamQuestion(question: ReviewQuestion): ExamQuestion {
  const kind = question.type === 'NAT' ? 'nat' : question.type === 'MSQ' ? 'msq' : 'mcq'
  const options = question.options.length
    ? question.options
    : ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '' }))
  return {
    id: question.id,
    kind,
    prompt: question.prompt,
    number: question.number,
    block: question.block ? { src: media(question.block) } : undefined,
    images: question.block ? [] : question.figures.map((figure) => ({ src: media(figure) })),
    options:
      kind === 'nat' ? undefined : options.map((option) => ({ id: option.key, text: option.text })),
  }
}

function ReviewCard({
  question,
  verdict,
  onSave,
}: {
  question: ReviewQuestion
  verdict: Verdict | undefined
  onSave: (verdict: Omit<Verdict, 'reviewedAt'>) => Promise<void>
}) {
  const [response, setResponse] = useState<ExamResponse | undefined>(undefined)
  const [fixing, setFixing] = useState(false)
  const [reasons, setReasons] = useState<string[]>(verdict?.reasons ?? [])
  const [note, setNote] = useState(verdict?.note ?? '')
  const [source, setSource] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const examQuestion = toExamQuestion(question)
  const drawing = question.type === 'DESCRIPTIVE'
  const flags = question.blockFlags.filter((flag) => flag !== 'continues-on-next-page')

  async function submit(value: Omit<Verdict, 'reviewedAt'>) {
    setSaving(true)
    setFailed(false)
    try {
      await onSave(value)
      setFixing(false)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li
      className={`${styles.card} ${verdict?.verdict === 'ok' ? styles.cardOk : ''} ${verdict?.verdict === 'fix' ? styles.cardFix : ''}`}
      aria-label={`${question.paperTitle}, question ${question.number}`}
    >
      <div className={styles.source}>
        <span>
          <strong>{question.paperTitle}</strong> · Q{question.number}
          {question.page ? ` · page ${question.page}` : ''}
        </span>
        <span className={styles.chips}>
          {question.original ? <span className={styles.chip}>Dexam original</span> : null}
          {question.ownerProvided ? <span className={styles.chip}>Your collection</span> : null}
          {question.drawingType ? (
            <span className={styles.chip}>Type: {question.drawingType}</span>
          ) : null}
          {!question.block && !question.original && !question.ownerProvided ? (
            <span className={styles.chipWarn}>Shown as text (no crop)</span>
          ) : null}
          {flags.map((flag) => (
            <span key={flag} className={styles.chipWarn}>
              {flagLabels[flag] ?? flag}
            </span>
          ))}
          {question.blockFlags.includes('continues-on-next-page') ? (
            <span className={styles.chip}>{flagLabels['continues-on-next-page']}</span>
          ) : null}
        </span>
      </div>

      <div className={styles.examPane}>
        <div className={exam.questionHead}>
          <h2 className={exam.questionNumber}>Question {question.number}</h2>
          <span className={exam.questionMeta}>
            {typeLabels[question.type]}
            {question.taskMarks ? ` · ${question.taskMarks} marks` : ''}
          </span>
        </div>
        <div className={exam.questionScroll}>
          {examQuestion.block ? (
            <PrintedBlock
              image={examQuestion.block}
              prompt={question.prompt}
              label={`Question ${question.number}`}
            />
          ) : (
            <>
              <p className={exam.prompt}>{question.prompt}</p>
              {examQuestion.images?.map((image, index) => (
                <img
                  key={image.src}
                  className={exam.figureImage}
                  src={image.src}
                  alt={`Figure ${index + 1}`}
                />
              ))}
            </>
          )}
          {drawing ? (
            <p className={styles.drawingNote}>
              Drawn on paper; the sheets are photographed and uploaded after the drawing time.
            </p>
          ) : (
            <ResponseInput
              question={examQuestion}
              response={response}
              onUpdate={(update) => setResponse((current) => update(current))}
            />
          )}
        </div>
      </div>

      <div className={styles.facts}>
        {drawing ? null : (
          <span>
            Answer key: <strong>{question.answer ?? 'none yet'}</strong>
            {question.answer ? ` (${question.answerStatus})` : ''}
          </span>
        )}
        <span className={styles.holds}>{goLive(question)}</span>
        {question.sourcePages.length ? (
          <button type="button" className={styles.linkButton} onClick={() => setSource((v) => !v)}>
            {source ? 'Hide source page' : 'Show source page'}
          </button>
        ) : null}
      </div>
      {source ? (
        <div className={styles.pages}>
          {question.sourcePages.map((page) => (
            <img key={page} src={media(page)} alt={`Source page for question ${question.number}`} />
          ))}
        </div>
      ) : null}

      <div className={styles.verdict}>
        <button
          type="button"
          className={styles.okButton}
          aria-pressed={verdict?.verdict === 'ok'}
          disabled={saving}
          onClick={() => void submit({ verdict: 'ok', reasons: [], note: '' })}
        >
          Looks right
        </button>
        <button
          type="button"
          className={styles.fixButton}
          aria-pressed={verdict?.verdict === 'fix'}
          aria-expanded={fixing}
          onClick={() => setFixing((open) => !open)}
        >
          Needs a fix
        </button>
        {verdict ? (
          <span className={styles.saved}>
            {verdict.verdict === 'ok' ? 'Marked right' : 'Marked to fix'}
            {verdict.note ? ` · “${verdict.note}”` : ''}
          </span>
        ) : null}
        {failed ? (
          <span className={styles.error} role="alert">
            Not saved. Is the dev server still running?
          </span>
        ) : null}
      </div>
      {fixing ? (
        <form
          className={styles.fixForm}
          onSubmit={(event) => {
            event.preventDefault()
            void submit({ verdict: 'fix', reasons, note })
          }}
        >
          <fieldset>
            <legend>What needs fixing?</legend>
            {Object.entries(reasonLabels).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={reasons.includes(key)}
                  onChange={() =>
                    setReasons((current) =>
                      current.includes(key)
                        ? current.filter((item) => item !== key)
                        : [...current, key],
                    )
                  }
                />
                {label}
              </label>
            ))}
          </fieldset>
          <label className={styles.noteField}>
            Note (optional)
            <textarea
              value={note}
              maxLength={2000}
              rows={2}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button type="submit" className={styles.fixButton} disabled={saving}>
            Save fix note
          </button>
        </form>
      ) : null}
    </li>
  )
}
