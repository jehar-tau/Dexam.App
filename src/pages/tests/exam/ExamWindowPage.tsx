import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { memberIdFromEmail } from '../../../features/testSeries/candidate'
import {
  beginExam,
  createAttempt,
  expireIfDue,
  forgetAttempt,
  loadAttempt,
  setStage,
  storeAttempt,
  submitAttempt,
  type ExamAttempt,
} from '../../../features/testSeries/examAttempt'
import { practicePaper } from '../../../features/testSeries/examPaper'
import { findPaper, paperLabel } from '../../../features/testSeries/paperCatalog'
import { previewSearch } from '../../../features/testSeries/previewSearch'
import {
  ExamGeneralInstructions,
  ExamLogin,
  ExamPaperInstructions,
  PracticeNotice,
  PreStartFrame,
  type Candidate,
} from './ExamPreStart'
import { ExamScreen, SummaryTable } from './ExamScreen'
import styles from './ExamWindow.module.css'

// Until the bank serves real papers (F038), every catalogue paper opens the fictional practice paper.
const paper = practicePaper

function initialAttempt(owner: string, paperId: string): ExamAttempt {
  const stored = loadAttempt(owner, paperId, paper)
  return stored ? expireIfDue(stored, Date.now()) : createAttempt(paper)
}

export function ExamWindowPage() {
  const { paperId = '' } = useParams()
  const search = previewSearch(useLocation().search)
  const { session } = useAuth()
  const owner = session?.user.id ?? (search ? 'preview' : 'signed-out')
  // A different paper or account starts from its own attempt, never the previous one's state.
  return <ExamWindow key={`${owner}:${paperId}`} owner={owner} paperId={paperId} search={search} />
}

function ExamWindow({
  owner,
  paperId,
  search,
}: {
  owner: string
  paperId: string
  search: string
}) {
  const { session } = useAuth()
  const catalogPaper = findPaper(paperId)

  const [attempt, setAttempt] = useState(() => initialAttempt(owner, paperId))
  const [now, setNow] = useState(() => Date.now())

  // The exam window always uses the official-looking light theme.
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-theme')
    root.setAttribute('data-theme', 'light')
    return () => {
      if (previous === null) root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', previous)
    }
  }, [])

  useEffect(() => {
    if (catalogPaper) storeAttempt(owner, paperId, attempt)
  }, [attempt, catalogPaper, owner, paperId])

  const inExam = attempt.stage === 'exam'

  useEffect(() => {
    if (!inExam) return
    const tick = () => {
      const current = Date.now()
      setNow(current)
      setAttempt((value) => expireIfDue(value, current))
    }
    const timer = window.setInterval(tick, 1000)
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warnBeforeLeaving)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('beforeunload', warnBeforeLeaving)
    }
  }, [inExam])

  const papersPath = `/tests/papers${search}`

  if (!catalogPaper) {
    return (
      <div className={styles.missing}>
        <h1>Paper not found</h1>
        <Link to={papersPath}>Back to papers</Link>
      </div>
    )
  }

  const label = paperLabel(catalogPaper)
  const memberId = memberIdFromEmail(session?.user.email)
  const name = search ? 'Fictional Student' : (memberId ?? 'Dexam student')
  const candidate: Candidate = {
    name,
    rollNumber: search ? 'DXM-PREVIEW0001' : (memberId ?? '—'),
    initials: name
      .split(/[\s-]+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  }

  switch (attempt.stage) {
    case 'login':
      return (
        <ExamLogin
          paperLabel={label}
          candidate={candidate}
          exitTo={`/tests/papers/${catalogPaper.id}${search}`}
          onSignIn={() => setAttempt(setStage(attempt, 'instructions'))}
        />
      )
    case 'instructions':
      return (
        <ExamGeneralInstructions
          paperLabel={label}
          paper={paper}
          onNext={() => setAttempt(setStage(attempt, 'paper-instructions'))}
        />
      )
    case 'paper-instructions':
      return (
        <ExamPaperInstructions
          paperLabel={label}
          paper={paper}
          onPrevious={() => setAttempt(setStage(attempt, 'instructions'))}
          onBegin={() => {
            const current = Date.now()
            setNow(current)
            setAttempt(beginExam(attempt, paper, current))
          }}
        />
      )
    case 'exam':
      return (
        <ExamScreen
          paper={paper}
          paperLabel={label}
          candidate={candidate}
          attempt={attempt}
          now={now}
          // A click can race the clock's auto-submit; never let it reopen a submitted paper.
          onChange={(next) => setAttempt((current) => (current.stage === 'exam' ? next : current))}
          onSubmit={() => setAttempt((current) => submitAttempt(current, Date.now(), 'candidate'))}
        />
      )
    case 'submitted':
      return (
        <PreStartFrame paperLabel={label}>
          <section className={styles.instructions} aria-labelledby="exam-done-title">
            <h1 id="exam-done-title" className={styles.instructionsTitle}>
              {attempt.submitReason === 'time'
                ? 'Time is up. Your paper has been submitted.'
                : 'Your paper has been submitted.'}
            </h1>
            <div className={styles.instructionsBody}>
              <p>Here is a summary of your responses for {label}.</p>
              <SummaryTable paper={paper} attempt={attempt} />
              <p>Scores, answers and review arrive with the results step.</p>
              <PracticeNotice />
            </div>
            <div className={styles.instructionsFooter}>
              <button
                type="button"
                className={styles.secondaryAction}
                onClick={() => {
                  forgetAttempt(owner, paperId)
                  setAttempt(createAttempt(paper))
                }}
              >
                Take it again
              </button>
              <Link className={styles.primaryAction} to={papersPath}>
                Back to papers
              </Link>
            </div>
          </section>
        </PreStartFrame>
      )
  }
}
