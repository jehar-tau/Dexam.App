import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'

import { useAuth } from '../../../features/auth/AuthContext'
import { getSupabaseClient } from '../../../features/auth/supabaseClient'
import { getBankAttempt } from '../../../features/testSeries/bankPaper'
import { ExamWindow, StatusPage } from './ExamWindowPage'

/** F047: runs a server practice set in the exam window, resuming it by attempt id. */
export function PracticeRunPage() {
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
        label="Practice"
        title="This practice set could not be opened"
        backTo="/tests/practice"
      >
        <p>
          {query.error?.message ?? 'The question bank is not connected.'} It may have been replaced
          by a newer set on the same topic, or already submitted.
        </p>
      </StatusPage>
    )
  }
  if (!query.data) {
    return (
      <StatusPage label="Practice" title="Loading your practice set…" backTo="/tests/practice" />
    )
  }
  const opened = query.data
  return (
    <ExamWindow
      key={opened.attemptId}
      owner={owner}
      storeKey={`practice-${opened.attemptId}`}
      label={opened.paper.title}
      exitTo="/tests/practice"
      backTo="/tests/practice"
      paper={opened.paper}
      search=""
      server={{ client, opened }}
    />
  )
}
