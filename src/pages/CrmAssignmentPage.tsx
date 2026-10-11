import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import {
  assignCrmEnquiry,
  listCrmAssignmentQueue,
  listCrmEligibleOwners,
  type CrmAssignmentItem,
  type CrmAssignmentQueue,
  type CrmEligibleOwner,
} from '../features/crm/crmAssignment'
import styles from './CrmAssignmentPage.module.css'

const previewItems: CrmAssignmentItem[] = [
  {
    id: 'preview-unassigned-rohan',
    subjectName: 'Rohan Desai',
    contactRelationship: 'guardian',
    source: 'walk_in',
    interestSummary: 'NID and UCEED foundation preparation',
    targetIntake: '2027 entrance',
    stage: 'new',
    currentOwnerPersonId: null,
    currentOwnerName: null,
    ownerIsEligible: false,
    followUpDueAt: null,
    createdAt: '2026-10-11T04:30:00.000Z',
  },
  {
    id: 'preview-unassigned-zoya',
    subjectName: 'Zoya Khan',
    contactRelationship: 'self',
    source: 'website_referral',
    interestSummary: 'NIFT situation test and portfolio guidance',
    targetIntake: '2027 entrance',
    stage: 'contact_in_progress',
    currentOwnerPersonId: null,
    currentOwnerName: null,
    ownerIsEligible: false,
    followUpDueAt: '2026-10-12T05:30:00.000Z',
    createdAt: '2026-10-10T07:45:00.000Z',
  },
  {
    id: 'preview-stranded-anaya',
    subjectName: 'Anaya Rao',
    contactRelationship: 'guardian',
    source: 'manual',
    interestSummary: 'NATA drawing and observation preparation',
    targetIntake: '2027 entrance',
    stage: 'engaged',
    currentOwnerPersonId: 'preview-inactive-owner',
    currentOwnerName: 'Isha Menon',
    ownerIsEligible: false,
    followUpDueAt: '2026-10-10T05:30:00.000Z',
    createdAt: '2026-10-08T08:15:00.000Z',
  },
]

const previewOwners: CrmEligibleOwner[] = [
  { personId: 'preview-owner-riya', displayName: 'Riya Shah' },
  { personId: 'preview-owner-sameer', displayName: 'Sameer Joshi' },
]

const queueCopy: Record<CrmAssignmentQueue, { description: string; label: string }> = {
  unassigned: {
    label: 'Unassigned',
    description: 'New enquiries that do not yet have a current Sales owner.',
  },
  needs_reassignment: {
    label: 'Needs reassignment',
    description: 'Enquiries whose recorded owner is no longer an active Sales owner.',
  },
}

