import type { SupabaseClient } from '@supabase/supabase-js'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { getSupabaseClient } from '../../../features/auth/supabaseClient'
import {
  beginBankAttempt,
  openBankAttempt,
  PaperLockedError,
  submitBankAttempt,
  type OpenedAttempt,
} from '../../../features/testSeries/bankPaper'
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
import { previewResultId } from '../../../features/testSeries/practiceResult'
import { previewSearch } from '../../../features/testSeries/previewSearch'
import { useTestAccess } from '../../../features/testSeries/testAccess'
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

type ServerAttempt = { client: SupabaseClient; opened: OpenedAttempt }

/**
 * The local attempt to show. For a bank paper the server attempt wins: a stored attempt is only
 * resumed when it belongs to the same server attempt, and a started server attempt always uses
 * the server deadline (for example when it was begun on another device).
 */
function initialAttempt(
  owner: string,
  paperId: string,
  paper: ExamPaper,
  server?: ServerAttempt,
): ExamAttempt {
  const now = Date.now()
  const stored = loadAttempt(owner, paperId, paper)
  if (!server) return stored ? expireIfDue(stored, now) : createAttempt(paper)

  const { attemptId, status, deadline } = server.opened
  let attempt = stored?.serverId === attemptId ? stored : createAttempt(paper, attemptId)
  // Practice sets skip the exam-centre login and general instructions.
  if (paper.practiceSet && (attempt.stage === 'login' || attempt.stage === 'instructions')) {
    attempt = setStage(attempt, 'paper-instructions')
  }
  if (status === 'in_progress' && deadline !== null) {
    attempt =
      attempt.stage === 'exam' || attempt.stage === 'submitted'
        ? { ...attempt, deadline }
        : beginExam(attempt, paper, now, deadline)
  }
  return expireIfDue(attempt, now)
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

export function StatusPage({
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
  // Fictional preview attempts never mix with a signed-in account's real ones.
  const owner = search ? 'preview' : (session?.user.id ?? 'signed-out')
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
      storeKey={catalogPaper.id}
      label={paperLabel(catalogPaper)}
      exitTo={`/tests/papers/${catalogPaper.id}${search}`}
      backTo={papersPath}
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
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['bank-attempt', owner, bankId],
    queryFn: async () => {
      const opened = await openBankAttempt(client!, label, bankId!)
      // Opening may have claimed a candidate's free paper.
      void queryClient.invalidateQueries({ queryKey: ['test-access'] })
      return opened
    },
    enabled: Boolean(client && bankId),
    // An attempt's questions are pinned by the server; they stay fixed for the whole sitting.
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })

  if (!bankId || query.data === null) {
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
      <StatusPage
        label={label}
        title={
          query.error instanceof PaperLockedError
            ? 'This paper is not included'
            : 'This paper could not be opened'
        }
        backTo="/tests/papers"
      >
        <p>
          {query.error instanceof PaperLockedError
            ? query.error.message
            : `${query.error?.message ?? 'The question bank is not connected.'} Please try again.`}
        </p>
      </StatusPage>
    )
  }
  if (!query.data) {
    return <StatusPage label={label} title="Loading the paper…" backTo="/tests/papers" />
  }
  return (
    <ExamWindow
      key={query.data.attemptId}
      owner={owner}
      storeKey={catalogPaper.id}
      label={label}
      exitTo={`/tests/papers/${catalogPaper.id}`}
      backTo="/tests/papers"
      paper={query.data.paper}
      search=""
      server={{ client, opened: query.data }}
    />
  )
}

export function ExamWindow({
  owner,
  storeKey,
  label,
  exitTo,
  backTo,
  paper,
  search,
  server,
  submittedTo,
}: {
  owner: string
  /** Local storage key part: the catalogue paper id, or the practice set's server paper id. */
  storeKey: string
  label: string
  /** Where "Back" from the login page goes. */
  exitTo: string
  /** Where "Back to papers" (or practice) goes. */
  backTo: string
  paper: ExamPaper
  search: string
  server?: ServerAttempt
  /** Where a submitted server attempt goes; the result page by default. */
  submittedTo?: string
}) {
  const { session } = useAuth()
  const access = useTestAccess(!search)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const paperId = storeKey

  const [attempt, setAttempt] = useState(() => initialAttempt(owner, paperId, paper, server))
  const [now, setNow] = useState(() => Date.now())

  const begin = useMutation({
    mutationFn: () => beginBankAttempt(server!.client, server!.opened.attemptId),
    onSuccess: (deadline) => {
      const current = Date.now()
      setNow(current)
      setAttempt((value) => beginExam(value, paper, current, deadline))
    },
  })

  // A submitted bank paper is scored by the server, then the result opens.
  const submit = useMutation({
    mutationFn: (value: ExamAttempt) =>
      submitBankAttempt(
        server!.client,
        server!.opened.attemptId,
        value.saved,
        value.submitReason ?? 'candidate',
      ),
    onSuccess: () => {
      forgetAttempt(owner, paperId)
      void queryClient.invalidateQueries({ queryKey: ['bank-attempts'] })
      void navigate(submittedTo ?? `/tests/results/${server!.opened.attemptId}`, { replace: true })
    },
  })
  const needsSubmit = Boolean(server) && attempt.stage === 'submitted' && submit.isIdle
  useEffect(() => {
    if (needsSubmit) submit.mutate(attempt)
  }, [attempt, needsSubmit, submit])

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

  const papersPath = backTo
  const memberId = memberIdFromEmail(session?.user.email)
  // Public candidates have no Member ID: show their name and a short reference instead.
  const name = search
    ? 'Fictional Student'
    : (memberId ?? access.data?.displayName ?? 'Dexam candidate')
  const candidate: Candidate = {
    name,
    rollNumber: search
      ? 'DXM-PREVIEW0001'
      : (memberId ?? `CAND-${(session?.user.id ?? '').slice(0, 8).toUpperCase()}`),
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
          exitTo={exitTo}
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
          busy={begin.isPending}
          error={begin.isError ? begin.error.message : undefined}
          onBegin={() => {
            if (server) {
              begin.mutate()
              return
            }
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
      if (server) {
        return submit.isError ? (
          <PreStartFrame paperLabel={label}>
            <section className={styles.instructions} aria-labelledby="exam-done-title">
              <h1 id="exam-done-title" className={styles.instructionsTitle}>
                Your answers are saved on this device, but the paper has not reached Dexam yet
              </h1>
              <div className={styles.instructionsBody}>
                <p>{submit.error.message} Keep this page open and try again.</p>
              </div>
              <div className={styles.instructionsFooter}>
                <span />
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={() => submit.mutate(attempt)}
                >
                  Try again
                </button>
              </div>
            </section>
          </PreStartFrame>
        ) : (
          <StatusPage label={label} title="Submitting your paper…" backTo={backTo}>
            <p>Your answers are being scored. Your result opens in a moment.</p>
          </StatusPage>
        )
      }
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
              <p>
                <Link to={`/tests/results/${previewResultId(paperId)}${search}`}>
                  See your score and review your answers
                </Link>
              </p>
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
