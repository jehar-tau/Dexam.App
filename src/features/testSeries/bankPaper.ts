import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { ExamResponse } from './examAttempt'
import type { ExamPaper, ExamQuestion, ExamQuestionKind, ExamSection } from './examPaper'
import type { AttemptResult, Marking, ResultQuestion } from './scoring'

/**
 * F038/F042/F044: real papers and attempts. The server pins the questions an attempt serves,
 * sets its deadline, scores it and releases keys only with the result. Figures are private and
 * opened with signed links.
 */

const SIGNED_URL_SECONDS = 4 * 60 * 60

const markingSchema = z.object({
  correct: z.number(),
  wrong: z.number(),
  partial: z.boolean().optional(),
  practice: z.boolean().optional(),
})

const questionSchema = z.object({
  id: z.string().uuid(),
  number: z.string().nullable(),
  type: z.enum(['nat', 'msq', 'mcq']),
  prompt: z.string(),
  figures: z.array(
    z.object({ path: z.string(), width: z.number().nullable(), height: z.number().nullable() }),
  ),
  options: z.array(
    z.object({ key: z.string(), text: z.string(), imagePath: z.string().nullable() }),
  ),
})

const attemptPayload = z.object({
  attemptId: z.string().uuid(),
  paperId: z.string(),
  exam: z.string(),
  status: z.enum(['open', 'in_progress', 'submitted']),
  deadline: z.string().nullable(),
  durationMinutes: z.number().int().min(1),
  objectiveCount: z.number().int().min(0),
  marking: z.record(z.string(), markingSchema),
  questions: z.array(questionSchema),
})

export type BankAttemptPayload = z.infer<typeof attemptPayload>

const officialMinutes: Record<string, number> = { uceed: 120, ceed: 60 }

const kindLabels: Record<ExamQuestionKind, string> = {
  nat: 'Numerical answer',
  msq: 'Multiple select',
  mcq: 'Multiple choice',
}

const msqLadder =
  'Part marks when only correct options are chosen; −1 if any wrong option is chosen.'
const practiceNote = 'Dexam practice marking: this exam does not publish a per-question scheme.'

export type SignedUrls = Map<string, string>

function sectionMarking(marking: Marking | undefined): ExamSection['marking'] {
  if (!marking) return undefined
  const note = marking.practice ? practiceNote : marking.partial ? msqLadder : undefined
  return { correct: marking.correct, wrong: marking.wrong, ...(note ? { note } : {}) }
}

/** Pure: shape the server's pinned attempt into the exam window's paper. */
export function buildBankPaper(
  title: string,
  payload: BankAttemptPayload,
  urls: SignedUrls,
): ExamPaper {
  const sections: ExamSection[] = []
  for (const item of payload.questions) {
    let section = sections.find((entry) => entry.id === item.type)
    if (!section) {
      section = {
        id: item.type,
        name: item.type.toUpperCase(),
        kindLabel: kindLabels[item.type],
        marking: sectionMarking(payload.marking[item.type]),
        questions: [],
      }
      sections.push(section)
    }
    const question: ExamQuestion = {
      id: item.id,
      kind: item.type,
      number: item.number ?? undefined,
      prompt: item.prompt,
      images: item.figures.flatMap((figure) => {
        const src = urls.get(figure.path)
        return src ? [{ src, width: figure.width, height: figure.height }] : []
      }),
      options:
        item.type === 'nat'
          ? undefined
          : item.options.map((option) => ({
              id: option.key,
              text: option.text,
              image: option.imagePath ? urls.get(option.imagePath) : undefined,
            })),
    }
    section.questions.push(question)
  }

  const shown = payload.questions.length
  const total = Math.max(payload.objectiveCount, shown)
  const official = officialMinutes[payload.exam]
  const notes: string[] = []
  if (official) {
    notes.push(
      shown < total
        ? `Time is scaled from the official ${official} minutes to the ${shown} questions shown.`
        : `Official time: ${official} minutes. Marking follows the ${payload.exam.toUpperCase()} 2026 Part A pattern.`,
    )
  } else {
    notes.push(
      'Practice timing: one minute per question, because the official timing is not published.',
    )
  }
  if (shown < total) {
    notes.push(
      `${shown} of the ${total} objective questions in this paper have been reviewed and are shown. The rest appear once their figures, options or answer keys are checked.`,
    )
  }

  return { title, durationMinutes: payload.durationMinutes, sections, source: 'bank', notes }
}

