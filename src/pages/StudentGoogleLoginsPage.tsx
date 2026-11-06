import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  approveStudentGoogleLogin,
  getStudentGoogleLogins,
  revokeStudentGoogleLogin,
  type StudentGoogleLogin,
} from '../features/enrolment/studentGoogleLogins'
import styles from './StudentGoogleLoginsPage.module.css'

const previewRows: StudentGoogleLogin[] = [
  {
    personId: '00000000-0000-4000-8000-0000000000d1',
    memberId: 'DXM-2K3M9Q2RW5TY',
    displayName: 'Aarohi Deshmukh',
    email: 'aarohi.d@gmail.com',
    state: 'approved',
    linked: true,
    revision: 1,
    revokedAt: null,
    admissionPaid: true,
  },
  {
    personId: '00000000-0000-4000-8000-0000000000d2',
    memberId: 'DXM-3K3M9Q2RW5TY',
    displayName: 'Kabir Mehta',
    email: null,
    state: 'none',
    linked: false,
    revision: null,
    revokedAt: null,
    admissionPaid: true,
  },
  {
    personId: '00000000-0000-4000-8000-0000000000d3',
    memberId: 'DXM-4K3M9Q2RW5TY',
    displayName: 'Meera Iyer',
    email: 'meera.iyer@gmail.com',
    state: 'revoked',
    linked: false,
    revision: 2,
    revokedAt: '2026-11-01T10:00:00+05:30',
    admissionPaid: true,
  },
]

function status(row: StudentGoogleLogin): [string, 'success' | 'accent' | 'warning' | 'neutral'] {
  if (row.state === 'approved')
    return row.linked
      ? ['Signs in with Google', 'success']
      : row.admissionPaid
        ? ['Waiting for first sign-in', 'accent']
        : ['Admission fee pending', 'warning']
  if (row.state === 'revoked') return ['Revoked', 'warning']
  return ['Not on the list', 'neutral']
}

function RowActions({
  row,
  admin,
  preview,
  onDone,
}: {
  row: StudentGoogleLogin
  admin: boolean
  preview: boolean
  onDone: (message: string) => Promise<void>
}) {
  const [email, setEmail] = useState(row.email ?? '')
  const [reason, setReason] = useState('')
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const revoking = row.state === 'approved'
  if (row.state !== 'none' && !admin)
    return (
      <p className={styles.meta}>
        {row.state === 'revoked'
          ? 'Revoked by an admin. Only an admin can restore it.'
          : 'Only an admin can revoke Google sign-in.'}
      </p>
    )

  function change(update: () => void) {
    update()
    setRequestKey(crypto.randomUUID())
    setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (preview) {
      setError('Preview only: nothing is saved.')
      return
    }
    setBusy(true)
    setError('')
    try {
      if (revoking)
        await revokeStudentGoogleLogin({
          requestKey,
          personId: row.personId,
          expectedRevision: row.revision ?? 0,
          reason,
        })
      else await approveStudentGoogleLogin({ requestKey, personId: row.personId, email, reason })
      await onDone(
        revoking
          ? `${row.displayName} can no longer sign in with Google.`
          : `${row.displayName} can now sign in with ${email.trim().toLowerCase()}.`,
      )
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The change could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  const label = revoking
    ? 'Revoke Google sign-in'
    : row.state === 'revoked'
      ? 'Restore Google sign-in'
      : 'Add to Google list'
  return (
    <form className={styles.actions} onSubmit={(event) => void submit(event)}>
      {error ? (
        <Callout tone="warning" icon="warning">
          <p role="alert">{error}</p>
        </Callout>
      ) : null}
      {!revoking ? (
        <Input
          label="Google email"
          aria-label={`Google email for ${row.displayName}`}
          type="email"
          autoComplete="off"
          value={email}
          disabled={busy}
          maxLength={254}
          onChange={(event) => change(() => setEmail(event.target.value))}
        />
      ) : null}
      <Input
        label="Reason"
        aria-label={`Reason for ${row.displayName}`}
        hint={
          revoking
            ? 'For example: fees refunded, left the course.'
            : 'For example: paid full course fee.'
        }
        value={reason}
        disabled={busy}
        maxLength={500}
        onChange={(event) => change(() => setReason(event.target.value))}
      />
      <Button
        type="submit"
        variant={revoking ? 'secondary' : 'primary'}
        disabled={busy || reason.trim().length < 3 || (!revoking && !email.includes('@'))}
      >
        {busy ? 'Saving…' : label}
      </Button>
    </form>
  )
}

export function StudentGoogleLoginsPage({ portal }: { portal: 'staff' | 'admin' }) {
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const preview =
    portal === 'staff' &&
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' &&
    searchParams.get('preview') === '1'
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['student-google-logins', session?.user.id, search],
    queryFn: () => getStudentGoogleLogins(search),
    enabled: !preview,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const rows = preview
    ? previewRows.filter((row) =>
        `${row.displayName} ${row.memberId ?? ''} ${row.email ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      )
    : query.data
  const admin = portal === 'admin'

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <p className="eyebrow">Dexam App · Google sign-in</p>
        <h1>Google sign-in list.</h1>
        <p>
          Only full-course students on this list can enter the Dexam App with Google, once their
          admission fee is recorded in Payments. Add the Google email the student will use.{' '}
          {admin
            ? 'As an admin you can also revoke or restore a student’s Google sign-in.'
            : 'Admins revoke access.'}{' '}
          This list is separate from Dexam Mock Test sign-up.
        </p>
      </header>
      <form
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(draft.trim())
          setMessage('')
        }}
      >
        <Input
          label="Find a current student"
          hint="Name, Member ID or Google email"
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {!preview && query.isPending ? (
        <p role="status">Loading students…</p>
      ) : !preview && query.isError ? (
        <Card>
          <p role="alert">{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </Card>
      ) : !rows?.length ? (
        <EmptyState
          title="No current students found"
          description="Only students with an active membership appear here."
        />
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => {
            const [label, tone] = status(row)
            return (
              <li key={`${row.personId}-${row.revision ?? 0}`}>
                <Card>
                  <div className={styles.row}>
                    <div className={styles.identity}>
                      <strong>{row.displayName}</strong>
                      <span className={styles.meta}>
                        {row.memberId ?? 'No Member ID'}
                        {row.email ? ` · ${row.email}` : ''}
                      </span>
                    </div>
                    <Badge tone={tone}>{label}</Badge>
                  </div>
                  <RowActions
                    row={row}
                    admin={admin}
                    preview={preview}
                    onDone={async (text) => {
                      setMessage(text)
                      await query.refetch()
                    }}
                  />
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
