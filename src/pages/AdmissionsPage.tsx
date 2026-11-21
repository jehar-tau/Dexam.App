import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  accessPresets,
  indiaInputInstant,
  presetExpiryInput,
  type AccessPreset,
} from '../features/enrolment/admissionInputs'
import {
  admitStudent,
  editAdmission,
  getAdmissionChoices,
  listAdmissions,
  searchAdmissionIdentity,
  type AdmissionDraft,
  type AdmissionEdit,
  type AdmissionIdentity,
  type AdmissionRow,
} from '../features/enrolment/admissions'
import fieldStyles from '../components/forms/Input.module.css'
import { AdmissionHistory } from './AdmissionHistory'
import styles from './AdmissionsPage.module.css'

const indiaTime = new Intl.DateTimeFormat('en-IN', {
  timeZone: 'Asia/Kolkata',
  dateStyle: 'medium',
  timeStyle: 'short',
})
function displayTime(value: string | null) {
  return value ? indiaTime.format(new Date(value)) : 'Not configured'
}
const emptyForm = {
  name: '',
  email: '',
  offeringId: '',
  cohortId: '',
  start: '',
  expiry: '',
  preset: '' as AccessPreset | '',
  amount: '',
  paid: '',
  reference: '',
  reason: '',
  method: 'cash' as AdmissionDraft['method'],
}

const directoryPageSize = 50
const maximumDirectoryOffset = 100_000
const initialFilters = { search: '', state: '', offeringId: '', cohortId: '', expiryDate: '' }

export function AdmissionsPage() {
  const { session } = useAuth()
  return session ? (
    <AdmissionsWorkspace key={session.user.id} accountId={session.user.id} />
  ) : (
    <p role="status">Sign in to view admissions.</p>
  )
}

