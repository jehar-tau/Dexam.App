import golden from './scoringGolden.json'
import {
  describeKey,
  describeResponse,
  scoreResponse,
  summariseResult,
  type AnswerKey,
  type AttemptResult,
  type Marking,
  type ResultQuestion,
} from './scoring'
import type { ExamQuestionKind } from './examPaper'

type GoldenCase = {
  name: string
  marking: 'uceed' | 'practice'
  type: ExamQuestionKind
  key: AnswerKey
  response: string | string[] | null
  outcome: string
  marks: number
}

describe('scoreResponse matches the server golden cases', () => {
  it.each(golden.cases as GoldenCase[])('$name', (testCase) => {
    const marking = (golden.marking as Record<string, Record<string, Marking>>)[testCase.marking]![
      testCase.type
    ]!
    expect(scoreResponse(testCase.type, testCase.key, testCase.response, marking)).toEqual({
      outcome: testCase.outcome,
      marks: testCase.marks,
    })
  })
})

const question = (overrides: Partial<ResultQuestion>): ResultQuestion => ({
  id: 'q',
  number: '1',
  type: 'mcq',
  prompt: 'Prompt',
  figures: [],
  options: [],
  response: null,
  outcome: 'unanswered',
  marks: 0,
  key: { kind: 'choice', correct: ['A'] },
  explanation: null,
  topic: null,
  topicName: null,
  ...overrides,
})

describe('summariseResult', () => {
  const result: AttemptResult = {
    attemptId: 'a',
    paperId: 'p',
    title: 'Paper',
    preview: true,
    startedAt: null,
    submittedAt: null,
    submitReason: 'candidate',
    late: false,
    durationMinutes: 20,
    score: 0,
    maxScore: 0,
    marking: { nat: { correct: 4, wrong: 0 }, mcq: { correct: 3, wrong: -1 } },
    questions: [
      question({
        id: '1',
        type: 'nat',
        outcome: 'correct',
        marks: 4,
        topic: 'spatial',
        topicName: 'Spatial',
      }),
      question({
        id: '2',
        type: 'nat',
        outcome: 'wrong',
        marks: 0,
        topic: 'spatial',
        topicName: 'Spatial',
      }),
      question({ id: '3', outcome: 'wrong', marks: -1, topic: 'language', topicName: 'Language' }),
      question({ id: '4', outcome: 'wrong', marks: -1, topic: 'language', topicName: 'Language' }),
      question({ id: '5', outcome: 'unanswered', topic: 'language', topicName: 'Language' }),
      question({ id: '6', outcome: 'dropped', topic: 'language', topicName: 'Language' }),
    ],
  }

  it('counts outcomes, sections, accuracy and weak topics', () => {
    const summary = summariseResult(result)
    expect(summary.counts).toMatchObject({
      total: 6,
      correct: 1,
      wrong: 3,
      unanswered: 1,
      dropped: 1,
    })
    expect(summary.attempted).toBe(4)
    expect(summary.accuracy).toBe(0.25)
    expect(summary.sections).toEqual([
      expect.objectContaining({ type: 'nat', total: 2, marks: 4, maxMarks: 8 }),
      expect.objectContaining({ type: 'mcq', total: 4, marks: -2, maxMarks: 9 }),
    ])
    expect(summary.topics.map((topic) => [topic.name, topic.total, topic.accuracy])).toEqual([
      ['Language', 3, 0],
      ['Spatial', 2, 0.5],
    ])
    expect(summary.improve.map((topic) => topic.name)).toEqual(['Language', 'Spatial'])
  })

  it('describes keys and responses for review', () => {
    expect(describeKey({ kind: 'multi', alternatives: [['B'], ['B', 'C']] })).toBe('B or B, C')
    expect(describeKey({ kind: 'numeric', accepted: [{ range: [1, 2] }, { exact: 4 }] })).toBe(
      '1 to 2 or 4',
    )
    expect(describeKey({ kind: 'dropped' })).toBe('Question dropped')
    expect(describeResponse(['A', 'C'])).toBe('A, C')
    expect(describeResponse(null)).toBe('Not answered')
  })
})
