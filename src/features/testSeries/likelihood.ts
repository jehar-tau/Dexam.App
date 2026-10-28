/**
 * F045 Part A shortlisting likelihood, a Dexam estimate (interim formula v1, pending the owner's
 * Decision Gate on formula and wording).
 *
 * UCEED and CEED shortlist on Part A alone: the OPEN cut-off is δ = μ + σ/2 of all candidates'
 * Part A marks, 0.9δ for OBC-NCL/EWS and 0.5δ for SC/ST/PwD (UCEED 2026 §17.4, CEED 2026 §1.1).
 * IIT Bombay publishes μ and σ each year; the cut-offs below are computed from them. The
 * student's Part A score, scaled to the official maximum, is compared with the last four years:
 *
 * - High: at or above every year's cut-off.
 * - Medium: at or above at least one year's cut-off.
 * - Low: below every year's cut-off.
 *
 * Shortlisting only means Part B gets marked; it is not admission. NID and NIFT publish no
 * cut-offs, so they get no band yet.
 */

export const LIKELIHOOD_VERSION = 'v1 (2026-10)'

export type Category = 'open' | 'obc-ews' | 'sc-st-pwd'

export const categoryLabels: Record<Category, string> = {
  open: 'OPEN',
  'obc-ews': 'OBC-NCL / EWS',
  'sc-st-pwd': 'SC / ST / PwD',
}

/** Category factors as exact fractions, so cut-offs round half-up like the published ones. */
const categoryFactor: Record<Category, [number, number]> = {
  open: [1, 1],
  'obc-ews': [9, 10],
  'sc-st-pwd': [1, 2],
}

type Published = { year: number; mean: number; sd: number }

const published: Record<'uceed' | 'ceed', { partAMax: number; years: Published[] }> = {
  uceed: {
    partAMax: 200,
    years: [
      { year: 2026, mean: 70.86, sd: 25.77 },
      { year: 2025, mean: 61.5, sd: 25.69 },
      { year: 2024, mean: 43.91, sd: 23.03 },
      { year: 2023, mean: 57.63, sd: 24.52 },
    ],
  },
  ceed: {
    partAMax: 150,
    years: [
      { year: 2026, mean: 39.35, sd: 16.89 },
      { year: 2025, mean: 45.48, sd: 16.98 },
      { year: 2024, mean: 41.9, sd: 16.72 },
      { year: 2023, mean: 22.59, sd: 11.82 },
    ],
  },
}

const round2 = (value: number) => Math.round(value * 100) / 100

/** δ = μ + σ/2 in hundredths, then the category factor, each rounded half-up to 2 dp. */
function cutoffFor(year: Published, category: Category) {
  const delta = Math.round(Math.round(year.mean * 100) + Math.round(year.sd * 100) / 2)
  const [num, den] = categoryFactor[category]
  return Math.round((delta * num) / den) / 100
}

export type Likelihood = {
  band: 'High' | 'Medium' | 'Low'
  exam: 'uceed' | 'ceed'
  category: Category
  /** The score scaled to the official Part A maximum. */
  scaled: number
  partAMax: number
  cutoffs: { year: number; cutoff: number }[]
  cleared: number
}

/** The band for a Part A score, or null where no official cut-off exists. */
export function partALikelihood(
  exam: string,
  score: number,
  maxScore: number,
  category: Category,
): Likelihood | null {
  if (exam !== 'uceed' && exam !== 'ceed') return null
  if (!(maxScore > 0)) return null
  const source = published[exam]
  const scaled = round2((Math.max(score, 0) / maxScore) * source.partAMax)
  const cutoffs = source.years.map((year) => ({
    year: year.year,
    cutoff: cutoffFor(year, category),
  }))
  const cleared = cutoffs.filter((item) => scaled >= item.cutoff).length
  return {
    band: cleared === cutoffs.length ? 'High' : cleared > 0 ? 'Medium' : 'Low',
    exam,
    category,
    scaled,
    partAMax: source.partAMax,
    cutoffs,
    cleared,
  }
}

/** The exam behind a result: the server's field, else the paper id's prefix (`uceed-2024`). */
export const examOf = (exam: string | undefined, paperId: string) =>
  exam ?? paperId.split('-')[0] ?? ''

const CATEGORY_KEY = 'dexam.tests.category'

/** The category the student last chose on this device (OPEN by default). */
export function readCategory(): Category {
  try {
    const value = window.localStorage.getItem(CATEGORY_KEY)
    return value === 'obc-ews' || value === 'sc-st-pwd' ? value : 'open'
  } catch {
    return 'open'
  }
}

export function saveCategory(category: Category) {
  try {
    window.localStorage.setItem(CATEGORY_KEY, category)
  } catch {
    // The choice still applies for this visit.
  }
}