export class BankPaperError extends Error {}

async function signPaths(client: SupabaseClient, paths: string[]): Promise<SignedUrls> {
  const urls: SignedUrls = new Map()
  const unique = [...new Set(paths)]
  if (!unique.length) return urls
  const signed = await client.storage
    .from('assessment-media')
    .createSignedUrls(unique, SIGNED_URL_SECONDS)
  if (signed.error) throw new BankPaperError('The figures for this paper could not be opened.')
  for (const entry of signed.data) {
    if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl)
  }
  return urls
}

const mediaPaths = (questions: z.infer<typeof questionSchema>[]) =>
  questions.flatMap((question) => [
    ...question.figures.map((figure) => figure.path),
    ...question.options.flatMap((option) => (option.imagePath ? [option.imagePath] : [])),
  ])

export type OpenedAttempt = {
  attemptId: string
  status: BankAttemptPayload['status']
  deadline: number | null
  paper: ExamPaper
}

/**
 * Opens (or resumes) the student's attempt at a bank paper; null when nothing is reviewed yet.
 * The clock does not start until beginBankAttempt().
 */
export async function openBankAttempt(
  client: SupabaseClient,
  title: string,
  bankPaperId: string,
): Promise<OpenedAttempt | null> {
  const result = await client.rpc('open_assessment_attempt', { p_paper_id: bankPaperId })
  if (result.error) {
    if (result.error.code === 'P0002') return null
    throw new BankPaperError('This paper could not be loaded for your account.')
  }
  const parsed = attemptPayload.safeParse(result.data as unknown)
  if (!parsed.success) throw new BankPaperError('This paper could not be read.')
  const urls = await signPaths(client, mediaPaths(parsed.data.questions))
  return {
    attemptId: parsed.data.attemptId,
    status: parsed.data.status,
    deadline: parsed.data.deadline ? Date.parse(parsed.data.deadline) : null,
    paper: buildBankPaper(title, parsed.data, urls),
  }
}

/** Starts the server clock and returns the server deadline. */
export async function beginBankAttempt(client: SupabaseClient, attemptId: string) {
  const result = await client.rpc('begin_assessment_attempt', { p_attempt_id: attemptId })
  const parsed = z.object({ deadline: z.string() }).safeParse(result.data as unknown)
  if (result.error || !parsed.success) {
    throw new BankPaperError('The paper could not be started. Please try again.')
  }
  return Date.parse(parsed.data.deadline)
}

export async function submitBankAttempt(
  client: SupabaseClient,
  attemptId: string,
  saved: Record<string, ExamResponse>,
  reason: 'candidate' | 'time',
) {
  const result = await client.rpc('submit_assessment_attempt', {
    p_attempt_id: attemptId,
    p_responses: saved,
    p_reason: reason,
  })
  if (result.error) {
    throw new BankPaperError('Your paper could not be submitted. Please try again.')
  }
}

const keySchema = z.union([
  z.object({ kind: z.literal('choice'), correct: z.array(z.string()) }),
  z.object({ kind: z.literal('multi'), correct: z.array(z.string()) }),
  z.object({ kind: z.literal('multi'), alternatives: z.array(z.array(z.string())) }),
  z.object({
    kind: z.literal('numeric'),
    accepted: z.array(
      z.union([
        z.object({ exact: z.number() }),
        z.object({ range: z.tuple([z.number(), z.number()]) }),
      ]),
    ),
  }),
  z.object({ kind: z.literal('dropped') }),
  z.object({ kind: z.literal('full_marks') }),
])

