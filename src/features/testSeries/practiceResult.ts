import { loadAttempt } from './examAttempt'
import { paperQuestions, practicePaper, type ExamQuestionKind } from './examPaper'
import { scoreResponse, type AnswerKey, type AttemptResult, type Marking } from './scoring'

/**
 * Preview only: answer keys and topics for the fictional practice paper, so the results page
 * can be tried without the server. Real attempts are scored by the server.
 */

const practiceKeys: Record<string, { key: AnswerKey; topic: [string, string] }> = {
  'nat-1': {
    key: { kind: 'numeric', accepted: [{ exact: 12 }] },
    topic: ['spatial-reasoning', 'Spatial Reasoning'],
  },
  'nat-2': {
    key: { kind: 'numeric', accepted: [{ exact: 4 }] },
    topic: ['spatial-reasoning', 'Spatial Reasoning'],
  },
  'nat-3': {
    key: { kind: 'numeric', accepted: [{ exact: 25 }] },
    topic: ['numerical-reasoning', 'Numerical Reasoning'],
  },
  'nat-4': {
    key: { kind: 'numeric', accepted: [{ exact: 18 }] },
    topic: ['numerical-reasoning', 'Numerical Reasoning'],
  },
  'msq-1': {
    key: { kind: 'multi', correct: ['A', 'B', 'D'] },
    topic: ['design-awareness', 'Design Awareness'],
  },
  'msq-2': {
    key: { kind: 'multi', correct: ['A', 'C', 'D'] },
    topic: ['visual-reasoning', 'Visual Reasoning'],
  },
  'msq-3': { key: { kind: 'multi', correct: ['A', 'B', 'D'] }, topic: ['materials', 'Materials'] },
  'msq-4': {
    key: { kind: 'multi', correct: ['A', 'C', 'D'] },
    topic: ['design-awareness', 'Design Awareness'],
  },
  'mcq-1': {
    key: { kind: 'choice', correct: ['C'] },
    topic: ['spatial-reasoning', 'Spatial Reasoning'],
  },
  'mcq-2': {
    key: { kind: 'choice', correct: ['D'] },
    topic: ['visual-reasoning', 'Visual Reasoning'],
  },
  'mcq-3': {
    key: { kind: 'choice', correct: ['B'] },
    topic: ['design-awareness', 'Design Awareness'],
  },
  'mcq-4': { key: { kind: 'choice', correct: ['B'] }, topic: ['language', 'Language'] },
  'mcq-5': {
    key: { kind: 'choice', correct: ['C'] },
    topic: ['numerical-reasoning', 'Numerical Reasoning'],
  },
  'mcq-6': {
    key: { kind: 'choice', correct: ['C'] },
    topic: ['design-awareness', 'Design Awareness'],
  },
}

const practiceMarking: Record<ExamQuestionKind, Marking> = {
  nat: { correct: 4, wrong: 0 },
  msq: { correct: 4, wrong: -1, partial: true },
  mcq: { correct: 3, wrong: -1 },
}

export const previewResultId = (paperId: string) => `preview-${paperId}`

/** The preview result of the locally stored practice attempt, or null if it is not submitted. */
export function buildPracticeResult(paperId: string, title: string): AttemptResult | null {
  const attempt = loadAttempt('preview', paperId, practicePaper)
  if (!attempt || attempt.stage !== 'submitted') return null

  const questions = paperQuestions(practicePaper).map((question) => {
    const entry = practiceKeys[question.id]!
    const response = attempt.saved[question.id] ?? null
    const scored = scoreResponse(question.kind, entry.key, response, practiceMarking[question.kind])
    return {
      id: question.id,
      number: String(paperQuestions(practicePaper).indexOf(question) + 1),
      type: question.kind,
      prompt: question.prompt,
      figures: [],
      figure: question.figure,
      options: (question.options ?? []).map((option) => ({ key: option.id, text: option.text })),
      response,
      ...scored,
      key: entry.key,
      explanation: null,
      topic: entry.topic[0],
      topicName: entry.topic[1],
    }
  })

  const score = questions.reduce((sum, question) => sum + question.marks, 0)
  const maxScore = questions.reduce(
    (sum, question) =>
      sum + (question.outcome === 'dropped' ? 0 : practiceMarking[question.type].correct),
    0,
  )
  const submittedAt = attempt.submittedAt ? new Date(attempt.submittedAt).toISOString() : null
  return {
    attemptId: previewResultId(paperId),
    paperId,
    title,
    preview: true,
    startedAt: attempt.deadline
      ? new Date(attempt.deadline - practicePaper.durationMinutes * 60_000).toISOString()
      : null,
    submittedAt,
    submitReason: attempt.submitReason,
    late: false,
    durationMinutes: practicePaper.durationMinutes,
    score: Math.round(score * 100) / 100,
    maxScore,
    marking: practiceMarking,
    questions,
  }
}
