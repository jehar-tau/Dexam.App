import { useQuery } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { getSupabaseClient } from '../../../features/auth/supabaseClient'
import { fetchBankPaper } from '../../../features/testSeries/bankPaper'
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
import { practicePaper, type ExamPaper } from '../../../features/testSeries/examPaper'
import {
  bankPaperId,
  findPaper,
  paperLabel,
  type CatalogPaper,
} from '../../../features/testSeries/paperCatalog'
import { previewSearch } from '../../../features/testSeries/previewSearch'
import {
  ExamGeneralInstructions,
  ExamLogin,
  ExamPaperInstructions,
  PaperNotice,
  PreStartFrame,
  type Candidate,
} from './ExamPreStart'
import { ExamScreen, SummaryTable } from './ExamScreen'
import styles from './ExamWindow.module.css'

function initialAttempt(owner: string, paperId: string, paper: ExamPaper): ExamAttempt {
  const stored = loadAttempt(owner, paperId, paper)
  return stored ? expireIfDue(stored, Date.now()) : createAttempt(paper)
}

/** The exam window always uses the official-looking light theme. */
function useLightTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-theme')
    root.setAttribute('data-theme', 'light')
    return () => {
      if (previous === null) root.removeAttribute('data-theme')
      else root.setAttribute('data-theme', previous)
    }
  }, [])
}

function StatusPage({
  label,
  title,
  backTo,
  children,
}: {
  label: string
  title: string
  backTo: string
  children?: ReactNode
}) {
  useLightTheme()
  return (
    <PreStartFrame paperLabel={label}>
      <section className={styles.instructions} aria-labelledby="exam-status-title">
        <h1 id="exam-status-title" className={styles.instructionsTitle}>
          {title}
        </h1>
        {children ? <div className={styles.instructionsBody}>{children}</div> : null}
        <div className={styles.instructionsFooter}>
          <span />
          <Link className={styles.primaryAction} to={backTo}>
            Back to papers
          </Link>
        </div>
      </section>
    </PreStartFrame>
  )
}

export function ExamWindowPage() {
  const { paperId = '' } = useParams()
  const search = previewSearch(useLocation().search)
  const { session } = useAuth()
  const catalogPaper = findPaper(paperId)
  const owner = session?.user.id ?? (search ? 'preview' : 'signed-out')
  const papersPath = `/tests/papers${search}`

  if (!catalogPaper) {
    return (
      <div className={styles.missing}>
        <h1>Paper not found</h1>
        <Link to={papersPath}>Back to papers</Link>
      </div>
    )
  }

  // A different paper or account starts from its own attempt, never the previous one's state.
  const key = `${owner}:${paperId}`
  // Preview shows the fictional practice paper; signed-in students get the reviewed bank paper.
  return search ? (
    <ExamWindow
      key={key}
      owner={owner}
      catalogPaper={catalogPaper}
      paper={practicePaper}
      search={search}
    />
  ) : (
    <BankExamWindow key={key} owner={owner} catalogPaper={catalogPaper} />
  )
}

function BankExamWindow({ owner, catalogPaper }: { owner: string; catalogPaper: CatalogPaper }) {
  const label = paperLabel(catalogPaper)
  const bankId = bankPaperId(catalogPaper)
  const client = getSupabaseClient()
  const query = useQuery({
    queryKey: ['bank-paper', owner, bankId],
    queryFn: () => fetchBankPaper(client!, label, catalogPaper.exam, bankId!),
    enabled: Boolean(client && bankId),
    // A paper stays fixed for the whole sitting.
    staleTime: Infinity,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: false,
  })

  if (!bankId || query.data?.sections.length === 0) {
    return (
      <StatusPage label={label} title="This paper is still being reviewed" backTo="/tests/papers">
        <p>
          None of its questions has finished review yet. Questions appear here once their figures,
          options and answer keys have been checked.
        </p>
      </StatusPage>
    )
  }
  if (query.isError || !client) {
    return (
      <StatusPage label={label} title="This paper could not be opened" backTo="/tests/papers">
        <p>{query.error?.message ?? 'The question bank is not connected.'} Please try again.</p>
      </StatusPage>
    )
  }
  if (!query.data) {
    return <StatusPage label={label} title="Loading the paper…" backTo="/tests/papers" />
  }
  return <ExamWindow owner={owner} catalogPaper={catalogPaper} paper={query.data} search="" />
}

function ExamWindow({
  owner,
  catalogPaper,
  paper,
  search,
}: {
  owner: string
  catalogPaper: CatalogPaper
  paper: ExamPaper
  search: string
}) {
  const { session } = useAuth()
  const paperId = catalogPaper.id

  const [attempt, setAttempt] = useState(() => initialAttempt(owner, paperId, paper))
  const [now, setNow] = useState(() => Date.now())

  useLightTheme()

  useEffect(() => {
    storeAttempt(owner, paperId, attempt)
  }, [attempt, owner, paperId])

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
          paper={paper}
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
              <PaperNotice paper={paper} />
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
