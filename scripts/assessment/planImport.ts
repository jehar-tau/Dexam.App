import { createHash } from 'node:crypto'

import { normaliseAnswer, type AnswerKey, type QuestionKind } from './answerKey.ts'
import type { BankExport, ExportQuestion } from './exportSchema.ts'

/**
 * F038 import planning: a pure decision for every exported question (insert, unchanged or new
 * version; ready or quarantined with every failing reason). The CLI performs the writes.
 */

export const TRUSTED_ANSWER_STATUSES = new Set([
  'official-key',
  'matched-source',
  'matched-source-positional',
  'independently-solved',
])

// Exam names in candidate-facing text would reveal the source paper.
const SOURCE_LABEL = /\b(?:U\.?C\.?E\.?E\.?D|C\.?E\.?E\.?D|N\.?I\.?F\.?T|N\.?I\.?D)\b/i

export type MediaCheck =
  | { ok: true; mime: 'image/png' | 'image/jpeg' | 'image/webp'; bytes: number }
  | { ok: false; reason: 'media-missing' | 'media-mismatch' | 'media-too-large' | 'media-type' }

export type ExistingQuestion = { id: string; version: number; contentHash: string }

export type PlannedOption = {
  key: string
  text: string
  position: number
  assetIndex: number | null
}

export type PlannedQuestion = {
  question: ExportQuestion
  kind: QuestionKind | 'descriptive'
  action: 'insert' | 'unchanged' | 'new-version'
  version: number
  state: 'ready' | 'quarantined'
  reasons: string[]
  answer: AnswerKey | null
  contentHash: string
  options: PlannedOption[]
}

export type ImportPlan = {
  items: PlannedQuestion[]
  counts: Record<'insert' | 'unchanged' | 'newVersion' | 'ready' | 'quarantined', number>
  reasons: Record<string, number>
}

const kindOf = (type: ExportQuestion['type']) => type.toLowerCase() as QuestionKind | 'descriptive'

/** Numeric option keys 1–6 map to A–F in order. */
const optionKey = (key: string) => (/^[1-6]$/.test(key) ? 'ABCDEF'[Number(key) - 1] : key)

export function contentHash(question: ExportQuestion): string {
  // Provenance and identity do not change what a candidate sees, so they stay out of the hash.
  const content: Partial<ExportQuestion> = { ...question }
  delete content.provenance
  delete content.externalKey
  return createHash('sha256').update(JSON.stringify(content)).digest('hex')
}

function answerReasons(
  question: ExportQuestion,
  kind: QuestionKind,
  optionKeys: string[],
): { reasons: string[]; answer: AnswerKey | null } {
  const raw = question.answer?.raw?.trim()
  if (!question.answer || !raw) return { reasons: ['answer-key-missing'], answer: null }
  const answer = normaliseAnswer(raw, kind)
  const reasons: string[] = []
  const status = question.answer.status
  if (!TRUSTED_ANSWER_STATUSES.has(status)) reasons.push('answer-key-unverified')
  else if (
    status === 'independently-solved' &&
    question.answer.verification !== 'second-pass-reproduced'
  )
    reasons.push('answer-key-unverified')
  if (!answer) return { reasons: [...reasons, 'unparsed-key'], answer: null }
  const letters =
    answer.kind === 'choice' || (answer.kind === 'multi' && 'correct' in answer)
      ? answer.correct
      : answer.kind === 'multi'
        ? answer.alternatives.flat()
        : []
  // Without options the question is already held for options; only compare when they exist.
  if (optionKeys.length >= 2 && letters.some((letter) => !optionKeys.includes(letter)))
    reasons.push('key-option-mismatch')
  return { reasons, answer }
}

export function planQuestion(
  question: ExportQuestion,
  existing: ExistingQuestion | undefined,
  media: Map<string, MediaCheck>,
): PlannedQuestion {
  const kind = kindOf(question.type)
  const reasons = new Set(question.holds)
  const hash = contentHash(question)

  if (!question.prompt.trim()) reasons.add('prompt-missing')

  const options: PlannedOption[] = question.options.map((option, position) => ({
    key: optionKey(option.key),
    text: option.text.trim(),
    position,
    assetIndex: option.asset ?? null,
  }))
  const keys = options.map((option) => option.key)
  if (kind === 'mcq' || kind === 'msq') {
    if (options.length < 2) reasons.add('options-missing')
    if (
      new Set(keys).size !== keys.length ||
      options.some(
        (option) =>
          (!option.text && option.assetIndex === null) ||
          (option.assetIndex !== null && question.assets[option.assetIndex] === undefined),
      )
    )
      reasons.add('options-invalid')
  }

  let answer: AnswerKey | null = null
  if (kind !== 'descriptive') {
    const result = answerReasons(question, kind, keys)
    answer = result.answer
    result.reasons.forEach((reason) => reasons.add(reason))
  }

  for (const asset of question.assets) {
    const check = media.get(asset.path)
    if (!check) reasons.add('media-missing')
    else if (!check.ok) reasons.add(check.reason)
    if (asset.role !== 'source_page' && asset.review !== 'approved')
      reasons.add('figure-not-approved')
  }

  const candidateText = [question.prompt, ...options.map((option) => option.text)].join('\n')
  if (SOURCE_LABEL.test(candidateText)) reasons.add('source-label')

  const action = !existing ? 'insert' : existing.contentHash === hash ? 'unchanged' : 'new-version'

  return {
    question,
    kind,
    action,
    version: !existing ? 1 : action === 'unchanged' ? existing.version : existing.version + 1,
    state: reasons.size ? 'quarantined' : 'ready',
    reasons: [...reasons].sort(),
    answer,
    contentHash: hash,
    options,
  }
}

export function planImport(
  bank: BankExport,
  existing: Map<string, ExistingQuestion>,
  media: Map<string, MediaCheck>,
): ImportPlan {
  const seen = new Set<string>()
  const items: PlannedQuestion[] = []
  for (const question of bank.questions) {
    if (seen.has(question.externalKey)) {
      throw new Error(`The export lists ${question.externalKey} more than once.`)
    }
    seen.add(question.externalKey)
    items.push(planQuestion(question, existing.get(question.externalKey), media))
  }

  const counts = { insert: 0, unchanged: 0, newVersion: 0, ready: 0, quarantined: 0 }
  const reasons: Record<string, number> = {}
  for (const item of items) {
    if (item.action === 'insert') counts.insert += 1
    else if (item.action === 'unchanged') counts.unchanged += 1
    else counts.newVersion += 1
    counts[item.state] += 1
    for (const reason of item.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1
  }
  return { items, counts, reasons }
}
