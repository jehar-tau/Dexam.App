import { z } from 'zod'

import { paperQuestions, type ExamPaper } from './examPaper'

/**
 * F042 exam attempt: pure state transitions for the official-style exam window.
 *
 * Like the official computer-based exams, a response is only kept when the candidate
 * presses "Save & Next" or "Mark for Review & Next"; jumping away through the palette
 * discards an unsaved choice. The unsaved choice lives in the exam screen, not here.
 */

export type ExamStage = 'login' | 'instructions' | 'paper-instructions' | 'exam' | 'submitted'

export type ExamResponse = string | string[]

export type QuestionStatus =
  'not-visited' | 'not-answered' | 'answered' | 'review' | 'answered-review'

export const questionStatuses: { status: QuestionStatus; label: string }[] = [
  { status: 'not-visited', label: 'Not visited' },
  { status: 'not-answered', label: 'Not answered' },
  { status: 'answered', label: 'Answered' },
  { status: 'review', label: 'Marked for review' },
  { status: 'answered-review', label: 'Answered and marked for review' },
]

const responseSchema = z.union([z.string().max(32), z.array(z.string().max(8)).max(10)])

const attemptSchema = z.object({
  version: z.literal(1),
  stage: z.enum(['login', 'instructions', 'paper-instructions', 'exam', 'submitted']),
  deadline: z.number().nullable(),
  activeId: z.string(),
  saved: z.record(z.string(), responseSchema),
  visited: z.array(z.string()),
  review: z.array(z.string()),
  submittedAt: z.number().nullable(),
  submitReason: z.enum(['candidate', 'time']).nullable(),
  // The server attempt behind a bank paper; absent for the fictional preview paper.
  serverId: z.string().uuid().nullable().optional(),
})

export type ExamAttempt = z.infer<typeof attemptSchema>

export function createAttempt(paper: ExamPaper, serverId: string | null = null): ExamAttempt {
  const first = paperQuestions(paper)[0]
  if (!first) throw new Error('An exam paper needs at least one question.')
  return {
    version: 1,
    stage: 'login',
    deadline: null,
    activeId: first.id,
    saved: {},
    visited: [],
    review: [],
    submittedAt: null,
    submitReason: null,
    serverId,
  }
}

export function isEmptyResponse(response: ExamResponse | undefined): boolean {
  if (response === undefined) return true
  return Array.isArray(response) ? response.length === 0 : response.trim() === ''
}

const addOnce = (list: string[], id: string) => (list.includes(id) ? list : [...list, id])

export function setStage(attempt: ExamAttempt, stage: ExamStage): ExamAttempt {
  return { ...attempt, stage }
}

/** `serverDeadline` comes from the server for bank papers; preview papers time themselves. */
export function beginExam(
  attempt: ExamAttempt,
  paper: ExamPaper,
  now: number,
  serverDeadline?: number,
): ExamAttempt {
  if (attempt.stage === 'exam' || attempt.stage === 'submitted') return attempt
  return {
    ...attempt,
    stage: 'exam',
    deadline: serverDeadline ?? now + paper.durationMinutes * 60_000,
    visited: addOnce(attempt.visited, attempt.activeId),
  }
}

export function goToQuestion(attempt: ExamAttempt, questionId: string): ExamAttempt {
  if (attempt.stage !== 'exam') return attempt
  return { ...attempt, activeId: questionId, visited: addOnce(attempt.visited, questionId) }
}

function nextQuestionId(paper: ExamPaper, currentId: string): string {
  const ids = paperQuestions(paper).map((question) => question.id)
  const index = ids.indexOf(currentId)
  return ids[(index + 1) % ids.length] ?? currentId
}

function withSaved(attempt: ExamAttempt, response: ExamResponse | undefined): ExamAttempt {
  const saved = { ...attempt.saved }
  if (isEmptyResponse(response)) delete saved[attempt.activeId]
  else saved[attempt.activeId] = response as ExamResponse
  return { ...attempt, saved }
}

/** Save what is on screen (an empty response clears the saved one), drop any review mark, move on. */
export function saveAndNext(
  attempt: ExamAttempt,
  paper: ExamPaper,
  response: ExamResponse | undefined,
): ExamAttempt {
  if (attempt.stage !== 'exam') return attempt
  const saved = withSaved(attempt, response)
  return goToQuestion(
    { ...saved, review: saved.review.filter((id) => id !== attempt.activeId) },
    nextQuestionId(paper, attempt.activeId),
  )
}

