import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { getSupabaseClient } from '../../../features/auth/supabaseClient'
import { getBankAttempt } from '../../../features/testSeries/bankPaper'
import { ExamWindow, StatusPage } from './ExamWindowPage'

/**
 * Runs a server attempt by id in the exam window: F047 practice sets (no exam-centre login) and
 * F040 mocks (the full exam-centre flow), resuming either where it was left.
 */
export function PracticeRunPage({ variant = 'practice' }: { variant?: 'practice' | 'mock' }) {
  const home = variant === 'mock' ? '/tests/mocks' : '/tests/practice'
  const noun = variant === 'mock' ? 'mock' : 'practice set'
  const { attemptId = '' } = useParams()
  const { session } = useAuth()
  const client = getSupabaseClient()
  const owner = session?.user.id ?? 'signed-out'
  const query = useQuery({
    queryKey: ['practice-attempt', owner, attemptId],
    queryFn: () => getBankAttempt(client!, attemptId),
    enabled: Boolean(client && session),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  })

  if (query.isError || !client) {
    return (
      <StatusPage
        label={variant === 'mock' ? 'Mock' : 'Practice'}
        title={`This ${noun} could not be opened`}
        backTo={home}
      >
        <p>
          {query.error?.message ?? 'The question bank is not connected.'} It may have been replaced
          or already submitted.
        </p>
      </StatusPage>
    )
  }
  if (!query.data) {
    return (
      <StatusPage
        label={variant === 'mock' ? 'Mock' : 'Practice'}
        title={`Loading your ${noun}…`}
        backTo={home}
      />
    )
  }
  const opened = query.data
  return (
    <ExamWindow
      key={opened.attemptId}
      owner={owner}
      storeKey={`${variant}-${opened.attemptId}`}
      label={opened.paper.title}
      exitTo={home}
      backTo={home}
      paper={opened.paper}
      search=""
      server={{ client, opened }}
    />
  )
}
