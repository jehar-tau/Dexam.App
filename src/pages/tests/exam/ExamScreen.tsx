import { useEffect, useRef, useState } from 'react'

import {
  clearResponse,
  formatClock,
  goToQuestion,
  isEmptyResponse,
  markForReviewAndNext,
  questionStatus,
  questionStatuses,
  remainingMs,
  sanitiseNumeric,
  saveAndNext,
  statusCounts,
  type ExamAttempt,
  type ExamResponse,
} from '../../../features/testSeries/examAttempt'
import {
  paperQuestions,
  sectionOf,
  type ExamPaper,
  type ExamQuestion,
} from '../../../features/testSeries/examPaper'
import { ExamFigure } from './ExamFigure'
import { PrintedBlock } from './PrintedBlock'
import type { Candidate } from './ExamPreStart'
import { StatusLegend } from './ExamStatus'
import { statusClassName } from './statusClassName'
import styles from './ExamWindow.module.css'

const WARNING_MS = 5 * 60_000

type Draft = { questionId: string; response: ExamResponse | undefined }

export function ExamScreen({
  paper,
  paperLabel,
  candidate,
  attempt,
  now,
  onChange,
  onSubmit,
}: {
  paper: ExamPaper
  paperLabel: string
  candidate: Candidate
  attempt: ExamAttempt
  now: number
  onChange: (attempt: ExamAttempt) => void
  onSubmit: () => void
}) {
  // The on-screen response; it becomes the saved one only through Save & Next or Mark for Review & Next.
  const [draft, setDraft] = useState<Draft | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const question =
    paperQuestions(paper).find((item) => item.id === attempt.activeId) ?? paperQuestions(paper)[0]!
  const section = sectionOf(paper, question.id) ?? paper.sections[0]!
  const number = paperQuestions(paper).indexOf(question) + 1
  const response = draft?.questionId === question.id ? draft.response : attempt.saved[question.id]
  const remaining = remainingMs(attempt, now)

  const act = (next: ExamAttempt) => {
    setDraft(null)
    onChange(next)
  }

  const goTo = (questionId: string) => {
    act(goToQuestion(attempt, questionId))
    setPaletteOpen(false)
  }

  return (
    <div className={styles.examFrame}>
      <header className={styles.examHeader} inert={confirming}>
        <span className={styles.examBrand}>
          <span className={styles.examMark} aria-hidden="true">
            D
          </span>
          <span className={styles.examHeaderPaper}>{paperLabel}</span>
        </span>
        <span className={styles.examCandidate}>
          <span className={styles.examAvatar} aria-hidden="true">
            {candidate.initials}
          </span>
          <span className={styles.examCandidateText}>
            <span className={styles.examCandidateName}>{candidate.name}</span>
            <span className={styles.examCandidateRoll}>{candidate.rollNumber}</span>
          </span>
        </span>
      </header>

      <div className={styles.examBar} inert={confirming}>
        <nav className={styles.sectionTabs} aria-label="Sections">
          {paper.sections.map((item) => {
            const counts = statusCounts(
              attempt,
              item.questions.map((q) => q.id),
            )
            return (
              <button
                key={item.id}
                type="button"
                className={`${styles.sectionTab} ${item.id === section.id ? styles.sectionTabActive : ''}`}
                aria-current={item.id === section.id ? 'true' : undefined}
                onClick={() => goTo(item.questions[0]!.id)}
              >
                {item.name}
                <span className={styles.sectionTabCount}>
                  {counts.answered + counts['answered-review']}/{counts.total}
                </span>
              </button>
            )
          })}
        </nav>
        {paper.untimed ? (
          <div className={styles.timer}>
            <span className={styles.timerLabel}>Untimed practice</span>
          </div>
        ) : (
          <>
            <div
              className={`${styles.timer} ${remaining <= WARNING_MS ? styles.timerWarning : ''}`}
              role="timer"
              aria-label="Time left"
            >
              <span className={styles.timerLabel}>Time left</span>
              <span className={styles.timerValue}>{formatClock(remaining)}</span>
            </div>
            <span className={styles.visuallyHidden} aria-live="polite">
              {remaining <= WARNING_MS ? 'Five minutes or less left.' : ''}
            </span>
          </>
        )}
        <button
          type="button"
          className={styles.paletteToggle}
          aria-expanded={paletteOpen}
          aria-controls="exam-palette"
          onClick={() => setPaletteOpen((open) => !open)}
        >
          {paletteOpen ? 'Hide palette' : 'Question palette'}
        </button>
      </div>

      <div className={styles.examBody} inert={confirming}>
        <main className={styles.questionArea} aria-labelledby="exam-question-title">
          <div className={styles.questionHead}>
            <h1 id="exam-question-title" className={styles.questionNumber}>
              Question {number}
            </h1>
            <span className={styles.questionMeta}>
              {section.kindLabel}
              {section.marking ? (
                <>
                  {' · Marks '}
                  <span className={styles.markGood}>+{section.marking.correct}</span>
                  {' | '}
                  <span className={styles.markBad}>
                    {section.marking.wrong < 0 ? `−${-section.marking.wrong}` : '0'}
                  </span>
                </>
              ) : null}
            </span>
          </div>
          <div className={styles.questionScroll}>
            {question.block ? (
              <PrintedBlock
                image={question.block}
                prompt={question.prompt}
                label={`Question ${number}`}
              />
            ) : (
              <p className={styles.prompt}>{question.prompt}</p>
            )}
            {question.figure ? <ExamFigure id={question.figure} /> : null}
            {question.images?.map((image, index) => (
              <img
                key={image.src}
                className={styles.figureImage}
                src={image.src}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                alt={`Figure ${index + 1} for question ${number}`}
                draggable={false}
              />
            ))}
            <ResponseInput
              key={question.id}
              question={question}
              response={response}
              onUpdate={(update) =>
                // Build on the latest draft so quick successive taps are never lost.
                setDraft((previous) => ({
                  questionId: question.id,
                  response: update(
                    previous?.questionId === question.id
                      ? previous.response
                      : attempt.saved[question.id],
                  ),
                }))
              }
            />
          </div>
          <div className={styles.actionBar}>
            <div className={styles.actionGroup}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => act(markForReviewAndNext(attempt, paper, response))}
              >
                Mark for Review &amp; Next
              </button>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => {
                  onChange(clearResponse(attempt))
                  setDraft({ questionId: question.id, response: undefined })
                }}
              >
                Clear Response
              </button>
            </div>
            <button
              type="button"
              className={styles.primaryAction}
              onClick={() => act(saveAndNext(attempt, paper, response))}
            >
              Save &amp; Next
            </button>
          </div>
        </main>

        <aside
          id="exam-palette"
          className={`${styles.palette} ${paletteOpen ? styles.paletteOpen : ''}`}
          aria-label="Question palette"
        >
          <StatusLegend
            counts={statusCounts(
              attempt,
              section.questions.map((q) => q.id),
            )}
          />
          <h2 className={styles.paletteSection}>Section: {section.name}</h2>
          <p className={styles.paletteHint}>Choose a question number</p>
          <ol className={styles.paletteGrid}>
            {section.questions.map((item) => {
              const status = questionStatus(attempt, item.id)
              const label = questionStatuses.find((entry) => entry.status === status)?.label
              const itemNumber = paperQuestions(paper).indexOf(item) + 1
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${statusClassName(status)} ${styles.paletteButton} ${item.id === question.id ? styles.paletteCurrent : ''}`}
                    aria-label={`Question ${itemNumber}, ${label?.toLowerCase()}`}
                    aria-current={item.id === question.id ? 'step' : undefined}
                    onClick={() => goTo(item.id)}
                  >
                    {itemNumber}
                  </button>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            className={`${styles.primaryAction} ${styles.submitButton}`}
            onClick={() => setConfirming(true)}
          >
            Submit
          </button>
        </aside>
      </div>

      {confirming ? (
        <SubmitDialog
          paper={paper}
          attempt={attempt}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false)
            onSubmit()
          }}
        />
      ) : null}
    </div>
  )
}

type ResponseUpdate = (update: (current: ExamResponse | undefined) => ExamResponse) => void

const asText = (response: ExamResponse | undefined) =>
  typeof response === 'string' ? response : ''

const asList = (response: ExamResponse | undefined) =>
  Array.isArray(response) ? response : typeof response === 'string' && response ? [response] : []

export function ResponseInput({
  question,
  response,
  onUpdate,
}: {
  question: ExamQuestion
  response: ExamResponse | undefined
  onUpdate: ResponseUpdate
}) {
  if (question.kind === 'nat') {
    return <NumericKeypad value={asText(response)} onUpdate={onUpdate} />
  }

  const selected = asList(response)
  const multiple = question.kind === 'msq'

  return (
    <fieldset className={styles.options}>
      <legend className={styles.visuallyHidden}>
        {multiple ? 'Choose one or more options' : 'Choose one option'}
      </legend>
      {question.options?.map((option) => {
        const checked = selected.includes(option.id)
        return (
          <label
            key={option.id}
            className={`${styles.option} ${checked ? styles.optionChecked : ''}`}
          >
            <input
              type={multiple ? 'checkbox' : 'radio'}
              name={`response-${question.id}`}
              value={option.id}
              checked={checked}
              onChange={() =>
                onUpdate((current) => {
                  if (!multiple) return option.id
                  const list = asList(current)
                  return list.includes(option.id)
                    ? list.filter((id) => id !== option.id)
                    : [...list, option.id].sort()
                })
              }
            />
            <span className={styles.optionLetter}>{option.id}</span>
            <span className={styles.optionBody}>
              {/* A printed block already shows the option; the button carries only its letter. */}
              {question.block ? null : option.text}
              {option.image ? (
                <img
                  className={styles.optionImage}
                  src={option.image}
                  alt={`Option ${option.id}`}
                />
              ) : null}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}

const keypadKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '-']

function NumericKeypad({ value, onUpdate }: { value: string; onUpdate: ResponseUpdate }) {
  return (
    <div className={styles.keypadWrap}>
      <label className={styles.keypadLabel}>
        Your answer
        <input
          className={styles.keypadInput}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => {
            const typed = sanitiseNumeric(event.target.value)
            onUpdate(() => typed)
          }}
        />
      </label>
      <div className={styles.keypad} role="group" aria-label="Number keypad">
        <button
          type="button"
          className={`${styles.key} ${styles.keyWide}`}
          onClick={() => onUpdate((current) => asText(current).slice(0, -1))}
        >
          Backspace
        </button>
        {keypadKeys.map((key) => (
          <button
            key={key}
            type="button"
            className={styles.key}
            aria-label={key === '-' ? 'Minus' : key === '.' ? 'Decimal point' : key}
            onClick={() => onUpdate((current) => sanitiseNumeric(asText(current) + key))}
          >
            {key === '-' ? '−' : key}
          </button>
        ))}
        <button
          type="button"
          className={`${styles.key} ${styles.keyWide}`}
          onClick={() => onUpdate(() => '')}
        >
          Clear all
        </button>
      </div>
    </div>
  )
}

export function SummaryTable({ paper, attempt }: { paper: ExamPaper; attempt: ExamAttempt }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className={styles.visuallyHidden}>Responses by section</caption>
        <thead>
          <tr>
            <th scope="col">Section</th>
            <th scope="col">Questions</th>
            {questionStatuses.map(({ status, label }) => (
              <th key={status} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {paper.sections.map((section) => {
            const counts = statusCounts(
              attempt,
              section.questions.map((q) => q.id),
            )
            return (
              <tr key={section.id}>
                <th scope="row">{section.name}</th>
                <td>{counts.total}</td>
                {questionStatuses.map(({ status }) => (
                  <td key={status}>{counts[status]}</td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SubmitDialog({
  paper,
  attempt,
  onCancel,
  onConfirm,
}: {
  paper: ExamPaper
  attempt: ExamAttempt
  onCancel: () => void
  onConfirm: () => void
}) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  // The exam clock re-renders this every second; keep the latest handler without re-focusing.
  const cancel = useRef(onCancel)
  useEffect(() => {
    cancel.current = onCancel
  })

  useEffect(() => {
    cancelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const unanswered = paperQuestions(paper).filter((question) =>
    isEmptyResponse(attempt.saved[question.id]),
  ).length

  return (
    <div className={styles.dialogScrim}>
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-submit-title"
      >
        <h2 id="exam-submit-title" className={styles.dialogTitle}>
          Submit the paper?
        </h2>
        <SummaryTable paper={paper} attempt={attempt} />
        <p className={styles.dialogText}>
          {unanswered > 0
            ? `${unanswered} question${unanswered === 1 ? ' is' : 's are'} not answered. `
            : ''}
          Once you submit, you cannot change any answer.
        </p>
        <div className={styles.dialogActions}>
          <button
            ref={cancelRef}
            type="button"
            className={styles.secondaryAction}
            onClick={onCancel}
          >
            No, go back
          </button>
          <button type="button" className={styles.primaryAction} onClick={onConfirm}>
            Yes, submit
          </button>
        </div>
      </section>
    </div>
  )
}