function AdmissionsWorkspace({ accountId }: { accountId: string }) {
  const directoryHeading = useRef<HTMLHeadingElement>(null)
  const [filters, setFilters] = useState(initialFilters)
  const [offset, setOffset] = useState(0)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm),
    [confirmed, setConfirmed] = useState(false)
  const [identity, setIdentity] = useState<AdmissionIdentity | null>(null)
  const [reviewed, setReviewed] = useState(false),
    [createNew, setCreateNew] = useState(false)
  const [matches, setMatches] = useState<AdmissionIdentity[]>([])
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const [editTarget, setSelected] = useState<AdmissionRow | null>(null)
  const [action, setAction] = useState<AdmissionEdit['action']>('details')
  const [editValue, setEditValue] = useState(''),
    [editStart, setEditStart] = useState(''),
    [editReason, setEditReason] = useState('')
  const choices = useQuery({
    queryKey: ['admission-choices', accountId],
    queryFn: getAdmissionChoices,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const directory = useQuery({
    queryKey: ['admissions', accountId, filters, offset],
    queryFn: () =>
      listAdmissions(filters.search, filters.state, {
        offeringId: filters.offeringId || undefined,
        cohortId: filters.cohortId || undefined,
        // Postgres stores microseconds and the directory's cutoff is inclusive.
        expiresBefore: filters.expiryDate
          ? `${filters.expiryDate}T23:59:59.999999+05:30`
          : undefined,
        offset,
      }),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const enabled = choices.isSuccess && choices.data.enabled
  const directoryOfferings = choices.data?.directoryOfferings ?? choices.data?.offerings ?? []
  const offering = choices.data?.offerings.find((row) => row.id === form.offeringId)
  const rows = directory.isSuccess ? directory.data.slice(0, directoryPageSize) : []
  const hasNext = directory.isSuccess && directory.data.length > directoryPageSize
  const selected =
    editTarget &&
    rows.some(
      (row) =>
        row.enrollmentId === editTarget.enrollmentId &&
        row.revision === editTarget.revision &&
        row.loginRevision === editTarget.loginRevision &&
        row.state === editTarget.state,
    )
      ? editTarget
      : null
  let expiry = form.expiry
  let durationError = ''
  if (form.preset) {
    expiry = ''
    if (form.start) {
      try {
        expiry = presetExpiryInput(form.start, form.preset)
      } catch (failure) {
        durationError = failure instanceof Error ? failure.message : 'Choose a valid access start.'
      }
    }
  }
  function closeRecord() {
    setSelected(null)
    setHistoryId(null)
    if (editTarget) {
      setConfirmed(false)
      setRequestKey(crypto.randomUUID())
    }
  }
  function filter(key: keyof typeof initialFilters, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === 'offeringId' ? { cohortId: '' } : {}),
    }))
    setOffset(0)
    closeRecord()
  }
  function movePage(nextOffset: number) {
    directoryHeading.current?.focus()
    setOffset(nextOffset)
    closeRecord()
  }
  function change<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'offeringId' ? { cohortId: '' } : {}),
      ...(key === 'expiry' ? { preset: '' as const } : {}),
      ...(key === 'preset' && !value ? { expiry } : {}),
    }))
    setConfirmed(false)
    setRequestKey(crypto.randomUUID())
    setMessage('')
    if (key === 'email' || key === 'name') {
      setReviewed(false)
      setIdentity(null)
      setCreateNew(false)
      setMatches([])
    }
  }
  async function run(operation: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await operation()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Admissions unavailable.')
    } finally {
      setBusy(false)
    }
  }
  async function checkIdentity() {
    await run(async () => {
      const byEmail = await searchAdmissionIdentity(form.email.trim())
      const byName =
        form.name.trim().length > 1 ? await searchAdmissionIdentity(form.name.trim()) : []
      setMatches([...new Map([...byEmail, ...byName].map((row) => [row.personId, row])).values()])
      setReviewed(true)
      setIdentity(null)
      setCreateNew(false)
      setConfirmed(false)
    })
  }
  return (
    <section className={styles.layout} aria-labelledby="admissions-title">
      <div className={styles.intro}>
        <p className="eyebrow">Shared admissions</p>
        <h1 id="admissions-title">One student. One shared record.</h1>
        <p className={styles.lede}>
          Review a canonical student, record the payment actually received and choose explicit
          coaching access dates.
        </p>
        <p>
          All dates below use Asia/Kolkata (UTC+05:30). Login email is not a guardian, billing or
          enquiry contact. Google login alone grants no access.
        </p>
      </div>
      <Card className={styles.card}>
        {choices.isPending ? <p role="status">Checking admission configuration…</p> : null}
        {choices.isError ? (
          <>
            <p role="alert">
              Admission choices are unavailable. Check your current role and recent MFA.
            </p>
            <Button variant="secondary" onClick={() => void choices.refetch()}>
              Retry admission choices
            </Button>
          </>
        ) : null}
        {!enabled && !choices.isPending ? (
          <Callout tone="warning" icon="warning">
            New admissions and edits are disabled until access, Google and file-security acceptance
            is complete. This page does not enable them.
          </Callout>
        ) : null}
        <h2 ref={directoryHeading} tabIndex={-1}>
          Student directory
        </h2>
        <div className={styles.filters}>
          <Input
            label="Search name, Member ID or approved login email"
            maxLength={254}
            value={filters.search}
            disabled={busy}
            onChange={(e) => filter('search', e.target.value)}
          />
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Access state</span>
            <select
              className={fieldStyles.input}
              value={filters.state}
              disabled={busy}
              onChange={(e) => filter('state', e.target.value)}
            >
              <option value="">All states</option>
              {['active', 'scheduled', 'expired', 'suspended', 'revoked', 'ended', 'legacy'].map(
                (value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Filter by course</span>
            <select
              className={fieldStyles.input}
              value={filters.offeringId}
              disabled={busy || !choices.isSuccess}
              onChange={(e) => filter('offeringId', e.target.value)}
            >
              <option value="">All courses</option>
              {directoryOfferings.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className={fieldStyles.field}>
            <span className={fieldStyles.label}>Filter by batch</span>
            <select
              className={fieldStyles.input}
              value={filters.cohortId}
              disabled={busy || !filters.offeringId || !choices.isSuccess}
              onChange={(e) => filter('cohortId', e.target.value)}
            >
              <option value="">All batches</option>
              {directoryOfferings
                .find((course) => course.id === filters.offeringId)
                ?.batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name}
                  </option>
                ))}
            </select>
          </label>
          <Input
            label="Access expires on or before (India time)"
            type="date"
            value={filters.expiryDate}
            disabled={busy}
            onChange={(e) => filter('expiryDate', e.target.value)}
          />
        </div>
        {directory.isPending ? (
          <p role="status">Loading shared records…</p>
        ) : directory.isError ? (
          <>
            <p role="alert">Directory could not be loaded.</p>
            <Button onClick={() => void directory.refetch()}>Retry directory</Button>
            {offset > 0 && (
              <Button variant="secondary" onClick={() => movePage(offset - directoryPageSize)}>
                Previous results
              </Button>
            )}
          </>
        ) : (
          <>
            {!rows.length ? (
              <p>
                {offset ? 'No enrolments remain on this page.' : 'No matching student enrolments.'}
              </p>
            ) : null}
            {rows.map((row) => (
              <article
                key={row.enrollmentId}
                className={styles.record}
                aria-labelledby={`record-${row.enrollmentId}`}
              >
                <h3 id={`record-${row.enrollmentId}`}>
                  {row.name ?? 'Student'} · {row.memberId ?? 'No Member ID'}
                </h3>
                <p>
                  {row.programme} · {row.batch ?? 'Independent enrolment'} · {row.state}
                </p>
                <p>
                  {row.loginEmail ?? 'No reviewed login email'}
                  <br />
                  {displayTime(row.startsAt)} → {displayTime(row.expiresAt)}
                </p>
                <div className={styles.actions}>
                  <Button
                    variant="secondary"
                    disabled={busy}
                    aria-expanded={historyId === row.enrollmentId}
                    onClick={() => {
                      closeRecord()
                      setHistoryId(historyId === row.enrollmentId ? null : row.enrollmentId)
                    }}
                  >
                    {historyId === row.enrollmentId ? 'Hide history' : 'View history'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={
                      busy ||
                      !enabled ||
                      row.revision === null ||
                      row.state === 'ended' ||
                      row.state === 'revoked'
                    }
                    onClick={() => {
                      setHistoryId(null)
                      setSelected(row)
                      setAction('details')
                      setEditValue(row.name ?? '')
                      setEditStart('')
                      setEditReason('')
                      setConfirmed(false)
                      setRequestKey(crypto.randomUUID())
                    }}
                  >
                    Review changes
                  </Button>
                </div>
                {historyId === row.enrollmentId ? (
                  <AdmissionHistory
                    accountId={accountId}
                    enrollmentId={row.enrollmentId}
                    formatTime={displayTime}
                    batches={
                      directoryOfferings.find((course) => course.id === row.offeringId)?.batches ??
                      []
                    }
                  />
                ) : null}
              </article>
            ))}
            {(offset > 0 || hasNext) && (
              <nav aria-label="Directory pages" className={styles.actions}>
                <Button
                  variant="secondary"
                  disabled={busy || offset === 0}
                  onClick={() => movePage(offset - directoryPageSize)}
                >
                  Previous results
                </Button>
                <span role="status">
                  Page {offset / directoryPageSize + 1}
                  {rows.length ? ` · Enrolments ${offset + 1}–${offset + rows.length}` : ''}
                </span>
                <Button
                  variant="secondary"
                  disabled={busy || !hasNext || offset >= maximumDirectoryOffset}
                  onClick={() => movePage(offset + directoryPageSize)}
                >
                  Next results
                </Button>
                {offset >= maximumDirectoryOffset && hasNext && (
                  <p>Narrow your filters to see additional enrolments.</p>
                )}
              </nav>
            )}
          </>
        )}
        {selected ? (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                if (!confirmed) throw new Error('Confirm this exact change.')
                await editAdmission({
                  enrollment: selected,
                  requestKey,
                  action,
                  reason: editReason,
                  ...(action === 'details' ? { name: editValue } : {}),
                  ...(action === 'dates'
                    ? {
                        startsAt: indiaInputInstant(editStart),
                        expiresAt: indiaInputInstant(editValue),
                      }
                    : {}),
                  ...(action === 'renewal' ? { expiresAt: indiaInputInstant(editValue) } : {}),
                  ...(action === 'batch_transfer' ? { cohortId: editValue } : {}),
                })
                setSelected(null)
                setConfirmed(false)
                setMessage(
                  'Change recorded with attribution. Other enrolments and payment history were not replaced.',
                )
                await directory.refetch()
              })
            }}
          >
            <fieldset disabled={busy || !enabled}>
              <h2>Change {selected.memberId}</h2>
              <p>
                {selected.programme} · {selected.batch ?? 'Independent enrolment'}
              </p>
              <label>
                Change type
                <select
                  value={action}
                  disabled={busy}
                  onChange={(e) => {
                    setAction(e.target.value as AdmissionEdit['action'])
                    setEditValue('')
                    setEditStart('')
                    setConfirmed(false)
                    setRequestKey(crypto.randomUUID())
                  }}
                >
                  <option value="details">Display name (not login identity)</option>
                  <option value="dates">Explicit access dates</option>
                  <option value="renewal">Extend expiry</option>
                  <option value="suspension">Suspend coaching access</option>
                  <option value="revocation">Revoke coaching access</option>
                  <option value="batch_transfer">Transfer delivery batch</option>
                </select>
              </label>
              {action === 'details' ? (
                <Input
                  label="Display name"
                  value={editValue}
                  required
                  maxLength={120}
                  onChange={(e) => {
                    setEditValue(e.target.value)
                    setConfirmed(false)
                    setRequestKey(crypto.randomUUID())
                  }}
                />
              ) : null}
              {action === 'dates' ? (
                <Input
                  label="New access start — Asia/Kolkata"
                  type="datetime-local"
                  value={editStart}
                  required
                  onChange={(e) => {
                    setEditStart(e.target.value)
                    setConfirmed(false)
                    setRequestKey(crypto.randomUUID())
                  }}
                />
              ) : null}
              {action === 'dates' || action === 'renewal' ? (
                <Input
                  label="New access expiry — Asia/Kolkata"
                  type="datetime-local"
                  value={editValue}
                  required
                  onChange={(e) => {
                    setEditValue(e.target.value)
                    setConfirmed(false)
                    setRequestKey(crypto.randomUUID())
                  }}
                />
              ) : null}
              {action === 'batch_transfer' ? (
                <label>
                  New delivery batch
                  <select
                    required
                    value={editValue}
                    onChange={(e) => {
                      setEditValue(e.target.value)
                      setConfirmed(false)
                      setRequestKey(crypto.randomUUID())
                    }}
                  >
                    <option value="">Choose batch</option>
                    {choices.data?.offerings
                      .find((row) => row.id === selected.offeringId)
                      ?.batches.filter((row) => row.id !== selected.cohortId)
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
              <p>
                Suspension and revocation do not restore automatically. Transfer preserves access
                dates and requires the same pinned curriculum. Receipt history and login ownership
                cannot be edited here.
              </p>
              <Input
                label="Reason for change"
                value={editReason}
                required
                minLength={3}
                maxLength={500}
                onChange={(e) => {
                  setEditReason(e.target.value)
                  setConfirmed(false)
                  setRequestKey(crypto.randomUUID())
                }}
              />
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                I reviewed this exact student, course and access change.
              </label>
              <Button type="submit" disabled={busy || !enabled || !confirmed}>
                {busy ? 'Recording…' : 'Record reviewed change'}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={closeRecord}>
                Cancel change
              </Button>
            </fieldset>
          </form>
        ) : editTarget ? (
          <div>
            <p role="alert">
              The selected enrolment is no longer available for this edit. Review its current
              details before making a change.
            </p>
            <Button variant="secondary" onClick={closeRecord}>
              Close change
            </Button>
          </div>
        ) : (
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                if (!reviewed || (!identity && !createNew))
                  throw new Error('Review identity matches before admitting.')
                const result = await admitStudent({
                  ...form,
                  requestKey,
                  existingPerson: identity?.personId ?? null,
                  cohortId: form.cohortId || null,
                  startsAt: indiaInputInstant(form.start),
                  expiresAt: indiaInputInstant(expiry),
                  paidAt: indiaInputInstant(form.paid),
                  confirmed,
                })
                setForm(emptyForm)
                setReviewed(false)
                setConfirmed(false)
                setIdentity(null)
                setCreateNew(false)
                setRequestKey(crypto.randomUUID())
                setMessage(
                  `Admission recorded${result.memberId ? ` · ${result.memberId}` : ''}. Payment is manually confirmed, not gateway verified.`,
                )
                await directory.refetch()
              })
            }}
          >
            <h2>Add a reviewed admission</h2>
            <fieldset disabled={busy || !enabled}>
              <Input
                label="Student display name"
                required
                maxLength={120}
                value={form.name}
                onChange={(e) => change('name', e.target.value)}
              />
              <Input
                label="Dedicated student login email"
                type="email"
                required
                maxLength={254}
                value={form.email}
                onChange={(e) => change('email', e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={!form.email || !form.name}
                onClick={() => void checkIdentity()}
              >
                Check existing identity
              </Button>
              {reviewed ? (
                <fieldset>
                  <legend>Deliberate identity choice</legend>
                  {matches.map((row) => (
                    <label key={row.personId}>
                      <input
                        type="radio"
                        name="identity"
                        checked={identity?.personId === row.personId}
                        disabled={row.state !== 'active'}
                        onChange={() => {
                          setIdentity(row)
                          setCreateNew(false)
                          setConfirmed(false)
                          setRequestKey(crypto.randomUUID())
                        }}
                      />{' '}
                      {row.name} · {row.memberId ?? 'No Member ID'} ·{' '}
                      {row.loginEmail ?? 'No reserved login'} · {row.state}
                    </label>
                  ))}
                  <label>
                    <input
                      type="radio"
                      name="identity"
                      checked={createNew}
                      onChange={() => {
                        setCreateNew(true)
                        setIdentity(null)
                        setConfirmed(false)
                        setRequestKey(crypto.randomUUID())
                      }}
                    />{' '}
                    I reviewed the matches and this is a new person.
                  </label>
                </fieldset>
              ) : null}
              <label>
                Programme
                <select
                  required
                  value={form.offeringId}
                  onChange={(e) => change('offeringId', e.target.value)}
                >
                  <option value="">Choose programme</option>
                  {choices.data?.offerings.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Delivery batch
                <select
                  required
                  value={form.cohortId}
                  onChange={(e) => change('cohortId', e.target.value)}
                >
                  <option value="">Choose batch</option>
                  {offering?.batches.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Access start — Asia/Kolkata"
                type="datetime-local"
                required
                value={form.start}
                onChange={(e) => change('start', e.target.value)}
              />
              <label>
                Duration preset
                <select
                  value={form.preset}
                  disabled={!form.start}
                  onChange={(e) =>
                    change(
                      'preset',
                      accessPresets.find((preset) => String(preset) === e.target.value) ?? '',
                    )
                  }
                >
                  <option value="">Custom expiry</option>
                  {accessPresets.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset === 30 ? '30 exact days' : `${preset} calendar months`}
                    </option>
                  ))}
                </select>
              </label>
              {durationError && <p role="alert">{durationError}</p>}
              <Input
                label="Access expiry — Asia/Kolkata (exclusive)"
                type="datetime-local"
                required
                value={expiry}
                onChange={(e) => change('expiry', e.target.value)}
              />
              <label>
                Manual payment method
                <select
                  value={form.method}
                  onChange={(e) => change('method', e.target.value as AdmissionDraft['method'])}
                >
                  <option value="cash">Cash</option>
                  <option value="online_transfer">Online transfer</option>
                  <option value="card_machine">Card machine</option>
                </select>
              </label>
              <Input
                label="Amount actually received — INR"
                inputMode="decimal"
                required
                value={form.amount}
                onChange={(e) => change('amount', e.target.value)}
              />
              <Input
                label="Payment received at — Asia/Kolkata"
                type="datetime-local"
                required
                value={form.paid}
                onChange={(e) => change('paid', e.target.value)}
              />
              <Input
                label="Receipt/reference (no card or bank credentials)"
                required
                maxLength={160}
                value={form.reference}
                onChange={(e) => change('reference', e.target.value)}
              />
              <Input
                label="Admission reason"
                required
                minLength={3}
                maxLength={500}
                value={form.reason}
                onChange={(e) => change('reason', e.target.value)}
              />
              <p>
                This records manual evidence only. It does not calculate outstanding fees, verify a
                bank transfer, send an invitation or grant an employee role.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                I verified the canonical student, actual payment and explicit access dates.
              </label>
              <Button type="submit" disabled={!confirmed || !reviewed || (!identity && !createNew)}>
                {busy ? 'Recording…' : 'Record admission and manual receipt'}
              </Button>
            </fieldset>
          </form>
        )}
        {error ? <p role="alert">{error}</p> : null}
        {message ? <p role="status">{message}</p> : null}
      </Card>
    </section>
  )
}
