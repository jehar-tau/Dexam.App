import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import type { ExamKey } from './paperCatalog'
import type { ExamPaper, ExamQuestion, ExamQuestionKind, ExamSection } from './examPaper'

/**
 * F038/F042: a real paper from the question bank. The server returns only reviewed (ready)
 * objective questions, without answer keys; figures are private and opened with signed links.
 */

const SIGNED_URL_SECONDS = 4 * 60 * 60

const paperPayload = z.object({
  paperId: z.string(),
  objectiveCount: z.number().int().min(0),
  questions: z.array(
    z.object({
      id: z.string().uuid(),
      number: z.string().nullable(),
      type: z.enum(['nat', 'msq', 'mcq']),
      prompt: z.string(),
      figures: z.array(
        z.object({
          path: z.string(),
          width: z.number().nullable(),
          height: z.number().nullable(),
        }),
      ),
      options: z.array(
        z.object({ key: z.string(), text: z.string(), imagePath: z.string().nullable() }),
      ),
    }),
  ),
})

export type BankPaperPayload = z.infer<typeof paperPayload>

type Marking = NonNullable<ExamSection['marking']>

type ExamPattern = {
  label: string
  /** Official Part A minutes for the full paper; null when not published. */
  minutes: number | null
  marking?: Partial<Record<ExamQuestionKind, Marking>>
}

const msqLadder =
  'Part marks when only correct options are chosen; −1 if any wrong option is chosen.'

// Marking and timing from the verified 2026 UCEED and CEED brochures (Part A). Earlier papers are
// presented on the current pattern. NID and NIFT do not publish a per-question scheme.
const patterns: Partial<Record<ExamKey, ExamPattern>> = {
  uceed: {
    label: 'UCEED 2026 Part A pattern',
    minutes: 120,
    marking: {
      nat: { correct: 4, wrong: 0 },
      msq: { correct: 4, wrong: -1, note: msqLadder },
      mcq: { correct: 3, wrong: -0.71 },
    },
  },
  ceed: {
    label: 'CEED 2026 Part A pattern',
    minutes: 60,
    marking: {
      nat: { correct: 4, wrong: 0 },
      msq: { correct: 4, wrong: -1, note: msqLadder },
      mcq: { correct: 3, wrong: -0.5 },
    },
  },
}

const kindLabels: Record<ExamQuestionKind, string> = {
  nat: 'Numerical answer',
  msq: 'Multiple select',
  mcq: 'Multiple choice',
}

export type SignedUrls = Map<string, string>

/** Pure: shape a bank payload into the exam window's paper. */
export function buildBankPaper(
  title: string,
  exam: ExamKey,
  payload: BankPaperPayload,
  urls: SignedUrls,
): ExamPaper {
  const pattern = patterns[exam]
  const sections: ExamSection[] = []
  for (const item of payload.questions) {
    let section = sections.find((entry) => entry.id === item.type)
    if (!section) {
      section = {
        id: item.type,
        name: item.type.toUpperCase(),
        kindLabel: kindLabels[item.type],
        marking: pattern?.marking?.[item.type],
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
  const notes: string[] = []
  let durationMinutes: number
  if (pattern?.minutes) {
    durationMinutes = Math.max(5, Math.round((pattern.minutes * shown) / total))
    notes.push(
      shown < total
        ? `Time is scaled from the official ${pattern.minutes} minutes to the ${shown} questions shown.`
        : `Official time: ${pattern.minutes} minutes. Marking follows the ${pattern.label}.`,
    )
  } else {
    durationMinutes = Math.max(5, shown)
    notes.push(
      'Practice timing: one minute per question, because the official timing is not published.',
    )
  }
  if (shown < total) {
    notes.push(
      `${shown} of the ${total} objective questions in this paper have been reviewed and are shown. The rest appear once their figures, options or answer keys are checked.`,
    )
  }

  return { title, durationMinutes, sections, source: 'bank', notes }
}

export class BankPaperError extends Error {}

export async function fetchBankPaper(
  client: SupabaseClient,
  title: string,
  exam: ExamKey,
  bankPaperId: string,
): Promise<ExamPaper> {
  const result = await client.rpc('get_assessment_student_paper', {
    p_paper_id: bankPaperId,
  })
  if (result.error) throw new BankPaperError('This paper could not be loaded for your account.')
  const parsed = paperPayload.safeParse(result.data as unknown)
  if (!parsed.success) throw new BankPaperError('This paper could not be read.')

  const paths = [
    ...new Set(
      parsed.data.questions.flatMap((question) => [
        ...question.figures.map((figure) => figure.path),
        ...question.options.flatMap((option) => (option.imagePath ? [option.imagePath] : [])),
      ]),
    ),
  ]
  const urls: SignedUrls = new Map()
  if (paths.length) {
    const signed = await client.storage
      .from('assessment-media')
      .createSignedUrls(paths, SIGNED_URL_SECONDS)
    if (signed.error) throw new BankPaperError('The figures for this paper could not be opened.')
    for (const entry of signed.data) {
      if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl)
    }
  }
  return buildBankPaper(title, exam, parsed.data, urls)
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
