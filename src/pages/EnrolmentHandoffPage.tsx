import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { Avatar, Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import {
  approveEnrolmentHandoff,
  type EnrolmentApproval,
  type EnrolmentChoice,
  type EnrolmentHandoff,
  type EnrolmentIdentityCandidate,
  type EnrolmentStudent,
  type IdentityCandidateDecision,
  listEnrolmentHandoffChoices,
  listEnrolmentHandoffs,
  listEnrolmentIdentityCandidates,
  returnEnrolmentHandoff,
  searchEnrolmentStudents,
  type StudentResolutionMode,
} from '../features/enrolment/enrolmentHandoff'
import styles from './EnrolmentHandoffPage.module.css'

const previewHandoffs: EnrolmentHandoff[] = [
  {
    requestId: 'preview-request-meera',
    enquiryId: 'preview-enquiry-meera',
    subjectName: 'Meera Kulkarni',
    contactName: 'Kavita Kulkarni',
    contactRelationship: 'guardian',
    contactKind: 'phone',
    contactValue: '+91 98111 12222',
    interestSummary: 'NID and UCEED foundation preparation',
    targetIntake: '2027 entrance',
    requestNote: 'Counselling complete. Guardian confirmed Foundation 2027.',
    salesOwnerName: 'Riya Shah',
    pendingIdentityMatches: 1,
    requestedAt: '2026-10-10T09:15:00.000Z',
  },
  {
    requestId: 'preview-request-rishi',
    enquiryId: 'preview-enquiry-rishi',
    subjectName: 'Rishi Bhat',
    contactName: 'Rishi Bhat',
    contactRelationship: 'self',
    contactKind: 'email',
    contactValue: 'rishi.bhat@example.test',
    interestSummary: 'NATA drawing and aptitude preparation',
    targetIntake: '2027 entrance',
    requestNote: 'Student selected the weekend studio cohort.',
    salesOwnerName: 'Sameer Joshi',
    pendingIdentityMatches: 0,
    requestedAt: '2026-10-11T05:30:00.000Z',
  },
]

const previewCandidates: EnrolmentIdentityCandidate[] = [
  {
    candidateId: 'preview-candidate-meera',
    newPersonName: 'Meera Kulkarni',
    existingPersonId: 'preview-student-anika',
    existingDisplayName: 'Anika Kulkarni',
    existingMemberId: 'DXM-7K3M9Q2RW5TY',
    evidenceKind: 'phone',
    contactValue: '+91 98111 12222',
    accountClaimed: true,
  },
]

const previewStudents: EnrolmentStudent[] = [
  {
    personId: 'preview-student-anika',
    memberId: 'DXM-7K3M9Q2RW5TY',
    displayName: 'Anika Kulkarni',
    accountClaimed: true,
    openEnrollmentCount: 1,
    openOfferingTitles: ['Portfolio Sprint'],
  },
  {
    personId: 'preview-student-dev',
    memberId: 'DXM-8N4P6R2TW7YH',
    displayName: 'Dev Malhotra',
    accountClaimed: false,
    openEnrollmentCount: 0,
    openOfferingTitles: [],
  },
]

const previewChoices: EnrolmentChoice[] = [
  {
    offeringId: 'preview-offering-foundation',
    offeringTitle: 'Design Entrance Foundation 2027',
    cohortId: null,
    cohortName: null,
  },
  {
    offeringId: 'preview-offering-foundation',
    offeringTitle: 'Design Entrance Foundation 2027',
    cohortId: 'preview-cohort-weekend',
    cohortName: 'Weekend Studio A',
  },
  {
    offeringId: 'preview-offering-portfolio',
    offeringTitle: 'Portfolio Sprint',
    cohortId: null,
    cohortName: null,
  },
]

function dateTime(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(value))
}

function makeChoiceValue(choice: EnrolmentChoice) {
  return `${choice.offeringId}|${choice.cohortId ?? ''}`
}

