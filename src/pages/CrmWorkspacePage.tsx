import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import {
  createCrmEnquiry,
  listCrmEnquiries,
  recordCrmActivity,
  requestCrmEnrolmentReview,
  scheduleCrmFollowUp,
  updateCrmEnquiryStage,
  type CrmActivityOutcome,
  type CrmContactKind,
  type CrmContactRelationship,
  type CrmEnquiry,
  type CrmEnquiryStage,
  type CrmQueueView,
} from '../features/crm/crm'
import styles from './CrmWorkspacePage.module.css'

const previewEnquiries: CrmEnquiry[] = [
  {
    id: 'preview-enquiry-aarav',
    archiveAt: null,
    closedAt: null,
    closedReason: null,
    subjectName: 'Aarav Kulkarni',
    contactName: 'Neha Kulkarni',
    contactRelationship: 'guardian',
    contactKind: 'phone',
    contactValue: '+91 98765 43210',
    source: 'website_referral',
    interestSummary: 'NID and UCEED foundation preparation',
    targetIntake: '2027 entrance',
    stage: 'engaged',
    ownerName: 'Riya Shah',
    followUpId: 'preview-follow-up-aarav',
    followUpDueAt: '2026-10-10T06:30:00.000Z',
    lastActivityAt: '2026-10-09T11:15:00.000Z',
    lastActivityOutcome: 'connected',
    possibleIdentityMatch: false,
    reviewRequestedAt: null,
    createdAt: '2026-10-08T08:30:00.000Z',
  },
  {
    id: 'preview-enquiry-meera',
    archiveAt: null,
    closedAt: null,
    closedReason: null,
    subjectName: 'Meera Patel',
    contactName: 'Meera Patel',
    contactRelationship: 'self',
    contactKind: 'email',
    contactValue: 'meera.patel@example.test',
    source: 'walk_in',
    interestSummary: 'NIFT situation test and portfolio guidance',
    targetIntake: '2027 entrance',
    stage: 'qualified',
    ownerName: 'Riya Shah',
    followUpId: 'preview-follow-up-meera',
    followUpDueAt: '2026-10-12T05:30:00.000Z',
    lastActivityAt: '2026-10-10T09:20:00.000Z',
    lastActivityOutcome: 'counselling_arranged',
    possibleIdentityMatch: true,
    reviewRequestedAt: null,
    createdAt: '2026-10-09T08:30:00.000Z',
  },
  {
    id: 'preview-enquiry-kabir',
    archiveAt: null,
    closedAt: null,
    closedReason: null,
    subjectName: 'Kabir Rao',
    contactName: 'Kabir Rao',
    contactRelationship: 'self',
    contactKind: 'phone',
    contactValue: '+91 97654 32109',
    source: 'manual',
    interestSummary: 'NATA drawing preparation',
    targetIntake: '2027 entrance',
    stage: 'new',
    ownerName: 'Riya Shah',
    followUpId: null,
    followUpDueAt: null,
    lastActivityAt: null,
    lastActivityOutcome: null,
    possibleIdentityMatch: false,
    reviewRequestedAt: null,
    createdAt: '2026-10-10T12:30:00.000Z',
  },
  {
    id: 'preview-enquiry-tanvi',
    archiveAt: '2026-10-15T08:30:00.000Z',
    closedAt: '2026-10-08T08:30:00.000Z',
    closedReason: 'The family asked to pause preparation plans.',
    subjectName: 'Tanvi Shah',
    contactName: 'Tanvi Shah',
    contactRelationship: 'self',
    contactKind: 'email',
    contactValue: 'tanvi.shah@example.test',
    source: 'walk_in',
    interestSummary: 'NIFT portfolio preparation',
    targetIntake: '2027 entrance',
    stage: 'closed',
    ownerName: 'Riya Shah',
    followUpId: null,
    followUpDueAt: null,
    lastActivityAt: '2026-10-08T08:20:00.000Z',
    lastActivityOutcome: 'connected',
    possibleIdentityMatch: false,
    reviewRequestedAt: null,
    createdAt: '2026-10-03T08:30:00.000Z',
  },
  {
    id: 'preview-enquiry-dev',
    archiveAt: '2026-10-06T08:30:00.000Z',
    closedAt: '2026-09-29T08:30:00.000Z',
    closedReason: 'No response after the agreed follow-up period.',
    subjectName: 'Dev Malhotra',
    contactName: 'Anita Malhotra',
    contactRelationship: 'guardian',
    contactKind: 'phone',
    contactValue: '+91 96543 21098',
    source: 'website_referral',
    interestSummary: 'NID foundation preparation',
    targetIntake: '2027 entrance',
    stage: 'closed',
    ownerName: 'Riya Shah',
    followUpId: null,
    followUpDueAt: null,
    lastActivityAt: '2026-09-29T08:00:00.000Z',
    lastActivityOutcome: 'no_response',
    possibleIdentityMatch: false,
    reviewRequestedAt: null,
    createdAt: '2026-09-22T08:30:00.000Z',
  },
]

