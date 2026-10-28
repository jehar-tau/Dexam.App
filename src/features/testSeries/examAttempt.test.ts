import { afterEach, describe, expect, it } from 'vitest'

import {
  attemptStorageKey,
  beginExam,
  clearResponse,
  createAttempt,
  expireIfDue,
  formatClock,
  goToQuestion,
  loadAttempt,
  markForReviewAndNext,
  questionStatus,
  remainingMs,
  sanitiseNumeric,
  saveAndNext,
  setStage,
  statusCounts,
  storeAttempt,
  submitAttempt,
} from './examAttempt'
import { paperQuestions, practicePaper } from './examPaper'

const ids = paperQuestions(practicePaper).map((question) => question.id)
const started = () => beginExam(createAttempt(practicePaper), practicePaper, 1_000)

describe('exam attempt', () => {
  afterEach(() => window.localStorage.clear())

  it('starts at the login stage and sets the deadline when the exam begins', () => {
    const attempt = createAttempt(practicePaper)
    expect(attempt.stage).toBe('login')
    expect(questionStatus(attempt, ids[0]!)).toBe('not-visited')

    const begun = started()
    expect(begun.stage).toBe('exam')
    expect(begun.deadline).toBe(1_000 + 20 * 60_000)
    expect(questionStatus(begun, ids[0]!)).toBe('not-answered')
    // Beginning twice must not move the deadline.
    expect(beginExam(begun, practicePaper, 9_999).deadline).toBe(begun.deadline)
  })

  it('keeps a response only through Save & Next and moves on', () => {
    const attempt = saveAndNext(started(), practicePaper, '12')
    expect(attempt.saved[ids[0]!]).toBe('12')
    expect(attempt.activeId).toBe(ids[1])
    expect(questionStatus(attempt, ids[0]!)).toBe('answered')
    expect(questionStatus(attempt, ids[1]!)).toBe('not-answered')
    expect(questionStatus(attempt, ids[2]!)).toBe('not-visited')
  })

  it('jumping through the palette keeps no unsaved response', () => {
    const attempt = goToQuestion(started(), ids[5]!)
    expect(attempt.activeId).toBe(ids[5])
    expect(attempt.saved).toEqual({})
    expect(questionStatus(attempt, ids[0]!)).toBe('not-answered')
  })

  it('marks for review with and without an answer, and Save & Next removes the mark', () => {
    let attempt = markForReviewAndNext(started(), practicePaper, undefined)
    expect(questionStatus(attempt, ids[0]!)).toBe('review')
    attempt = markForReviewAndNext(attempt, practicePaper, '3')
    expect(questionStatus(attempt, ids[1]!)).toBe('answered-review')
    attempt = goToQuestion(attempt, ids[1]!)
    attempt = saveAndNext(attempt, practicePaper, '3')
    expect(questionStatus(attempt, ids[1]!)).toBe('answered')
  })

  it('clears a saved response and saving an empty response clears it too', () => {
    let attempt = saveAndNext(started(), practicePaper, ['A', 'C'])
    attempt = goToQuestion(attempt, ids[0]!)
    expect(questionStatus(clearResponse(attempt), ids[0]!)).toBe('not-answered')
    expect(questionStatus(saveAndNext(attempt, practicePaper, []), ids[0]!)).toBe('not-answered')
  })

  it('wraps from the last question to the first', () => {
    const attempt = goToQuestion(started(), ids.at(-1)!)
    expect(saveAndNext(attempt, practicePaper, 'A').activeId).toBe(ids[0])
  })

  it('counts statuses for a set of questions', () => {
    let attempt = saveAndNext(started(), practicePaper, '1')
    attempt = markForReviewAndNext(attempt, practicePaper, undefined)
    expect(statusCounts(attempt, ids)).toMatchObject({
      total: ids.length,
      answered: 1,
      review: 1,
      'not-answered': 1,
      'not-visited': ids.length - 3,
    })
  })

  it('locks after submission and auto-submits when time runs out', () => {
    const begun = started()
    const submitted = submitAttempt(begun, 5_000, 'candidate')
    expect(submitted).toMatchObject({ stage: 'submitted', submitReason: 'candidate' })
    expect(saveAndNext(submitted, practicePaper, '1')).toBe(submitted)
    expect(clearResponse(submitted)).toBe(submitted)
    expect(submitAttempt(submitted, 6_000, 'time')).toBe(submitted)

    expect(expireIfDue(begun, begun.deadline! - 1)).toBe(begun)
    expect(expireIfDue(begun, begun.deadline!)).toMatchObject({
      stage: 'submitted',
      submitReason: 'time',
      submittedAt: begun.deadline,
    })
    expect(remainingMs(begun, begun.deadline! + 50)).toBe(0)
  })

  it('ignores answering actions before the exam begins', () => {
    const attempt = setStage(createAttempt(practicePaper), 'instructions')
    expect(saveAndNext(attempt, practicePaper, '1')).toBe(attempt)
    expect(goToQuestion(attempt, ids[3]!)).toBe(attempt)
  })

  it('formats the clock and sanitises numerical answers', () => {
    expect(formatClock(20 * 60_000)).toBe('00:20:00')
    expect(formatClock(61_001)).toBe('00:01:02')
    expect(formatClock(0)).toBe('00:00:00')
    expect(sanitiseNumeric('-12.5.3a')).toBe('-12.53')
    expect(sanitiseNumeric('4-2')).toBe('42')
    expect(sanitiseNumeric('1234567890123')).toHaveLength(12)
  })

  it('stores and reloads an attempt, rejecting tampered or foreign data', () => {
    const attempt = saveAndNext(started(), practicePaper, '7')
    storeAttempt('student-a', 'uceed-2025', attempt)
    expect(loadAttempt('student-a', 'uceed-2025', practicePaper)).toEqual(attempt)
    // Another account on the same computer starts fresh.
    expect(loadAttempt('student-b', 'uceed-2025', practicePaper)).toBeNull()

    window.localStorage.setItem(attemptStorageKey('student-a', 'bad'), '{"version":2}')
    expect(loadAttempt('student-a', 'bad', practicePaper)).toBeNull()
    window.localStorage.setItem(attemptStorageKey('student-a', 'bad'), 'not json')
    expect(loadAttempt('student-a', 'bad', practicePaper)).toBeNull()
    storeAttempt('student-a', 'foreign', { ...attempt, activeId: 'unknown-question' })
    expect(loadAttempt('student-a', 'foreign', practicePaper)).toBeNull()
  })
})
