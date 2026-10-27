import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card } from '../components'
import {
  createExamSession,
  previewQuestions,
  questionState,
  setAnswer,
  toggleReview,
  visitQuestion,
  type ExamSession,
} from '../features/assessment/examSession'
import styles from './StudentTestSeriesPage.module.css'

const previewDurationSeconds = 30 * 60
const storageKey = 'dexam-fictional-test-series-preview-v1'

function formatTime(total: number) {
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function loadSession(): ExamSession {
  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? (JSON.parse(stored) as ExamSession) : createExamSession()
  } catch {
    return createExamSession()
  }
}

export function StudentTestSeriesPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_STUDENT_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [started, setStarted] = useState(false)
  const [session, setSession] = useState(loadSession)
  const [remaining, setRemaining] = useState(previewDurationSeconds)
  const [partBFile, setPartBFile] = useState('')

  const activeIndex = previewQuestions.findIndex(
    (question) => question.id === session.activeQuestionId,
  )
  const activeQuestion = previewQuestions[activeIndex] ?? previewQuestions[0]!
  const sections = useMemo(
    () => [...new Set(previewQuestions.map((question) => question.section))],
    [],
  )

  useEffect(() => {
    if (!previewEnabled || !started || session.submitted) return
    const timer = window.setInterval(
      () =>
        setRemaining((time) => {
          const next = Math.max(0, time - 1)
          if (next === 0) setSession((current) => ({ ...current, submitted: true }))
          return next
        }),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [previewEnabled, session.submitted, started])

  useEffect(() => {
    if (previewEnabled) localStorage.setItem(storageKey, JSON.stringify(session))
  }, [previewEnabled, session])

  if (!started) {
    return (
      <section className={styles.series} aria-labelledby="test-series-title">
        <header className={styles.intro}>
          <div>
            <p className="eyebrow">Dexam test series · Fictional preview</p>
            <h1 id="test-series-title">Practise the paper, not just the questions.</h1>
            <p>
              A time-bound design entrance test with computer-based Part A and a dedicated Part B
              drawing upload window.
            </p>
          </div>
          <div className={styles.metric}>
            <strong>1,689</strong>
            <span>public PYQs identified for independent sourcing</span>
          </div>
        </header>
        <Callout tone="neutral">
          This preview uses fictional questions. Official papers will be imported only with source,
          year, answer-key, and verification records.
        </Callout>
        <Card className={styles.testCard}>
          <div>
            <Badge pill tone="success">
              Available
            </Badge>
            <h2>UCEED pattern diagnostic · Preview</h2>
            <p>MCQ, MSQ, NAT and Part B drawing · 30-minute demonstration</p>
          </div>
          <dl>
            <div>
              <dt>Part A</dt>
              <dd>Computer based</dd>
            </div>
            <div>
              <dt>Part B</dt>
              <dd>Draw, photograph, upload</dd>
            </div>
            <div>
              <dt>Autosave</dt>
              <dd>On this device</dd>
            </div>
          </dl>
          <Button onClick={() => setStarted(true)}>Read instructions and begin</Button>
        </Card>
      </section>
    )
  }

  if (session.submitted) {
    return (
      <section className={styles.complete} aria-labelledby="submission-title">
        <p className="eyebrow">Attempt submitted</p>
        <h1 id="submission-title">Your response sheet is locked.</h1>
        <p>
          {Object.keys(session.answers).length} of {previewQuestions.length} questions have a saved
          response.
        </p>
        <Callout tone="neutral">
          Part A scoring and human Part B evaluation are deliberately excluded from this fictional
          preview.
        </Callout>
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.removeItem(storageKey)
            setSession(createExamSession())
            setRemaining(previewDurationSeconds)
            setPartBFile('')
            setStarted(false)
          }}
        >
          Return to test series
        </Button>
      </section>
    )
  }

  const answer = session.answers[activeQuestion.id]
  return (
    <section className={styles.runner} aria-labelledby="runner-title">
      <header className={styles.runnerHeader}>
        <div>
          <p className="eyebrow">UCEED diagnostic preview</p>
          <h1 id="runner-title">Test workspace</h1>
        </div>
        <div className={styles.clock} aria-label={`${formatTime(remaining)} remaining`}>
          <span>Time remaining</span>
          <strong>{formatTime(remaining)}</strong>
        </div>
      </header>
      <div className={styles.sectionTabs}>
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => {
              const first = previewQuestions.find((q) => q.section === section)
              if (first) setSession((current) => visitQuestion(current, first.id))
            }}
            className={activeQuestion.section === section ? styles.activeSection : ''}
          >
            {section}
          </button>
        ))}
      </div>
      <div className={styles.examGrid}>
        <main className={styles.questionPanel}>
          <div className={styles.questionMeta}>
            <span>
              Question {activeIndex + 1} of {previewQuestions.length}
            </span>
            <Badge pill tone="neutral">
              {activeQuestion.kind.toUpperCase()} · {activeQuestion.marks} marks
            </Badge>
          </div>
          <h2>{activeQuestion.prompt}</h2>
          {activeQuestion.kind === 'nat' ? (
            <label className={styles.nat}>
              Numerical answer
              <input
                inputMode="decimal"
                value={typeof answer === 'string' ? answer : ''}
                onChange={(event) =>
                  setSession((current) =>
                    setAnswer(
                      current,
                      activeQuestion.id,
                      event.target.value.replace(/[^0-9.-]/g, ''),
                    ),
                  )
                }
              />
            </label>
          ) : null}
          {activeQuestion.options ? (
            <fieldset className={styles.options}>
              <legend className="sr-only">Answer choices</legend>
              {activeQuestion.options.map((option, index) => {
                const value = String.fromCharCode(65 + index)
                const selected = Array.isArray(answer) ? answer.includes(value) : answer === value
                return (
                  <label key={option}>
                    <input
                      type={activeQuestion.kind === 'msq' ? 'checkbox' : 'radio'}
                      name={activeQuestion.id}
                      checked={selected}
                      onChange={() => {
                        if (activeQuestion.kind === 'msq') {
                          const current = Array.isArray(answer) ? answer : []
                          const next = selected
                            ? current.filter((item) => item !== value)
                            : [...current, value]
                          setSession((state) => setAnswer(state, activeQuestion.id, next))
                        } else setSession((state) => setAnswer(state, activeQuestion.id, value))
                      }}
                    />
                    <span>
                      <b>{value}</b>
                      {option}
                    </span>
                  </label>
                )
              })}
            </fieldset>
          ) : null}
          {activeQuestion.kind === 'drawing' ? (
            <div className={styles.upload}>
              <Callout tone="neutral">
                Complete the drawing on paper. In the live system, the upload window begins only
                after Part A closes.
              </Callout>
              <label>
                Photograph or scan
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(event) => setPartBFile(event.target.files?.[0]?.name ?? '')}
                />
              </label>
              {partBFile ? <p role="status">Selected: {partBFile}</p> : null}
            </div>
          ) : null}
          <div className={styles.controls}>
            <Button
              variant="secondary"
              disabled={activeIndex === 0}
              onClick={() =>
                setSession((current) =>
                  visitQuestion(current, previewQuestions[activeIndex - 1]!.id),
                )
              }
            >
              Previous
            </Button>
            <Button
              variant="ghost"
              onClick={() => setSession((current) => toggleReview(current, activeQuestion.id))}
            >
              {session.markedForReview.includes(activeQuestion.id)
                ? 'Remove review mark'
                : 'Mark for review'}
            </Button>
            <Button
              disabled={activeIndex === previewQuestions.length - 1}
              onClick={() =>
                setSession((current) =>
                  visitQuestion(current, previewQuestions[activeIndex + 1]!.id),
                )
              }
            >
              Save and next
            </Button>
          </div>
        </main>
        <aside className={styles.palette} aria-label="Question palette">
          <h2>Question palette</h2>
          {sections.map((section) => (
            <div key={section}>
              <h3>{section}</h3>
              <div className={styles.paletteGrid}>
                {previewQuestions
                  .filter((q) => q.section === section)
                  .map((question) => (
                    <button
                      key={question.id}
                      data-state={questionState(session, question.id)}
                      aria-current={question.id === activeQuestion.id ? 'true' : undefined}
                      onClick={() => setSession((current) => visitQuestion(current, question.id))}
                    >
                      {previewQuestions.indexOf(question) + 1}
                    </button>
                  ))}
              </div>
            </div>
          ))}
          <div className={styles.legend}>
            <span data-state="answered">Answered</span>
            <span data-state="review">Review</span>
            <span data-state="visited">Visited</span>
          </div>
          <Button
            variant="secondary"
            onClick={() => setSession((current) => ({ ...current, submitted: true }))}
          >
            Submit test
          </Button>
        </aside>
      </div>
    </section>
  )
}
