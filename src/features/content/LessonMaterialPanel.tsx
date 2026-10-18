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
import { setContentFileLabel, validateMaterialFile } from './contentWorkspace'
import { watchAccountChanges } from '../auth/accountOperation'
import { getSupabaseClient } from '../auth/supabaseClient'

function AttachmentName({
  name,
  save,
  disabled,
}: {
  name: string
  save: (name: string) => Promise<void>
  disabled: boolean
}) {
  const [label, setLabel] = useState(name)
  return (
    <div>
      <Input
        label={`Attachment name for ${name}`}
        value={label}
        maxLength={180}
        disabled={disabled}
        onChange={(e) => setLabel(e.target.value)}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={disabled || !label.trim() || label.trim() === name}
        onClick={() => void save(label)}
      >
        Save attachment name
      </Button>
    </div>
  )
}

export function LessonFiles({
  lessonId,
  editable = false,
  preview = false,
}: {
  lessonId: string
  editable?: boolean
  preview?: boolean
}) {
  return preview ? (
    <PreviewLessonFiles editable={editable} />
  ) : (
    <LiveLessonFiles lessonId={lessonId} editable={editable} />
  )
}

function PreviewLessonFiles({ editable }: { editable: boolean }) {
  const [files, setFiles] = useState<{ id: string; name: string; label: string }[]>([])
  const [error, setError] = useState('')
  return (
    <section aria-label="Lesson downloads" className={styles.panel}>
      <p>Topic/lesson attachments · PDF, JPEG, PNG or WebP · up to 5 files, 10 MB each.</p>
      {files.map((file) => (
        <div key={file.id} className={styles.file}>
          <span>
            {file.label} · {file.name}
          </span>
          {editable ? (
            <>
              <AttachmentName
                name={file.label}
                disabled={false}
                save={(label) => {
                  setFiles((items) =>
                    items.map((item) => (item.id === file.id ? { ...item, label } : item)),
                  )
                  return Promise.resolve()
                }}
              />
              <Button
                variant="ghost"
                onClick={() => setFiles((items) => items.filter((item) => item.id !== file.id))}
              >
                Remove {file.label}
              </Button>
            </>
          ) : null}
        </div>
      ))}
      {editable ? (
        <Input
          label="Attach lesson files"
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? [])
            event.target.value = ''
            const issue = selected
              .map((file, index) => validateMaterialFile(file, files.length + index))
              .find(Boolean)
            setError(issue ?? '')
            if (!issue)
              setFiles((items) => [
                ...items,
                ...selected.map((file) => ({
                  id: crypto.randomUUID(),
                  name: file.name,
                  label: file.name,
                })),
              ])
          }}
        />
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
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
            {file.display_name ?? file.file_name} · {file.file_name} ·{' '}
            {formatFileSize(file.byte_size)}
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
            <AttachmentName
              name={file.display_name ?? file.file_name}
              disabled={busy}
              save={(label) =>
                action(async () => {
                  await setContentFileLabel('lesson', lessonId, file.id, label)
                  await query.refetch()
                })
              }
            />
          ) : null}
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
          label="Attach lesson files"
          multiple
          hint="PDF, JPEG, PNG or WebP · up to 5 files, 10 MB each. Images are optimized; published files are pinned."
          accept="application/pdf,image/jpeg,image/png,image/webp"
          disabled={busy || query.isPending || query.isError || (query.data?.length ?? 0) >= 5}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (files.length)
              void action(async () => {
                const count = query.data?.length ?? 0
                const issue = files
                  .map((file, index) => validateMaterialFile(file, count + index))
                  .find(Boolean)
                if (issue) throw new Error(issue)
                const client = getSupabaseClient(),
                  guard = client ? watchAccountChanges(client) : null
                try {
                  for (const [index, file] of files.entries()) {
                    guard?.assertCurrent()
                    await uploadLessonFile(lessonId, file, count + index)
                  }
                } finally {
                  guard?.dispose()
                  await query.refetch()
                }
              })
          }}
        />
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  )
}
