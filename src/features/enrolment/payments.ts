import { z } from 'zod'
import { getSupabaseClient } from '../auth/supabaseClient'
import { downloadProtectedObject, fileNameFor, saveBlob } from '../files/protectedFiles'

// D-068/F057: the payment ledger. Sales and admins record; admins see every detail and correct.
export const paymentKinds = ['admission_fee', 'course_fee', 'other'] as const
export const paymentMethods = ['cash', 'upi', 'card_machine', 'bank_transfer', 'cheque'] as const
export type PaymentKind = (typeof paymentKinds)[number]
export type PaymentMethod = (typeof paymentMethods)[number]
export const kindLabels: Record<PaymentKind | 'correction', string> = {
  admission_fee: 'Admission fee',
  course_fee: 'Course fee',
  other: 'Other',
  correction: 'Correction',
}
export const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  upi: 'UPI / QR code',
  card_machine: 'Card machine',
  bank_transfer: 'Bank transfer',
  cheque: 'Cheque',
}

const money = z.number().int()
const studentSchema = z.object({
  enrollment_id: z.uuid(),
  person_id: z.uuid(),
  member_id: z.string().nullable(),
  display_name: z.string(),
  course_title: z.string(),
  enrollment_status: z.string(),
  fee_paise: money.nullable(),
  agreed_fee: z.boolean(),
  admission_fee_paise: money.nullable(),
  paid_paise: money,
  admission_paid: z.boolean(),
  fee_revision: z.number().int().positive().nullable(),
})
export type PaymentStudent = {
  enrollmentId: string
  personId: string
  memberId: string | null
  displayName: string
  courseTitle: string
  enrollmentStatus: string
  feePaise: number | null
  agreedFee: boolean
  admissionFeePaise: number | null
  paidPaise: number
  admissionPaid: boolean
  feeRevision: number | null
}
const paymentSchema = z.object({
  payment_id: z.uuid(),
  receipt_number: z.string(),
  kind: z.enum([...paymentKinds, 'correction']),
  method: z.enum(paymentMethods).nullable(),
  amount_paise: money,
  paid_on: z.iso.date(),
  transaction_id: z.string().nullable(),
  collected_by: z.string().nullable(),
  recorded_by: z.string().nullable(),
  recorded_at: z.iso.datetime({ offset: true }),
  note: z.string().nullable(),
  corrects_receipt_number: z.string().nullable(),
  has_receipt: z.boolean(),
  receipt_object: z.string().nullable(),
  restricted: z.boolean(),
  source: z.enum(['ledger', 'admission']),
})
export type StudentPayment = {
  paymentId: string
  receiptNumber: string
  kind: PaymentKind | 'correction'
  method: PaymentMethod | null
  amountPaise: number
  paidOn: string
  transactionId: string | null
  collectedBy: string | null
  recordedBy: string | null
  note: string | null
  correctsReceiptNumber: string | null
  hasReceipt: boolean
  receiptObject: string | null
  restricted: boolean
  source: 'ledger' | 'admission'
}
const ledgerSchema = z.object({
  payment_id: z.uuid(),
  receipt_number: z.string(),
  enrollment_id: z.uuid(),
  member_id: z.string().nullable(),
  display_name: z.string(),
  course_title: z.string(),
  kind: z.enum([...paymentKinds, 'correction']),
  method: z.enum(paymentMethods).nullable(),
  amount_paise: money,
  paid_on: z.iso.date(),
  transaction_id: z.string().nullable(),
  collected_by: z.string().nullable(),
  recorded_by: z.string(),
  recorded_at: z.iso.datetime({ offset: true }),
  note: z.string().nullable(),
  has_receipt: z.boolean(),
  receipt_object: z.string().nullable(),
})
export type LedgerEntry = {
  paymentId: string
  receiptNumber: string
  enrollmentId: string
  memberId: string | null
  displayName: string
  courseTitle: string
  kind: PaymentKind | 'correction'
  method: PaymentMethod | null
  amountPaise: number
  paidOn: string
  transactionId: string | null
  collectedBy: string | null
  recordedBy: string
  note: string | null
  receiptObject: string | null
}

