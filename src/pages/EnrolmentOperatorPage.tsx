import { type FormEvent, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

import { Avatar, Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import { type ActivationPack, issueActivationPack } from '../features/enrolment/issueActivationPack'
import {
  type ActivationQueueItem,
  listActivationQueue,
} from '../features/enrolment/listActivationQueue'
import styles from './EnrolmentOperatorPage.module.css'

const previewEnrollment: ActivationQueueItem = {
  enrollmentId: '94000000-0000-4000-8000-000000000001',
  displayName: 'Aarohi Deshmukh',
  memberId: 'DXM-2K3M9Q2RW5TY',
  offeringTitle: 'Design Entrance Foundation',
  cohortName: 'Studio Batch · Autumn 2026',
  sourceType: 'authorized_staff',
  requestedAt: '2026-10-04T10:00:00.000Z',
  approvedAt: '2026-10-05T10:00:00.000Z',
}

const previewPack: ActivationPack = {
  memberId: previewEnrollment.memberId,
  activationUrl:
    'http://127.0.0.1:5173/activate?memberId=DXM-2K3M9Q2RW5TY&token=fictional-preview-token-not-valid',
  backupCode: '7K3M9Q2RW5',
  expiresAt: '2026-10-09T15:30:00.000Z',
  reissued: false,
}

type ViewState = 'queue' | 'review' | 'issuing' | 'issued'

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

function formatDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}

function formatSource(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function EnrolmentOperatorPage() {
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [view, setView] = useState<ViewState>('queue')
  const [pack, setPack] = useState<ActivationPack | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState('')
  const [selectedEnrollment, setSelectedEnrollment] = useState<ActivationQueueItem | null>(null)
  const [searchDraft, setSearchDraft] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')

  const queueQuery = useQuery({
    queryKey: ['activation-queue', submittedSearch, previewEnabled],
    queryFn: async () => {
      if (!previewEnabled) return listActivationQueue(25, submittedSearch)

      const search = submittedSearch.trim().toLocaleLowerCase()
      if (
        search &&
        !previewEnrollment.displayName.toLocaleLowerCase().includes(search) &&
        !previewEnrollment.memberId.toLocaleLowerCase().includes(search)
      ) {
        return []
      }
      return [previewEnrollment]
    },
    retry: false,
  })

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmittedSearch(searchDraft.trim())
  }

  function clearSearch() {
    setSearchDraft('')
    setSubmittedSearch('')
  }

  function reviewEnrollment(enrollment: ActivationQueueItem) {
    setSelectedEnrollment(enrollment)
    setError('')
    setView('review')
  }

  function returnToQueue() {
    setError('')
    setPack(null)
    setSelectedEnrollment(null)
    setView('queue')
  }

  async function handleIssue() {
    if (!selectedEnrollment) return

    setError('')
    setView('issuing')
    try {
      const issuedPack = previewEnabled
        ? await new Promise<ActivationPack>((resolve) =>
            window.setTimeout(() => resolve(previewPack), 450),
          )
        : await issueActivationPack(selectedEnrollment.enrollmentId)
      setPack(issuedPack)
      setView('issued')
    } catch (issueError) {
      setError(issueError instanceof Error ? issueError.message : 'The activation pack failed.')
      setView('review')
    }
  }

  async function handleDone() {
    if (!previewEnabled) {
      await queryClient.invalidateQueries({ queryKey: ['activation-queue'] })
    }
    returnToQueue()
  }

  async function handleCopy(label: string, value: string) {
    try {
      await copyText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('Copy is unavailable. Select the value and copy it manually.')
    }
  }

  const queue = queueQuery.data ?? []

  return (
    <section className={styles.workspace} aria-labelledby="operator-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Enrolment desk · {previewEnabled ? 'Local preview' : 'Live workspace'}
          </p>
          <h1 id="operator-title">Activation queue</h1>
          <p className={styles.lede}>
            Review approved enrolments and hand account activation directly to the student.
          </p>
        </div>
        <div className={styles.operator} aria-label="Current operator">
          <span>Enrolment Operator</span>
          <strong>
            {previewEnabled ? 'Fictional staff account' : 'Verified employee session'}
          </strong>
        </div>
      </header>

      {view === 'queue' ? (
        <div className={styles.queue}>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <Input
              label="Search queue"
              hint="Search by student name or Dexam Member ID."
              maxLength={80}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Aarohi or DXM-…"
              type="search"
              value={searchDraft}
            />
            <div className={styles.searchActions}>
              {submittedSearch ? (
                <Button type="button" variant="secondary" onClick={clearSearch}>
                  Clear
                </Button>
              ) : null}
              <Button type="submit">Search</Button>
            </div>
          </form>

          <div className={styles.queueHeader}>
            <div>
              <h2>Ready for activation</h2>
              <p>
                {queueQuery.isPending
                  ? 'Loading approved enrolments…'
                  : `${queue.length} approved enrolment${queue.length === 1 ? '' : 's'}`}
              </p>
            </div>
            <Badge pill tone="success">
              Approved
            </Badge>
          </div>

          {queueQuery.isPending ? (
            <p className={styles.queueStatus} role="status">
              Loading the activation queue…
            </p>
          ) : null}

          {queueQuery.isError ? (
            <Callout tone="warning" icon="warning">
              <strong>The activation queue could not be loaded.</strong>
              <span>Check your connection and access, then try again.</span>
              <Button size="sm" variant="secondary" onClick={() => void queueQuery.refetch()}>
                Try again
              </Button>
            </Callout>
          ) : null}

          {queueQuery.isSuccess && queue.length === 0 ? (
            <EmptyState
              title={submittedSearch ? 'No matching enrolments' : 'The queue is clear'}
              description={
                submittedSearch
                  ? 'Try the student’s full display name or Dexam Member ID.'
                  : 'Newly approved enrolments will appear here automatically.'
              }
              action={
                submittedSearch ? (
                  <Button variant="secondary" onClick={clearSearch}>
                    Clear search
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => void queueQuery.refetch()}>
                    Refresh queue
                  </Button>
                )
              }
            />
          ) : null}

          {queueQuery.isSuccess && queue.length > 0 ? (
            <div className={styles.queueList}>
              {queue.map((enrollment) => (
                <Card className={styles.enrollmentCard} key={enrollment.enrollmentId}>
                  <Avatar name={enrollment.displayName} size="lg" />
                  <div className={styles.student}>
                    <h3>{enrollment.displayName}</h3>
                    <p>{enrollment.memberId}</p>
                  </div>
                  <dl className={styles.summary}>
                    <div>
                      <dt>Offering</dt>
                      <dd>{enrollment.offeringTitle}</dd>
                    </div>
                    <div>
                      <dt>Cohort</dt>
                      <dd>{enrollment.cohortName ?? 'Independent enrolment'}</dd>
                    </div>
                    <div>
                      <dt>Approved</dt>
                      <dd>{formatDateTime(enrollment.approvedAt)}</dd>
                    </div>
                  </dl>
                  <Button onClick={() => reviewEnrollment(enrollment)}>Review enrolment</Button>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {(view === 'review' || view === 'issuing') && selectedEnrollment ? (
        <div className={styles.reviewLayout}>
          <Button variant="link" onClick={returnToQueue}>
            ← Back to queue
          </Button>
          <Card className={styles.reviewCard}>
            <div className={styles.reviewHeading}>
              <Badge tone="accent">Final review</Badge>
              <h2>Issue activation pack?</h2>
              <p>Confirm the enrolment details before generating one-time credentials.</p>
            </div>
            <dl className={styles.details}>
              <div>
                <dt>Student</dt>
                <dd>{selectedEnrollment.displayName}</dd>
              </div>
              <div>
                <dt>Member ID</dt>
                <dd className={styles.mono}>{selectedEnrollment.memberId}</dd>
              </div>
              <div>
                <dt>Offering</dt>
                <dd>{selectedEnrollment.offeringTitle}</dd>
              </div>
              <div>
                <dt>Cohort</dt>
                <dd>{selectedEnrollment.cohortName ?? 'Independent enrolment'}</dd>
              </div>
              <div>
                <dt>Request source</dt>
                <dd>{formatSource(selectedEnrollment.sourceType)}</dd>
              </div>
              <div>
                <dt>Expires</dt>
                <dd>48 hours after issue</dd>
              </div>
            </dl>
            <div className={styles.securityNote}>
              <Callout tone="warning" icon="warning">
                <strong>The student creates their own password.</strong>
                <span>Never ask them to share it with staff.</span>
              </Callout>
            </div>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <div className={styles.actions}>
              <Button variant="secondary" onClick={returnToQueue}>
                Cancel
              </Button>
              <Button disabled={view === 'issuing'} onClick={() => void handleIssue()}>
                {view === 'issuing' ? 'Issuing securely…' : 'Issue activation pack'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      {view === 'issued' && pack ? (
        <Card className={styles.resultLayout}>
          <div className={styles.successMark} aria-hidden="true">
            ✓
          </div>
          <div className={styles.resultIntro}>
            <p className="eyebrow">Activation pack ready</p>
            <h2>Hand this directly to the student.</h2>
            <p>
              These one-time credentials are shown for this handoff. Reissuing the pack will
              invalidate them.
            </p>
          </div>
          <div className={styles.credentials}>
            <Credential
              label="Member ID"
              value={pack.memberId}
              copied={copied}
              onCopy={handleCopy}
            />
            <Credential
              label="Backup code"
              value={pack.backupCode}
              copied={copied}
              onCopy={handleCopy}
              prominent
            />
            <Credential
              label="Activation link"
              value={pack.activationUrl}
              copied={copied}
              onCopy={handleCopy}
              wrap
            />
          </div>
          <div className={styles.expiry}>
            <span>Expires</span>
            <strong>{formatDateTime(pack.expiresAt)}</strong>
          </div>
          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          <Button className={styles.doneAction} onClick={() => void handleDone()}>
            Done
          </Button>
        </Card>
      ) : null}

      {copied ? (
        <p className={styles.toast} role="status">
          {copied} copied
        </p>
      ) : null}
    </section>
  )
}

type CredentialProps = {
  label: string
  value: string
  copied: string
  onCopy: (label: string, value: string) => Promise<void>
  prominent?: boolean
  wrap?: boolean
}

function Credential({
  label,
  value,
  copied,
  onCopy,
  prominent = false,
  wrap = false,
}: CredentialProps) {
  return (
    <div className={`${styles.credential} ${prominent ? styles.prominent : ''}`}>
      <span>{label}</span>
      <code className={wrap ? styles.wrap : ''}>{value}</code>
      <Button size="sm" variant="secondary" onClick={() => void onCopy(label, value)}>
        {copied === label ? 'Copied' : 'Copy'}
      </Button>
    </div>
  )
}
