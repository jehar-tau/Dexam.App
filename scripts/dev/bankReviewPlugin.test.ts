import { parseVerdict, safeMediaPath, sameOriginJson } from './bankReviewPlugin.ts'

describe('bank review dev server', () => {
  it('serves only image files inside the media root', () => {
    expect(safeMediaPath('/data/media', 'ceed-2024/blocks/ceed-2024-q1.png')).toBe(
      '/data/media/ceed-2024/blocks/ceed-2024-q1.png',
    )
    expect(safeMediaPath('/data/media', '../dexam.sqlite')).toBeNull()
    expect(safeMediaPath('/data/media', 'ceed-2024/../../secret.png')).toBeNull()
    expect(safeMediaPath('/data/media', '/etc/passwd.png')).toBeNull()
    expect(safeMediaPath('/data/media', 'notes.txt')).toBeNull()
  })

  it('accepts well-formed verdicts and rejects the rest', () => {
    const ok = parseVerdict({ id: 'ceed-2024-q8', verdict: 'ok', reasons: ['crop-cut-off'] })
    expect(typeof ok).toBe('object')
    expect(ok).toMatchObject({ id: 'ceed-2024-q8', verdict: { verdict: 'ok', reasons: [] } })
    expect(
      parseVerdict({
        id: 'ceed-2024-q8',
        verdict: 'fix',
        reasons: ['wrong-answer-key'],
        note: ' B ',
      }),
    ).toMatchObject({ verdict: { verdict: 'fix', reasons: ['wrong-answer-key'], note: 'B' } })
    expect(parseVerdict({ id: '../x', verdict: 'ok' })).toBe('Unknown question id.')
    expect(parseVerdict({ id: 'a-1', verdict: 'maybe' })).toBe('Verdict must be ok or fix.')
    expect(parseVerdict({ id: 'a-1', verdict: 'fix', reasons: ['drop table'] })).toBe(
      'Unknown reason.',
    )
    expect(parseVerdict({ id: 'a-1', verdict: 'fix', note: 'x'.repeat(2001) })).toBe(
      'The note is too long.',
    )
  })

  it('saves verdicts only from a same-origin JSON request', () => {
    const host = '127.0.0.1:5180'
    expect(sameOriginJson({ host, 'content-type': 'application/json' })).toBe(true)
    expect(
      sameOriginJson({ host, 'content-type': 'application/json', origin: 'http://127.0.0.1:5180' }),
    ).toBe(true)
    expect(
      sameOriginJson({ host, 'content-type': 'application/json', origin: 'https://evil.example' }),
    ).toBe(false)
    // A forged HTML form can only send form encodings or text/plain.
    expect(sameOriginJson({ host, 'content-type': 'text/plain' })).toBe(false)
    expect(sameOriginJson({ host, 'content-type': 'application/x-www-form-urlencoded' })).toBe(
      false,
    )
  })
})
