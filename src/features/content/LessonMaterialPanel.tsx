import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Callout, Input } from '../../components'
import { useAuth } from '../auth/AuthContext'
import { formatFileSize } from '../student/prepareSubmissionFile'
import {
  getLessonDownload,
  listLessonFiles,
  removeLessonFile,
  uploadLessonFile,
} from './lessonFiles'
import styles from './LessonMaterialPanel.module.css'

export function LessonFiles({
  lessonId,
  editable = false,
  preview = false,
}: {
  lessonId: string
  editable?: boolean
  preview?: boolean
}) {
  return preview ? null : <LiveLessonFiles lessonId={lessonId} editable={editable} />
}

function LiveLessonFiles({ lessonId, editable }: { lessonId: string; editable: boolean }) {
  const { session } = useAuth(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  const query = useQuery({
    queryKey: ['lesson-files', session?.user.id, lessonId],
    queryFn: () => listLessonFiles(lessonId),
    enabled: Boolean(session),
    retry: false,
    gcTime: 0,
    staleTime: 0,
  })
  async function action(work: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await work()
    } catch {
      setError('The lesson file action could not be completed. Check your access and try again.')
    } finally {
      setBusy(false)
    }
  }
  async function download(id: string) {
    const url = await getLessonDownload(lessonId, id)
    const link = document.createElement('a')
    link.href = url
    link.rel = 'noreferrer'
    link.download = ''
    link.click()
  }
  return (
    <section aria-label="Lesson downloads" className={styles.panel}>
      {query.isError ? (
        <Callout tone="warning" icon="warning">
          Lesson files could not be verified.{' '}
          <Button variant="ghost" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </Callout>
      ) : null}
      {query.isPending && session ? <p role="status">Loading lesson files…</p> : null}
      {(query.data ?? []).map((file) => (
        <div key={file.id} className={styles.file}>
          <span className={styles.name}>
            {file.file_name} · {formatFileSize(file.byte_size)}
          </span>{' '}
          <Button
            size="sm"
            variant="secondary"
            aria-label={`Download ${file.file_name}`}
            disabled={busy}
            onClick={() => void action(() => download(file.id))}
          >
            Download
          </Button>
          {editable ? (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Remove ${file.file_name}`}
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await removeLessonFile(lessonId, file.id)
                  await query.refetch()
                })
              }
            >
              Remove
            </Button>
          ) : null}
        </div>
      ))}
      {editable ? (
        <Input
          type="file"
          label="Attach lesson file"
          hint="PDF, JPEG, PNG or WebP · up to 5 files, 10 MB each. Images are optimized; published files are pinned."
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={busy || query.isPending || query.isError || (query.data?.length ?? 0) >= 5}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file)
              void action(async () => {
                await uploadLessonFile(lessonId, file, query.data?.length ?? 0)
                await query.refetch()
              })
          }}
        />
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