const resultPayload = z.object({
  attemptId: z.string().uuid(),
  paperId: z.string(),
  startedAt: z.string().nullable(),
  submittedAt: z.string().nullable(),
  submitReason: z.enum(['candidate', 'time']).nullable(),
  late: z.boolean(),
  durationMinutes: z.number(),
  score: z.number(),
  maxScore: z.number(),
  marking: z.record(z.string(), markingSchema),
  questions: z.array(
    questionSchema.extend({
      response: z.union([z.string(), z.array(z.string())]).nullable(),
      outcome: z.enum(['correct', 'partial', 'wrong', 'unanswered', 'dropped', 'full_marks']),
      marks: z.number(),
      key: keySchema.nullable(),
      explanation: z.string().nullable(),
      topic: z.string().nullable(),
      topicName: z.string().nullable(),
    }),
  ),
})

export async function fetchAttemptResult(
  client: SupabaseClient,
  attemptId: string,
  titleFor: (bankPaperId: string) => string,
): Promise<AttemptResult> {
  const result = await client.rpc('get_assessment_attempt_result', { p_attempt_id: attemptId })
  if (result.error) throw new BankPaperError('This result is not available to your account.')
  const parsed = resultPayload.safeParse(result.data as unknown)
  if (!parsed.success) throw new BankPaperError('This result could not be read.')
  const data = parsed.data
  const urls = await signPaths(client, mediaPaths(data.questions))
  const questions: ResultQuestion[] = data.questions.map((question) => ({
    id: question.id,
    number: question.number,
    type: question.type,
    prompt: question.prompt,
    figures: question.figures.flatMap((figure) => {
      const src = urls.get(figure.path)
      return src ? [{ src, width: figure.width, height: figure.height }] : []
    }),
    options: question.options.map((option) => ({
      key: option.key,
      text: option.text,
      image: option.imagePath ? urls.get(option.imagePath) : undefined,
    })),
    response: question.response,
    outcome: question.outcome,
    marks: question.marks,
    key: question.key,
    explanation: question.explanation,
    topic: question.topic,
    topicName: question.topicName,
  }))
  return {
    attemptId: data.attemptId,
    paperId: data.paperId,
    title: titleFor(data.paperId),
    preview: false,
    startedAt: data.startedAt,
    submittedAt: data.submittedAt,
    submitReason: data.submitReason,
    late: data.late,
    durationMinutes: data.durationMinutes,
    score: data.score,
    maxScore: data.maxScore,
    marking: data.marking,
    questions,
  }
}

const attemptRows = z.array(
  z.object({
    attempt_id: z.string().uuid(),
    paper_id: z.string(),
    status: z.enum(['open', 'in_progress', 'submitted']),
    started_at: z.string().nullable(),
    submitted_at: z.string().nullable(),
    score: z.union([z.number(), z.string().transform(Number)]).nullable(),
    max_score: z.union([z.number(), z.string().transform(Number)]).nullable(),
    question_count: z.number().int(),
  }),
)

export type AttemptSummary = {
  attemptId: string
  paperId: string
  status: 'open' | 'in_progress' | 'submitted'
  submittedAt: string | null
  score: number | null
  maxScore: number | null
  questionCount: number
}

export async function fetchMyAttempts(client: SupabaseClient): Promise<AttemptSummary[]> {
  const result = await client.rpc('list_assessment_attempts')
  if (result.error) throw new BankPaperError('Your attempts could not be loaded.')
  return attemptRows.parse(result.data as unknown).map((row) => ({
    attemptId: row.attempt_id,
    paperId: row.paper_id,
    status: row.status,
    submittedAt: row.submitted_at,
    score: row.score,
    maxScore: row.max_score,
    questionCount: row.question_count,
  }))
}

const readinessPayload = z.array(
  z.object({
    paper_id: z.string(),
    ready_count: z.number().int(),
    objective_count: z.number().int(),
  }),
)

export type PaperReadiness = Map<string, { ready: number; objective: number }>

export async function fetchPaperReadiness(client: SupabaseClient): Promise<PaperReadiness> {
  const result = await client.rpc('list_assessment_student_papers')
  if (result.error) throw new BankPaperError('Paper availability could not be loaded.')
  const rows = readinessPayload.parse(result.data as unknown)
  return new Map(
    rows.map((row) => [row.paper_id, { ready: row.ready_count, objective: row.objective_count }]),
  )
}