const previewNow = new Date('2026-10-10T18:30:00.000Z').getTime()
const deadArchiveDelay = 7 * 24 * 60 * 60 * 1000

const nextStage: Partial<Record<CrmEnquiryStage, CrmEnquiryStage>> = {
  new: 'contact_in_progress',
  contact_in_progress: 'engaged',
  engaged: 'qualified',
}

function label(value: string) {
  return value
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function dateTime(value: string | null) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

function followUpTone(value: string | null) {
  if (!value) return 'neutral' as const
  return new Date(value).getTime() < new Date('2026-10-10T18:30:00.000Z').getTime()
    ? ('warning' as const)
    : ('accent' as const)
}

function belongsToQueue(enquiry: CrmEnquiry, queue: CrmQueueView) {
  if (queue === 'active') return enquiry.stage !== 'closed'
  if (enquiry.stage !== 'closed' || !enquiry.closedAt) return false
  const isArchived = new Date(enquiry.closedAt).getTime() <= previewNow - deadArchiveDelay
  return queue === 'dead_archive' ? isArchived : !isArchived
}

const queueCopy: Record<CrmQueueView, { description: string; label: string; summary: string }> = {
  active: {
    label: 'Active',
    summary: 'Assigned',
    description: 'Enquiries that still need an owner and a next step.',
  },
  recently_dead: {
    label: 'Recently dead',
    summary: 'Recently dead',
    description: 'Removed from the active queue for seven days before automatic archiving.',
  },
  dead_archive: {
    label: 'Dead archive',
    summary: 'Archived',
    description:
      'Dead enquiries older than seven days. Their history remains available and reversible.',
  },
}

export function CrmWorkspacePage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [localEnquiries, setLocalEnquiries] = useState(previewEnquiries)
  const [queueView, setQueueView] = useState<CrmQueueView>('active')
  const [selectedId, setSelectedId] = useState(
    searchParams.get('enquiry') ?? 'preview-enquiry-aarav',
  )
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [activityOutcome, setActivityOutcome] = useState<CrmActivityOutcome>('connected')
  const [activityNote, setActivityNote] = useState('')
  const [followUpAt, setFollowUpAt] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [deadReason, setDeadReason] = useState('')
  const [restoreReason, setRestoreReason] = useState('')
  const [subjectName, setSubjectName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactRelationship, setContactRelationship] = useState<CrmContactRelationship>('self')
  const [contactKind, setContactKind] = useState<CrmContactKind>('phone')
  const [contactValue, setContactValue] = useState('')
  const [interestSummary, setInterestSummary] = useState('')
  const [targetIntake, setTargetIntake] = useState('')

  const enquiriesQuery = useQuery({
    queryKey: ['crm-enquiries', queueView],
    queryFn: () => listCrmEnquiries(100, '', queueView),
    enabled: !previewEnabled,
    retry: false,
  })
  const enquiries = useMemo(
    () =>
      previewEnabled
        ? localEnquiries.filter((enquiry) => belongsToQueue(enquiry, queueView))
        : (enquiriesQuery.data ?? []),
    [enquiriesQuery.data, localEnquiries, previewEnabled, queueView],
  )
  const visibleEnquiries = useMemo(() => {
    const term = search.trim().toLocaleLowerCase()
    if (!term) return enquiries
    return enquiries.filter(
      (enquiry) =>
        enquiry.subjectName.toLocaleLowerCase().includes(term) ||
        enquiry.contactName.toLocaleLowerCase().includes(term) ||
        enquiry.contactValue.toLocaleLowerCase().includes(term),
    )
  }, [enquiries, search])
  const selected =
    enquiries.find((enquiry) => enquiry.id === selectedId) ?? visibleEnquiries[0] ?? null

  function changeQueue(nextQueue: CrmQueueView) {
    setQueueView(nextQueue)
    setSelectedId('')
    setSearch('')
    setShowCreate(false)
    setNotice('')
    setError('')
    setDeadReason('')
    setRestoreReason('')
  }

  function updateSelected(update: Partial<CrmEnquiry>) {
    setLocalEnquiries((current) =>
      current.map((enquiry) => (enquiry.id === selected?.id ? { ...enquiry, ...update } : enquiry)),
    )
  }

  async function refresh() {
    if (!previewEnabled) await enquiriesQuery.refetch()
  }

  async function run(action: () => Promise<void>, success: string) {
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await action()
      await refresh()
      setNotice(success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The CRM update could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  async function submitActivity(event: FormEvent) {
    event.preventDefault()
    if (!selected) return
    await run(async () => {
      if (!previewEnabled) await recordCrmActivity(selected.id, activityOutcome, activityNote)
      else
        updateSelected({
          lastActivityAt: new Date().toISOString(),
          lastActivityOutcome: activityOutcome,
        })
      setActivityNote('')
    }, 'Activity added to the enquiry timeline.')
  }

  async function submitFollowUp(event: FormEvent) {
    event.preventDefault()
    if (!selected || !followUpAt) return
    const dueAt = new Date(followUpAt).toISOString()
    await run(async () => {
      if (!previewEnabled) await scheduleCrmFollowUp(selected.id, dueAt)
      else updateSelected({ followUpId: `preview-${crypto.randomUUID()}`, followUpDueAt: dueAt })
      setFollowUpAt('')
    }, 'Follow-up scheduled. Any earlier open reminder was safely replaced.')
  }

  async function advanceStage() {
    if (!selected) return
    const stage = nextStage[selected.stage]
    if (!stage) return
    await run(
      async () => {
        if (!previewEnabled) await updateCrmEnquiryStage(selected.id, stage, `${stage}_confirmed`)
        else updateSelected({ stage })
      },
      `Enquiry moved to ${label(stage)}.`,
    )
  }

  async function moveToDead(event: FormEvent) {
    event.preventDefault()
    if (!selected || !deadReason.trim()) return
    const closedAt = new Date().toISOString()
    const archiveAt = new Date(new Date(closedAt).getTime() + deadArchiveDelay).toISOString()
    await run(async () => {
      if (!previewEnabled) {
        await updateCrmEnquiryStage(selected.id, 'closed', 'marked_dead', deadReason.trim())
      } else {
        updateSelected({
          archiveAt,
          closedAt,
          closedReason: deadReason.trim(),
          followUpDueAt: null,
          followUpId: null,
          stage: 'closed',
        })
      }
      setDeadReason('')
      setQueueView('recently_dead')
    }, 'Enquiry moved to Recently dead. It will enter the archive automatically after seven days.')
  }

  async function restoreEnquiry(event: FormEvent) {
    event.preventDefault()
    if (!selected || !restoreReason.trim()) return
    await run(async () => {
      if (!previewEnabled) {
        await updateCrmEnquiryStage(
          selected.id,
          'contact_in_progress',
          'enquiry_restored',
          restoreReason.trim(),
        )
      } else {
        updateSelected({
          archiveAt: null,
          closedAt: null,
          closedReason: null,
          stage: 'contact_in_progress',
        })
      }
      setRestoreReason('')
      setQueueView('active')
    }, 'Enquiry restored to the active queue with its earlier history preserved.')
  }

  async function requestReview(event: FormEvent) {
    event.preventDefault()
    if (!selected || !reviewNote.trim()) return
    await run(async () => {
      if (!previewEnabled) await requestCrmEnrolmentReview(selected.id, reviewNote.trim())
      else
        updateSelected({
          stage: 'enrolment_review_requested',
          reviewRequestedAt: new Date().toISOString(),
        })
      setReviewNote('')
    }, 'Enrolment review requested. Student access has not been created.')
  }

  async function createEnquiry(event: FormEvent) {
    event.preventDefault()
    if (
      !subjectName.trim() ||
      !contactName.trim() ||
      !contactValue.trim() ||
      !interestSummary.trim()
    ) {
      setError('Add the prospect, contact route, and area of interest.')
      return
    }
    await run(async () => {
      if (previewEnabled) {
        const id = `preview-${crypto.randomUUID()}`
        setLocalEnquiries((current) => [
          {
            id,
            archiveAt: null,
            closedAt: null,
            closedReason: null,
            subjectName: subjectName.trim(),
            contactName: contactName.trim(),
            contactRelationship,
            contactKind,
            contactValue: contactValue.trim(),
            source: 'manual',
            interestSummary: interestSummary.trim(),
            targetIntake: targetIntake.trim() || null,
            stage: 'new',
            ownerName: 'Riya Shah',
            followUpId: null,
            followUpDueAt: null,
            lastActivityAt: null,
            lastActivityOutcome: null,
            possibleIdentityMatch: false,
            reviewRequestedAt: null,
            createdAt: new Date().toISOString(),
          },
          ...current,
        ])
        setSelectedId(id)
      } else {
        const created = await createCrmEnquiry({
          subjectName: subjectName.trim(),
          contactName: contactName.trim(),
          contactRelationship,
          contactKind,
          contactValue: contactValue.trim(),
          interestSummary: interestSummary.trim(),
          targetIntake: targetIntake.trim(),
          source: 'manual',
          requestKey: crypto.randomUUID(),
        })
        setSelectedId(created.enquiryId)
      }
      setShowCreate(false)
      setSubjectName('')
      setContactName('')
      setContactValue('')
      setInterestSummary('')
      setTargetIntake('')
    }, 'Enquiry created and assigned to you. No student account was created.')
  }

  if (!previewEnabled && enquiriesQuery.isPending)
    return (
      <section className={styles.state}>
        <p className="eyebrow">Admissions CRM</p>
        <h1>Loading assigned enquiries…</h1>
      </section>
    )

  if (!previewEnabled && enquiriesQuery.isError)
    return (
      <section className={styles.state}>
        <p className="eyebrow">Admissions CRM</p>
        <h1>The CRM workspace could not be loaded.</h1>
        <Button onClick={() => void enquiriesQuery.refetch()}>Try again</Button>
      </section>
    )

  return (
    <section className={styles.workspace} aria-labelledby="crm-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Admissions CRM · {previewEnabled ? 'Local preview' : 'Live data'}
          </p>
          <h1 id="crm-title">Assigned enquiries.</h1>
          <p>Own the next step without creating student access or sending external messages.</p>
        </div>
        <Button
          onClick={() => {
            if (queueView !== 'active') {
              changeQueue('active')
              setShowCreate(true)
            } else {
              setShowCreate((current) => !current)
            }
          }}
        >
          {showCreate ? 'Close form' : 'Add enquiry'}
        </Button>
      </header>

      {notice ? (
        <Callout tone="success" icon="success">
          {notice}
        </Callout>
      ) : null}
      {error ? (
        <Callout tone="warning" icon="warning">
          {error}
        </Callout>
      ) : null}

      <div className={styles.queueViews} aria-label="Enquiry areas">
        {(Object.keys(queueCopy) as CrmQueueView[]).map((queue) => (
          <Button
            aria-pressed={queueView === queue}
            key={queue}
            onClick={() => changeQueue(queue)}
            variant={queueView === queue ? undefined : 'ghost'}
          >
            {queueCopy[queue].label}
          </Button>
        ))}
      </div>

      {showCreate ? (
        <form onSubmit={(event) => void createEnquiry(event)}>
          <Card className={styles.createForm}>
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">Manual intake</p>
                <h2>New enquiry</h2>
              </div>
              <Badge tone="neutral">No account created</Badge>
            </div>
            <div className={styles.formGrid}>
              <Input
                label="Prospect name"
                value={subjectName}
                onChange={(event) => {
                  setSubjectName(event.target.value)
                  if (contactRelationship === 'self') setContactName(event.target.value)
                }}
              />
              <div className={styles.field}>
                <label htmlFor="crm-relationship">Primary contact</label>
                <select
                  id="crm-relationship"
                  value={contactRelationship}
                  onChange={(event) =>
                    setContactRelationship(event.target.value as CrmContactRelationship)
                  }
                >
                  <option value="self">The prospect</option>
                  <option value="guardian">Guardian</option>
                  <option value="other">Other contact</option>
                </select>
              </div>
              <Input
                label="Contact name"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
              <div className={styles.field}>
                <label htmlFor="crm-contact-kind">Contact route</label>
                <select
                  id="crm-contact-kind"
                  value={contactKind}
                  onChange={(event) => setContactKind(event.target.value as CrmContactKind)}
                >
                  <option value="phone">Phone with country code</option>
                  <option value="email">Email</option>
                </select>
              </div>
              <Input
                label={contactKind === 'phone' ? 'Phone' : 'Email'}
                value={contactValue}
                onChange={(event) => setContactValue(event.target.value)}
                placeholder={contactKind === 'phone' ? '+91…' : 'name@example.com'}
              />
              <Input
                label="Target intake"
                value={targetIntake}
                onChange={(event) => setTargetIntake(event.target.value)}
                placeholder="2027 entrance"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="crm-interest">Area of interest</label>
              <textarea
                id="crm-interest"
                maxLength={240}
                value={interestSummary}
                onChange={(event) => setInterestSummary(event.target.value)}
              />
            </div>
            <Button disabled={busy} type="submit">
              Create assigned enquiry
            </Button>
          </Card>
        </form>
      ) : null}

      <div className={styles.layout}>
        <aside className={styles.queue} aria-label={`${queueCopy[queueView].label} enquiry queue`}>
          <div className={styles.queueIntroduction}>
            <strong>{queueCopy[queueView].label}</strong>
            <p>{queueCopy[queueView].description}</p>
          </div>
          <Input
            label={`Search ${queueCopy[queueView].label.toLocaleLowerCase()} enquiries`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or contact"
          />
          <div className={styles.queueSummary}>
            <strong>{visibleEnquiries.length}</strong>
            <span>{queueCopy[queueView].summary}</span>
          </div>
          {visibleEnquiries.length === 0 ? (
            <EmptyState
              title="No matching enquiries"
              description={
                search
                  ? 'Clear the search to see this area again.'
                  : queueView === 'active'
                    ? 'Add a new enquiry when the next prospect contacts Dexam.'
                    : 'No enquiries are currently stored in this area.'
              }
            />
          ) : (
            <div className={styles.queueList}>
              {visibleEnquiries.map((enquiry) => (
                <button
                  className={
                    enquiry.id === selected?.id ? styles.selectedQueueItem : styles.queueItem
                  }
                  key={enquiry.id}
                  onClick={() => {
                    setSelectedId(enquiry.id)
                    setNotice('')
                    setError('')
                    setDeadReason('')
                    setRestoreReason('')
                  }}
                  type="button"
                >
                  <span>
                    <strong>{enquiry.subjectName}</strong>
                    <small>{enquiry.interestSummary}</small>
                  </span>
                  <Badge tone={followUpTone(enquiry.followUpDueAt)}>
                    {enquiry.stage === 'closed'
                      ? `Closed ${dateTime(enquiry.closedAt)}`
                      : enquiry.followUpDueAt
                        ? dateTime(enquiry.followUpDueAt)
                        : label(enquiry.stage)}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </aside>

        {selected ? (
          <div className={styles.detail}>
            <Card className={styles.summaryCard}>
              <div className={styles.sectionHeading}>
                <div>
                  <p className="eyebrow">{label(selected.source)}</p>
                  <h2>{selected.subjectName}</h2>
                </div>
                <Badge tone="accent">{label(selected.stage)}</Badge>
              </div>
              <p className={styles.interest}>{selected.interestSummary}</p>
              <dl className={styles.meta}>
                <div>
                  <dt>Primary contact</dt>
                  <dd>
                    {selected.contactName} · {label(selected.contactRelationship)}
                  </dd>
                </div>
                <div>
                  <dt>{label(selected.contactKind)}</dt>
                  <dd>{selected.contactValue}</dd>
                </div>
                <div>
                  <dt>Target intake</dt>
                  <dd>{selected.targetIntake ?? 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{selected.ownerName}</dd>
                </div>
                <div>
                  <dt>{selected.stage === 'closed' ? 'Moved to dead' : 'Next follow-up'}</dt>
                  <dd>
                    {selected.stage === 'closed'
                      ? dateTime(selected.closedAt)
                      : dateTime(selected.followUpDueAt)}
                  </dd>
                </div>
                <div>
                  <dt>Last activity</dt>
                  <dd>
                    {selected.lastActivityOutcome
                      ? `${label(selected.lastActivityOutcome)} · ${dateTime(selected.lastActivityAt)}`
                      : 'No activity recorded'}
                  </dd>
                </div>
                {selected.stage === 'closed' ? (
                  <div>
                    <dt>Archive placement</dt>
                    <dd>
                      {queueView === 'dead_archive'
                        ? `Archived ${dateTime(selected.archiveAt)}`
                        : `Automatic on ${dateTime(selected.archiveAt)}`}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {selected.stage === 'closed' ? (
                <Callout tone="warning" icon="warning">
                  <div className={styles.calloutStack}>
                    <strong>Dead enquiry</strong>
                    <span>{selected.closedReason}</span>
                  </div>
                </Callout>
              ) : null}
              {selected.possibleIdentityMatch ? (
                <Callout tone="warning" icon="warning">
                  <strong>Possible existing person</strong>
                  <span>
                    An Enrolment Operator must resolve this during review. No records were merged
                    automatically.
                  </span>
                </Callout>
              ) : null}
              <Callout tone="neutral" icon="note">
                This contact route is for responding to this enquiry. It is not promotional
                marketing consent.
              </Callout>
            </Card>

            {selected.stage !== 'closed' ? (
              <div className={styles.actionsGrid}>
                <form onSubmit={(event) => void submitActivity(event)}>
                  <Card className={styles.actionCard}>
                    <h3>Log activity</h3>
                    <div className={styles.field}>
                      <label htmlFor="crm-outcome">Outcome</label>
                      <select
                        id="crm-outcome"
                        value={activityOutcome}
                        onChange={(event) =>
                          setActivityOutcome(event.target.value as CrmActivityOutcome)
                        }
                      >
                        <option value="connected">Connected</option>
                        <option value="contact_attempted">Contact attempted</option>
                        <option value="counselling_arranged">Counselling arranged</option>
                        <option value="no_response">No response</option>
                        <option value="note_added">Note added</option>
                      </select>
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="crm-activity-note">Bounded note</label>
                      <textarea
                        id="crm-activity-note"
                        maxLength={1000}
                        value={activityNote}
                        onChange={(event) => setActivityNote(event.target.value)}
                      />
                    </div>
                    <Button disabled={busy} type="submit" variant="secondary">
                      Save activity
                    </Button>
                  </Card>
                </form>
                <form onSubmit={(event) => void submitFollowUp(event)}>
                  <Card className={styles.actionCard}>
                    <h3>Schedule follow-up</h3>
                    <Input
                      label="Due date and time"
                      type="datetime-local"
                      value={followUpAt}
                      onChange={(event) => setFollowUpAt(event.target.value)}
                    />
                    <p>Rescheduling preserves the earlier task and cancels its obsolete alert.</p>
                    <Button disabled={busy || !followUpAt} type="submit" variant="secondary">
                      Schedule follow-up
                    </Button>
                  </Card>
                </form>
              </div>
            ) : null}

            {nextStage[selected.stage] ? (
              <Card className={styles.nextStep}>
                <div>
                  <p className="eyebrow">Lifecycle</p>
                  <h3>Move to {label(nextStage[selected.stage]!)}</h3>
                  <p>Every stage change is recorded and attributable.</p>
                </div>
                <Button disabled={busy} onClick={() => void advanceStage()}>
                  Confirm next stage
                </Button>
              </Card>
            ) : null}
            {['new', 'contact_in_progress', 'engaged', 'qualified'].includes(selected.stage) ? (
              <form onSubmit={(event) => void moveToDead(event)}>
                <Card className={styles.deadLifecycleCard}>
                  <div>
                    <p className="eyebrow">Remove from active queue</p>
                    <h3>Move to dead enquiries</h3>
                    <p>
                      The enquiry stays in Recently dead for seven days, then moves automatically to
                      the Dead archive. It is never deleted and can be restored later.
                    </p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="crm-dead-reason">Why is this enquiry dead?</label>
                    <textarea
                      id="crm-dead-reason"
                      maxLength={240}
                      value={deadReason}
                      onChange={(event) => setDeadReason(event.target.value)}
                    />
                  </div>
                  <Button
                    disabled={busy || deadReason.trim().length < 3}
                    type="submit"
                    variant="secondary"
                  >
                    Move to dead enquiries
                  </Button>
                </Card>
              </form>
            ) : null}
            {selected.stage === 'closed' ? (
              <form onSubmit={(event) => void restoreEnquiry(event)}>
                <Card className={styles.restoreCard}>
                  <div>
                    <p className="eyebrow">Reversible history</p>
                    <h3>Restore this enquiry</h3>
                    <p>
                      Restoration returns this same record to Contact in progress. The earlier dead
                      period remains in its history.
                    </p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="crm-restore-reason">Why are you restoring this enquiry?</label>
                    <textarea
                      id="crm-restore-reason"
                      maxLength={500}
                      value={restoreReason}
                      onChange={(event) => setRestoreReason(event.target.value)}
                    />
                  </div>
                  <Button disabled={busy || restoreReason.trim().length < 3} type="submit">
                    Restore to active queue
                  </Button>
                </Card>
              </form>
            ) : null}
            {selected.stage === 'qualified' ? (
              <form onSubmit={(event) => void requestReview(event)}>
                <Card className={styles.reviewForm}>
                  <div>
                    <p className="eyebrow">Sales-to-enrolment handoff</p>
                    <h3>Request enrolment review</h3>
                    <p>
                      The Enrolment Operator still resolves identity, approves enrolment, and issues
                      activation.
                    </p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="crm-review-note">Handoff note</label>
                    <textarea
                      id="crm-review-note"
                      maxLength={500}
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                    />
                  </div>
                  <Button disabled={busy || !reviewNote.trim()} type="submit">
                    Request review
                  </Button>
                </Card>
              </form>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
