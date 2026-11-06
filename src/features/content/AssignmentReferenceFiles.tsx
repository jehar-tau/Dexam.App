import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { z } from 'zod'
import { Button, Callout } from '../../components'
import { useAuth } from '../auth/AuthContext'
import { getSupabaseClient } from '../auth/supabaseClient'
import { captureAccountOperation } from '../auth/accountOperation'
import { downloadProtectedObject, saveBlob } from '../files/protectedFiles'

const filesSchema = z
  .array(
    z.object({
      id: z.string().uuid(),
      file_name: z.string(),
      display_name: z.string(),
      object_path: z.string(),
    }),
  )
  .max(5)
export function AssignmentReferenceFiles({
  versionId,
  instanceId,
  preview = false,
}: {
  versionId?: string
  instanceId?: string
  preview?: boolean
}) {
  if (preview)
    return (
      <section aria-label="Assignment references">
        <h3>Assignment reference files</h3>
        <p>Named reference downloads appear here when attached to the released assignment.</p>
      </section>
    )
  return <LiveAssignmentReferenceFiles versionId={versionId} instanceId={instanceId} />
}
function LiveAssignmentReferenceFiles({
  versionId,
  instanceId,
}: {
  versionId?: string
  instanceId?: string
}) {
  const { session } = useAuth(),
    [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['assignment-reference-files', session?.user.id, versionId, instanceId],
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    queryFn: async () => {
      const client = getSupabaseClient()
      if (!client) throw new Error('Unavailable')
      let id = versionId
      if (!id && instanceId) {
        const result = await client.rpc('assignment_reference_version_for_instance', {
          p_instance_id: instanceId,
        })
        if (result.error || typeof result.data !== 'string') throw new Error('Unavailable')
        id = result.data
      }
      if (!id) throw new Error('Unavailable')
      const result = await client.rpc('list_assignment_reference_files', { p_version_id: id }),
        parsed = filesSchema.safeParse(result.data)
      if (result.error || !parsed.success) throw new Error('Unavailable')
      return parsed.data
    },
  })
  return (
    <section aria-label="Assignment references">
      <h3>Assignment reference files</h3>
      {query.isError ? (
        <Callout tone="warning">
          Reference files could not be verified.{' '}
          <Button onClick={() => void query.refetch()}>Retry references</Button>
        </Callout>
      ) : null}
      {query.data?.length === 0 ? <p>No reference files attached.</p> : null}
      {query.data?.map((file) => (
        <p key={file.id}>
          {file.display_name} <small>({file.file_name})</small>{' '}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void (async () => {
                setError('')
                const client = getSupabaseClient()
                if (!client) return
                const operation = await captureAccountOperation(client)
                try {
                  operation.assertCurrent()
                  // Read with the pinned session; Storage re-checks access for this request.
                  const blob = await downloadProtectedObject(
                    operation.client,
                    'assignment-materials',
                    file.object_path,
                  )
                  operation.assertCurrent()
                  saveBlob(blob, file.file_name)
                } catch {
                  setError('The reference file could not be downloaded. Check current access.')
                } finally {
                  operation.dispose()
                }
              })()
            }
          >
            Download {file.display_name}
          </Button>
        </p>
      ))}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
