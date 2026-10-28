/**
 * F038 answer-key normaliser: turns an official key string into the structured key stored in
 * assessment_question_keys. Anything it cannot read with certainty returns null, and the importer
 * quarantines the question with `unparsed-key`.
 */

export type QuestionKind = 'nat' | 'msq' | 'mcq'

export type NumericAccepted = { exact: number } | { range: [number, number] }

export type AnswerKey =
  | { kind: 'choice'; correct: string[] }
  | { kind: 'multi'; correct: string[] }
  | { kind: 'multi'; alternatives: string[][] }
  | { kind: 'numeric'; accepted: NumericAccepted[] }
  | { kind: 'dropped' }
  | { kind: 'full_marks' }

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
const NUMBER = String.raw`-?\d+(?:\.\d+)?`
const RANGE = new RegExp(String.raw`^(${NUMBER})\s*(?:[-–~]|to)\s*(${NUMBER})$`, 'i')
const EXACT = new RegExp(String.raw`^${NUMBER}$`)

/** "B. D", "A,C", "ACD", "B, C" → sorted unique letters, or null if anything else appears. */
function optionSet(value: string): string[] | null {
  const compact = value.replace(/[\s,.;/&]+/g, '').toUpperCase()
  if (!compact || !/^[A-F]+$/.test(compact)) return null
  const letters = [...new Set(compact)].sort()
  return letters.length === compact.length ? letters : null
}

/** MCQ keys sometimes use 1–4 for A–D. */
function choiceLetter(value: string): string | null {
  const text = value.trim().toUpperCase()
  if (/^[A-F]$/.test(text)) return text
  if (/^[1-6]$/.test(text)) return OPTION_LETTERS[Number(text) - 1] ?? null
  return null
}

function numericValue(value: string): NumericAccepted | null {
  const text = value.trim()
  const range = RANGE.exec(text)
  if (range) {
    const low = Number(range[1])
    const high = Number(range[2])
    return low <= high ? { range: [low, high] } : null
  }
  return EXACT.test(text) ? { exact: Number(text) } : null
}

function numericKey(raw: string): NumericAccepted[] | null {
  // "94.2 (92.9 - 94.6)": the bracketed range is the accepted band.
  const bracketed = /^\s*(-?\d+(?:\.\d+)?)\s*\(([^()]+)\)\s*$/.exec(raw)
  if (bracketed) {
    const band = numericValue(bracketed[2] ?? '')
    return band && 'range' in band ? [band] : null
  }
  const parts = raw.split(/\s+or\s+/i)
  const accepted = parts.map(numericValue)
  return accepted.every((item): item is NumericAccepted => item !== null) ? accepted : null
}

export function normaliseAnswer(
  raw: string | null | undefined,
  kind: QuestionKind,
): AnswerKey | null {
  const text = String(raw ?? '').trim()
  if (!text) return null

  const upper = text.toUpperCase()
  if (/^FULL\s+MARKS$/.test(upper) || /AWARDED\s+TO\s+ALL/.test(upper))
    return { kind: 'full_marks' }
  if (upper === 'DROPPED') return { kind: 'dropped' }

  if (kind === 'nat') {
    const accepted = numericKey(text)
    return accepted ? { kind: 'numeric', accepted } : null
  }

  const alternatives = text.split(/\s+or\s+/i)

  if (kind === 'mcq') {
    const letters = alternatives.map(choiceLetter)
    if (!letters.every((item): item is string => item !== null)) return null
    return { kind: 'choice', correct: [...new Set(letters)].sort() }
  }

  const sets = alternatives.map(optionSet)
  if (!sets.every((item): item is string[] => item !== null)) return null
  const unique = sets.filter(
    (set, index) => sets.findIndex((other) => other.join() === set.join()) === index,
  )
  return unique.length === 1
    ? { kind: 'multi', correct: unique[0] }
    : { kind: 'multi', alternatives: unique }
}
