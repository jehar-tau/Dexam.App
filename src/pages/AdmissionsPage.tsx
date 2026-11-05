import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Callout, Card, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  accessPresets,
  previewAccessExpiry,
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
import styles from './SignInPage.module.css'

/** Wall-clock input is always India time, never the operator's device timezone. */
function indiaInstant(value: string) {
  if (!value) throw new Error('Choose an explicit date and time in Asia/Kolkata.')
  const result = new Date(`${value}:00+05:30`)
  if (!Number.isFinite(result.getTime())) throw new Error('Choose a valid date and time.')
  return result.toISOString()
}
function displayTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not configured'
}
const emptyForm = {
  name: '',
  email: '',
  offeringId: '',
  cohortId: '',
  start: '',
  expiry: '',
  amount: '',
  paid: '',
  reference: '',
  reason: '',
  method: 'cash' as AdmissionDraft['method'],
}

export function AdmissionsPage() {
  const { session } = useAuth()
  const [search, setSearch] = useState(''),
    [state, setState] = useState('')
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
  const [selected, setSelected] = useState<AdmissionRow | null>(null)
  const [action, setAction] = useState<AdmissionEdit['action']>('details')
  const [editValue, setEditValue] = useState(''),
    [editStart, setEditStart] = useState(''),
    [editReason, setEditReason] = useState('')
  const choices = useQuery({
    queryKey: ['admission-choices', session?.user.id],
    queryFn: getAdmissionChoices,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const directory = useQuery({
    queryKey: ['admissions', session?.user.id, search, state],
    queryFn: () => listAdmissions(search, state),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const enabled = choices.data?.enabled === true
  const offering = choices.data?.offerings.find((row) => row.id === form.offeringId)
  function change(key: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'offeringId' ? { cohortId: '' } : {}),
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
          <p role="alert">
            Admission choices are unavailable. Check your current role and recent MFA.
          </p>
        ) : null}
        {!enabled && !choices.isPending ? (
          <Callout tone="warning" icon="warning">
            New admissions and edits are disabled until access, Google and file-security acceptance
            is complete. This page does not enable them.
          </Callout>
        ) : null}
        <h2>Student directory</h2>
        <Input
          label="Search name, Member ID or approved login email"
          maxLength={254}
          value={search}
          disabled={busy}
          onChange={(e) => {
            setSearch(e.target.value)
            setSelected(null)
          }}
        />
        <label>
          Access state
          <select value={state} disabled={busy} onChange={(e) => setState(e.target.value)}>
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
        {directory.isPending ? (
          <p role="status">Loading shared records…</p>
        ) : directory.isError ? (
          <>
            <p role="alert">Directory could not be loaded.</p>
            <Button onClick={() => void directory.refetch()}>Retry directory</Button>
          </>
        ) : (
          <>
            {!directory.data.length ? <p>No matching student enrolments.</p> : null}
            {directory.data.length === 100 ? (
              <p>Showing the first 100 results. Narrow your search to locate a student.</p>
            ) : null}
            {directory.data.map((row) => (
              <article key={row.enrollmentId}>
                <h3>
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
              </article>
            ))}
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
                    ? { startsAt: indiaInstant(editStart), expiresAt: indiaInstant(editValue) }
                    : {}),
                  ...(action === 'renewal' ? { expiresAt: indiaInstant(editValue) } : {}),
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
              <Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>
                Cancel change
              </Button>
            </fieldset>
          </form>
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
                  startsAt: indiaInstant(form.start),
                  expiresAt: indiaInstant(form.expiry),
                  paidAt: indiaInstant(form.paid),
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
                  defaultValue=""
                  onChange={(e) => {
                    if (!e.target.value) return
                    try {
                      const end = previewAccessExpiry(
                        indiaInstant(form.start),
                        Number(e.target.value) as AccessPreset,
                      )
                      change(
                        'expiry',
                        new Date(Date.parse(end) + 330 * 60_000).toISOString().slice(0, 16),
                      )
                      setError('')
                    } catch (failure) {
                      setError(failure instanceof Error ? failure.message : 'Choose start first.')
                    }
                  }}
                >
                  <option value="">Choose after setting start</option>
                  {accessPresets.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset === 30 ? '30 exact days' : `${preset} calendar months`}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Access expiry — Asia/Kolkata (exclusive)"
                type="datetime-local"
                required
                value={form.expiry}
                onChange={(e) => change('expiry', e.target.value)}
              />
              <label>
                Manual payment method
                <select value={form.method} onChange={(e) => change('method', e.target.value)}>
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
