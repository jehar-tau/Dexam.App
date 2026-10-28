import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BankPaperError,
  buildBankPaper,
  fetchBankPaper,
  fetchPaperReadiness,
  type BankPaperPayload,
} from './bankPaper'
import { bankPaperId, findPaper } from './paperCatalog'

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

const payload: BankPaperPayload = {
  paperId: 'fiction-2026',
  objectiveCount: 8,
  questions: [
    { id: id(1), number: '1', type: 'nat', prompt: 'How many corners?', figures: [], options: [] },
    {
      id: id(2),
      number: '2',
      type: 'mcq',
      prompt: 'Which shape?',
      figures: [{ path: 'ab/fig.png', width: 300, height: 200 }],
      options: [
        { key: 'A', text: 'Square', imagePath: null },
        { key: 'B', text: '', imagePath: 'cd/opt.png' },
      ],
    },
    { id: id(3), number: '3', type: 'nat', prompt: 'How many edges?', figures: [], options: [] },
    {
      id: id(4),
      number: '4',
      type: 'msq',
      prompt: 'Pick all.',
      figures: [{ path: 'ef/missing.png', width: null, height: null }],
      options: [
        { key: 'A', text: 'One', imagePath: null },
        { key: 'B', text: 'Two', imagePath: null },
      ],
    },
  ],
}

const urls = new Map([
  ['ab/fig.png', 'https://local/sign/ab'],
  ['cd/opt.png', 'https://local/sign/cd'],
])

describe('buildBankPaper', () => {
  it('groups questions into sections in paper order with the exam marking', () => {
    const paper = buildBankPaper('UCEED 2025', 'uceed', payload, urls)
    expect(paper.source).toBe('bank')
    expect(paper.sections.map((section) => [section.name, section.questions.length])).toEqual([
      ['NAT', 2],
      ['MCQ', 1],
      ['MSQ', 1],
    ])
    expect(paper.sections[1]!.marking).toEqual({ correct: 3, wrong: -0.71 })
    expect(paper.sections[0]!.questions[0]!.options).toBeUndefined()
  })

  it('attaches signed figure links and drops figures it could not sign', () => {
    const paper = buildBankPaper('UCEED 2025', 'uceed', payload, urls)
    const mcq = paper.sections[1]!.questions[0]!
    expect(mcq.images).toEqual([{ src: 'https://local/sign/ab', width: 300, height: 200 }])
    expect(mcq.options?.[1]).toEqual({ id: 'B', text: '', image: 'https://local/sign/cd' })
    expect(paper.sections[2]!.questions[0]!.images).toEqual([])
  })

  it('scales official time to the reviewed questions and says so', () => {
    const paper = buildBankPaper('UCEED 2025', 'uceed', payload, urls)
    expect(paper.durationMinutes).toBe(60)
    expect(paper.notes).toEqual([
      'Time is scaled from the official 120 minutes to the 4 questions shown.',
      expect.stringMatching(/^4 of the 8 objective questions/),
    ])

    const complete = buildBankPaper('CEED 2024', 'ceed', { ...payload, objectiveCount: 4 }, urls)
    expect(complete.durationMinutes).toBe(60)
    expect(complete.notes).toEqual([
      'Official time: 60 minutes. Marking follows the CEED 2026 Part A pattern.',
    ])
  })

  it('uses practice timing and no marking where the exam publishes none', () => {
    const paper = buildBankPaper('NID DAT 2020', 'nid-bdes', payload, urls)
    expect(paper.durationMinutes).toBe(5)
    expect(paper.sections.every((section) => section.marking === undefined)).toBe(true)
    expect(paper.notes?.[0]).toMatch(/^Practice timing/)
  })
})

function client(overrides: {
  rpc?: { data: unknown; error: unknown }
  signed?: { data: unknown; error: unknown }
}) {
  const createSignedUrls = vi.fn(() =>
    Promise.resolve(overrides.signed ?? { data: [], error: null }),
  )
  const rpc = vi.fn(() => Promise.resolve(overrides.rpc ?? { data: payload, error: null }))
  return {
    rpc,
    client: {
      rpc,
      storage: { from: vi.fn(() => ({ createSignedUrls })) },
    } as unknown as SupabaseClient,
    createSignedUrls,
  }
}

describe('fetchBankPaper', () => {
  it('signs every figure path once and builds the paper', async () => {
    const {
      client: mock,
      rpc,
      createSignedUrls,
    } = client({
      signed: {
        data: [
          { path: 'ab/fig.png', signedUrl: 'https://local/sign/ab', error: null },
          { path: 'cd/opt.png', signedUrl: 'https://local/sign/cd', error: null },
          { path: 'ef/missing.png', signedUrl: '', error: 'Object not found' },
        ],
        error: null,
      },
    })
    const paper = await fetchBankPaper(mock, 'UCEED 2025', 'uceed', 'uceed-2025')
    expect(rpc).toHaveBeenCalledWith('get_assessment_student_paper', {
      p_paper_id: 'uceed-2025',
    })
    expect(createSignedUrls).toHaveBeenCalledWith(
      ['ab/fig.png', 'cd/opt.png', 'ef/missing.png'],
      14400,
    )
    expect(paper.sections[1]!.questions[0]!.images?.[0]?.src).toBe('https://local/sign/ab')
  })

  it('reports refusals, unreadable payloads and signing failures', async () => {
    await expect(
      fetchBankPaper(
        client({ rpc: { data: null, error: { code: '42501' } } }).client,
        'x',
        'uceed',
        'uceed-2025',
      ),
    ).rejects.toBeInstanceOf(BankPaperError)
    await expect(
      fetchBankPaper(
        client({ rpc: { data: { questions: 'nope' }, error: null } }).client,
        'x',
        'uceed',
        'uceed-2025',
      ),
    ).rejects.toThrow('This paper could not be read.')
    await expect(
      fetchBankPaper(
        client({ signed: { data: null, error: { message: 'denied' } } }).client,
        'x',
        'uceed',
        'uceed-2025',
      ),
    ).rejects.toThrow(/figures/)
  })
})

describe('fetchPaperReadiness and bankPaperId', () => {
  it('maps readiness rows by bank paper id', async () => {
    const { client: mock } = client({
      rpc: {
        data: [{ paper_id: 'uceed-2025', ready_count: 21, objective_count: 56 }],
        error: null,
      },
    })
    const readiness = await fetchPaperReadiness(mock)
    expect(readiness.get('uceed-2025')).toEqual({ ready: 21, objective: 56 })
  })

  it('links catalogue papers to bank papers, leaving unconfirmed NIFT booklets unlinked', () => {
    expect(bankPaperId(findPaper('uceed-2025')!)).toBe('uceed-2025')
    expect(bankPaperId(findPaper('nift-bdes-2014')!)).toBe('nift-2014-bdes-written')
    expect(bankPaperId(findPaper('nift-mdes-sample')!)).toBe('nift-mdes-written-sample')
    expect(bankPaperId(findPaper('nift-bdes-2013')!)).toBeNull()
  })
})
