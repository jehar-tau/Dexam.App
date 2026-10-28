// @vitest-environment node
import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { bankExport } from './exportSchema.ts'
import { contentHash, planImport, type MediaCheck } from './planImport.ts'

const fixture = () =>
  bankExport.parse(
    JSON.parse(
      readFileSync(new URL('./fixtures/fictional-bank-export.json', import.meta.url), 'utf8'),
    ),
  )

const allMedia = new Map<string, MediaCheck>([
  ['fiction-2026/q1.png', { ok: true, mime: 'image/png', bytes: 2048 }],
  ['fiction-2026/q4.png', { ok: true, mime: 'image/png', bytes: 2048 }],
])

const byKey = (plan: ReturnType<typeof planImport>, key: string) =>
  plan.items.find((item) => item.question.externalKey === key)!

describe('export schema', () => {
  it('accepts the fictional fixture and rejects unknown versions and unsafe paths', () => {
    expect(fixture().questions).toHaveLength(6)
    const raw = JSON.parse(
      readFileSync(new URL('./fixtures/fictional-bank-export.json', import.meta.url), 'utf8'),
    )
    expect(bankExport.safeParse({ ...raw, schemaVersion: 2 }).success).toBe(false)
    for (const path of ['../secret.png', '/etc/q.png', 'a//b.png', 'q.svg', 'a/../../b.png']) {
      const unsafe = structuredClone(raw)
      unsafe.questions[0].assets[0].path = path
      expect(bankExport.safeParse(unsafe).success, path).toBe(false)
    }
  })
})

describe('planImport', () => {
  it('reports exact counts and reasons on a first import', () => {
    const plan = planImport(fixture(), new Map(), allMedia)
    expect(plan.counts).toEqual({
      insert: 6,
      unchanged: 0,
      newVersion: 0,
      ready: 4,
      quarantined: 2,
    })
    expect(plan.reasons).toEqual({
      'answer-key-unverified': 1,
      'figure-not-approved': 1,
      'source-label': 1,
      'unparsed-key': 1,
      'visual-crop-awaiting-review': 1,
    })
    expect(byKey(plan, 'fiction-2026-q3').options.map((option) => option.key)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ])
    expect(byKey(plan, 'fiction-2026-q3').answer).toEqual({
      kind: 'multi',
      correct: ['A', 'C', 'D'],
    })
    expect(byKey(plan, 'fiction-2026-qb1')).toMatchObject({ kind: 'descriptive', state: 'ready' })
  })

  it('is idempotent, and a changed question becomes a new version', () => {
    const bank = fixture()
    const existing = new Map(
      bank.questions.map((question) => [
        question.externalKey,
        { id: question.externalKey, version: 1, contentHash: contentHash(question) },
      ]),
    )
    expect(planImport(bank, existing, allMedia).counts).toMatchObject({ unchanged: 6, insert: 0 })

    bank.questions[1].prompt = 'How many edges does a cube have?'
    const changed = planImport(bank, existing, allMedia)
    expect(changed.counts).toMatchObject({ unchanged: 5, newVersion: 1 })
    expect(byKey(changed, 'fiction-2026-q2')).toMatchObject({ action: 'new-version', version: 2 })
  })

  it('quarantines missing or mismatched media', () => {
    const missing = planImport(fixture(), new Map(), new Map())
    expect(byKey(missing, 'fiction-2026-q1').reasons).toEqual(['media-missing'])
    const mismatch = planImport(
      fixture(),
      new Map(),
      new Map([['fiction-2026/q1.png', { ok: false, reason: 'media-mismatch' }]]),
    )
    expect(byKey(mismatch, 'fiction-2026-q1')).toMatchObject({
      state: 'quarantined',
      reasons: ['media-mismatch'],
    })
  })

  it('requires options, a matching key and a second pass for solved keys', () => {
    const bank = fixture()
    bank.questions[0].options = bank.questions[0].options.slice(0, 1)
    bank.questions[2].answer = { raw: 'E', status: 'official-key' }
    bank.questions[1].answer = null
    bank.questions[4].answer = {
      raw: 'A',
      status: 'independently-solved',
      verification: 'second-pass-reproduced',
    }
    bank.questions[4].prompt = 'Which year came first?'
    const plan = planImport(bank, new Map(), allMedia)
    expect(byKey(plan, 'fiction-2026-q1').reasons).toEqual(['options-missing'])
    expect(byKey(plan, 'fiction-2026-q3').reasons).toEqual(['key-option-mismatch'])
    expect(byKey(plan, 'fiction-2026-q2').reasons).toEqual(['answer-key-missing'])
    expect(byKey(plan, 'fiction-2026-q5').state).toBe('ready')
  })

  it('serves an approved printed block with letter-only options (D-060)', () => {
    const bank = fixture()
    const textHash = contentHash(bank.questions[0])
    bank.questions[0].display = 'block'
    bank.questions[0].options = ['A', 'B', 'C', 'D'].map((key) => ({ key, text: '', asset: null }))
    const plan = planImport(bank, new Map(), allMedia)
    expect(byKey(plan, 'fiction-2026-q1')).toMatchObject({ state: 'ready', reasons: [] })
    // Switching to the printed block is a content change: a new version.
    expect(contentHash(bank.questions[0])).not.toBe(textHash)

    bank.questions[0].assets = []
    expect(byKey(planImport(bank, new Map(), allMedia), 'fiction-2026-q1').reasons).toContain(
      'block-missing',
    )
  })

  it('keeps text questions on their existing versions (no D-060 fields in the hash)', () => {
    const question = fixture().questions[1]
    const withDefaults = { ...question, display: 'text' as const, taskMarks: null }
    expect(contentHash(withDefaults)).toBe(contentHash(question))
  })

  it('refuses an export that lists a question twice', () => {
    const bank = fixture()
    bank.questions.push(bank.questions[0])
    expect(() => planImport(bank, new Map(), allMedia)).toThrow(/more than once/)
  })
})
