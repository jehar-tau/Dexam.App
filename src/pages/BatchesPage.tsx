import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  addDays,
  assignStudentBatch,
  batchStatuses,
  getBatchStudents,
  getBatchWorkspace,
  istDate,
  saveBatch,
  type Batch,
  type BatchStudent,
  type BatchWorkspace,
} from '../features/enrolment/batches'
import styles from './BatchesPage.module.css'
import fieldStyles from '../components/forms/Input.module.css'

const previewWorkspace: BatchWorkspace = {
  canManage: true,
  serviceTypes: [
    { key: 'end_to_end', label: 'End-to-end learning', defaultDurationDays: 365 },
    { key: 'crash_course', label: 'Crash course', defaultDurationDays: 45 },
    { key: 'portfolio', label: 'Portfolio', defaultDurationDays: 90 },
    { key: 'interview', label: 'Interview preparation', defaultDurationDays: 30 },
  ],
  offerings: [
    {
      id: '00000000-0000-4000-8000-0000000000a1',
      title: 'Design Entrance Foundation',
      canAssign: true,
    },
  ],
  batches: [
    {
      id: '00000000-0000-4000-8000-0000000000b1',
      offeringId: '00000000-0000-4000-8000-0000000000a1',
      code: 'B261201-3F9A2C',
      name: 'Weekend studio · December',
      serviceType: 'end_to_end',
      status: 'active',
      startsAt: '2026-12-01T00:00:00+05:30',
      endsAt: '2027-12-01T00:00:00+05:30',
      revision: 1,
      studentCount: 2,
    },
    {
      id: '00000000-0000-4000-8000-0000000000b2',
      offeringId: '00000000-0000-4000-8000-0000000000a1',
      code: 'B261115-7C1D0E',
      name: 'UCEED crash course · November',
      serviceType: 'crash_course',
      status: 'active',
      startsAt: '2026-11-15T00:00:00+05:30',
      endsAt: '2026-12-30T00:00:00+05:30',
      revision: 1,
      studentCount: 0,
    },
  ],
}
const previewStudents: BatchStudent[] = [
  {
    enrollmentId: '00000000-0000-4000-8000-0000000000c1',
    memberId: 'DXM-2K3M9Q2RW5TY',
    displayName: 'Aarohi Deshmukh',
    batchId: '00000000-0000-4000-8000-0000000000b1',
    movable: true,
  },
  {
    enrollmentId: '00000000-0000-4000-8000-0000000000c2',
    memberId: 'DXM-3K3M9Q2RW5TY',
    displayName: 'Kabir Mehta',
    batchId: '00000000-0000-4000-8000-0000000000b1',
    movable: true,
  },
  {
    enrollmentId: '00000000-0000-4000-8000-0000000000c3',
    memberId: 'DXM-4K3M9Q2RW5TY',
    displayName: 'Meera Iyer',
    batchId: null,
    movable: true,
  },
]

const statusLabels: Record<Batch['status'], string> = {
  planned: 'Planned',
  active: 'Open',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
const dayFormat = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeZone: 'Asia/Kolkata',
})
function day(value: string | null) {
  return value ? dayFormat.format(new Date(value)) : 'Not set'
}
function today() {
  return istDate(new Date().toISOString())
}

type FormState = {
  requestKey: string
  batch: Batch | null
  name: string
  serviceType: string
  startsOn: string
  endsOn: string
  endTouched: boolean
  status: (typeof batchStatuses)[number]
}
function blankForm(workspace: BatchWorkspace): FormState {
  const type = workspace.serviceTypes[0]
  const start = today()
  return {
    requestKey: crypto.randomUUID(),
    batch: null,
    name: '',
    serviceType: type?.key ?? '',
    startsOn: start,
    endsOn: type ? addDays(start, type.defaultDurationDays) : '',
    endTouched: false,
    status: 'active',
  }
}