/** Save what is on screen, mark the question for review, move on. */
export function markForReviewAndNext(
  attempt: ExamAttempt,
  paper: ExamPaper,
  response: ExamResponse | undefined,
): ExamAttempt {
  if (attempt.stage !== 'exam') return attempt
  const saved = withSaved(attempt, response)
  return goToQuestion(
    { ...saved, review: addOnce(saved.review, attempt.activeId) },
    nextQuestionId(paper, attempt.activeId),
  )
}

export function clearResponse(attempt: ExamAttempt): ExamAttempt {
  if (attempt.stage !== 'exam') return attempt
  return withSaved(attempt, undefined)
}

export function submitAttempt(
  attempt: ExamAttempt,
  now: number,
  reason: 'candidate' | 'time',
): ExamAttempt {
  if (attempt.stage !== 'exam') return attempt
  return { ...attempt, stage: 'submitted', submittedAt: now, submitReason: reason }
}

export function remainingMs(attempt: ExamAttempt, now: number): number {
  return attempt.deadline === null ? 0 : Math.max(0, attempt.deadline - now)
}

/** Submits an exam whose time has run out; anything else is returned unchanged. */
export function expireIfDue(attempt: ExamAttempt, now: number): ExamAttempt {
  if (attempt.stage !== 'exam' || attempt.deadline === null || now < attempt.deadline) {
    return attempt
  }
  return submitAttempt(attempt, attempt.deadline, 'time')
}

export function questionStatus(attempt: ExamAttempt, questionId: string): QuestionStatus {
  const answered = Object.prototype.hasOwnProperty.call(attempt.saved, questionId)
  const review = attempt.review.includes(questionId)
  if (answered && review) return 'answered-review'
  if (review) return 'review'
  if (answered) return 'answered'
  return attempt.visited.includes(questionId) ? 'not-answered' : 'not-visited'
}

export type StatusCounts = Record<QuestionStatus, number> & { total: number }

export function statusCounts(attempt: ExamAttempt, questionIds: string[]): StatusCounts {
  const counts: StatusCounts = {
    total: questionIds.length,
    'not-visited': 0,
    'not-answered': 0,
    answered: 0,
    review: 0,
    'answered-review': 0,
  }
  for (const id of questionIds) counts[questionStatus(attempt, id)] += 1
  return counts
}

export function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

/** Keeps only characters a numerical answer can contain: an optional leading minus, digits, one point. */
export function sanitiseNumeric(value: string): string {
  let result = ''
  for (const [index, char] of [...value].entries()) {
    if (char === '-' && index === 0) result += char
    else if (char === '.' && !result.includes('.')) result += char
    else if (char >= '0' && char <= '9') result += char
  }
  return result.slice(0, 12)
}

/**
 * Local persistence so a reload resumes the attempt. Keyed by account as well as paper, so a
 * shared computer never shows one candidate another's attempt. Server-side attempts replace this.
 */
export const attemptStorageKey = (owner: string, paperId: string) =>
  `dexam-exam-attempt-v1:${owner}:${paperId}`

export function loadAttempt(owner: string, paperId: string, paper: ExamPaper): ExamAttempt | null {
  try {
    const raw = window.localStorage.getItem(attemptStorageKey(owner, paperId))
    if (!raw) return null
    const parsed = attemptSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    const ids = new Set(paperQuestions(paper).map((question) => question.id))
    if (!ids.has(parsed.data.activeId)) return null
    return parsed.data
  } catch {
    return null
  }
}

export function storeAttempt(owner: string, paperId: string, attempt: ExamAttempt): void {
  try {
    window.localStorage.setItem(attemptStorageKey(owner, paperId), JSON.stringify(attempt))
  } catch {
    // Storage can be blocked or full; the attempt still works for this page view.
  }
}

export function forgetAttempt(owner: string, paperId: string): void {
  try {
    window.localStorage.removeItem(attemptStorageKey(owner, paperId))
  } catch {
    // Nothing to clear when storage is unavailable.
  }
}
