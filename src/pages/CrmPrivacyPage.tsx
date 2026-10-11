import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import {
  applyCrmPrivacyCorrection,
  createCrmPrivacyCase,
  decideCrmErasure,
  listCrmPrivacyCases,
  placeCrmPrivacyHold,
  previewCrmErasure,
  proposeCrmErasure,
  releaseCrmPrivacyHold,
  type CrmErasureImpact,
  type CrmPrivacyCase,
  type CrmPrivacyCaseKind,
  type CrmPrivacyCorrectionField,
  type CrmPrivacyQueue,
  type CrmPrivacyRequesterRelationship,
  type CrmPrivacyVerificationMethod,
} from '../features/crm/crmPrivacy'
import styles from './CrmPrivacyPage.module.css'

const previewCases: CrmPrivacyCase[] = [
  {
    id: 'preview-correction-mira',
    enquiryId: 'b9f71c4d-5f28-4ce1-a10a-04d945cc1842',
    kind: 'correction',
    status: 'under_review',
    subjectName: 'Mira Kulkarni',
    maskedContact: 'm***@example.test',
    requesterRelationship: 'self',
    verificationMethod: 'existing_contact_callback',
    requestSummary: 'The requester confirmed that the intended exam was recorded incorrectly.',
    proposalReason: null,
    proposerName: null,
    approverName: null,
    requestedAt: '2026-10-11T05:45:00.000Z',
    expiresAt: '2026-11-10T05:45:00.000Z',
    lifecycleState: 'active',
    minimizationDueAt: null,
    holdId: null,
    holdReviewBy: null,
  },
  {
    id: 'preview-erasure-kabir',
    enquiryId: 'c6db89d9-7c50-4d6f-8d3c-e6ed883bd9b2',
    kind: 'erasure',
    status: 'approval_required',
    subjectName: 'Kabir Mehta',
    maskedContact: '•••• 4018',
    requesterRelationship: 'parent_guardian',
    verificationMethod: 'existing_contact_callback',
    requestSummary: 'Verified guardian request for a closed enquiry with no remaining CRM purpose.',
    proposalReason: 'Identity, contact, notes, follow-ups, and alerts are in scope.',
    proposerName: 'Aditi Rao',
    approverName: null,
    requestedAt: '2026-10-10T08:20:00.000Z',
    expiresAt: '2026-11-09T08:20:00.000Z',
    lifecycleState: 'restricted',
    minimizationDueAt: '2027-09-18T08:20:00.000Z',
    holdId: null,
    holdReviewBy: null,
  },
  {
    id: 'preview-erasure-rhea',
    enquiryId: '6d4db15a-a92c-4edf-a9d0-64419da7a4c3',
    kind: 'erasure',
    status: 'approved',
    subjectName: 'Rhea Sen',
    maskedContact: 'r***@example.test',
    requesterRelationship: 'self',
    verificationMethod: 'member_account',
    requestSummary: 'CRM-only erasure was approved after conversion to a student account.',
    proposalReason: 'Preserve the student identity and academic records; minimize CRM-only data.',
    proposerName: 'Aditi Rao',
    approverName: 'Nikhil Bose',
    requestedAt: '2026-10-09T06:15:00.000Z',
    expiresAt: '2026-11-08T06:15:00.000Z',
    lifecycleState: 'held',
    minimizationDueAt: '2027-09-01T06:15:00.000Z',
    holdId: 'preview-hold-rhea',
    holdReviewBy: '2026-11-01T06:15:00.000Z',
  },
]

const previewImpacts: CrmErasureImpact[] = [
  {
    category: 'Identity and contact',
    recordCount: 1,
    plannedAction: 'Remove CRM contact values and anonymize prospect-only names.',
    protectedRecord: false,
  },
  {
    category: 'CRM free text',
    recordCount: 4,
    plannedAction: 'Erase notes and replace required text with a non-personal marker.',
    protectedRecord: false,
  },
  {
    category: 'Follow-ups and alerts',
    recordCount: 3,
    plannedAction: 'Close open work and expire related CRM notifications.',
    protectedRecord: false,
  },
  {
    category: 'Enrolment handoff',
    recordCount: 0,
    plannedAction: 'Preserve canonical student and enrolment records when they exist.',
    protectedRecord: true,
  },
]

const queueCopy: Record<CrmPrivacyQueue, string> = {
  open: 'Open cases',
  completed: 'Completed',
  all: 'All cases',
}

