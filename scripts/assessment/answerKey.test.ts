// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { normaliseAnswer } from './answerKey.ts'

describe('normaliseAnswer', () => {
  it.each([
    ['B', { kind: 'choice', correct: ['B'] }],
    ['3', { kind: 'choice', correct: ['C'] }],
    ['A or B', { kind: 'choice', correct: ['A', 'B'] }],
    ['c OR d', { kind: 'choice', correct: ['C', 'D'] }],
  ])('reads the multiple-choice key %s', (raw, expected) => {
    expect(normaliseAnswer(raw, 'mcq')).toEqual(expected)
  })

  it.each([
    ['A,C', { kind: 'multi', correct: ['A', 'C'] }],
    ['ACD', { kind: 'multi', correct: ['A', 'C', 'D'] }],
    ['B. D', { kind: 'multi', correct: ['B', 'D'] }],
    ['D', { kind: 'multi', correct: ['D'] }],
    ['B OR B, C', { kind: 'multi', alternatives: [['B'], ['B', 'C']] }],
    [
      'ABC or BC',
      {
        kind: 'multi',
        alternatives: [
          ['A', 'B', 'C'],
          ['B', 'C'],
        ],
      },
    ],
    [
      'BC or ABC or BCD or ABCD',
      {
        kind: 'multi',
        alternatives: [
          ['B', 'C'],
          ['A', 'B', 'C'],
          ['B', 'C', 'D'],
          ['A', 'B', 'C', 'D'],
        ],
      },
    ],
  ])('reads the multiple-select key %s', (raw, expected) => {
    expect(normaliseAnswer(raw, 'msq')).toEqual(expected)
  })

  it.each([
    ['12', { kind: 'numeric', accepted: [{ exact: 12 }] }],
    ['02', { kind: 'numeric', accepted: [{ exact: 2 }] }],
    ['-3.5', { kind: 'numeric', accepted: [{ exact: -3.5 }] }],
    ['7 OR 9', { kind: 'numeric', accepted: [{ exact: 7 }, { exact: 9 }] }],
    ['0.17 - 0.19', { kind: 'numeric', accepted: [{ range: [0.17, 0.19] }] }],
    ['132.8 – 133.1', { kind: 'numeric', accepted: [{ range: [132.8, 133.1] }] }],
    ['94.2 (92.9 - 94.6)', { kind: 'numeric', accepted: [{ range: [92.9, 94.6] }] }],
    ['2.25 (2.24-2.26)', { kind: 'numeric', accepted: [{ range: [2.24, 2.26] }] }],
    ['16.12 (15.00~16.50)', { kind: 'numeric', accepted: [{ range: [15, 16.5] }] }],
  ])('reads the numerical key %s', (raw, expected) => {
    expect(normaliseAnswer(raw, 'nat')).toEqual(expected)
  })

  it('reads dropped and full-marks entries for every type', () => {
    expect(normaliseAnswer('DROPPED', 'mcq')).toEqual({ kind: 'dropped' })
    expect(normaliseAnswer('FULL MARKS', 'msq')).toEqual({ kind: 'full_marks' })
    expect(normaliseAnswer('DROPPED (+3 marks awarded to all)', 'mcq')).toEqual({
      kind: 'full_marks',
    })
  })

  it.each([
    ['', 'mcq'],
    ['Q66', 'mcq'],
    ['Q36', 'msq'],
    ['Q06', 'nat'],
    ['AA', 'msq'],
    ['G', 'mcq'],
    ['9 - 3', 'nat'],
    ['about 12', 'nat'],
    ['12 (approx)', 'nat'],
  ] as const)('refuses the unreadable key %j for %s', (raw, kind) => {
    expect(normaliseAnswer(raw, kind)).toBeNull()
  })
})
