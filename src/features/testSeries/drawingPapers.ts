import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { findPaper, paperLabel } from './paperCatalog'

/**
 * D-060: drawing papers. A paper's drawing tasks taken on their own on the clock: UCEED Part B
 * (60 min), CEED Part B (120 min), NID DAT drawing mocks on the 2026 all-drawing pattern
 * (3 hours, 100 marks) and NIFT CAT (3 hours).
 */

const numberish = z.union([z.number(), z.string().transform(Number)])

const drawingPaperSchema = z.object({
  paperId: z.string(),
  exam: z.string(),
  tasks: z.number().int(),
  minutes: z.number().int(),
  totalMarks: numberish,
  original: z.boolean(),
  locked: z.boolean(),
  latest: z
    .object({
      attemptId: z.string().uuid(),
      status: z.enum(['none', 'drawing', 'uploading', 'submitted', 'evaluated']),
      score: numberish.nullable(),
      maxScore: numberish.nullable(),
    })
    .nullable(),
})

export type DrawingPaper = z.infer<typeof drawingPaperSchema>

export class DrawingPaperError extends Error {}

export async function fetchDrawingPapers(client: SupabaseClient): Promise<DrawingPaper[]> {
  const result = await client.rpc('list_drawing_papers')
  if (result.error) throw new DrawingPaperError('Drawing papers could not be loaded.')
  return z.array(drawingPaperSchema).parse(result.data as unknown)
}

export async function startDrawingPaper(client: SupabaseClient, paperId: string): Promise<string> {
  const result = await client.rpc('start_drawing_paper', { p_paper_id: paperId })
  if (result.error) {
    throw new DrawingPaperError(
      result.error.code === 'DX001'
        ? 'This paper is not included in your access.'
        : result.error.code === 'P0002'
          ? 'This paper has no drawing tasks ready yet.'
          : 'The drawing paper could not be started. Try again.',
    )
  }
  return z.object({ attemptId: z.string().uuid() }).parse(result.data as unknown).attemptId
}

/** B.Des or M.Des, from the paper id. */
export function drawingLevel(paperId: string): 'bdes' | 'mdes' {
  return paperId.startsWith('ceed-') || paperId.includes('mdes') ? 'mdes' : 'bdes'
}

const MOCK_RE = /^nid-(bdes|mdes)-dat-mock-(\d+)$/
const CAT_RE = /^nift-(?:(\d{4})-)?(bdes|mdes)-cat(?:-sample)?$/

/** A reader-friendly name; exam names here describe the pattern, not a hidden source. */
export function drawingTitle(paperId: string): string {
  const mock = MOCK_RE.exec(paperId)
  if (mock)
    return `NID DAT ${mock[1] === 'bdes' ? 'B.Des' : 'M.Des'} drawing mock ${Number(mock[2])}`
  const cat = CAT_RE.exec(paperId)
  if (cat)
    return `NIFT ${cat[2] === 'bdes' ? 'B.Des' : 'M.Des'} CAT${cat[1] ? ` ${cat[1]}` : ' sample'}`
  const paper = findPaper(paperId)
  return paper ? `${paperLabel(paper)} · Part B` : paperId.toUpperCase()
}

export type DrawingGroup = 'nid-mock' | 'part-b' | 'nid-past' | 'nift-cat'

export function drawingGroup(paper: Pick<DrawingPaper, 'paperId' | 'exam'>): DrawingGroup {
  if (MOCK_RE.test(paper.paperId)) return 'nid-mock'
  if (paper.exam === 'nift') return 'nift-cat'
  if (paper.exam === 'nid') return 'nid-past'
  return 'part-b'
}