export function EnrolmentHandoffPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const [previewQueue, setPreviewQueue] = useState(previewHandoffs)
  const [selectedRequestId, setSelectedRequestId] = useState('')
  const [queueSearch, setQueueSearch] = useState('')
  const [resolutionMode, setResolutionMode] = useState<StudentResolutionMode>('new')
  const [candidateDecisions, setCandidateDecisions] = useState<
    Record<string, IdentityCandidateDecision>
  >({})
  const [studentSearchDraft, setStudentSearchDraft] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [choiceValue, setChoiceValue] = useState('')
  const [reason, setReason] = useState('')
  const [returnReason, setReturnReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [approval, setApproval] = useState<EnrolmentApproval | null>(null)

  const queueQuery = useQuery({
    queryKey: ['enrolment-handoffs'],
    queryFn: () => listEnrolmentHandoffs(25),
    enabled: !previewEnabled,
    retry: false,
  })
  const choicesQuery = useQuery({
    queryKey: ['enrolment-handoff-choices'],
    queryFn: listEnrolmentHandoffChoices,
    enabled: !previewEnabled,
    retry: false,
  })
  const studentQuery = useQuery({
    queryKey: ['enrolment-student-search', studentSearch],
    queryFn: () => searchEnrolmentStudents(studentSearch),
    enabled: !previewEnabled && resolutionMode === 'existing' && studentSearch.length >= 2,
    retry: false,
  })

  const allQueue = useMemo(
    () => (previewEnabled ? previewQueue : (queueQuery.data ?? [])),
    [previewEnabled, previewQueue, queueQuery.data],
  )
  const queue = useMemo(() => {
    const search = queueSearch.trim().toLocaleLowerCase()
    if (!search) return allQueue
    return allQueue.filter(
      (item) =>
        item.subjectName.toLocaleLowerCase().includes(search) ||
        item.contactName.toLocaleLowerCase().includes(search) ||
        item.contactValue.toLocaleLowerCase().includes(search),
    )
  }, [allQueue, queueSearch])
  const selected =
    allQueue.find((item) => item.requestId === selectedRequestId) ?? allQueue[0] ?? null
  const effectiveRequestId = selected?.requestId ?? ''
  const candidatesQuery = useQuery({
    queryKey: ['enrolment-identity-candidates', effectiveRequestId],
    queryFn: () => listEnrolmentIdentityCandidates(effectiveRequestId),
    enabled: !previewEnabled && Boolean(effectiveRequestId),
    retry: false,
  })
  const candidates = previewEnabled
    ? selected?.requestId === 'preview-request-meera'
      ? previewCandidates
      : []
    : (candidatesQuery.data ?? [])
  const choices = previewEnabled ? previewChoices : (choicesQuery.data ?? [])
  const students = useMemo(() => {
    if (!previewEnabled) return studentQuery.data ?? []
    const search = studentSearch.toLocaleLowerCase()
    if (search.length < 2) return []
    return previewStudents.filter(
      (student) =>
        student.displayName.toLocaleLowerCase().includes(search) ||
        student.memberId.toLocaleLowerCase().includes(search),
    )
  }, [previewEnabled, studentQuery.data, studentSearch])
  const selectedStudent = students.find((student) => student.personId === selectedStudentId) ?? null
  const selectedChoice = choices.find((choice) => makeChoiceValue(choice) === choiceValue) ?? null

  function resetResolution() {
    setResolutionMode('new')
    setCandidateDecisions({})
    setStudentSearchDraft('')
    setStudentSearch('')
    setSelectedStudentId('')
    setChoiceValue('')
    setReason('')
    setReturnReason('')
    setError('')
  }

  function searchStudents() {
    const term = studentSearchDraft.trim()
    if (term.length < 2) {
      setError('Enter at least 2 characters of the student name or Member ID.')
      return
    }
    setError('')
    setStudentSearch(term)
    setSelectedStudentId('')
  }

  function removeFromQueue(requestId: string) {
    if (previewEnabled)
      setPreviewQueue((current) => current.filter((item) => item.requestId !== requestId))
    else void queueQuery.refetch()
    setSelectedRequestId('')
    resetResolution()
  }

  async function submitReturn(event: FormEvent) {
    event.preventDefault()
    if (!selected || returnReason.trim().length < 3) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!previewEnabled) await returnEnrolmentHandoff(selected.requestId, returnReason)
      setNotice(`${selected.subjectName} was returned to Sales. No student access was created.`)
      removeFromQueue(selected.requestId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The handoff could not be returned.')
    } finally {
      setBusy(false)
    }
  }

  async function submitApproval(event: FormEvent) {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!selected) return
    if (candidates.some((candidate) => !candidateDecisions[candidate.candidateId])) {
      setError('Classify every possible identity match before approval.')
      return
    }
    if (resolutionMode === 'existing' && !selectedStudent) {
      setError('Search for and select the canonical existing student.')
      return
    }
    if (!selectedChoice) {
      setError('Select the approved course and cohort context.')
      return
    }
    if (reason.trim().length < 3) {
      setError('Enter an approval reason of at least 3 characters.')
      return
    }
    setBusy(true)
    try {
      const result = previewEnabled
        ? {
            personId: selectedStudent?.personId ?? 'preview-new-student',
            memberId: selectedStudent?.memberId ?? 'DXM-3F7K9M2RW5TY',
            enrollmentId: 'preview-enrollment-created',
            enrollmentStatus: selectedStudent?.accountClaimed
              ? ('active' as const)
              : ('approved' as const),
            activationRequired: !selectedStudent?.accountClaimed,
          }
        : await approveEnrolmentHandoff({
            requestId: selected.requestId,
            resolutionMode,
            existingPersonId: selectedStudent?.personId ?? null,
            offeringId: selectedChoice.offeringId,
            cohortId: selectedChoice.cohortId,
            reason,
            candidateDecisions: candidates.map((candidate) => ({
              candidateId: candidate.candidateId,
              decision: candidateDecisions[candidate.candidateId]!,
            })),
          })
      setApproval(result)
      setNotice(
        result.activationRequired
          ? `${selected.subjectName} was approved and added to the activation queue.`
          : `${selected.subjectName} was linked to the existing account and enrolled immediately.`,
      )
      removeFromQueue(selected.requestId)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The handoff could not be approved.')
    } finally {
      setBusy(false)
    }
  }

  const loading = !previewEnabled && (queueQuery.isPending || choicesQuery.isPending)
  const loadFailed =
    !previewEnabled && (queueQuery.isError || choicesQuery.isError || candidatesQuery.isError)

  if (loading) {
    return (
      <section className={styles.state}>
        <p className="eyebrow">Enrolment handoffs</p>
        <h1>Loading the secure inbox…</h1>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-labelledby="handoff-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Enrolment operations · {previewEnabled ? 'Local preview' : 'Live data'}
          </p>
          <h1 id="handoff-title">Review enrolment handoffs.</h1>
          <p>
            Resolve identity and course access one student at a time. Nothing is merged
            automatically.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Badge tone="accent">Enrolment Operator</Badge>
          <Link
            className={styles.workspaceLink}
            to={`/staff/enrolments${previewEnabled ? '?preview=1' : ''}`}
          >
            Activation queue
          </Link>
        </div>
      </header>

      {notice ? (
        <Callout tone="success" icon="success">
          <strong>{notice}</strong>
          {approval ? (
            <span>
              Member ID: {approval.memberId} · Status: {approval.enrollmentStatus}
            </span>
          ) : null}
        </Callout>
      ) : null}
      {error ? (
        <Callout tone="warning" icon="warning">
          <strong>{error}</strong>
        </Callout>
      ) : null}
      {loadFailed ? (
        <Callout tone="warning" icon="warning">
          <strong>The handoff inbox could not be loaded.</strong>
          <span>No protected identity data was exposed.</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void queueQuery.refetch()
              void choicesQuery.refetch()
            }}
          >
            Try again
          </Button>
        </Callout>
      ) : null}

      <div className={styles.layout}>
        <aside className={styles.queue} aria-label="Pending handoffs">
          <div className={styles.queueHeading}>
            <div>
              <h2>Pending</h2>
              <p>
                {queue.length} request{queue.length === 1 ? '' : 's'}
              </p>
            </div>
            <Badge pill tone="warning">
              Oldest first
            </Badge>
          </div>
          <Input
            label="Search pending requests"
            type="search"
            placeholder="Student, contact, phone…"
            maxLength={80}
            value={queueSearch}
            onChange={(event) => setQueueSearch(event.target.value)}
          />
          {queue.length === 0 ? (
            <EmptyState
              title="No matching handoffs"
              description={
                allQueue.length
                  ? 'Clear the search to see pending requests.'
                  : 'Sales review requests will appear here.'
              }
            />
          ) : (
            <div className={styles.queueList}>
              {queue.map((item) => (
                <button
                  className={
                    item.requestId === selected?.requestId
                      ? styles.queueItemActive
                      : styles.queueItem
                  }
                  key={item.requestId}
                  onClick={() => {
                    resetResolution()
                    setNotice('')
                    setApproval(null)
                    setSelectedRequestId(item.requestId)
                  }}
                  type="button"
                >
                  <span className={styles.queueName}>{item.subjectName}</span>
                  <span>{item.interestSummary}</span>
                  <span>{dateTime(item.requestedAt)}</span>
                  {item.pendingIdentityMatches ? (
                    <Badge tone="warning">{item.pendingIdentityMatches} possible match</Badge>
                  ) : (
                    <Badge tone="neutral">No match flagged</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className={styles.detail}>
          {!selected ? (
            <EmptyState
              title="The handoff queue is clear"
              description="Completed and returned requests remain in audit history, not this active inbox."
            />
          ) : (
            <>
              <Card className={styles.summaryCard}>
                <div className={styles.identityHeader}>
                  <Avatar name={selected.subjectName} size="lg" />
                  <div>
                    <p className="eyebrow">Student prospect</p>
                    <h2>{selected.subjectName}</h2>
                    <p>
                      Requested by {selected.salesOwnerName ?? 'assigned Sales'} ·{' '}
                      {dateTime(selected.requestedAt)}
                    </p>
                  </div>
                </div>
                <dl className={styles.summaryGrid}>
                  <div>
                    <dt>Primary contact</dt>
                    <dd>
                      {selected.contactName} · {selected.contactRelationship}
                    </dd>
                    <dd>{selected.contactValue}</dd>
                  </div>
                  <div>
                    <dt>Interest</dt>
                    <dd>{selected.interestSummary}</dd>
                  </div>
                  <div>
                    <dt>Target intake</dt>
                    <dd>{selected.targetIntake ?? 'Not recorded'}</dd>
                  </div>
                  <div>
                    <dt>Sales handoff note</dt>
                    <dd>{selected.requestNote}</dd>
                  </div>
                </dl>
              </Card>

              <form
                className={styles.approvalForm}
                onSubmit={(event) => void submitApproval(event)}
              >
                <Card className={styles.sectionCard}>
                  <div className={styles.sectionHeading}>
                    <span className={styles.step}>1</span>
                    <div>
                      <h3>Resolve student identity</h3>
                      <p>Choose whether this prospect is a new or existing canonical student.</p>
                    </div>
                  </div>
                  <div className={styles.modeGrid}>
                    <label className={resolutionMode === 'new' ? styles.modeActive : styles.mode}>
                      <input
                        aria-label="Create a new student"
                        checked={resolutionMode === 'new'}
                        name="resolution-mode"
                        onChange={() => {
                          setResolutionMode('new')
                          setSelectedStudentId('')
                        }}
                        type="radio"
                      />
                      <strong>Create a new student</strong>
                      <span>Generate one permanent Member ID after approval.</span>
                    </label>
                    <label
                      className={resolutionMode === 'existing' ? styles.modeActive : styles.mode}
                    >
                      <input
                        aria-label="Use an existing student"
                        checked={resolutionMode === 'existing'}
                        name="resolution-mode"
                        onChange={() => setResolutionMode('existing')}
                        type="radio"
                      />
                      <strong>Use an existing student</strong>
                      <span>Search by name or immutable Member ID.</span>
                    </label>
                  </div>
                  {resolutionMode === 'existing' ? (
                    <div className={styles.studentSearch}>
                      <div className={styles.studentSearchControls}>
                        <Input
                          label="Find existing student"
                          hint="Enter at least 2 characters."
                          value={studentSearchDraft}
                          onChange={(event) => setStudentSearchDraft(event.target.value)}
                          placeholder="Name or DXM-…"
                        />
                        <Button type="button" variant="secondary" onClick={searchStudents}>
                          Search
                        </Button>
                      </div>
                      {studentQuery.isError ? (
                        <Callout tone="warning" icon="warning">
                          Student search failed safely. Try again.
                        </Callout>
                      ) : null}
                      {studentSearch && !studentQuery.isPending && students.length === 0 ? (
                        <p role="status">No matching active students.</p>
                      ) : null}
                      <div className={styles.studentResults}>
                        {students.map((student) => (
                          <label
                            className={
                              student.personId === selectedStudentId
                                ? styles.studentActive
                                : styles.studentResult
                            }
                            key={student.personId}
                          >
                            <input
                              aria-label={`${student.displayName} ${student.memberId}`}
                              checked={student.personId === selectedStudentId}
                              name="existing-student"
                              onChange={() => setSelectedStudentId(student.personId)}
                              type="radio"
                            />
                            <div>
                              <strong>{student.displayName}</strong>
                              <span>
                                {student.memberId} ·{' '}
                                {student.accountClaimed ? 'Account active' : 'Activation required'}
                              </span>
                              {student.openOfferingTitles.length ? (
                                <small>Open: {student.openOfferingTitles.join(', ')}</small>
                              ) : (
                                <small>No open enrolments</small>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>

                <Card className={styles.sectionCard}>
                  <div className={styles.sectionHeading}>
                    <span className={styles.step}>2</span>
                    <div>
                      <h3>Classify possible matches</h3>
                      <p>
                        A shared phone or email is only evidence. It never merges people
                        automatically.
                      </p>
                    </div>
                  </div>
                  {candidatesQuery.isPending && !previewEnabled ? (
                    <p role="status">Loading possible matches…</p>
                  ) : candidates.length === 0 ? (
                    <Callout tone="neutral" icon="note">
                      No weak contact matches were found for this request.
                    </Callout>
                  ) : (
                    <div className={styles.candidates}>
                      {candidates.map((candidate) => (
                        <fieldset className={styles.candidate} key={candidate.candidateId}>
                          <legend>
                            {candidate.newPersonName} ↔ {candidate.existingDisplayName}
                          </legend>
                          <p>
                            {candidate.evidenceKind}:{' '}
                            {candidate.contactValue ?? 'Shared contact evidence'} ·{' '}
                            {candidate.existingMemberId ?? 'No Member ID'}
                          </p>
                          <div className={styles.inlineChoices}>
                            <label>
                              <input
                                aria-label="Different people"
                                checked={
                                  candidateDecisions[candidate.candidateId] === 'distinct_people'
                                }
                                name={`candidate-${candidate.candidateId}`}
                                onChange={() =>
                                  setCandidateDecisions((current) => ({
                                    ...current,
                                    [candidate.candidateId]: 'distinct_people',
                                  }))
                                }
                                type="radio"
                              />
                              Different people
                            </label>
                            <label>
                              <input
                                aria-label="Same person"
                                checked={candidateDecisions[candidate.candidateId] === 'resolved'}
                                name={`candidate-${candidate.candidateId}`}
                                onChange={() =>
                                  setCandidateDecisions((current) => ({
                                    ...current,
                                    [candidate.candidateId]: 'resolved',
                                  }))
                                }
                                type="radio"
                              />
                              Same person
                            </label>
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className={styles.sectionCard}>
                  <div className={styles.sectionHeading}>
                    <span className={styles.step}>3</span>
                    <div>
                      <h3>Choose learning access</h3>
                      <p>Select one active offering and its optional compatible cohort.</p>
                    </div>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="handoff-choice">Course and cohort</label>
                    <select
                      id="handoff-choice"
                      value={choiceValue}
                      onChange={(event) => setChoiceValue(event.target.value)}
                    >
                      <option value="">Select course access</option>
                      {choices.map((choice) => (
                        <option key={makeChoiceValue(choice)} value={makeChoiceValue(choice)}>
                          {choice.offeringTitle} — {choice.cohortName ?? 'Independent enrolment'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="handoff-reason">Approval reason</label>
                    <textarea
                      id="handoff-reason"
                      maxLength={500}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Record what was checked and confirmed."
                    />
                  </div>
                  <Callout tone="accent" icon="note">
                    Approval is atomic: identity, enrolment, and CRM conversion either all succeed
                    or nothing changes.
                  </Callout>
                  <Button disabled={busy} type="submit">
                    {busy ? 'Saving…' : 'Approve enrolment'}
                  </Button>
                </Card>
              </form>

              <form onSubmit={(event) => void submitReturn(event)}>
                <Card className={styles.returnCard}>
                  <div>
                    <p className="eyebrow">Needs correction</p>
                    <h3>Return to Sales</h3>
                    <p>No Member ID or student access will be created.</p>
                  </div>
                  <div className={styles.field}>
                    <label htmlFor="return-reason">Return reason</label>
                    <textarea
                      id="return-reason"
                      maxLength={500}
                      value={returnReason}
                      onChange={(event) => setReturnReason(event.target.value)}
                    />
                  </div>
                  <Button
                    disabled={busy || returnReason.trim().length < 3}
                    type="submit"
                    variant="secondary"
                  >
                    Return request
                  </Button>
                </Card>
              </form>
            </>
          )}
        </main>
      </div>
    </section>
  )
}
