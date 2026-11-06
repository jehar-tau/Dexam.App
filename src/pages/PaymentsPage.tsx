import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'

import { Badge, Button, Callout, Card, EmptyState, Input } from '../components'
import { useAuth } from '../features/auth/AuthContext'
import {
  attachPaymentReceipt,
  correctStudentPayment,
  formatPaise,
  getPaymentCollectors,
  getPaymentLedger,
  getPaymentStudents,
  getStudentPayments,
  kindLabels,
  methodLabels,
  paymentKinds,
  paymentMethods,
  receiptAccept,
  receiptProblem,
  recordStudentPayment,
  rupeesToPaise,
  saveReceipt,
  setEnrollmentFee,
  type PaymentKind,
  type PaymentMethod,
  type PaymentStudent,
  type StudentPayment,
} from '../features/enrolment/payments'
import { istDate } from '../features/enrolment/batches'
import fieldStyles from '../components/forms/Input.module.css'
import styles from './PaymentsPage.module.css'

const today = () => istDate(new Date().toISOString())

function ReceiptButton({
  objectName,
  receiptNumber,
}: {
  objectName: string
  receiptNumber: string
}) {
  const [error, setError] = useState('')
  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setError('')
          void saveReceipt(objectName, receiptNumber).catch(() =>
            setError('The receipt could not be opened.'),
          )
        }}
      >
        Download receipt {receiptNumber}
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </>
  )
}

