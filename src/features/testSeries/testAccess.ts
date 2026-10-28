import type { SupabaseClient } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '../auth/AuthContext'
import { getSupabaseClient } from '../auth/supabaseClient'
import { bankPaperId, type CatalogPaper, type ExamKey } from './paperCatalog'

/**
 * F039/F041: who may use the test series and which papers they can open. Coaching students open
 * everything; public candidates (Google sign-in) get one free paper of their choice per exam of
 * their level, plus any paper they are entitled to later.
 */

export type Level = 'bdes' | 'mdes'

export const levelExams: Record<Level, ExamKey[]> = {
  bdes: ['uceed', 'nid-bdes', 'nift-bdes'],
  mdes: ['ceed', 'nid-mdes', 'nift-mdes'],
}

const accessSchema = z.object({
  kind: z.enum(['student', 'candidate']).nullable(),
  displayName: z.string().nullable().optional(),
  profile: z
    .object({
      level: z.enum(['bdes', 'mdes']),
      exams: z.array(z.string()),
      examYear: z.number().int().nullable(),
    })
    .nullable()
    .optional(),
  freeSlots: z
    .array(z.object({ slot: z.string(), paperId: z.string().nullable() }))
    .optional()
    .default([]),
  entitledPapers: z.array(z.string()).optional().default([]),
})

export type TestAccess = z.infer<typeof accessSchema>

export async function fetchTestAccess(client: SupabaseClient): Promise<TestAccess> {
  const result = await client.rpc('get_test_access')
  if (result.error) throw new Error('Your test-series access could not be checked.')
  return accessSchema.parse(result.data as unknown)
}

export function useTestAccess(enabled = true) {
  const { session } = useAuth()
  const client = getSupabaseClient()
  return useQuery({
    queryKey: ['test-access', session?.user.id],
    queryFn: () => fetchTestAccess(client!),
    enabled: enabled && Boolean(client && session),
    staleTime: 30_000,
    retry: false,
  })
}

/** First Google sign-in: creates the candidate. Refused for logins that did not come from Google. */
export async function provisionCandidate(client: SupabaseClient) {
  const result = await client.rpc('provision_google_candidate')
  if (result.error) {
    throw new Error(
      result.error.code === '42501'
        ? 'This login cannot create a test-series account. Use "Continue with Google", or sign in with your Dexam Member ID if you are a coaching student.'
        : 'Your account could not be set up. Please try again.',
    )
  }
}

export async function saveCandidateProfile(
  client: SupabaseClient,
  profile: { level: Level; exams: ExamKey[]; examYear: number | null },
) {
  const result = await client.rpc('save_candidate_profile', {
    p_level: profile.level,
    p_exams: profile.exams,
    p_exam_year: profile.examYear,
  })
  if (result.error) throw new Error('Your choices could not be saved. Please try again.')
}

export async function signInWithGoogle(client: SupabaseClient, returnTo: string) {
  const redirectTo = new URL('/tests/welcome', window.location.origin)
  redirectTo.searchParams.set('returnTo', returnTo)
  const result = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: redirectTo.toString() },
  })
  if (result.error) throw new Error('Google sign-in is not available right now. Please try again.')
}

/** Only test-series pages may be a return destination. */
export function safeTestsReturnTo(value: string | null) {
  return value && (value === '/tests' || /^\/tests[/?]/.test(value)) && !value.startsWith('//')
    ? value
    : '/tests'
}

export type PaperAccess = 'open' | 'free-choice' | 'free-claimed' | 'locked'

/** How a candidate (or student) can reach a catalogue paper. */
export function paperAccess(paper: CatalogPaper, access: TestAccess | undefined): PaperAccess {
  if (!access || access.kind === 'student') return 'open'
  const bankId = bankPaperId(paper)
  if (bankId && access.entitledPapers.includes(bankId)) {
    return access.freeSlots.some((slot) => slot.paperId === bankId) ? 'free-claimed' : 'open'
  }
  const slot = access.freeSlots.find((entry) => entry.slot === paper.exam)
  return slot && slot.paperId === null && bankId ? 'free-choice' : 'locked'
}
