import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  courseStatuses,
  getCourses,
  saveCourse,
  type Course,
  type CourseStatus,
} from '../features/enrolment/courses'
import { formatPaise, rupeesToPaise } from '../features/enrolment/payments'
import fieldStyles from '../components/forms/Input.module.css'
import styles from './PaymentsPage.module.css'

const statusLabels: Record<CourseStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
}
const paiseText = (paise: number | null) => (paise === null ? '' : String(paise / 100))

type FormState = {
  requestKey: string
  code: string
  title: string
  status: CourseStatus
  durationDays: string
  totalFee: string
  admissionFee: string
  reason: string
}
function formFor(course: Course | null): FormState {
  return {
    requestKey: crypto.randomUUID(),
    code: course?.code ?? '',
    title: course?.title ?? '',
    status: course?.status ?? 'active',
    durationDays: course?.durationDays ? String(course.durationDays) : '',
    totalFee: paiseText(course?.totalFeePaise ?? null),
    admissionFee: paiseText(course?.admissionFeePaise ?? null),
    reason: '',
  }
}

function CourseForm({
  course,
  onSaved,
  onCancel,
}: {
  course: Course | null
  onSaved: (message: string) => Promise<void>
  onCancel?: () => void
}) {
  const [form, setForm] = useState(() => formFor(course))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (change: Partial<FormState>) =>
    setForm((current) => ({ ...current, ...change, requestKey: crypto.randomUUID() }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    const days = form.durationDays.trim() ? Number(form.durationDays) : null
    const total = form.totalFee.trim() ? rupeesToPaise(form.totalFee) : null
    const admission = form.admissionFee.trim() ? rupeesToPaise(form.admissionFee) : null
    if (
      (days !== null && (!Number.isInteger(days) || days < 1 || days > 1500)) ||
      (form.totalFee.trim() && total === null) ||
      (form.admissionFee.trim() && admission === null)
    ) {
      setError('Enter the length in whole days (1 to 1500) and fees in rupees.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await saveCourse({
        requestKey: form.requestKey,
        courseId: course?.id ?? null,
        expectedRevision: course?.revision ?? null,
        code: form.code,
        title: form.title,
        status: form.status,
        durationDays: days,
        totalFeePaise: total,
        admissionFeePaise: admission,
        reason: form.reason,
      })
      await onSaved(course ? `${form.title.trim()} updated.` : `${form.title.trim()} added.`)
      if (!course) setForm(formFor(null))
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The course could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const id = course?.id ?? 'new'
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {error ? (
        <Callout tone="warning" icon="warning">
          <p role="alert">{error}</p>
        </Callout>
      ) : null}
      <div className={styles.fields}>
        {course ? null : (
          <Input
            label="Course code"
            hint="Short and permanent, for example NID-BDES-2027."
            value={form.code}
            disabled={busy}
            maxLength={32}
            onChange={(event) => update({ code: event.target.value })}
          />
        )}
        <Input
          label="Course name"
          value={form.title}
          disabled={busy}
          maxLength={160}
          onChange={(event) => update({ title: event.target.value })}
        />
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor={`course-status-${id}`}>
            Status
          </label>
          <select
            className={fieldStyles.input}
            id={`course-status-${id}`}
            value={form.status}
            disabled={busy}
            onChange={(event) => update({ status: event.target.value as CourseStatus })}
          >
            {courseStatuses
              .filter((status) => course || status !== 'archived')
              .map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
          </select>
        </div>
        <Input
          label="Course length (days)"
          hint="Pre-fills the end date of new batches."
          inputMode="numeric"
          value={form.durationDays}
          disabled={busy}
          maxLength={4}
          onChange={(event) => update({ durationDays: event.target.value })}
        />
        <Input
          label="Total fee (₹)"
          inputMode="decimal"
          value={form.totalFee}
          disabled={busy}
          maxLength={14}
          onChange={(event) => update({ totalFee: event.target.value })}
        />
        <Input
          label="Admission fee (₹)"
          hint="Paying this opens the Dexam App for the student."
          inputMode="decimal"
          value={form.admissionFee}
          disabled={busy}
          maxLength={14}
          onChange={(event) => update({ admissionFee: event.target.value })}
        />
        <Input
          label="Reason"
          hint="For example: new 2027 batch, fee revised."
          value={form.reason}
          disabled={busy}
          maxLength={500}
          onChange={(event) => update({ reason: event.target.value })}
        />
      </div>
      <div className={styles.actions}>
        <Button
          type="submit"
          disabled={
            busy ||
            form.title.trim().length < 2 ||
            form.reason.trim().length < 3 ||
            (!course && form.code.trim().length < 3)
          }
        >
          {busy ? 'Saving…' : course ? 'Save course' : 'Add course'}
        </Button>
        {onCancel ? (
          <Button variant="secondary" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}

export function CoursesPage() {
  const { session } = useAuth()
  const [editing, setEditing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const query = useQuery({
    queryKey: ['courses', session?.user.id],
    queryFn: getCourses,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  async function saved(text: string) {
    setMessage(text)
    setEditing(null)
    await query.refetch()
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <p className="eyebrow">Admin · Courses</p>
        <h1>Courses and fees.</h1>
        <p>
          Every course Dexam offers. Set each course’s length, total fee and admission fee. Sales
          record payments against these fees, and the admission fee opens the Dexam App.
        </p>
      </header>
      {message ? <p role="status">{message}</p> : null}
      <Card>
        <h2>Add a course</h2>
        <CourseForm key={`new-${message}`} course={null} onSaved={saved} />
      </Card>
      {query.isPending ? (
        <p role="status">Loading courses…</p>
      ) : query.isError ? (
        <Card>
          <p role="alert">{query.error.message}</p>
          <Button onClick={() => void query.refetch()}>Try again</Button>
        </Card>
      ) : !query.data.length ? (
        <EmptyState title="No courses yet" description="Add the first course above." />
      ) : (
        <ul className={styles.list}>
          {query.data.map((course) => (
            <li key={`${course.id}-${course.revision}`}>
              <Card>
                <div className={styles.row}>
                  <div className={styles.identity}>
                    <strong>{course.title}</strong>
                    <span className={styles.meta}>
                      {course.code} ·{' '}
                      {course.durationDays ? `${course.durationDays} days` : 'No length set'} · Fee{' '}
                      {course.totalFeePaise === null
                        ? 'not set'
                        : formatPaise(course.totalFeePaise)}{' '}
                      · Admission{' '}
                      {course.admissionFeePaise === null
                        ? 'not set'
                        : formatPaise(course.admissionFeePaise)}{' '}
                      · {course.openEnrolments} open enrolments
                    </span>
                  </div>
                  <Badge tone={course.status === 'active' ? 'success' : 'neutral'}>
                    {statusLabels[course.status]}
                  </Badge>
                </div>
                {editing === course.id ? (
                  <CourseForm course={course} onSaved={saved} onCancel={() => setEditing(null)} />
                ) : (
                  <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => setEditing(course.id)}>
                      Edit {course.title}
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
