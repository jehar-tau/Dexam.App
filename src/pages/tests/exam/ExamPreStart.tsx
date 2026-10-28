import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

import type { ExamPaper } from '../../../features/testSeries/examPaper'
import { StatusLegend } from './ExamStatus'
import styles from './ExamWindow.module.css'

export type Candidate = { name: string; rollNumber: string; initials: string }

type FrameProps = { paperLabel: string; children: ReactNode }

export function PreStartFrame({ paperLabel, children }: FrameProps) {
  return (
    <div className={styles.preStart}>
      <header className={styles.examHeader}>
        <span className={styles.examBrand}>
          <span className={styles.examMark} aria-hidden="true">
            D
          </span>
          Dexam exam window
        </span>
        <span className={styles.examHeaderPaper}>{paperLabel}</span>
      </header>
      <main className={styles.preStartMain}>{children}</main>
    </div>
  )
}

export function PracticeNotice() {
  return (
    <p className={styles.notice}>
      Practice content: the questions in this window are fictional. Real papers load here once the
      question bank is connected.
    </p>
  )
}

export function ExamLogin({
  paperLabel,
  candidate,
  exitTo,
  onSignIn,
}: {
  paperLabel: string
  candidate: Candidate
  exitTo: string
  onSignIn: () => void
}) {
  return (
    <PreStartFrame paperLabel={paperLabel}>
      <section className={styles.loginCard} aria-labelledby="exam-login-title">
        <div className={styles.loginSystem}>
          <span className={styles.loginLabel}>System</span>
          <span className={styles.loginMono}>DXM-PRACTICE</span>
        </div>
        <div className={styles.loginBody}>
          <span className={styles.loginPhoto} aria-hidden="true">
            {candidate.initials}
          </span>
          <div className={styles.loginDetails}>
            <h1 id="exam-login-title" className={styles.loginTitle}>
              Candidate login
            </h1>
            <dl className={styles.loginFacts}>
              <div>
                <dt>Candidate name</dt>
                <dd>{candidate.name}</dd>
              </div>
              <div>
                <dt>Roll number</dt>
                <dd className={styles.loginMono}>{candidate.rollNumber}</dd>
              </div>
              <div>
                <dt>Paper</dt>
                <dd>{paperLabel}</dd>
              </div>
            </dl>
            <p className={styles.loginHint}>
              Check your details before you sign in. If anything is wrong, go back to Papers.
            </p>
            <div className={styles.loginActions}>
              <button type="button" className={styles.primaryAction} onClick={onSignIn}>
                Sign in
              </button>
              <Link className={styles.quietLink} to={exitTo}>
                Back to papers
              </Link>
            </div>
          </div>
        </div>
        <PracticeNotice />
      </section>
    </PreStartFrame>
  )
}

export function ExamGeneralInstructions({
  paperLabel,
  paper,
  onNext,
}: {
  paperLabel: string
  paper: ExamPaper
  onNext: () => void
}) {
  return (
    <PreStartFrame paperLabel={paperLabel}>
      <section className={styles.instructions} aria-labelledby="exam-instructions-title">
        <h1 id="exam-instructions-title" className={styles.instructionsTitle}>
          General instructions
        </h1>
        <div className={styles.instructionsBody}>
          <h2>The clock</h2>
          <ol>
            <li>
              You have {paper.durationMinutes} minutes. The clock at the top right of the exam
              screen shows the time left.
            </li>
            <li>
              When the clock reaches zero, the paper is submitted automatically. You do not need to
              submit it yourself.
            </li>
          </ol>
          <h2>The question palette</h2>
          <ol start={3}>
            <li>
              The palette on the right of the screen shows the status of every question in the
              current section:
              <StatusLegend />
            </li>
            <li>
              Questions that are answered and marked for review are counted when the paper is
              marked.
            </li>
          </ol>
          <h2>Moving between questions</h2>
          <ol start={5}>
            <li>
              Click a number in the palette to go straight to that question. This does{' '}
              <strong>not</strong> save your answer to the question you are on.
            </li>
            <li>
              <strong>Save &amp; Next</strong> saves your answer and opens the next question.
            </li>
            <li>
              <strong>Mark for Review &amp; Next</strong> saves your answer, if you gave one, marks
              the question for review and opens the next question.
            </li>
            <li>
              Sections appear as tabs above the question. Click a tab to go to its first question.
              You can move between sections at any time.
            </li>
          </ol>
          <h2>Answering</h2>
          <ol start={9}>
            <li>
              Multiple choice: choose one option. Choose another to change it, or press{' '}
              <strong>Clear Response</strong> to remove it.
            </li>
            <li>Multiple select: choose every option you think is correct.</li>
            <li>Numerical answer: enter the number with the on-screen keypad or your keyboard.</li>
          </ol>
        </div>
        <div className={styles.instructionsFooter}>
          <span />
          <button type="button" className={styles.primaryAction} onClick={onNext}>
            Next
          </button>
        </div>
      </section>
    </PreStartFrame>
  )
}

const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0')

export function ExamPaperInstructions({
  paperLabel,
  paper,
  onPrevious,
  onBegin,
}: {
  paperLabel: string
  paper: ExamPaper
  onPrevious: () => void
  onBegin: () => void
}) {
  const [declared, setDeclared] = useState(false)
  const total = paper.sections.reduce((sum, section) => sum + section.questions.length, 0)

  return (
    <PreStartFrame paperLabel={paperLabel}>
      <section className={styles.instructions} aria-labelledby="exam-paper-title">
        <h1 id="exam-paper-title" className={styles.instructionsTitle}>
          Paper instructions
        </h1>
        <div className={styles.instructionsBody}>
          <p>
            {paperLabel} has {total} questions in {paper.sections.length} sections and lasts{' '}
            {paper.durationMinutes} minutes.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>Marking scheme</caption>
              <thead>
                <tr>
                  <th scope="col">Section</th>
                  <th scope="col">Questions</th>
                  <th scope="col">Correct</th>
                  <th scope="col">Wrong</th>
                  <th scope="col">Not answered</th>
                </tr>
              </thead>
              <tbody>
                {paper.sections.map((section) => (
                  <tr key={section.id}>
                    <th scope="row">
                      {section.name}
                      <span className={styles.tableSub}>{section.kindLabel}</span>
                    </th>
                    <td>{section.questions.length}</td>
                    <td>{signed(section.marking.correct)}</td>
                    <td>{signed(section.marking.wrong)}</td>
                    <td>0</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paper.sections
            .filter((section) => section.marking.note)
            .map((section) => (
              <p key={section.id} className={styles.tableNote}>
                {section.name}: {section.marking.note}
              </p>
            ))}
          <PracticeNotice />
        </div>
        <div className={styles.declaration}>
          <label className={styles.declarationLabel}>
            <input
              type="checkbox"
              checked={declared}
              onChange={(event) => setDeclared(event.target.checked)}
            />
            <span>
              I have read and understood the instructions. I will take this paper on my own, without
              outside help, and the device I am using is working properly.
            </span>
          </label>
        </div>
        <div className={styles.instructionsFooter}>
          <button type="button" className={styles.secondaryAction} onClick={onPrevious}>
            Previous
          </button>
          <button
            type="button"
            className={styles.primaryAction}
            disabled={!declared}
            onClick={onBegin}
          >
            I am ready to begin
          </button>
        </div>
      </section>
    </PreStartFrame>
  )
}
