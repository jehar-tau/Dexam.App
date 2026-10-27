import {
  currentCycleYear,
  exams,
  examsForLevel,
  findPaper,
  formatMinutes,
  freePaperId,
  latestYear,
  paperLabel,
  papers,
  papersForExam,
  previewProgress,
} from './paperCatalog'

describe('paperCatalog', () => {
  it('gives every paper a unique id and a known exam', () => {
    const ids = papers.map((paper) => paper.id)
    expect(new Set(ids).size).toBe(ids.length)
    const examKeys = new Set(exams.map((exam) => exam.key))
    for (const paper of papers) expect(examKeys.has(paper.exam)).toBe(true)
  })

  it('splits exams by programme level for B.Des and M.Des students', () => {
    expect(examsForLevel('bdes').map((exam) => exam.key)).toEqual([
      'uceed',
      'nid-bdes',
      'nift-bdes',
    ])
    expect(examsForLevel('mdes').map((exam) => exam.key)).toEqual(['ceed', 'nid-mdes', 'nift-mdes'])
  })

  it('lists papers newest first within an exam', () => {
    const uceedYears = papersForExam('uceed').map((paper) => paper.year)
    expect(uceedYears[0]).toBe(currentCycleYear)
    expect(uceedYears).toEqual([...uceedYears].sort((a, b) => (b ?? 0) - (a ?? 0)))
    expect(uceedYears).toHaveLength(12)
  })

  it('makes exactly one free paper per exam: its first listed paper', () => {
    for (const exam of exams) {
      const free = freePaperId(exam.key)
      expect(free).toBe(papersForExam(exam.key)[0]?.id)
    }
  })

  it('ignores undated sample papers when finding the latest year', () => {
    expect(papersForExam('nift-bdes')[0]?.sample).toBe(true)
    expect(latestYear('nift-bdes')).toBe(2014)
  })

  it('labels papers with year, variant and sample markers', () => {
    expect(paperLabel(findPaper('ceed-2016-paper1')!)).toBe('CEED 2016 Paper 1')
    expect(paperLabel(findPaper('nid-bdes-sample-2025')!)).toBe('NID DAT 2025 Sample')
    expect(paperLabel(findPaper('nift-bdes-sample')!)).toBe('NIFT Sample')
  })

  it('only keeps preview progress for papers that exist, within their marks', () => {
    for (const [id, progress] of Object.entries(previewProgress)) {
      const paper = findPaper(id)
      expect(paper).toBeDefined()
      expect(progress.bestScore).toBeLessThanOrEqual(paper!.maxMarks)
      expect(progress.attempts).toBeGreaterThan(0)
    }
  })

  it('formats practice time compactly', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(311)).toBe('5h 11m')
  })
})
