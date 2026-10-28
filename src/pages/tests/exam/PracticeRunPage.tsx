import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { getSupabaseClient } from '../../../features/auth/supabaseClient'
import { getBankAttempt } from '../../../features/testSeries/bankPaper'
import { ExamWindow, StatusPage } from './ExamWindowPage'

const labels = { practice: 'Practice', mock: 'Mock', live: 'Live mock' }

/**
 * Runs a server attempt by id in the exam window: F047 practice sets (no exam-centre login),
 * F040 mocks and F050 live mocks (the full exam-centre flow), resuming where it was left.
 */
export function PracticeRunPage({
  variant = 'practice',
}: {
  variant?: 'practice' | 'mock' | 'live'
}) {
  const { attemptId = '', key = '' } = useParams()
  const home =
    variant === 'live'
      ? `/tests/live/${encodeURIComponent(key)}`
      : variant === 'mock'
        ? '/tests/mocks'
        : '/tests/practice'
  const noun = variant === 'practice' ? 'practice set' : labels[variant].toLowerCase()
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
      <StatusPage label={labels[variant]} title={`This ${noun} could not be opened`} backTo={home}>
        <p>
          {query.error?.message ?? 'The question bank is not connected.'} It may have been replaced
          or already submitted.
        </p>
      </StatusPage>
    )
  }
  if (!query.data) {
    return <StatusPage label={labels[variant]} title={`Loading your ${noun}…`} backTo={home} />
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
      submittedTo={variant === 'live' ? home : undefined}
    />
  )
}