const correctionFieldCopy: Record<CrmPrivacyCorrectionField, string> = {
  subject_name: 'Prospect name',
  contact_name: 'Contact name',
  contact_value: 'Phone or email',
  interest_summary: 'Interest or exam',
  target_intake: 'Target intake',
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

function statusTone(
  status: CrmPrivacyCase['status'],
): 'accent' | 'neutral' | 'success' | 'warning' {
  if (status === 'completed') return 'success'
  if (status === 'approval_required' || status === 'approved') return 'accent'
  if (status === 'expired' || status === 'rejected') return 'warning'
  return 'neutral'
}

export function CrmPrivacyPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [queue, setQueue] = useState<CrmPrivacyQueue>('open')
  const [previewItems, setPreviewItems] = useState(previewCases)
  const [selectedId, setSelectedId] = useState(previewCases[1]?.id ?? '')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNewCase, setShowNewCase] = useState(false)
  const [newEnquiryId, setNewEnquiryId] = useState('')
  const [newKind, setNewKind] = useState<CrmPrivacyCaseKind>('correction')
  const [newRelationship, setNewRelationship] = useState<CrmPrivacyRequesterRelationship>('self')
  const [newVerification, setNewVerification] = useState<CrmPrivacyVerificationMethod>(
    'existing_contact_callback',
  )
  const [newSummary, setNewSummary] = useState('')
  const [correctionField, setCorrectionField] =
    useState<CrmPrivacyCorrectionField>('interest_summary')
  const [correctedValue, setCorrectedValue] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [decisionNote, setDecisionNote] = useState('')
  const [holdNote, setHoldNote] = useState('')
  const [holdReviewBy, setHoldReviewBy] = useState('')
  const [releaseReason, setReleaseReason] = useState('')

  const casesQuery = useQuery({
    queryKey: ['crm-privacy-cases', queue],
    queryFn: () => listCrmPrivacyCases(queue),
    enabled: !previewEnabled,
    retry: false,
  })
  const cases = useMemo(() => {
    const sourceCases = previewEnabled ? previewItems : (casesQuery.data ?? [])
    if (!previewEnabled || queue === 'all') return sourceCases
    const completedStatuses: CrmPrivacyCase['status'][] = [
      'completed',
      'partially_completed',
      'rejected',
      'expired',
    ]
    return sourceCases.filter((item) =>
      queue === 'completed'
        ? completedStatuses.includes(item.status)
        : !completedStatuses.includes(item.status),
    )
  }, [casesQuery.data, previewEnabled, previewItems, queue])
  const selected = cases.find((item) => item.id === selectedId) ?? cases[0] ?? null
  const impactQuery = useQuery({
    queryKey: ['crm-erasure-impact', selected?.id],
    queryFn: () => previewCrmErasure(selected!.id),
    enabled: Boolean(selected?.kind === 'erasure') && !previewEnabled,
    retry: false,
  })
  const impacts =
    selected?.kind === 'erasure' ? (previewEnabled ? previewImpacts : impactQuery.data) : []

  function clearMessages() {
    setNotice('')
    setError('')
  }

  async function refresh() {
    if (!previewEnabled) await casesQuery.refetch()
  }

  async function submitNewCase(event: FormEvent) {
    event.preventDefault()
    clearMessages()
    if (!newEnquiryId.trim() || newSummary.trim().length < 3) {
      setError('Enter the CRM enquiry reference and a request summary of at least 3 characters.')
      return
    }
    setSaving(true)
    try {
      if (previewEnabled) {
        const created: CrmPrivacyCase = {
          ...previewCases[0]!,
          id: `preview-created-${Date.now()}`,
          enquiryId: newEnquiryId.trim(),
          kind: newKind,
          requestSummary: newSummary.trim(),
          requesterRelationship: newRelationship,
          verificationMethod: newVerification,
          subjectName: 'Fictional new request',
          maskedContact: '•••• 2027',
          requestedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
        }
        setPreviewItems((current) => [created, ...current])
        setSelectedId(created.id)
      } else {
        const createdId = await createCrmPrivacyCase({
          enquiryId: newEnquiryId.trim(),
          kind: newKind,
          requesterRelationship: newRelationship,
          verificationMethod: newVerification,
          requestSummary: newSummary,
        })
        await refresh()
        setSelectedId(createdId)
      }
      setNewEnquiryId('')
      setNewSummary('')
      setShowNewCase(false)
      setNotice('The verified request was recorded without storing identity-document images.')
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The privacy request could not be recorded.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function submitCorrection(event: FormEvent) {
    event.preventDefault()
    clearMessages()
    if (!selected || correctedValue.trim().length < 2 || correctionReason.trim().length < 3) {
      setError('Enter the corrected value and a reason of at least 3 characters.')
      return
    }
    setSaving(true)
    try {
      if (!previewEnabled) {
        await applyCrmPrivacyCorrection({
          caseId: selected.id,
          field: correctionField,
          newValue: correctedValue,
          reason: correctionReason,
        })
        await refresh()
      } else {
        setPreviewItems((current) =>
          current.map((item) =>
            item.id === selected.id ? { ...item, status: 'completed' as const } : item,
          ),
        )
      }
      setCorrectedValue('')
      setCorrectionReason('')
      setNotice(
        'Correction applied. The readable prior value was not copied into the audit record.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The correction could not be applied.')
    } finally {
      setSaving(false)
    }
  }

  async function submitProposal(event: FormEvent) {
    event.preventDefault()
    clearMessages()
    if (!selected || decisionNote.trim().length < 3) {
      setError('Enter the proposed erasure scope and reason.')
      return
    }
    setSaving(true)
    try {
      if (!previewEnabled) {
        await proposeCrmErasure(selected.id, decisionNote)
        await refresh()
      } else {
        setPreviewItems((current) =>
          current.map((item) =>
            item.id === selected.id
              ? {
                  ...item,
                  status: 'approval_required' as const,
                  proposalReason: decisionNote.trim(),
                  proposerName: 'You (current operator)',
                }
              : item,
          ),
        )
      }
      setDecisionNote('')
      setNotice('Erasure proposed. A different current Elevated Admin must decide it.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The erasure could not be proposed.')
    } finally {
      setSaving(false)
    }
  }

  async function decide(approve: boolean) {
    clearMessages()
    if (!selected || decisionNote.trim().length < 3) {
      setError('Enter an independent decision note of at least 3 characters.')
      return
    }
    setSaving(true)
    try {
      if (!previewEnabled) {
        await decideCrmErasure(selected.id, approve, decisionNote)
        await refresh()
      } else {
        setPreviewItems((current) =>
          current.map((item) =>
            item.id === selected.id
              ? {
                  ...item,
                  status: approve ? ('approved' as const) : ('rejected' as const),
                  approverName: approve ? 'You (independent approver)' : item.approverName,
                }
              : item,
          ),
        )
      }
      setDecisionNote('')
      setNotice(
        approve
          ? 'Erasure approved for the trusted worker. Student and academic records remain outside scope.'
          : 'Erasure rejected with an attributable decision note.',
      )
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'The erasure decision could not be recorded.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function placeHold(event: FormEvent) {
    event.preventDefault()
    clearMessages()
    if (!selected || holdNote.trim().length < 3 || !holdReviewBy) {
      setError('Enter a hold reason and a review date within 90 days.')
      return
    }
    const reviewAt = new Date(holdReviewBy).toISOString()
    setSaving(true)
    try {
      let holdId = 'preview-new-hold'
      if (!previewEnabled) {
        holdId = await placeCrmPrivacyHold({
          enquiryId: selected.enquiryId,
          reasonCode: 'active_investigation',
          note: holdNote,
          reviewBy: reviewAt,
        })
        await refresh()
      } else {
        setPreviewItems((current) =>
          current.map((item) =>
            item.id === selected.id
              ? { ...item, lifecycleState: 'held' as const, holdId, holdReviewBy: reviewAt }
              : item,
          ),
        )
      }
      setHoldNote('')
      setHoldReviewBy('')
      setNotice(
        'Temporary hold placed. It must be reviewed or deliberately renewed within 90 days.',
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The temporary hold could not be placed.')
    } finally {
      setSaving(false)
    }
  }

  async function releaseHold() {
    clearMessages()
    if (!selected?.holdId || releaseReason.trim().length < 3) {
      setError('Enter a release reason of at least 3 characters.')
      return
    }
    setSaving(true)
    try {
      if (!previewEnabled) {
        await releaseCrmPrivacyHold(selected.holdId, releaseReason)
        await refresh()
      } else {
        setPreviewItems((current) =>
          current.map((item) =>
            item.id === selected.id
              ? {
                  ...item,
                  lifecycleState: 'restricted' as const,
                  holdId: null,
                  holdReviewBy: null,
                }
              : item,
          ),
        )
      }
      setReleaseReason('')
      setNotice('Temporary hold released. Its attributable history was preserved.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The hold could not be released.')
    } finally {
      setSaving(false)
    }
  }

  if (!previewEnabled && casesQuery.isPending) {
    return (
      <section className={styles.state} aria-live="polite">
        <p className="eyebrow">Privacy operations</p>
        <h1>Checking protected cases…</h1>
        <p>We are rechecking your current MFA assurance and privacy authority.</p>
      </section>
    )
  }

  if (!previewEnabled && casesQuery.isError) {
    return (
      <section className={styles.state} aria-labelledby="privacy-error-title">
        <p className="eyebrow">Privacy operations</p>
        <h1 id="privacy-error-title">Privacy operations could not be loaded.</h1>
        <Callout tone="warning" icon="warning">
          No case or personal data was exposed. Check your current MFA session and privacy grant.
        </Callout>
        <Button onClick={() => void casesQuery.refetch()}>Try again</Button>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-labelledby="privacy-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            CRM governance · {previewEnabled ? 'Local preview' : 'Live data'}
          </p>
          <h1 id="privacy-title">Protect every enquiry through its full lifecycle.</h1>
          <p>
            Verify requests, correct only the intended field, and require a different approver
            before CRM personal data can be erased.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Badge tone="warning">MFA required</Badge>
          <Link
            className={styles.workspaceLink}
            to={`/staff/crm${previewEnabled ? '?preview=1' : ''}`}
          >
            Assigned CRM
          </Link>
        </div>
      </header>

      <Callout tone="accent" icon="note">
        This workspace never stores identity-document images. CRM erasure does not delete a
        canonical student, enrolment, coursework, submissions, feedback, or payment records.
      </Callout>

      <div className={styles.toolbar}>
        <div className={styles.queueTabs} aria-label="Privacy case queues">
          {(Object.keys(queueCopy) as CrmPrivacyQueue[]).map((queueName) => (
            <Button
              aria-pressed={queue === queueName}
              key={queueName}
              onClick={() => {
                setQueue(queueName)
                setSelectedId('')
                clearMessages()
              }}
              size="sm"
              variant={queue === queueName ? 'primary' : 'secondary'}
            >
              {queueCopy[queueName]}
            </Button>
          ))}
        </div>
        <Button onClick={() => setShowNewCase((current) => !current)} size="sm" variant="secondary">
          {showNewCase ? 'Close request form' : 'Record verified request'}
        </Button>
      </div>

      {showNewCase ? (
        <Card className={styles.newCaseCard}>
          <form className={styles.formGrid} onSubmit={(event) => void submitNewCase(event)}>
            <div className={styles.sectionHeading}>
              <div>
                <p className="eyebrow">New privacy case</p>
                <h2>Record a verified request</h2>
              </div>
              <Badge tone="neutral">No document uploads</Badge>
            </div>
            <Input
              label="CRM enquiry reference"
              onChange={(event) => setNewEnquiryId(event.target.value)}
              placeholder="Enquiry UUID"
              value={newEnquiryId}
            />
            <div className={styles.twoColumns}>
              <label>
                Request type
                <select
                  value={newKind}
                  onChange={(event) => setNewKind(event.target.value as CrmPrivacyCaseKind)}
                >
                  <option value="correction">Correction</option>
                  <option value="erasure">Erasure</option>
                </select>
              </label>
              <label>
                Requester relationship
                <select
                  value={newRelationship}
                  onChange={(event) =>
                    setNewRelationship(event.target.value as CrmPrivacyRequesterRelationship)
                  }
                >
                  <option value="self">Self</option>
                  <option value="parent_guardian">Parent or guardian</option>
                  <option value="authorized_representative">Authorized representative</option>
                </select>
              </label>
            </div>
            <label>
              Verification method
              <select
                value={newVerification}
                onChange={(event) =>
                  setNewVerification(event.target.value as CrmPrivacyVerificationMethod)
                }
              >
                <option value="existing_contact_callback">Existing contact callback</option>
                <option value="member_account">Member account</option>
                <option value="in_person">In person</option>
                <option value="authorized_representative">Authorized representative</option>
              </select>
            </label>
            <label>
              Request summary
              <textarea
                maxLength={500}
                onChange={(event) => setNewSummary(event.target.value)}
                placeholder="Record the requested outcome, not a copy of an identity document."
                rows={3}
                value={newSummary}
              />
            </label>
            <Button disabled={saving} type="submit">
              {saving ? 'Recording…' : 'Record verified request'}
            </Button>
          </form>
        </Card>
      ) : null}

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
        <aside className={styles.queuePanel} aria-label={queueCopy[queue]}>
          <div className={styles.queueHeading}>
            <div>
              <p className="eyebrow">{queueCopy[queue]}</p>
              <h2>{cases.length} cases</h2>
            </div>
            <p>Oldest requests are shown first.</p>
          </div>
          {cases.length ? (
            <div className={styles.queueList}>
              {cases.map((item) => (
                <button
                  aria-pressed={selected?.id === item.id}
                  className={selected?.id === item.id ? styles.selectedItem : styles.queueItem}
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id)
                    setDecisionNote('')
                    setCorrectedValue('')
                    clearMessages()
                  }}
                  type="button"
                >
                  <span>
                    <strong>{item.subjectName}</strong>
                    <small>
                      {label(item.kind)} · {item.maskedContact}
                    </small>
                  </span>
                  <Badge tone={statusTone(item.status)}>{label(item.status)}</Badge>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState description="There are no cases in this queue." title="Queue is clear" />
          )}
        </aside>

        <div className={styles.detail}>
          {selected ? (
            <>
              <Card className={styles.summaryCard}>
                <div className={styles.sectionHeading}>
                  <div>
                    <p className="eyebrow">Verified {label(selected.kind)} request</p>
                    <h2>{selected.subjectName}</h2>
                  </div>
                  <Badge tone={statusTone(selected.status)}>{label(selected.status)}</Badge>
                </div>
                <p className={styles.summary}>{selected.requestSummary}</p>
                <dl className={styles.meta}>
                  <div>
                    <dt>Masked contact</dt>
                    <dd>{selected.maskedContact}</dd>
                  </div>
                  <div>
                    <dt>Requester</dt>
                    <dd>{label(selected.requesterRelationship)}</dd>
                  </div>
                  <div>
                    <dt>Verified through</dt>
                    <dd>{label(selected.verificationMethod)}</dd>
                  </div>
                  <div>
                    <dt>Lifecycle</dt>
                    <dd>{label(selected.lifecycleState)}</dd>
                  </div>
                  <div>
                    <dt>Requested</dt>
                    <dd>{dateTime(selected.requestedAt)}</dd>
                  </div>
                  <div>
                    <dt>Case expires</dt>
                    <dd>{dateTime(selected.expiresAt)}</dd>
                  </div>
                </dl>
              </Card>

              {selected.kind === 'correction' && selected.status === 'under_review' ? (
                <Card>
                  <form
                    className={styles.formGrid}
                    onSubmit={(event) => void submitCorrection(event)}
                  >
                    <div className={styles.sectionHeading}>
                      <div>
                        <p className="eyebrow">Field-scoped change</p>
                        <h2>Apply correction</h2>
                      </div>
                      <Badge tone="neutral">Prior value fingerprinted</Badge>
                    </div>
                    <label>
                      Field to correct
                      <select
                        value={correctionField}
                        onChange={(event) =>
                          setCorrectionField(event.target.value as CrmPrivacyCorrectionField)
                        }
                      >
                        {(Object.keys(correctionFieldCopy) as CrmPrivacyCorrectionField[]).map(
                          (field) => (
                            <option key={field} value={field}>
                              {correctionFieldCopy[field]}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <Input
                      label="Corrected value"
                      onChange={(event) => setCorrectedValue(event.target.value)}
                      value={correctedValue}
                    />
                    <Input
                      label="Correction reason"
                      onChange={(event) => setCorrectionReason(event.target.value)}
                      value={correctionReason}
                    />
                    <Button disabled={saving} type="submit">
                      {saving ? 'Applying…' : 'Apply verified correction'}
                    </Button>
                  </form>
                </Card>
              ) : null}

              {selected.kind === 'erasure' ? (
                <Card>
                  <div className={styles.sectionHeading}>
                    <div>
                      <p className="eyebrow">Server-prepared dry run</p>
                      <h2>Erasure impact</h2>
                    </div>
                    <Badge tone="warning">Irreversible</Badge>
                  </div>
                  {impactQuery.isPending && !previewEnabled ? (
                    <p>Preparing protected impact…</p>
                  ) : null}
                  {impactQuery.isError && !previewEnabled ? (
                    <Callout tone="warning" icon="warning">
                      Impact could not be loaded. Do not decide this case yet.
                    </Callout>
                  ) : null}
                  {impacts?.length ? (
                    <div className={styles.impactList}>
                      {impacts.map((impact) => (
                        <div className={styles.impactRow} key={impact.category}>
                          <div>
                            <strong>{impact.category}</strong>
                            <span>{impact.plannedAction}</span>
                          </div>
                          <div className={styles.impactCount}>
                            <Badge tone={impact.protectedRecord ? 'accent' : 'neutral'}>
                              {impact.recordCount} records
                            </Badge>
                            {impact.protectedRecord ? <small>Protected boundary</small> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ) : null}

              {selected.kind === 'erasure' && selected.status === 'under_review' ? (
                <Card>
                  <form
                    className={styles.formGrid}
                    onSubmit={(event) => void submitProposal(event)}
                  >
                    <div>
                      <p className="eyebrow">First person</p>
                      <h2>Propose erasure</h2>
                    </div>
                    <label>
                      Scope and reason
                      <textarea
                        maxLength={500}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        rows={3}
                        value={decisionNote}
                      />
                    </label>
                    <Button disabled={saving} type="submit">
                      Send for independent approval
                    </Button>
                  </form>
                </Card>
              ) : null}

              {selected.kind === 'erasure' && selected.status === 'approval_required' ? (
                <Card>
                  <div className={styles.formGrid}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <p className="eyebrow">Second person</p>
                        <h2>Independent decision</h2>
                      </div>
                      <Badge tone="accent">
                        Proposed by {selected.proposerName ?? 'another operator'}
                      </Badge>
                    </div>
                    <p>{selected.proposalReason}</p>
                    <label>
                      Decision note
                      <textarea
                        maxLength={500}
                        onChange={(event) => setDecisionNote(event.target.value)}
                        rows={3}
                        value={decisionNote}
                      />
                    </label>
                    <div className={styles.buttonRow}>
                      <Button disabled={saving} onClick={() => void decide(true)}>
                        Approve erasure
                      </Button>
                      <Button
                        disabled={saving}
                        onClick={() => void decide(false)}
                        variant="secondary"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : null}

              {selected.status === 'approved' ? (
                <Callout tone="success" icon="success">
                  Approved by {selected.approverName ?? 'an independent administrator'}. The trusted
                  worker will recheck both people's current authority before execution.
                </Callout>
              ) : null}

              {selected.holdId ? (
                <Card>
                  <div className={styles.formGrid}>
                    <div className={styles.sectionHeading}>
                      <div>
                        <p className="eyebrow">Temporary hold</p>
                        <h2>Execution paused</h2>
                      </div>
                      <Badge tone="warning">Review {dateTime(selected.holdReviewBy)}</Badge>
                    </div>
                    <Input
                      label="Hold release reason"
                      onChange={(event) => setReleaseReason(event.target.value)}
                      value={releaseReason}
                    />
                    <Button
                      disabled={saving}
                      onClick={() => void releaseHold()}
                      variant="secondary"
                    >
                      Release hold
                    </Button>
                  </div>
                </Card>
              ) : selected.status !== 'completed' && selected.status !== 'rejected' ? (
                <Card>
                  <form className={styles.formGrid} onSubmit={(event) => void placeHold(event)}>
                    <div>
                      <p className="eyebrow">Exception control</p>
                      <h2>Place a temporary hold</h2>
                    </div>
                    <Input
                      label="Hold reason"
                      onChange={(event) => setHoldNote(event.target.value)}
                      value={holdNote}
                    />
                    <Input
                      label="Review by"
                      onChange={(event) => setHoldReviewBy(event.target.value)}
                      type="datetime-local"
                      value={holdReviewBy}
                    />
                    <Button disabled={saving} type="submit" variant="secondary">
                      Place hold
                    </Button>
                  </form>
                </Card>
              ) : null}
            </>
          ) : (
            <EmptyState
              description="Choose a case from the queue to inspect its protected workflow."
              title="No case selected"
            />
          )}
        </div>
      </div>
    </section>
  )
}