/** Rupees typed by staff ("12,500.50") to whole paise; null when not a valid positive amount. */
export function rupeesToPaise(value: string) {
  const text = value.replace(/[,\s₹]/g, '')
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(text)) return null
  const [whole = '0', fraction = ''] = text.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})
export function formatPaise(paise: number) {
  return rupees.format(paise / 100)
}

function clientOrThrow(message: string) {
  const client = getSupabaseClient()
  if (!client) throw new Error(message)
  return client
}
const unavailable = 'Payments could not be loaded. Check your access and try again.'

export async function getPaymentStudents(search: string): Promise<PaymentStudent[]> {
  const result = await clientOrThrow(unavailable).rpc('list_payment_students', {
    p_search: search.trim(),
  })
  const parsed = z.array(studentSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({
    enrollmentId: row.enrollment_id,
    personId: row.person_id,
    memberId: row.member_id,
    displayName: row.display_name,
    courseTitle: row.course_title,
    enrollmentStatus: row.enrollment_status,
    feePaise: row.fee_paise,
    agreedFee: row.agreed_fee,
    admissionFeePaise: row.admission_fee_paise,
    paidPaise: row.paid_paise,
    admissionPaid: row.admission_paid,
    feeRevision: row.fee_revision,
  }))
}

export async function getStudentPayments(enrollmentId: string): Promise<StudentPayment[]> {
  const result = await clientOrThrow(unavailable).rpc('list_student_payments', {
    p_enrollment_id: enrollmentId,
  })
  const parsed = z.array(paymentSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({
    paymentId: row.payment_id,
    receiptNumber: row.receipt_number,
    kind: row.kind,
    method: row.method,
    amountPaise: row.amount_paise,
    paidOn: row.paid_on,
    transactionId: row.transaction_id,
    collectedBy: row.collected_by,
    recordedBy: row.recorded_by,
    note: row.note,
    correctsReceiptNumber: row.corrects_receipt_number,
    hasReceipt: row.has_receipt,
    receiptObject: row.receipt_object,
    restricted: row.restricted,
    source: row.source,
  }))
}

export async function getPaymentLedger(search: string): Promise<LedgerEntry[]> {
  const result = await clientOrThrow(unavailable).rpc('list_payment_ledger', {
    p_search: search.trim(),
  })
  const parsed = z.array(ledgerSchema).safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({
    paymentId: row.payment_id,
    receiptNumber: row.receipt_number,
    enrollmentId: row.enrollment_id,
    memberId: row.member_id,
    displayName: row.display_name,
    courseTitle: row.course_title,
    kind: row.kind,
    method: row.method,
    amountPaise: row.amount_paise,
    paidOn: row.paid_on,
    transactionId: row.transaction_id,
    collectedBy: row.collected_by,
    recordedBy: row.recorded_by,
    note: row.note,
    receiptObject: row.receipt_object,
  }))
}

export async function getPaymentCollectors() {
  const result = await clientOrThrow(unavailable).rpc('list_payment_collectors')
  const parsed = z
    .array(z.object({ person_id: z.uuid(), display_name: z.string() }))
    .safeParse(result.data)
  if (result.error || !parsed.success) throw new Error(unavailable)
  return parsed.data.map((row) => ({ personId: row.person_id, displayName: row.display_name }))
}

