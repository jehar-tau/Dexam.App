import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import {
  distributeAssignment,
  getAssignmentDistributionTargets,
  getAssignmentDistributionWorkspace,
  type AssignmentDistributionWorkspace,
  type DistributionTarget,
} from '../features/content/assignmentDistribution'
import styles from './AssignmentDistributionPage.module.css'

const previewWorkspace: AssignmentDistributionWorkspace = {
  offerings: [{ id: 'preview-offering', title: 'Design Entrance Foundation' }],
  cohorts: [
    { id: 'preview-cohort', offeringId: 'preview-offering', name: 'Studio Batch · Autumn 2026' },
  ],
  assignments: [
    {
      id: 'preview-assignment-version',
      offeringId: 'preview-offering',
      code: 'PERSPECTIVE_ROOM',
      versionNumber: 1,
      groupName: 'Perspective & Objects',
      title: 'Draw a one-point perspective room',
    },
  ],
  releases: [
    {
      id: 'preview-release',
      assignmentVersionId: 'preview-assignment-version',
      offeringId: 'preview-offering',
      targetKind: 'selected',
      dueAt: null,
      status: 'active',
      releaseNote: 'Extra practice for selected students',
      releasedAt: '2026-10-09T09:00:00.000Z',
    },
  ],
}
const previewTargets: DistributionTarget[] = [
  {
    enrollmentId: 'preview-enrolment-one',
    memberId: 'DXM-2K3M9Q2RW5TY',
    displayName: 'Aarohi Deshmukh',
    cohortId: 'preview-cohort',
    cohortName: 'Studio Batch · Autumn 2026',
  },
  {
    enrollmentId: 'preview-enrolment-two',
    memberId: 'DXM-3K3M9Q2RW5TY',
    displayName: 'Kabir Mehta',
    cohortId: 'preview-cohort',
    cohortName: 'Studio Batch · Autumn 2026',
  },
]