function BatchForm({
  workspace,
  offeringId,
  editing,
  preview,
  onSaved,
  onCancelEdit,
}: {
  workspace: BatchWorkspace
  offeringId: string
  editing: Batch | null
  preview: boolean
  onSaved: (message: string) => Promise<void>
  onCancelEdit: () => void
}) {
  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          requestKey: crypto.randomUUID(),
          batch: editing,
          name: editing.name,
          serviceType: editing.serviceType ?? workspace.serviceTypes[0]?.key ?? '',
          startsOn: editing.startsAt ? istDate(editing.startsAt) : today(),
          endsOn: editing.endsAt ? istDate(editing.endsAt) : '',
          endTouched: true,
          status: editing.status === 'planned' ? 'active' : editing.status,
        }
      : blankForm(workspace),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const defaultDays = (key: string) =>
    workspace.serviceTypes.find((type) => type.key === key)?.defaultDurationDays

  function update(change: Partial<FormState>) {
    setForm((current) => {
      const next = { ...current, ...change, requestKey: crypto.randomUUID() }
      const days = defaultDays(next.serviceType)
      if (!next.endTouched && days && /^\d{4}-\d{2}-\d{2}$/.test(next.startsOn))
        next.endsOn = addDays(next.startsOn, days)
      return next
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    setError('')
    if (preview) {
      setError('Preview only: batches are not saved.')
      return
    }
    setBusy(true)
    try {
      await saveBatch({
        requestKey: form.requestKey,
        batchId: form.batch?.id ?? null,
        expectedRevision: form.batch?.revision ?? null,
        offeringId,
        name: form.name,
        serviceType: form.serviceType,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        status: form.status,
      })
      await onSaved(form.batch ? 'Batch updated.' : 'Batch created.')
      if (!form.batch) setForm(blankForm(workspace))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The batch could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const days = defaultDays(form.serviceType)
  return (
    <Card>
      <form className={styles.form} onSubmit={(event) => void submit(event)}>
        <h2>{form.batch ? `Edit ${form.batch.name}` : 'Create a batch'}</h2>
        {error ? (
          <Callout tone="warning" icon="warning">
            <p role="alert">{error}</p>
          </Callout>
        ) : null}
        <Input
          label="Batch name"
          hint="Students see this name. They never see the batch dates."
          value={form.name}
          disabled={busy}
          maxLength={160}
          onChange={(event) => update({ name: event.target.value })}
        />
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor="batch-service">
            Service type
          </label>
          <select
            className={fieldStyles.input}
            id="batch-service"
            value={form.serviceType}
            disabled={busy}
            onChange={(event) => update({ serviceType: event.target.value })}
          >
            {workspace.serviceTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.dates}>
          <Input
            label="Start date"
            type="date"
            value={form.startsOn}
            disabled={busy}
            onChange={(event) => update({ startsOn: event.target.value })}
          />
          <Input
            label="End date"
            type="date"
            hint={days ? `Default for this service: ${days} days. You can change it.` : undefined}
            value={form.endsOn}
            disabled={busy}
            onChange={(event) => update({ endsOn: event.target.value, endTouched: true })}
          />
        </div>
        {form.batch ? (
          <div className={fieldStyles.field}>
            <label className={fieldStyles.label} htmlFor="batch-status">
              Status
            </label>
            <select
              className={fieldStyles.input}
              id="batch-status"
              value={form.status}
              disabled={busy}
              onChange={(event) => update({ status: event.target.value as FormState['status'] })}
            >
              {batchStatuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <p className={styles.meta}>Dates are India Standard Time.</p>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : form.batch ? 'Save batch' : 'Create batch'}
        </Button>
        {form.batch ? (
          <Button variant="secondary" disabled={busy} onClick={onCancelEdit}>
            Cancel editing
          </Button>
        ) : null}
      </form>
    </Card>
  )
}

function StudentPlacement({
  offeringId,
  batches,
  preview,
  onChanged,
}: {
  offeringId: string
  batches: Batch[]
  preview: boolean
  onChanged: () => Promise<void>
}) {
  const { session } = useAuth()
  const students = useQuery({
    queryKey: ['batch-students', session?.user.id, offeringId],
    queryFn: () => getBatchStudents(offeringId),
    enabled: !preview,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const [choice, setChoice] = useState<Record<string, string>>({})
  const [reason, setReason] = useState<Record<string, string>>({})
  const [keys, setKeys] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const rows = preview ? previewStudents : students.data
  const open = batches.filter((batch) => batch.status === 'active')
  const nameOf = (id: string | null) =>
    batches.find((batch) => batch.id === id)?.name ?? 'No batch yet'

  async function place(student: BatchStudent) {
    const target = choice[student.enrollmentId]
    if (!target || busy) return
    setError('')
    setMessage('')
    if (preview) {
      setError('Preview only: batch changes are not saved.')
      return
    }
    setBusy(student.enrollmentId)
    try {
      await assignStudentBatch({
        requestKey: keys[student.enrollmentId] ?? crypto.randomUUID(),
        enrollmentId: student.enrollmentId,
        expectedBatchId: student.batchId,
        batchId: target,
        reason: reason[student.enrollmentId] ?? '',
      })
      setMessage(`${student.displayName} moved to ${nameOf(target)}.`)
      setChoice((current) => ({ ...current, [student.enrollmentId]: '' }))
      setReason((current) => ({ ...current, [student.enrollmentId]: '' }))
      setKeys((current) => ({ ...current, [student.enrollmentId]: crypto.randomUUID() }))
      await Promise.all([students.refetch(), onChanged()])
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The batch change could not be saved.')
      await students.refetch()
    } finally {
      setBusy('')
    }
  }

  return (
    <Card>
      <div className={styles.stack}>
        <h2>Place students</h2>
        <p className={styles.meta}>
          Converted students enrolled in this course. A move keeps their course access dates and
          past work; each change is recorded with your reason.
        </p>
        {message ? <p role="status">{message}</p> : null}
        {error ? (
          <Callout tone="warning" icon="warning">
            <p role="alert">{error}</p>
          </Callout>
        ) : null}
        {!preview && students.isPending ? (
          <p role="status">Loading students…</p>
        ) : !preview && students.isError ? (
          <>
            <p role="alert">Students could not be loaded.</p>
            <Button onClick={() => void students.refetch()}>Try again</Button>
          </>
        ) : !rows?.length ? (
          <EmptyState title="No enrolled students yet" />
        ) : (
          <ul className={styles.students}>
            {rows.map((student) => {
              const options = open.filter((batch) => batch.id !== student.batchId)
              return (
                <li className={styles.student} key={student.enrollmentId}>
                  <div className={styles.batchHeader}>
                    <strong>
                      {student.displayName} · {student.memberId}
                    </strong>
                    <Badge tone={student.batchId ? 'accent' : 'warning'}>
                      {nameOf(student.batchId)}
                    </Badge>
                  </div>
                  {!student.movable ? (
                    <p className={styles.meta}>
                      This enrolment has its own fixed curriculum. An admin must move it.
                    </p>
                  ) : (
                    <div className={styles.studentControls}>
                      <div className={fieldStyles.field}>
                        <label
                          className={fieldStyles.label}
                          htmlFor={`move-${student.enrollmentId}`}
                        >
                          New batch
                        </label>
                        <select
                          className={fieldStyles.input}
                          id={`move-${student.enrollmentId}`}
                          aria-label={`New batch for ${student.displayName}`}
                          value={choice[student.enrollmentId] ?? ''}
                          disabled={Boolean(busy) || !options.length}
                          onChange={(event) => {
                            const value = event.target.value
                            setChoice((current) => ({ ...current, [student.enrollmentId]: value }))
                            setKeys((current) => ({
                              ...current,
                              [student.enrollmentId]: crypto.randomUUID(),
                            }))
                          }}
                        >
                          <option value="">
                            {options.length ? 'Choose batch' : 'No other open batch'}
                          </option>
                          {options.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Input
                        label="Reason"
                        aria-label={`Reason for ${student.displayName}`}
                        value={reason[student.enrollmentId] ?? ''}
                        disabled={Boolean(busy)}
                        maxLength={500}
                        onChange={(event) => {
                          const value = event.target.value
                          setReason((current) => ({ ...current, [student.enrollmentId]: value }))
                          setKeys((current) => ({
                            ...current,
                            [student.enrollmentId]: crypto.randomUUID(),
                          }))
                        }}
                      />
                      <Button
                        disabled={
                          Boolean(busy) ||
                          !choice[student.enrollmentId] ||
                          (reason[student.enrollmentId] ?? '').trim().length < 3
                        }
                        onClick={() => void place(student)}
                      >
                        {busy === student.enrollmentId ? 'Saving…' : 'Move'}
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Card>
  )
}

export function BatchesPage({ portal }: { portal: 'staff' | 'teacher' }) {
  const { session } = useAuth()
  const [searchParams] = useSearchParams()
  const preview =
    import.meta.env.VITE_ENABLE_OPERATOR_PREVIEW === 'true' && searchParams.get('preview') === '1'
  const query = useQuery({
    queryKey: ['batch-workspace', session?.user.id],
    queryFn: getBatchWorkspace,
    enabled: !preview,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const workspace = preview ? previewWorkspace : query.data
  const [selectedOffering, setSelectedOffering] = useState('')
  const [editing, setEditing] = useState<Batch | null>(null)
  const [message, setMessage] = useState('')
  const offeringId = selectedOffering || workspace?.offerings[0]?.id || ''
  const offering = workspace?.offerings.find((item) => item.id === offeringId)
  const batches = workspace?.batches.filter((batch) => batch.offeringId === offeringId) ?? []
  // D-066: Sales create batches; teachers place students only.
  const canManage = Boolean(workspace?.canManage) && portal === 'staff'
  const typeLabel = (key: string | null) =>
    workspace?.serviceTypes.find((type) => type.key === key)?.label ?? 'Service not set'

  async function refresh() {
    if (!preview) await query.refetch()
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <p className="eyebrow">Batches</p>
        <h1>{canManage ? 'Create and fill batches.' : 'Place students in batches.'}</h1>
        <p>
          {canManage
            ? 'Create a batch for each course, service type and start date, then place converted students into it. Students see only the batch name.'
            : 'Place enrolled students into the open batches of your courses. Students see only the batch name.'}
        </p>
      </header>
      {message ? <p role="status">{message}</p> : null}
      {!preview && query.isPending ? (
        <p role="status">Loading batches…</p>
      ) : !preview && query.isError ? (
        <Card>
          <p role="alert">
            Batches could not be loaded. Your account may not have batch access for any course.
          </p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </Card>
      ) : !workspace?.offerings.length ? (
        <EmptyState
          title="No courses available"
          description="Batch access is granted per course."
        />
      ) : (
        <>
          {workspace.offerings.length > 1 ? (
            <div className={fieldStyles.field}>
              <label className={fieldStyles.label} htmlFor="batch-offering">
                Course
              </label>
              <select
                className={fieldStyles.input}
                id="batch-offering"
                value={offeringId}
                onChange={(event) => {
                  setSelectedOffering(event.target.value)
                  setEditing(null)
                }}
              >
                {workspace.offerings.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <h2>{offering?.title}</h2>
          )}
          <div className={canManage ? styles.layout : styles.single}>
            <div className={styles.stack}>
              <div className={styles.batchList}>
                {!batches.length ? (
                  <EmptyState
                    title="No batches yet"
                    description={
                      canManage
                        ? 'Create the first batch for this course.'
                        : 'Sales create batches for each course.'
                    }
                  />
                ) : (
                  batches.map((batch) => (
                    <Card key={batch.id}>
                      <div className={styles.batchHeader}>
                        <h3>{batch.name}</h3>
                        <Badge tone={batch.status === 'active' ? 'success' : 'neutral'}>
                          {statusLabels[batch.status]}
                        </Badge>
                      </div>
                      <p className={styles.meta}>
                        {typeLabel(batch.serviceType)} · {day(batch.startsAt)} to{' '}
                        {day(batch.endsAt)} · {batch.studentCount}{' '}
                        {batch.studentCount === 1 ? 'student' : 'students'}
                      </p>
                      {canManage ? (
                        <Button variant="secondary" onClick={() => setEditing(batch)}>
                          Edit {batch.name}
                        </Button>
                      ) : null}
                    </Card>
                  ))
                )}
              </div>
              {offering?.canAssign ? (
                <StudentPlacement
                  key={offeringId}
                  offeringId={offeringId}
                  batches={batches}
                  preview={preview}
                  onChanged={refresh}
                />
              ) : null}
            </div>
            {canManage ? (
              <BatchForm
                key={editing ? `${editing.id}-${editing.revision}` : `new-${offeringId}`}
                workspace={workspace}
                offeringId={offeringId}
                editing={editing}
                preview={preview}
                onCancelEdit={() => setEditing(null)}
                onSaved={async (text) => {
                  setMessage(text)
                  setEditing(null)
                  await refresh()
                }}
              />
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
