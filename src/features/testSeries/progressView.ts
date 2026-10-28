import type { Progress, ProgressAttempt } from './bankPaper'
import { bankPaperId, paperLabel, papers } from './paperCatalog'

/** Shared views of a student's progress (Analytics and Overview). */

const day = 24 * 60 * 60 * 1000
const fictionalDate = (daysAgo: number) =>
  new Date(Date.UTC(2026, 9, 27) - daysAgo * day).toISOString()

// Fictional preview progress. Real progress comes from get_assessment_progress().
export const previewProgress: Progress = {
  attempts: [
    {
      attemptId: '00000000-0000-4000-8000-00000000f001',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2022',
      exam: 'uceed',
      submittedAt: fictionalDate(42),
      score: 76,
      maxScore: 200,
      questionCount: 57,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f002',
      kind: 'paper',
      title: null,
      paperId: 'nid-bdes-2019',
      exam: 'nid',
      submittedAt: fictionalDate(35),
      score: 40,
      maxScore: 100,
      questionCount: 18,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f003',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2023',
      exam: 'uceed',
      submittedAt: fictionalDate(28),
      score: 90,
      maxScore: 200,
      questionCount: 57,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f004',
      kind: 'practice',
      title: 'Practice · Spatial Reasoning',
      paperId: 'practice-all-spatial-reasoning',
      exam: '',
      submittedAt: fictionalDate(21),
      score: 7,
      maxScore: 10,
      questionCount: 10,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f005',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2024',
      exam: 'uceed',
      submittedAt: fictionalDate(14),
      score: 104,
      maxScore: 200,
      questionCount: 57,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f006',
      kind: 'paper',
      title: null,
      paperId: 'nid-bdes-2020',
      exam: 'nid',
      submittedAt: fictionalDate(9),
      score: 55,
      maxScore: 100,
      questionCount: 19,
    },
    {
      attemptId: '00000000-0000-4000-8000-00000000f007',
      kind: 'paper',
      title: null,
      paperId: 'uceed-2025',
      exam: 'uceed',
      submittedAt: fictionalDate(2),
      score: 128,
      maxScore: 200,
      questionCount: 56,
    },
  ],
  topics: [
    { slug: 'analytical-reasoning', name: 'Analytical Reasoning', total: 24, scored: 9 },
    { slug: 'numerical-reasoning', name: 'Numerical Reasoning', total: 31, scored: 15 },
    { slug: 'design-awareness', name: 'Design Awareness', total: 12, scored: 7 },
    { slug: 'spatial-reasoning', name: 'Spatial Reasoning', total: 40, scored: 29 },
    { slug: 'language', name: 'Language', total: 9, scored: 8 },
  ],
}

export const percentOf = (attempt: ProgressAttempt) =>
  attempt.maxScore > 0 ? (attempt.score / attempt.maxScore) * 100 : 0

export function attemptName(attempt: ProgressAttempt) {
  if (attempt.kind === 'practice') return attempt.title ?? 'Practice set'
  if (attempt.kind === 'mock' || attempt.kind === 'live') return attempt.title ?? 'Mock'
  const paper = papers.find((item) => bankPaperId(item) === attempt.paperId)
  return paper ? paperLabel(paper) : attempt.paperId.toUpperCase()
}

export const formatMarks = (value: number) =>
  Number.isInteger(value) ? String(value) : value.toFixed(2)

const localDay = (time: number) => new Date(time).toLocaleDateString('en-CA')

/** Consecutive days with a submission, ending today (or yesterday, if today has none yet). */
export function dayStreak(submittedAt: string[], now: number): number {
  const days = new Set(submittedAt.map((value) => localDay(Date.parse(value))))
  let cursor = days.has(localDay(now)) ? now : now - day
  let streak = 0
  while (days.has(localDay(cursor))) {
    streak += 1
    cursor -= day
  }
  return streak
}