export function AssignmentDistributionPage() {
  const [searchParams] = useSearchParams()
  const previewEnabled =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const workspaceQuery = useQuery({
    queryKey: ['assignment-distribution'],
    queryFn: getAssignmentDistributionWorkspace,
    enabled: !previewEnabled,
    retry: false,
  })
  const workspace = previewEnabled ? previewWorkspace : workspaceQuery.data
  const firstOffering = workspace?.offerings[0]?.id ?? ''
  const [offeringId, setOfferingId] = useState('')
  const activeOfferingId = offeringId || firstOffering
  const [assignmentVersionId, setAssignmentVersionId] = useState('')
  const [targetMode, setTargetMode] = useState<'cohort' | 'selected'>('cohort')
  const [cohortId, setCohortId] = useState('')
  const [selectedEnrollmentIds, setSelectedEnrollmentIds] = useState<string[]>([])
  const [dueAt, setDueAt] = useState('')
  const [releaseNote, setReleaseNote] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const targetsQuery = useQuery({
    queryKey: ['assignment-distribution-targets', activeOfferingId],
    queryFn: () =>
      previewEnabled
        ? Promise.resolve(previewTargets)
        : getAssignmentDistributionTargets(activeOfferingId),
    enabled: Boolean(activeOfferingId),
    retry: false,
  })

  const assignments = useMemo(
    () =>
      workspace?.assignments.filter((assignment) => assignment.offeringId === activeOfferingId) ??
      [],
    [workspace, activeOfferingId],
  )
  const cohorts =
    workspace?.cohorts.filter((cohort) => cohort.offeringId === activeOfferingId) ?? []
  const effectiveAssignmentId = assignmentVersionId || assignments[0]?.id || ''
  const effectiveCohortId = cohortId || cohorts[0]?.id || ''

  function toggleTarget(enrollmentId: string) {
    setSelectedEnrollmentIds((current) =>
      current.includes(enrollmentId)
        ? current.filter((id) => id !== enrollmentId)
        : [...current, enrollmentId],
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setStatus('')
    if (
      !effectiveAssignmentId ||
      !releaseNote.trim() ||
      (targetMode === 'cohort' ? !effectiveCohortId : selectedEnrollmentIds.length === 0)
    ) {
      setError('Choose an assignment and target, then add a release note.')
      return
    }
    setSubmitting(true)
    try {
      if (!previewEnabled) {
        await distributeAssignment({
          assignmentVersionId: effectiveAssignmentId,
          cohortId: targetMode === 'cohort' ? effectiveCohortId : null,
          enrollmentIds: targetMode === 'selected' ? selectedEnrollmentIds : [],
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          releaseNote,
          requestKey: crypto.randomUUID(),
        })
        await workspaceQuery.refetch()
      }
      setStatus(
        `Assignment released to ${targetMode === 'cohort' ? 'the cohort' : `${selectedEnrollmentIds.length} selected students`}.`,
      )
      setReleaseNote('')
      setSelectedEnrollmentIds([])
      setDueAt('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The assignment could not be released.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!previewEnabled && workspaceQuery.isPending)
    return (
      <section className={styles.state}>
        <p className="eyebrow">Assignment distribution</p>
        <h1>Loading release controls…</h1>
      </section>
    )
  if (!workspace)
    return (
      <section className={styles.state}>
        <p className="eyebrow">Assignment distribution</p>
        <h1>Distribution could not be loaded.</h1>
        <Button onClick={() => void workspaceQuery.refetch()}>Try again</Button>
      </section>
    )

  return (
    <section className={styles.workspace} aria-labelledby="distribution-title">
      <header className={styles.pageHeader}>
        <div>
          <p className="eyebrow">
            Academic operations · {previewEnabled ? 'Local preview' : 'Live data'}
          </p>
          <h1 id="distribution-title">Assignment distribution.</h1>
          <p>Give one published assignment version to a cohort or selected active students.</p>
        </div>
        <Badge tone="accent">Deliberate release</Badge>
      </header>
      <div className={styles.layout}>
        <form className={styles.releaseForm} onSubmit={(event) => void submit(event)}>
          <div className={styles.field}>
            <label htmlFor="distribution-offering">Programme</label>
            <select
              id="distribution-offering"
              onChange={(event) => {
                setOfferingId(event.target.value)
                setAssignmentVersionId('')
                setCohortId('')
                setSelectedEnrollmentIds([])
              }}
              value={activeOfferingId}
            >
              {workspace.offerings.map((offering) => (
                <option key={offering.id} value={offering.id}>
                  {offering.title}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="distribution-assignment">Published assignment</label>
            <select
              id="distribution-assignment"
              onChange={(event) => setAssignmentVersionId(event.target.value)}
              value={effectiveAssignmentId}
            >
              {assignments.map((assignment) => (
                <option key={assignment.id} value={assignment.id}>
                  {assignment.title} · v{assignment.versionNumber}
                </option>
              ))}
            </select>
          </div>
          <fieldset>
            <legend>Release to</legend>
            <label>
              <input
                checked={targetMode === 'cohort'}
                name="target-mode"
                onChange={() => setTargetMode('cohort')}
                type="radio"
              />{' '}
              One cohort
            </label>
            <label>
              <input
                checked={targetMode === 'selected'}
                name="target-mode"
                onChange={() => setTargetMode('selected')}
                type="radio"
              />{' '}
              Selected students
            </label>
          </fieldset>
          {targetMode === 'cohort' ? (
            <div className={styles.field}>
              <label htmlFor="distribution-cohort">Cohort</label>
              <select
                id="distribution-cohort"
                onChange={(event) => setCohortId(event.target.value)}
                value={effectiveCohortId}
              >
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className={styles.targetList} aria-label="Select students">
              {targetsQuery.data?.map((target) => (
                <label key={target.enrollmentId}>
                  <input
                    checked={selectedEnrollmentIds.includes(target.enrollmentId)}
                    onChange={() => toggleTarget(target.enrollmentId)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{target.displayName ?? 'Student'}</strong>
                    <small>
                      {target.memberId} · {target.cohortName ?? 'Independent enrolment'}
                    </small>
                  </span>
                </label>
              ))}
            </div>
          )}
          <Input
            hint="Optional. Late submissions remain possible and are marked late."
            id="distribution-due"
            label="Due date and time"
            onChange={(event) => setDueAt(event.target.value)}
            type="datetime-local"
            value={dueAt}
          />
          <div className={styles.field}>
            <label htmlFor="distribution-note">Release note</label>
            <textarea
              id="distribution-note"
              maxLength={500}
              onChange={(event) => setReleaseNote(event.target.value)}
              placeholder="Why is this assignment being released?"
              required
              rows={4}
              value={releaseNote}
            />
          </div>
          <Callout tone="neutral">
            This release pins the current assignment version. Future content edits will not change
            what these students receive.
          </Callout>
          {error ? <Callout tone="warning">{error}</Callout> : null}
          {status ? <Callout tone="success">{status}</Callout> : null}
          <Button disabled={submitting || assignments.length === 0} type="submit">
            {submitting ? 'Releasing…' : 'Release assignment'}
          </Button>
        </form>
        <aside className={styles.releaseHistory}>
          <div>
            <p className="eyebrow">Audit view</p>
            <h2>Recent releases</h2>
          </div>
          {workspace.releases.length === 0 ? (
            <EmptyState
              title="No releases yet"
              description="The first deliberate assignment release will appear here."
            />
          ) : (
            workspace.releases.map((release) => {
              const assignment = workspace.assignments.find(
                (item) => item.id === release.assignmentVersionId,
              )
              return (
                <Card key={release.id}>
                  <div className={styles.releaseHeading}>
                    <strong>{assignment?.title ?? 'Published assignment'}</strong>
                    <Badge tone={release.status === 'active' ? 'success' : 'neutral'}>
                      {release.status}
                    </Badge>
                  </div>
                  <p>
                    {release.targetKind === 'cohort' ? 'Cohort release' : 'Selected students'} ·{' '}
                    {release.dueAt
                      ? `Due ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(release.dueAt))}`
                      : 'No deadline'}
                  </p>
                  <small>{release.releaseNote}</small>
                </Card>
              )
            })
          )}
        </aside>
      </div>
    </section>
  )
}