const recordMessages: Record<string, string> = {
  '42501': 'Your account cannot record payments.',
  '40001': 'This request was already used. Reload and review.',
}
export async function recordStudentPayment(input: {
  requestKey: string
  enrollmentId: string
  kind: PaymentKind
  method: PaymentMethod
  amountPaise: number
  paidOn: string
  transactionId: string
  collectedBy: string
  note: string
}) {
  const result = await clientOrThrow('The payment could not be recorded.').rpc(
    'record_student_payment',
    {
      p_request_key: input.requestKey,
      p_enrollment_id: input.enrollmentId,
      p_kind: input.kind,
      p_method: input.method,
      p_amount_paise: input.amountPaise,
      p_paid_on: input.paidOn,
      p_transaction_id: input.transactionId,
      p_collected_by: input.collectedBy,
      p_note: input.note,
    },
  )
  const parsed = z.object({ paymentId: z.uuid(), receiptNumber: z.string() }).safeParse(result.data)
  if (result.error || !parsed.success) {
    const code = result.error?.code ?? ''
    throw new Error(
      recordMessages[code] ??
        (code === '22023' && result.error?.message
          ? `Not recorded: ${result.error.message}.`
          : 'The payment could not be recorded.'),
    )
  }
  return parsed.data
}

const receiptTypes: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
export const receiptAccept = Object.keys(receiptTypes).join(',')
export const receiptMaxBytes = 5 * 1024 * 1024
export function receiptProblem(file: File) {
  if (!Object.hasOwn(receiptTypes, file.type)) return 'Choose a PDF, JPG, PNG or WebP receipt.'
  if (file.size > receiptMaxBytes) return 'The receipt file must be 5 MB or smaller.'
  return ''
}
/** Uploads the receipt under the payment it belongs to, then attaches it once. */
export async function attachPaymentReceipt(paymentId: string, file: File) {
  const problem = receiptProblem(file)
  if (problem) throw new Error(problem)
  const client = clientOrThrow('The receipt could not be uploaded.')
  const name = `${paymentId}/receipt-${crypto.randomUUID()}.${receiptTypes[file.type]}`
  const upload = await client.storage
    .from('payment-receipts')
    .upload(name, file, { contentType: file.type, upsert: false })
  if (upload.error) throw new Error('The receipt could not be uploaded. The payment is saved.')
  const attached = await client.rpc('attach_payment_receipt', {
    p_payment_id: paymentId,
    p_object_name: name,
  })
  if (attached.error || attached.data !== true)
    throw new Error('The receipt could not be attached. The payment is saved.')
}
export async function saveReceipt(objectName: string, receiptNumber: string) {
  const blob = await downloadProtectedObject(
    clientOrThrow('The receipt is not available.'),
    'payment-receipts',
    objectName,
  )
  saveBlob(blob, fileNameFor(`receipt-${receiptNumber}`, blob.type))
}

export async function correctStudentPayment(input: {
  requestKey: string
  paymentId: string
  amountPaise: number
  note: string
}) {
  const result = await clientOrThrow('The correction could not be saved.').rpc(
    'correct_student_payment',
    {
      p_request_key: input.requestKey,
      p_payment_id: input.paymentId,
      p_amount_paise: input.amountPaise,
      p_note: input.note,
    },
  )
  if (result.error || typeof result.data !== 'object' || result.data === null) {
    const code = result.error?.code ?? ''
    throw new Error(
      code === '22023' && result.error?.message
        ? `Not saved: ${result.error.message}.`
        : code === '42501'
          ? 'Only an admin can correct a payment.'
          : 'The correction could not be saved.',
    )
  }
}

export async function setEnrollmentFee(input: {
  requestKey: string
  enrollmentId: string
  expectedRevision: number | null
  agreedFeePaise: number
  reason: string
}) {
  const result = await clientOrThrow('The agreed fee could not be saved.').rpc(
    'set_enrollment_fee',
    {
      p_request_key: input.requestKey,
      p_enrollment_id: input.enrollmentId,
      p_expected_revision: input.expectedRevision,
      p_agreed_fee_paise: input.agreedFeePaise,
      p_reason: input.reason,
    },
  )
  if (result.error || typeof result.data !== 'number') {
    const code = result.error?.code ?? ''
    throw new Error(
      code === '40001'
        ? 'This fee changed since you opened it. Reload and review.'
        : code === '42501'
          ? 'Only an admin can set an agreed fee.'
          : 'The agreed fee could not be saved.',
    )
  }
}
