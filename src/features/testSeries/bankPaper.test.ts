import type { SupabaseClient } from '@supabase/supabase-js'

import {
  BankPaperError,
  beginBankAttempt,
  buildBankPaper,
  fetchAttemptResult,
  fetchMyAttempts,
  fetchPaperReadiness,
  openBankAttempt,
  submitBankAttempt,
  type BankAttemptPayload,
} from './bankPaper'
import { bankPaperId, findPaper } from './paperCatalog'

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`

const marking = {
  nat: { correct: 4, wrong: 0 },
  msq: { correct: 4, wrong: -1, partial: true },
  mcq: { correct: 3, wrong: -0.71 },
}

const payload: BankAttemptPayload = {
  attemptId: id(9),
  paperId: 'uceed-2025',
  exam: 'uceed',
  status: 'open',
  deadline: null,
  durationMinutes: 60,
  objectiveCount: 8,
  marking,
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
  it('groups questions into sections in paper order with the server marking and time', () => {
    const paper = buildBankPaper('UCEED 2025', payload, urls)
    expect(paper).toMatchObject({ source: 'bank', durationMinutes: 60 })
    expect(paper.sections.map((section) => [section.name, section.questions.length])).toEqual([
      ['NAT', 2],
      ['MCQ', 1],
      ['MSQ', 1],
    ])
    expect(paper.sections[1]!.marking).toEqual({ correct: 3, wrong: -0.71 })
    expect(paper.sections[2]!.marking?.note).toMatch(/^Part marks/)
    expect(paper.sections[0]!.questions[0]!.options).toBeUndefined()
  })

  it('attaches signed figure links and drops figures it could not sign', () => {
    const paper = buildBankPaper('UCEED 2025', payload, urls)
    const mcq = paper.sections[1]!.questions[0]!
    expect(mcq.images).toEqual([{ src: 'https://local/sign/ab', width: 300, height: 200 }])
    expect(mcq.options?.[1]).toEqual({ id: 'B', text: '', image: 'https://local/sign/cd' })
    expect(paper.sections[2]!.questions[0]!.images).toEqual([])
  })

  it('explains scaled time and partial papers', () => {
    expect(buildBankPaper('UCEED 2025', payload, urls).notes).toEqual([
      'Time is scaled from the official 120 minutes to the 4 questions shown.',
      expect.stringMatching(/^4 of the 8 objective questions/),
    ])
    expect(
      buildBankPaper('CEED 2024', { ...payload, exam: 'ceed', objectiveCount: 4 }, urls).notes,
    ).toEqual(['Official time: 60 minutes. Marking follows the CEED 2026 Part A pattern.'])
  })

  it('labels practice marking and timing where the exam publishes none', () => {
    const practice = { correct: 1, wrong: 0, practice: true }
    const paper = buildBankPaper(
      'NID DAT 2020',
      { ...payload, exam: 'nid', marking: { nat: practice, msq: practice, mcq: practice } },
      urls,
    )
    expect(paper.sections[0]!.marking?.note).toMatch(/^Dexam practice marking/)
    expect(paper.notes?.[0]).toMatch(/^Practice timing/)
  })
})

function client(responses: Record<string, { data: unknown; error: unknown }>) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve(responses[name] ?? { data: null, error: { message: 'unexpected' } }),
  )
  const createSignedUrls = vi.fn(() =>
    Promise.resolve({
      data: [
        { path: 'ab/fig.png', signedUrl: 'https://local/sign/ab', error: null },
        { path: 'cd/opt.png', signedUrl: 'https://local/sign/cd', error: null },
        { path: 'ef/missing.png', signedUrl: '', error: 'Object not found' },
      ],
      error: null,
    }),
  )
  return {
    rpc,
    createSignedUrls,
    client: { rpc, storage: { from: () => ({ createSignedUrls }) } } as unknown as SupabaseClient,
  }
}

describe('attempt calls', () => {
  it('opens an attempt, signing every figure once', async () => {
    const mock = client({ open_assessment_attempt: { data: payload, error: null } })
    const opened = await openBankAttempt(mock.client, 'UCEED 2025', 'uceed-2025')
    expect(mock.rpc).toHaveBeenCalledWith('open_assessment_attempt', { p_paper_id: 'uceed-2025' })
    expect(mock.createSignedUrls).toHaveBeenCalledWith(
      ['ab/fig.png', 'cd/opt.png', 'ef/missing.png'],
      14400,
    )
    expect(opened).toMatchObject({ attemptId: id(9), status: 'open', deadline: null })
  })

  it('returns null when nothing is reviewed and reports other failures', async () => {
    expect(
      await openBankAttempt(
        client({ open_assessment_attempt: { data: null, error: { code: 'P0002' } } }).client,
        'x',
        'nid-bdes-2020',
      ),
    ).toBeNull()
    await expect(
      openBankAttempt(
        client({ open_assessment_attempt: { data: null, error: { code: '42501' } } }).client,
        'x',
        'uceed-2025',
      ),
    ).rejects.toBeInstanceOf(BankPaperError)
    await expect(
      openBankAttempt(
        client({ open_assessment_attempt: { data: { questions: 'no' }, error: null } }).client,
        'x',
        'uceed-2025',
      ),
    ).rejects.toThrow('This paper could not be read.')
  })

  it('begins with the server deadline and submits saved responses', async () => {
    const mock = client({
      begin_assessment_attempt: { data: { deadline: '2026-10-28T10:00:00+00:00' }, error: null },
      submit_assessment_attempt: { data: { score: 4 }, error: null },
    })
    expect(await beginBankAttempt(mock.client, id(9))).toBe(Date.parse('2026-10-28T10:00:00Z'))
    await submitBankAttempt(mock.client, id(9), { [id(1)]: '12' }, 'time')
    expect(mock.rpc).toHaveBeenLastCalledWith('submit_assessment_attempt', {
      p_attempt_id: id(9),
      p_responses: { [id(1)]: '12' },
      p_reason: 'time',
    })
    await expect(
      submitBankAttempt(
        client({ submit_assessment_attempt: { data: null, error: { code: '42501' } } }).client,
        id(9),
        {},
        'candidate',
      ),
    ).rejects.toThrow(/could not be submitted/)
  })

  it('reads a released result with signed figures and the catalogue title', async () => {
    const mock = client({
      get_assessment_attempt_result: {
        data: {
          attemptId: id(9),
          paperId: 'uceed-2025',
          startedAt: null,
          submittedAt: '2026-10-28T10:00:00+00:00',
          submitReason: 'candidate',
          late: false,
          durationMinutes: 60,
          score: 3,
          maxScore: 7,
          marking,
          questions: [
            {
              ...payload.questions[1],
              response: 'A',
              outcome: 'correct',
              marks: 3,
              key: { kind: 'choice', correct: ['A'] },
              explanation: null,
              topic: 'spatial-reasoning',
              topicName: 'Spatial Reasoning',
            },
          ],
        },
        error: null,
      },
    })
    const result = await fetchAttemptResult(mock.client, id(9), () => 'UCEED 2025')
    expect(result).toMatchObject({ title: 'UCEED 2025', score: 3, maxScore: 7, preview: false })
    expect(result.questions[0]!.figures[0]!.src).toBe('https://local/sign/ab')
  })

  it('lists attempts and paper readiness', async () => {
    const mock = client({
      list_assessment_attempts: {
        data: [
          {
            attempt_id: id(9),
            paper_id: 'uceed-2025',
            status: 'submitted',
            started_at: null,
            submitted_at: '2026-10-28T10:00:00+00:00',
            score: '5.29',
            max_score: 11,
            question_count: 3,
          },
        ],
        error: null,
      },
      list_assessment_student_papers: {
        data: [{ paper_id: 'uceed-2025', ready_count: 21, objective_count: 56 }],
        error: null,
      },
    })
    expect(await fetchMyAttempts(mock.client)).toEqual([
      expect.objectContaining({ attemptId: id(9), score: 5.29, maxScore: 11 }),
    ])
    expect((await fetchPaperReadiness(mock.client)).get('uceed-2025')).toEqual({
      ready: 21,
      objective: 56,
    })
  })

  it('links catalogue papers to bank papers, leaving unconfirmed NIFT booklets unlinked', () => {
    expect(bankPaperId(findPaper('uceed-2025')!)).toBe('uceed-2025')
    expect(bankPaperId(findPaper('nift-bdes-2014')!)).toBe('nift-2014-bdes-written')
    expect(bankPaperId(findPaper('nift-bdes-2013')!)).toBeNull()
  })
})
