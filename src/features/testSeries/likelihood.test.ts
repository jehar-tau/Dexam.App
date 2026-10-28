import { examOf, partALikelihood } from './likelihood'

describe('Part A shortlisting likelihood (F045 v1)', () => {
  it('reproduces the published UCEED and CEED cut-offs', () => {
    expect(partALikelihood('uceed', 0, 200, 'open')?.cutoffs).toEqual([
      { year: 2026, cutoff: 83.75 },
      { year: 2025, cutoff: 74.35 },
      { year: 2024, cutoff: 55.43 },
      { year: 2023, cutoff: 69.89 },
    ])
    expect(partALikelihood('uceed', 0, 200, 'obc-ews')?.cutoffs.map((c) => c.cutoff)).toEqual([
      75.38, 66.92, 49.89, 62.9,
    ])
    expect(partALikelihood('uceed', 0, 200, 'sc-st-pwd')?.cutoffs.map((c) => c.cutoff)).toEqual([
      41.88, 37.18, 27.72, 34.95,
    ])
    expect(partALikelihood('ceed', 0, 150, 'open')?.cutoffs.map((c) => c.cutoff)).toEqual([
      47.8, 53.97, 50.26, 28.5,
    ])
    expect(partALikelihood('ceed', 0, 150, 'obc-ews')?.cutoffs.map((c) => c.cutoff)).toEqual([
      43.02, 48.57, 45.23, 25.65,
    ])
  })

  it('bands a score against every recent year', () => {
    expect(partALikelihood('uceed', 84, 200, 'open')?.band).toBe('High')
    expect(partALikelihood('uceed', 83.74, 200, 'open')?.band).toBe('Medium')
    expect(partALikelihood('uceed', 55.43, 200, 'open')?.band).toBe('Medium')
    expect(partALikelihood('uceed', 55.42, 200, 'open')?.band).toBe('Low')
    expect(partALikelihood('uceed', 45, 200, 'sc-st-pwd')?.band).toBe('High')
    expect(partALikelihood('ceed', -10, 150, 'open')).toMatchObject({ band: 'Low', scaled: 0 })
  })

  it('scales a shortened paper to the official maximum', () => {
    expect(partALikelihood('uceed', 50, 100, 'open')).toMatchObject({ scaled: 100, band: 'High' })
    expect(partALikelihood('ceed', 20, 75, 'open')).toMatchObject({ scaled: 40, cleared: 1 })
  })

  it('has no band where no official cut-off exists', () => {
    expect(partALikelihood('nift', 80, 100, 'open')).toBeNull()
    expect(partALikelihood('nid', 80, 100, 'open')).toBeNull()
    expect(partALikelihood('uceed', 0, 0, 'open')).toBeNull()
    expect(examOf(undefined, 'ceed-2024')).toBe('ceed')
    expect(examOf('uceed', 'mock-uceed-2026')).toBe('uceed')
  })
})
