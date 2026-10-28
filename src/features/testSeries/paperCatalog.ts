// Paper catalogue for the test-series Papers page.
//
// Metadata only (exam, programme level, year, label). It contains no question
// content. Attempts and scores here are fictional preview fixtures until the
// question bank (F038) and scoring (results step) land.

/** Admission cycle whose papers get the "New" badge. */
export const currentCycleYear = 2026

export type ProgrammeLevel = 'bdes' | 'mdes'

export type ExamKey = 'uceed' | 'ceed' | 'nid-bdes' | 'nid-mdes' | 'nift-bdes' | 'nift-mdes'

export type CatalogPaper = {
  id: string
  exam: ExamKey
  /** Absent for undated official sample papers. */
  year?: number
  /** Distinguishes two papers in one year, e.g. "Paper 1". */
  variant?: string
  /** Official sample paper rather than a previous-year paper. */
  sample?: boolean
  maxMarks: number
}

export type CatalogExam = {
  key: ExamKey
  name: string
  level: ProgrammeLevel
  description: string
}

export const exams: CatalogExam[] = [
  { key: 'uceed', name: 'UCEED', level: 'bdes', description: 'IIT Bombay · B.Des' },
  { key: 'nid-bdes', name: 'NID DAT', level: 'bdes', description: 'NID · B.Des Prelims' },
  { key: 'nift-bdes', name: 'NIFT', level: 'bdes', description: 'NIFT · B.Des GAT' },
  { key: 'ceed', name: 'CEED', level: 'mdes', description: 'IIT Bombay · M.Des' },
  { key: 'nid-mdes', name: 'NID DAT', level: 'mdes', description: 'NID · M.Des Prelims' },
  { key: 'nift-mdes', name: 'NIFT', level: 'mdes', description: 'NIFT · M.Des GAT' },
]

function years(exam: ExamKey, from: number, to: number, maxMarks: number): CatalogPaper[] {
  const result: CatalogPaper[] = []
  for (let year = to; year >= from; year -= 1) {
    result.push({ id: `${exam}-${year}`, exam, year, maxMarks })
  }
  return result
}

export const papers: CatalogPaper[] = [
  ...years('uceed', 2015, 2026, 200),
  ...years('ceed', 2017, 2026, 150),
  { id: 'ceed-2016-paper2', exam: 'ceed', year: 2016, variant: 'Paper 2', maxMarks: 100 },
  { id: 'ceed-2016-paper1', exam: 'ceed', year: 2016, variant: 'Paper 1', maxMarks: 100 },
  ...years('ceed', 2010, 2015, 100),
  { id: 'nid-bdes-sample-2025', exam: 'nid-bdes', year: 2025, sample: true, maxMarks: 100 },
  { id: 'nid-bdes-sample-2024', exam: 'nid-bdes', year: 2024, sample: true, maxMarks: 100 },
  ...years('nid-bdes', 2016, 2020, 100),
  { id: 'nid-mdes-sample-2025', exam: 'nid-mdes', year: 2025, sample: true, maxMarks: 100 },
  { id: 'nid-mdes-sample-2024', exam: 'nid-mdes', year: 2024, sample: true, maxMarks: 100 },
  { id: 'nift-bdes-sample', exam: 'nift-bdes', sample: true, maxMarks: 100 },
  ...years('nift-bdes', 2012, 2014, 100),
  { id: 'nift-mdes-sample', exam: 'nift-mdes', sample: true, maxMarks: 120 },
  ...years('nift-mdes', 2012, 2014, 120),
]

export type PaperProgress = {
  attempts: number
  bestScore: number
}

/** Fictional preview progress, keyed by paper id. */
export const previewProgress: Record<string, PaperProgress> = {
  'uceed-2025': { attempts: 2, bestScore: 128 },
  'uceed-2024': { attempts: 1, bestScore: 96 },
  'nid-bdes-2020': { attempts: 1, bestScore: 61 },
}

export type PreviewStats = {
  papersAttempted: number
  accuracyPercent: number
  questionsAttempted: number
  minutesPractised: number
}

export const previewStats: PreviewStats = {
  papersAttempted: 3,
  accuracyPercent: 58,
  questionsAttempted: 142,
  minutesPractised: 311,
}

export function examsForLevel(level: ProgrammeLevel): CatalogExam[] {
  return exams.filter((exam) => exam.level === level)
}

export function papersForExam(exam: ExamKey): CatalogPaper[] {
  return papers.filter((paper) => paper.exam === exam)
}

/** The newest paper per exam is the free onboarding paper (D-054 / F041). */
export function freePaperId(exam: ExamKey): string | undefined {
  return papersForExam(exam)[0]?.id
}

export function latestYear(exam: ExamKey): number | undefined {
  return papersForExam(exam).find((paper) => !paper.sample)?.year
}

export function paperLabel(paper: CatalogPaper): string {
  const exam = exams.find((item) => item.key === paper.exam)
  const parts = [exam?.name ?? paper.exam.toUpperCase()]
  if (paper.year) parts.push(String(paper.year))
  if (paper.variant) parts.push(paper.variant)
  if (paper.sample) parts.push('Sample')
  return parts.join(' ')
}

export function findPaper(id: string): CatalogPaper | undefined {
  return papers.find((paper) => paper.id === id)
}

// Catalogue ids that differ from the workstation bank's paper ids. The NIFT 2012 and 2013 written
// booklets are numbered, not named by programme, so they stay unlinked until the owner confirms
// which booklet is the B.Des or M.Des paper.
const bankPaperIds: Record<string, string | null> = {
  'nift-bdes-sample': 'nift-bdes-written-sample',
  'nift-mdes-sample': 'nift-mdes-written-sample',
  'nift-bdes-2014': 'nift-2014-bdes-written',
  'nift-mdes-2014': 'nift-2014-mdes-written',
  'nift-mdes-2012': 'nift-2012-mdes-written',
  'nift-bdes-2012': null,
  'nift-bdes-2013': null,
  'nift-mdes-2013': null,
}

/** The question-bank paper behind a catalogue paper, or null when none is linked yet. */
export function bankPaperId(paper: CatalogPaper): string | null {
  return paper.id in bankPaperIds ? (bankPaperIds[paper.id] ?? null) : paper.id
}

export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}
