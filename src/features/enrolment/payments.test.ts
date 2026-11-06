import {
  attachPaymentReceipt,
  formatPaise,
  getPaymentStudents,
  getStudentPayments,
  receiptProblem,
  recordStudentPayment,
  rupeesToPaise,
} from './payments'

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upload: vi.fn(), from: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc, storage: { from: mocks.from } }),
}))

const enrollment = '00000000-0000-4000-8000-0000000000e1'
const payment = '00000000-0000-4000-8000-0000000000f1'
describe('payments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.from.mockReturnValue({ upload: mocks.upload })
  })
  it.each([
    ['5000', 500000],
    ['12,500.50', 1250050],
    ['₹ 10,000', 1000000],
    ['0.5', 50],
  ])('reads rupees %s as paise', (value, paise) => {
    expect(rupeesToPaise(value)).toBe(paise)
  })
  it.each(['', 'abc', '1.234', '-5', '1e5', '9999999999'])('refuses %s', (value) => {
    expect(rupeesToPaise(value)).toBeNull()
  })
  it('formats paise as Indian rupees', () => {
    expect(formatPaise(1250050)).toBe('₹12,500.50')
  })
  it('maps the student list and fails closed on an unexpected shape', async () => {
    mocks.rpc.mockResolvedValueOnce({
      error: null,
      data: [
        {
          enrollment_id: enrollment,
          person_id: '00000000-0000-4000-8000-0000000000d1',
          member_id: 'DXM-2K3M9Q2RW5TY',
          display_name: 'Fictional Student',
          course_title: 'Fictional Course',
          enrollment_status: 'active',
          fee_paise: 15000000,
          agreed_fee: false,
          admission_fee_paise: 1000000,
          paid_paise: 500000,
          admission_paid: false,
          fee_revision: null,
        },
      ],
    })
    await expect(getPaymentStudents(' fictional ')).resolves.toMatchObject([
      { enrollmentId: enrollment, paidPaise: 500000, admissionPaid: false },
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_payment_students', { p_search: 'fictional' })
    mocks.rpc.mockResolvedValueOnce({ error: null, data: [{ enrollment_id: 'x' }] })
    await expect(getPaymentStudents('')).rejects.toThrow('could not be loaded')
  })
  it('keeps restricted rows without details for another recorder', async () => {
    mocks.rpc.mockResolvedValue({
      error: null,
      data: [
        {
          payment_id: payment,
          receipt_number: 'DXR-000001',
          kind: 'admission_fee',
          method: 'upi',
          amount_paise: 500000,
          paid_on: '2026-11-06',
          transaction_id: null,
          collected_by: null,
          recorded_by: null,
          recorded_at: '2026-11-06T10:00:00+05:30',
          note: null,
          corrects_receipt_number: null,
          has_receipt: true,
          receipt_object: null,
          restricted: true,
          source: 'ledger',
        },
      ],
    })
    await expect(getStudentPayments(enrollment)).resolves.toMatchObject([
      { receiptNumber: 'DXR-000001', restricted: true, transactionId: null, receiptObject: null },
    ])
  })
  it('records a payment and explains validation failures', async () => {
    const input = {
      requestKey: '00000000-0000-4000-8000-0000000000a1',
      enrollmentId: enrollment,
      kind: 'admission_fee' as const,
      method: 'cash' as const,
      amountPaise: 500000,
      paidOn: '2026-11-06',
      transactionId: '',
      collectedBy: '00000000-0000-4000-8000-0000000000b1',
      note: '',
    }
    mocks.rpc.mockResolvedValueOnce({
      error: null,
      data: { paymentId: payment, receiptNumber: 'DXR-000002', replayed: false },
    })
    await expect(recordStudentPayment(input)).resolves.toEqual({
      paymentId: payment,
      receiptNumber: 'DXR-000002',
    })
    expect(mocks.rpc).toHaveBeenCalledWith(
      'record_student_payment',
      expect.objectContaining({ p_amount_paise: 500000, p_method: 'cash' }),
    )
    mocks.rpc.mockResolvedValueOnce({
      error: { code: '22023', message: 'choose a current Sales or Admin team member as collector' },
      data: null,
    })
    await expect(recordStudentPayment(input)).rejects.toThrow('Not recorded: choose a current')
    mocks.rpc.mockResolvedValueOnce({ error: { code: '42501', message: 'private' }, data: null })
    await expect(recordStudentPayment(input)).rejects.toThrow('cannot record payments')
  })
  it('checks receipt type and size before uploading', () => {
    expect(receiptProblem(new File(['x'], 'r.pdf', { type: 'application/pdf' }))).toBe('')
    expect(receiptProblem(new File(['x'], 'r.html', { type: 'text/html' }))).toMatch('PDF, JPG')
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'r.png', { type: 'image/png' })
    expect(receiptProblem(big)).toMatch('5 MB')
  })
  it('uploads the receipt under its payment and attaches it', async () => {
    mocks.upload.mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ error: null, data: true })
    await attachPaymentReceipt(payment, new File(['x'], 'r.jpg', { type: 'image/jpeg' }))
    expect(mocks.from).toHaveBeenCalledWith('payment-receipts')
    const name = mocks.upload.mock.calls[0]?.[0] as string
    expect(name).toMatch(new RegExp(`^${payment}/receipt-[0-9a-f-]{36}\\.jpg$`))
    expect(mocks.rpc).toHaveBeenCalledWith('attach_payment_receipt', {
      p_payment_id: payment,
      p_object_name: name,
    })
  })
  it('keeps the payment when the receipt upload fails', async () => {
    mocks.upload.mockResolvedValue({ error: new Error('storage detail') })
    await expect(
      attachPaymentReceipt(payment, new File(['x'], 'r.pdf', { type: 'application/pdf' })),
    ).rejects.toThrow('The payment is saved')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