function RecordPaymentForm({
  student,
  onDone,
}: {
  student: PaymentStudent
  onDone: (message: string) => Promise<void>
}) {
  const { session } = useAuth()
  const collectors = useQuery({
    queryKey: ['payment-collectors', session?.user.id],
    queryFn: getPaymentCollectors,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const blank = () => ({
    requestKey: crypto.randomUUID(),
    kind: (student.admissionPaid ? 'course_fee' : 'admission_fee') as PaymentKind,
    method: 'upi' as PaymentMethod,
    amount: '',
    paidOn: today(),
    transactionId: '',
    collectedBy: '',
    note: '',
  })
  const [form, setForm] = useState(blank)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (change: Partial<ReturnType<typeof blank>>) =>
    setForm((current) => ({ ...current, ...change, requestKey: crypto.randomUUID() }))
  const amount = rupeesToPaise(form.amount)
  const id = student.enrollmentId

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (amount === null || amount < 1) {
      setError('Enter the amount paid in rupees.')
      return
    }
    if (file && receiptProblem(file)) {
      setError(receiptProblem(file))
      return
    }
    setBusy(true)
    setError('')
    let saved: { paymentId: string; receiptNumber: string } | null = null
    try {
      saved = await recordStudentPayment({
        requestKey: form.requestKey,
        enrollmentId: student.enrollmentId,
        kind: form.kind,
        method: form.method,
        amountPaise: amount,
        paidOn: form.paidOn,
        transactionId: form.transactionId,
        collectedBy: form.collectedBy,
        note: form.note,
      })
      if (file) await attachPaymentReceipt(saved.paymentId, file)
      setForm(blank())
      setFile(null)
      await onDone(
        `${formatPaise(amount)} recorded for ${student.displayName} (${saved.receiptNumber}).`,
      )
    } catch (failure) {
      const text = failure instanceof Error ? failure.message : 'The payment could not be recorded.'
      if (saved) {
        setForm(blank())
        await onDone(`Recorded ${saved.receiptNumber}, but: ${text}`)
      } else setError(text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <h3>Record a payment</h3>
      {error ? (
        <Callout tone="warning" icon="warning">
          <p role="alert">{error}</p>
        </Callout>
      ) : null}
      <div className={styles.fields}>
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor={`pay-kind-${id}`}>
            Payment for
          </label>
          <select
            className={fieldStyles.input}
            id={`pay-kind-${id}`}
            value={form.kind}
            disabled={busy}
            onChange={(event) => update({ kind: event.target.value as PaymentKind })}
          >
            {paymentKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kindLabels[kind]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Amount (₹)"
          inputMode="decimal"
          value={form.amount}
          disabled={busy}
          maxLength={14}
          onChange={(event) => update({ amount: event.target.value })}
        />
        <Input
          label="Paid on"
          type="date"
          max={today()}
          value={form.paidOn}
          disabled={busy}
          onChange={(event) => update({ paidOn: event.target.value })}
        />
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor={`pay-method-${id}`}>
            Method
          </label>
          <select
            className={fieldStyles.input}
            id={`pay-method-${id}`}
            value={form.method}
            disabled={busy}
            onChange={(event) => update({ method: event.target.value as PaymentMethod })}
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {methodLabels[method]}
              </option>
            ))}
          </select>
        </div>
        <Input
          label="Transaction ID"
          hint={
            form.method === 'cash' ? 'Optional for cash.' : 'From the UPI app, card slip or bank.'
          }
          value={form.transactionId}
          disabled={busy}
          maxLength={120}
          autoComplete="off"
          onChange={(event) => update({ transactionId: event.target.value })}
        />
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor={`pay-collector-${id}`}>
            Collected by
          </label>
          <select
            className={fieldStyles.input}
            id={`pay-collector-${id}`}
            value={form.collectedBy}
            disabled={busy || !collectors.data}
            onChange={(event) => update({ collectedBy: event.target.value })}
          >
            <option value="">Choose who took the payment</option>
            {(collectors.data ?? []).map((person) => (
              <option key={person.personId} value={person.personId}>
                {person.displayName}
              </option>
            ))}
          </select>
          {collectors.isError ? (
            <span className={fieldStyles.hint} role="alert">
              The team list could not be loaded. Reload the page.
            </span>
          ) : null}
        </div>
        <div className={fieldStyles.field}>
          <label className={fieldStyles.label} htmlFor={`pay-receipt-${id}`}>
            Receipt (optional)
          </label>
          <input
            className={fieldStyles.input}
            id={`pay-receipt-${id}`}
            type="file"
            accept={receiptAccept}
            disabled={busy}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span className={fieldStyles.hint}>PDF or photo, up to 5 MB.</span>
        </div>
        <Input
          label="Note (optional)"
          value={form.note}
          disabled={busy}
          maxLength={500}
          onChange={(event) => update({ note: event.target.value })}
        />
      </div>
      <div className={styles.actions}>
        <Button
          type="submit"
          disabled={
            busy ||
            amount === null ||
            !form.collectedBy ||
            !form.paidOn ||
            (form.method !== 'cash' && !form.transactionId.trim())
          }
        >
          {busy ? 'Saving…' : 'Record payment'}
        </Button>
      </div>
    </form>
  )
}

function CorrectionForm({
  payment,
  onDone,
}: {
  payment: StudentPayment
  onDone: (message: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!open)
    return (
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Correct {payment.receiptNumber}
        </Button>
      </div>
    )
  const negative = amount.trim().startsWith('-')
  const paise = rupeesToPaise(amount.trim().replace(/^-/, ''))
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || paise === null) return
    setBusy(true)
    setError('')
    try {
      await correctStudentPayment({
        requestKey,
        paymentId: payment.paymentId,
        amountPaise: negative ? -paise : paise,
        note,
      })
      await onDone(`Correction recorded against ${payment.receiptNumber}.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The correction could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  const change = (update: () => void) => {
    update()
    setRequestKey(crypto.randomUUID())
  }
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      {error ? (
        <Callout tone="warning" icon="warning">
          <p role="alert">{error}</p>
        </Callout>
      ) : null}
      <div className={styles.fields}>
        <Input
          label="Correction (₹)"
          hint="Use a minus sign to reduce, for example -500."
          value={amount}
          disabled={busy}
          maxLength={15}
          onChange={(event) => change(() => setAmount(event.target.value))}
        />
        <Input
          label="Correction reason"
          value={note}
          disabled={busy}
          maxLength={500}
          onChange={(event) => change(() => setNote(event.target.value))}
        />
      </div>
      <div className={styles.actions}>
        <Button type="submit" disabled={busy || !paise || note.trim().length < 3}>
          {busy ? 'Saving…' : 'Save correction'}
        </Button>
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function AgreedFeeForm({
  student,
  onDone,
}: {
  student: PaymentStudent
  onDone: (message: string) => Promise<void>
}) {
  const [fee, setFee] = useState(student.feePaise === null ? '' : String(student.feePaise / 100))
  const [reason, setReason] = useState('')
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const paise = rupeesToPaise(fee)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || paise === null) return
    setBusy(true)
    setError('')
    try {
      await setEnrollmentFee({
        requestKey,
        enrollmentId: student.enrollmentId,
        expectedRevision: student.feeRevision,
        agreedFeePaise: paise,
        reason,
      })
      await onDone(`Agreed fee for ${student.displayName} set to ${formatPaise(paise)}.`)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The agreed fee could not be saved.')
    } finally {
      setBusy(false)
    }
  }
  const change = (update: () => void) => {
    update()
    setRequestKey(crypto.randomUUID())
  }
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <h3>Agreed fee for this student</h3>
      {error ? (
        <Callout tone="warning" icon="warning">
          <p role="alert">{error}</p>
        </Callout>
      ) : null}
      <div className={styles.fields}>
        <Input
          label="Agreed fee (₹)"
          hint="Replaces the course fee for this student, for example after a scholarship."
          inputMode="decimal"
          value={fee}
          disabled={busy}
          maxLength={14}
          onChange={(event) => change(() => setFee(event.target.value))}
        />
        <Input
          label="Fee change reason"
          value={reason}
          disabled={busy}
          maxLength={500}
          onChange={(event) => change(() => setReason(event.target.value))}
        />
      </div>
      <div className={styles.actions}>
        <Button
          type="submit"
          variant="secondary"
          disabled={busy || paise === null || reason.trim().length < 3}
        >
          {busy ? 'Saving…' : 'Save agreed fee'}
        </Button>
      </div>
    </form>
  )
}

function StudentLedger({
  student,
  admin,
  onChanged,
}: {
  student: PaymentStudent
  admin: boolean
  onChanged: (message: string) => Promise<void>
}) {
  const { session } = useAuth()
  const payments = useQuery({
    queryKey: ['student-payments', session?.user.id, student.enrollmentId],
    queryFn: () => getStudentPayments(student.enrollmentId),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  async function done(message: string) {
    await payments.refetch()
    await onChanged(message)
  }
  const balance = student.feePaise === null ? null : student.feePaise - student.paidPaise
  return (
    <div className={styles.stack}>
      <div className={styles.summary}>
        <div>
          <span className={styles.meta}>{student.agreedFee ? 'Agreed fee' : 'Course fee'}</span>
          <strong className={styles.amount}>
            {student.feePaise === null ? 'Not set' : formatPaise(student.feePaise)}
          </strong>
        </div>
        <div>
          <span className={styles.meta}>Paid</span>
          <strong className={styles.amount}>{formatPaise(student.paidPaise)}</strong>
        </div>
        <div>
          <span className={styles.meta}>Balance</span>
          <strong className={styles.amount}>{balance === null ? '—' : formatPaise(balance)}</strong>
        </div>
        <div>
          <span className={styles.meta}>Admission fee</span>
          <strong className={styles.amount}>
            {student.admissionFeePaise === null
              ? 'Not set'
              : formatPaise(student.admissionFeePaise)}
          </strong>
        </div>
      </div>
      {payments.isPending ? (
        <p role="status">Loading payments…</p>
      ) : payments.isError ? (
        <p role="alert">{payments.error.message}</p>
      ) : !payments.data.length ? (
        <p className={styles.meta}>No payments recorded yet.</p>
      ) : (
        <ul className={styles.payments} aria-label={`Payments for ${student.displayName}`}>
          {payments.data.map((payment) => (
            <li key={payment.paymentId}>
              <div className={styles.row}>
                <strong>
                  {kindLabels[payment.kind]} ·{' '}
                  <span className={payment.amountPaise < 0 ? styles.negative : styles.amount}>
                    {formatPaise(payment.amountPaise)}
                  </span>
                </strong>
                <span className={styles.meta}>
                  {payment.receiptNumber} · {payment.paidOn}
                </span>
              </div>
              <span className={styles.meta}>
                {[
                  payment.method ? methodLabels[payment.method] : null,
                  payment.transactionId ? `Transaction ${payment.transactionId}` : null,
                  payment.collectedBy ? `Collected by ${payment.collectedBy}` : null,
                  payment.recordedBy ? `Recorded by ${payment.recordedBy}` : null,
                  payment.correctsReceiptNumber
                    ? `Corrects ${payment.correctsReceiptNumber}`
                    : null,
                  payment.source === 'admission' ? 'From Admissions' : null,
                  payment.restricted ? 'Details visible to the recorder and admins' : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              {payment.note ? <span className={styles.meta}>{payment.note}</span> : null}
              {payment.receiptObject ? (
                <div className={styles.actions}>
                  <ReceiptButton
                    objectName={payment.receiptObject}
                    receiptNumber={payment.receiptNumber}
                  />
                </div>
              ) : null}
              {admin && payment.kind !== 'correction' && payment.source === 'ledger' ? (
                <CorrectionForm payment={payment} onDone={done} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <RecordPaymentForm student={student} onDone={done} />
      {admin ? (
        <AgreedFeeForm key={student.feeRevision ?? 0} student={student} onDone={done} />
      ) : null}
    </div>
  )
}

function Ledger() {
  const { session } = useAuth()
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const query = useQuery({
    queryKey: ['payment-ledger', session?.user.id, search],
    queryFn: () => getPaymentLedger(search),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const total = query.data?.reduce((sum, entry) => sum + entry.amountPaise, 0) ?? 0
  return (
    <Card>
      <h2>All payments</h2>
      <div className={styles.stack}>
        <form
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault()
            setSearch(draft.trim())
          }}
        >
          <Input
            label="Search the ledger"
            hint="Student, Member ID, receipt number or transaction ID"
            value={draft}
            maxLength={120}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        {query.isPending ? (
          <p role="status">Loading the ledger…</p>
        ) : query.isError ? (
          <p role="alert">{query.error.message}</p>
        ) : !query.data.length ? (
          <p className={styles.meta}>No payments found.</p>
        ) : (
          <>
            <p className={styles.meta}>
              {query.data.length} entries · Total {formatPaise(total)}
              {query.data.length === 500 ? ' · Showing the latest 500; search to narrow.' : ''}
            </p>
            <ul className={styles.payments} aria-label="Payment ledger">
              {query.data.map((entry) => (
                <li key={entry.paymentId}>
                  <div className={styles.row}>
                    <strong>
                      {entry.displayName} · {formatPaise(entry.amountPaise)}
                    </strong>
                    <span className={styles.meta}>
                      {entry.receiptNumber} · {entry.paidOn}
                    </span>
                  </div>
                  <span className={styles.meta}>
                    {[
                      entry.memberId,
                      entry.courseTitle,
                      kindLabels[entry.kind],
                      entry.method ? methodLabels[entry.method] : null,
                      entry.transactionId ? `Transaction ${entry.transactionId}` : null,
                      entry.collectedBy ? `Collected by ${entry.collectedBy}` : null,
                      `Recorded by ${entry.recordedBy}`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  {entry.note ? <span className={styles.meta}>{entry.note}</span> : null}
                  {entry.receiptObject ? (
                    <div className={styles.actions}>
                      <ReceiptButton
                        objectName={entry.receiptObject}
                        receiptNumber={entry.receiptNumber}
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  )
}

export function PaymentsPage({ portal }: { portal: 'staff' | 'admin' }) {
  const { session } = useAuth()
  const admin = portal === 'admin'
  const [draft, setDraft] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const students = useQuery({
    queryKey: ['payment-students', session?.user.id, search],
    queryFn: () => getPaymentStudents(search),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })

  return (
    <section className={styles.workspace}>
      <header className={styles.pageHeader}>
        <p className="eyebrow">{admin ? 'Admin · Payment ledger' : 'Sales · Payments'}</p>
        <h1>{admin ? 'Payment ledger.' : 'Student payments.'}</h1>
        <p>
          Record every payment: cash, UPI or QR code, card machine, bank transfer or cheque. Once a
          student’s admission fee is recorded, they can sign in to the Dexam App with Google.{' '}
          {admin
            ? 'As an admin you see every detail and can correct entries or set an agreed fee.'
            : 'You see each student’s paid total; transaction details stay with whoever recorded them and admins.'}{' '}
          Payments are never edited or deleted; an admin records a correction instead.
        </p>
      </header>
      {message ? <p role="status">{message}</p> : null}
      {admin ? <Ledger key={message} /> : null}
      <form
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault()
          setSearch(draft.trim())
          setMessage('')
        }}
      >
        <Input
          label="Find a student"
          hint="Name, Member ID or course"
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {students.isPending ? (
        <p role="status">Loading students…</p>
      ) : students.isError ? (
        <Card>
          <p role="alert">{students.error.message}</p>
          <Button onClick={() => void students.refetch()}>Try again</Button>
        </Card>
      ) : !students.data.length ? (
        <EmptyState
          title="No enrolled students found"
          description="Students appear here once their enrolment exists."
        />
      ) : (
        <ul className={styles.list}>
          {students.data.map((student) => (
            <li key={student.enrollmentId}>
              <Card>
                <div className={styles.row}>
                  <div className={styles.identity}>
                    <strong>{student.displayName}</strong>
                    <span className={styles.meta}>
                      {student.memberId ?? 'No Member ID'} · {student.courseTitle} · Paid{' '}
                      {formatPaise(student.paidPaise)}
                      {student.feePaise === null ? '' : ` of ${formatPaise(student.feePaise)}`}
                    </span>
                  </div>
                  <Badge tone={student.admissionPaid ? 'success' : 'warning'}>
                    {student.admissionPaid ? 'Admission fee paid' : 'Admission fee pending'}
                  </Badge>
                </div>
                {open === student.enrollmentId ? (
                  <StudentLedger
                    student={student}
                    admin={admin}
                    onChanged={async (text) => {
                      setMessage(text)
                      await students.refetch()
                    }}
                  />
                ) : (
                  <div className={styles.actions}>
                    <Button variant="secondary" onClick={() => setOpen(student.enrollmentId)}>
                      Open payments for {student.displayName}
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
