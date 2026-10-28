import type { ExamResponse } from './examAttempt'
import type { ExamFigureId, ExamImage, ExamQuestionKind } from './examPaper'

/**
 * F044 scoring and result summaries. Real attempts are scored by the server
 * (assessment_score_response); this mirror scores the fictional preview paper and is held to the
 * same golden cases (scoringGolden.json) as the database.
 */

export type AnswerKey =
  | { kind: 'choice'; correct: string[] }
  | { kind: 'multi'; correct: string[] }
  | { kind: 'multi'; alternatives: string[][] }
  | { kind: 'numeric'; accepted: ({ exact: number } | { range: [number, number] })[] }
  | { kind: 'dropped' }
  | { kind: 'full_marks' }

export type Marking = { correct: number; wrong: number; partial?: boolean; practice?: boolean }

export type Outcome = 'correct' | 'partial' | 'wrong' | 'unanswered' | 'dropped' | 'full_marks'

const NUMBER = /^\s*-?\d+(\.\d+)?\s*$/

export function scoreResponse(
  type: ExamQuestionKind,
  key: AnswerKey | null,
  response: ExamResponse | null | undefined,
  marking: Marking,
): { outcome: Outcome; marks: number } {
  if (!key || key.kind === 'dropped') return { outcome: 'dropped', marks: 0 }
  if (key.kind === 'full_marks') return { outcome: 'full_marks', marks: marking.correct }
  if (
    response === null ||
    response === undefined ||
    (typeof response === 'string' && response.trim() === '') ||
    (Array.isArray(response) && response.length === 0)
  ) {
    return { outcome: 'unanswered', marks: 0 }
  }
  const wrong = { outcome: 'wrong' as const, marks: marking.wrong }

  if (type === 'mcq') {
    return key.kind === 'choice' && typeof response === 'string' && key.correct.includes(response)
      ? { outcome: 'correct', marks: marking.correct }
      : wrong
  }

  if (type === 'msq') {
    if (!Array.isArray(response) || key.kind !== 'multi') return wrong
    const chosen = [...new Set(response)].sort()
    const sets = 'correct' in key ? [key.correct] : key.alternatives
    let best: { outcome: Outcome; marks: number } = wrong
    for (const candidate of sets) {
      const set = [...candidate].sort()
      if (set.join() === chosen.join()) return { outcome: 'correct', marks: marking.correct }
      if (
        marking.partial &&
        chosen.length < set.length &&
        chosen.every((letter) => set.includes(letter)) &&
        chosen.length > best.marks
      ) {
        best = { outcome: 'partial', marks: chosen.length }
      }
    }
    return best
  }

  if (key.kind !== 'numeric' || typeof response !== 'string' || !NUMBER.test(response)) return wrong
  const value = Number(response.trim())
  const accepted = key.accepted.some((item) =>
    'exact' in item ? value === item.exact : value >= item.range[0] && value <= item.range[1],
  )
  return accepted ? { outcome: 'correct', marks: marking.correct } : wrong
}

export type ResultQuestion = {
  id: string
  number: string | null
  type: ExamQuestionKind
  prompt: string
  figures: ExamImage[]
  /** Fictional preview figure. */
  figure?: ExamFigureId
  options: { key: string; text: string; image?: string }[]
  response: ExamResponse | null
  outcome: Outcome
  marks: number
  key: AnswerKey | null
  explanation: string | null
  topic: string | null
  topicName: string | null
}

export type AttemptResult = {
  attemptId: string
  paperId: string
  title: string
  /** Paper attempts link back to their paper; practice sets to the practice page. */
  kind?: 'paper' | 'practice' | 'mock'
  preview: boolean
  startedAt: string | null
  submittedAt: string | null
  submitReason: 'candidate' | 'time' | null
  late: boolean
  durationMinutes: number
  score: number
  maxScore: number
  marking: Partial<Record<ExamQuestionKind, Marking>>
  questions: ResultQuestion[]
}

export type OutcomeCounts = Record<Outcome, number> & { total: number }

export type SectionSummary = OutcomeCounts & {
  type: ExamQuestionKind
  marks: number
  maxMarks: number
}

export type TopicSummary = {
  slug: string
  name: string
  total: number
  /** Correct, partial and full-marks answers. */
  scored: number
  accuracy: number
}

const emptyCounts = (): OutcomeCounts => ({
  total: 0,
  correct: 0,
  partial: 0,
  wrong: 0,
  unanswered: 0,
  dropped: 0,
  full_marks: 0,
})

const sectionNames: Record<ExamQuestionKind, string> = { nat: 'NAT', msq: 'MSQ', mcq: 'MCQ' }
export const sectionName = (type: ExamQuestionKind) => sectionNames[type]

export function summariseResult(result: AttemptResult) {
  const counts = emptyCounts()
  const sections: SectionSummary[] = []
  const topics = new Map<string, TopicSummary>()

  for (const question of result.questions) {
    counts.total += 1
    counts[question.outcome] += 1

    let section = sections.find((entry) => entry.type === question.type)
    if (!section) {
      section = { ...emptyCounts(), type: question.type, marks: 0, maxMarks: 0 }
      sections.push(section)
    }
    section.total += 1
    section[question.outcome] += 1
    section.marks += question.marks
    if (question.outcome !== 'dropped')
      section.maxMarks += result.marking[question.type]?.correct ?? 0

    if (question.outcome === 'dropped') continue
    const slug = question.topic ?? 'general'
    const topic = topics.get(slug) ?? {
      slug,
      name: question.topicName ?? 'General',
      total: 0,
      scored: 0,
      accuracy: 0,
    }
    topic.total += 1
    if (['correct', 'partial', 'full_marks'].includes(question.outcome)) topic.scored += 1
    topic.accuracy = topic.scored / topic.total
    topics.set(slug, topic)
  }

  const attempted = counts.total - counts.unanswered - counts.dropped
  const topicList = [...topics.values()].sort(
    (a, b) => a.accuracy - b.accuracy || b.total - a.total,
  )
  return {
    counts,
    attempted,
    // Of the questions answered, the share that earned marks.
    accuracy: attempted ? (counts.correct + counts.partial + counts.full_marks) / attempted : 0,
    sections,
    topics: topicList,
    // Weakest topics with enough questions to mean something.
    improve: topicList.filter((topic) => topic.total >= 2 && topic.accuracy < 0.6).slice(0, 3),
  }
}

/** The accepted answer, written for a candidate. */
export function describeKey(key: AnswerKey | null): string {
  if (!key) return '—'
  switch (key.kind) {
    case 'choice':
      return key.correct.join(' or ')
    case 'multi':
      return 'correct' in key
        ? key.correct.join(', ')
        : key.alternatives.map((set) => set.join(', ')).join(' or ')
    case 'numeric':
      return key.accepted
        .map((item) =>
          'exact' in item ? String(item.exact) : `${item.range[0]} to ${item.range[1]}`,
        )
        .join(' or ')
    case 'dropped':
      return 'Question dropped'
    case 'full_marks':
      return 'Full marks to everyone'
  }
}

export function describeResponse(response: ExamResponse | null): string {
  if (response === null || (Array.isArray(response) && !response.length) || response === '') {
    return 'Not answered'
  }
  return Array.isArray(response) ? response.join(', ') : response
}