function label(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function dateTime(value: string | null) {
  if (!value) return 'No follow-up scheduled'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

export function CrmAssignmentPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [queue, setQueue] = useState<CrmAssignmentQueue>('unassigned')
  const [previewQueue, setPreviewQueue] = useState(previewItems)
  const [selectedId, setSelectedId] = useState('preview-unassigned-rohan')
  const [search, setSearch] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const assignmentQuery = useQuery({
    queryKey: ['crm-assignment-queue', queue],
    queryFn: () => listCrmAssignmentQueue(queue, 100),
    enabled: !previewEnabled,
    retry: false,
  })
  const ownersQuery = useQuery({
    queryKey: ['crm-eligible-owners'],
    queryFn: () => listCrmEligibleOwners(100),
    enabled: !previewEnabled,
    retry: false,
  })
  const items = useMemo(() => {
    const allItems = previewEnabled ? previewQueue : (assignmentQuery.data ?? [])
    const filteredQueue = allItems.filter((item) =>
      queue === 'unassigned'
        ? item.currentOwnerPersonId === null
        : item.currentOwnerPersonId !== null && !item.ownerIsEligible,
    )
    const term = search.trim().toLocaleLowerCase()
    if (!term) return filteredQueue
    return filteredQueue.filter(
      (item) =>
        item.subjectName.toLocaleLowerCase().includes(term) ||
        item.interestSummary.toLocaleLowerCase().includes(term) ||
        item.currentOwnerName?.toLocaleLowerCase().includes(term),
    )
  }, [assignmentQuery.data, previewEnabled, previewQueue, queue, search])
  const owners = previewEnabled ? previewOwners : (ownersQuery.data ?? [])
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null
  const effectiveOwnerId = ownerId || owners[0]?.personId || ''
  const selectedOwner = owners.find((owner) => owner.personId === effectiveOwnerId)

  function changeQueue(nextQueue: CrmAssignmentQueue) {
    setQueue(nextQueue)
    setSearch('')
    setSelectedId('')
    setOwnerId('')
    setReason('')
    setNotice('')
    setError('')
  }

  async function submitAssignment(event: FormEvent) {
    event.preventDefault()
    setNotice('')
    setError('')
    if (!selected || !effectiveOwnerId || reason.trim().length < 3) {
      setError('Choose an active Sales owner and enter a reason of at least 3 characters.')
      return
    }
    setSaving(true)
    try {
      if (!previewEnabled) {
        await assignCrmEnquiry({
          enquiryId: selected.id,
          ownerPersonId: effectiveOwnerId,
          expectedOwnerPersonId: selected.currentOwnerPersonId,
          reason,
        })
        await assignmentQuery.refetch()
      } else {
        setPreviewQueue((current) => current.filter((item) => item.id !== selected.id))
      }
      setNotice(
        `${selected.subjectName} was assigned to ${selectedOwner?.displayName ?? 'the selected Sales owner'}. Ownership history was preserved.`,
      )
      setSelectedId('')
      setOwnerId('')
      setReason('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The enquiry could not be assigned.')
    } finally {
      setSaving(false)
    }
  }

  if (!previewEnabled && (assignmentQuery.isPending || ownersQuery.isPending)) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">CRM assignment</p>
        <h1>Loading assignment controls…</h1>
        <p>We are checking your current coordinator authority and available Sales owners.</p>
      </section>
    )
  }

  if (!previewEnabled && (assignmentQuery.isError || ownersQuery.isError)) {
    return (
      <section className={styles.state} aria-labelledby="assignment-error-title">
        <p className="eyebrow">CRM assignment</p>
        <h1 id="assignment-error-title">CRM assignment could not be loaded.</h1>
        <Callout tone="warning" icon="warning">
          No allocation data was exposed. Check your connection or current coordinator access and
          try again.
        </Callout>
        <Button
          onClick={() => {
            void assignmentQuery.refetch()
            void ownersQuery.refetch()
          }}
        >
          Try again
        </Button>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-labelledby="crm-assignment-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            CRM operations · {previewEnabled ? 'Local preview' : 'Live data'}
          </p>
          <h1 id="crm-assignment-title">Assign enquiries.</h1>
          <p>
            Allocate one enquiry at a time. Every change needs a reason and keeps the complete
            ownership history.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Badge tone="accent">CRM Coordinator</Badge>
          <Link
            className={styles.workspaceLink}
            to={`/staff/crm${previewEnabled ? '?preview=1' : ''}`}
          >
            Assigned CRM
          </Link>
        </div>
      </header>

      <Callout tone="accent" icon="note">
        This workspace shows only allocation details. Contact-match evidence, academic records,
        exports, and bulk assignment remain unavailable.
      </Callout>

      <div className={styles.queueTabs} aria-label="Assignment queues">
        {(Object.keys(queueCopy) as CrmAssignmentQueue[]).map((queueName) => (
          <Button
            aria-pressed={queue === queueName}
            key={queueName}
            onClick={() => changeQueue(queueName)}
            size="sm"
            variant={queue === queueName ? 'primary' : 'secondary'}
          >
            {queueCopy[queueName].label}
          </Button>
        ))}
      </div>

      {notice ? (
        <Callout tone="success" icon="success">
          {notice}
        </Callout>
      ) : null}
      {error ? (
        <Callout tone="warning" icon="warning">
          <span role="alert">{error}</span>
        </Callout>
      ) : null}

      <div className={styles.layout}>
        <aside className={styles.queuePanel} aria-label={queueCopy[queue].label}>
          <div className={styles.queueHeading}>
            <div>
              <p className="eyebrow">{queueCopy[queue].label}</p>
              <h2>{items.length} waiting</h2>
            </div>
            <p>{queueCopy[queue].description}</p>
          </div>
          <Input
            label="Search this queue"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, interest, or previous owner"
            type="search"
            value={search}
          />
          {items.length ? (
            <div className={styles.queueList}>
              {items.map((item) => (
                <button
                  aria-pressed={selected?.id === item.id}
                  className={selected?.id === item.id ? styles.selectedItem : styles.queueItem}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id)
                    setOwnerId('')
                    setReason('')
                    setNotice('')
                    setError('')
                  }}
                  type="button"
                >
                  <span>
                    <strong>{item.subjectName}</strong>
                    <small>{item.interestSummary}</small>
                  </span>
                  <Badge tone={queue === 'needs_reassignment' ? 'warning' : 'neutral'}>
                    {queue === 'needs_reassignment' ? 'Owner inactive' : 'No owner'}
                  </Badge>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              description={
                search
                  ? 'Clear the search or choose the other queue.'
                  : 'Nothing currently needs allocation in this queue.'
              }
              title={search ? 'No matching enquiries' : 'Queue is clear'}
            />
          )}
        </aside>

        <div className={styles.detail}>
          {selected ? (
            <>
              <Card className={styles.summaryCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <p className="eyebrow">Allocation review</p>
                    <h2>{selected.subjectName}</h2>
                  </div>
                  <Badge tone="accent">{label(selected.stage)}</Badge>
                </div>
                <p className={styles.interest}>{selected.interestSummary}</p>
                <dl className={styles.meta}>
                  <div>
                    <dt>Current owner</dt>
                    <dd>{selected.currentOwnerName ?? 'Unassigned'}</dd>
                  </div>
                  <div>
                    <dt>Contact relationship</dt>
                    <dd>{label(selected.contactRelationship)}</dd>
                  </div>
                  <div>
                    <dt>Target intake</dt>
                    <dd>{selected.targetIntake ?? 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Open follow-up</dt>
                    <dd>{dateTime(selected.followUpDueAt)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{label(selected.source)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{dateTime(selected.createdAt)}</dd>
                  </div>
                </dl>
                {selected.currentOwnerPersonId ? (
                  <Callout tone="warning" icon="warning">
                    {selected.currentOwnerName ?? 'The recorded owner'} no longer has active Sales
                    authority. Assigning a new owner will replace any open follow-up without
                    restoring the previous employee's access.
                  </Callout>
                ) : null}
              </Card>

              <Card className={styles.assignmentCard}>
                <div>
                  <p className="eyebrow">Single-record action</p>
                  <h2>Choose the new owner</h2>
                  <p>Only currently active Sales owners appear here.</p>
                </div>
                <form onSubmit={(event) => void submitAssignment(event)}>
                  <div className={styles.field}>
                    <label htmlFor="crm-assignment-owner">Active Sales owner</label>
                    <select
                      id="crm-assignment-owner"
                      onChange={(event) => setOwnerId(event.target.value)}
                      value={effectiveOwnerId}
                    >
                      {owners.map((owner) => (
                        <option key={owner.personId} value={owner.personId}>
                          {owner.displayName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="crm-assignment-reason">Assignment reason</label>
                    <textarea
                      id="crm-assignment-reason"
                      maxLength={240}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Why should this owner receive the enquiry?"
                      required
                      value={reason}
                    />
                    <small>{reason.length}/240 · Saved in ownership history</small>
                  </div>
                  <Button disabled={saving || !owners.length} type="submit">
                    {saving ? 'Assigning…' : `Assign to ${selectedOwner?.displayName ?? 'owner'}`}
                  </Button>
                </form>
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState
                description="Choose the other queue or wait for a new allocation item."
                title="No enquiry selected"
              />
            </Card>
          )}
        </div>
      </div>
    </section>
  )
}
