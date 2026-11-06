import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '../test/render'
import { PaymentsPage } from './PaymentsPage'

const mocks = vi.hoisted(() => ({
  students: vi.fn(),
  payments: vi.fn(),
  ledger: vi.fn(),
  collectors: vi.fn(),
  record: vi.fn(),
  attach: vi.fn(),
  correct: vi.fn(),
  fee: vi.fn(),
}))
vi.mock('../features/auth/AuthContext', () => ({
  useAuth: () => ({ session: { user: { id: 'fictional' } } }),
}))
vi.mock('../features/enrolment/payments', async (importOriginal) => {
  const original = await importOriginal<typeof import('../features/enrolment/payments')>()
  return {
    ...original,
    getPaymentStudents: mocks.students,
    getStudentPayments: mocks.payments,
    getPaymentLedger: mocks.ledger,
    getPaymentCollectors: mocks.collectors,
    recordStudentPayment: mocks.record,
    attachPaymentReceipt: mocks.attach,
    correctStudentPayment: mocks.correct,
    setEnrollmentFee: mocks.fee,
  }
})

const student = {
  enrollmentId: '00000000-0000-4000-8000-0000000000e1',
  personId: '00000000-0000-4000-8000-0000000000d1',
  memberId: 'DXM-2K3M9Q2RW5TY',
  displayName: 'Fictional Student',
  courseTitle: 'Fictional Course',
  enrollmentStatus: 'active',
  feePaise: 15000000,
  agreedFee: false,
  admissionFeePaise: 1000000,
  paidPaise: 0,
  admissionPaid: false,
  feeRevision: null,
}
const payment = {
  paymentId: '00000000-0000-4000-8000-0000000000f1',
  receiptNumber: 'DXR-000001',
  kind: 'admission_fee' as const,
  method: 'upi' as const,
  amountPaise: 500000,
  paidOn: '2026-11-06',
  transactionId: 'UPI-1',
  collectedBy: 'Fictional Sales',
  recordedBy: 'Fictional Sales',
  note: null,
  correctsReceiptNumber: null,
  hasReceipt: false,
  receiptObject: null,
  restricted: false,
  source: 'ledger' as const,
}
describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.students.mockResolvedValue([student])
    mocks.payments.mockResolvedValue([payment])
    mocks.ledger.mockResolvedValue([])
    mocks.collectors.mockResolvedValue([
      { personId: '00000000-0000-4000-8000-0000000000b1', displayName: 'Fictional Sales' },
    ])
    mocks.record.mockResolvedValue({
      paymentId: '00000000-0000-4000-8000-0000000000f2',
      receiptNumber: 'DXR-000002',
    })
  })
  it('lets Sales record a payment with who collected it', async () => {
    const user = userEvent.setup()
    renderApp(<PaymentsPage portal="staff" />)
    expect(await screen.findByText('Admission fee pending')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open payments for Fictional Student' }))
    expect(await screen.findByText(/Transaction UPI-1/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Correct / })).not.toBeInTheDocument()
    expect(screen.queryByText('Agreed fee for this student')).not.toBeInTheDocument()
    expect(screen.queryByText('All payments')).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Amount (₹)'), '5,000')
    await user.type(screen.getByLabelText('Transaction ID'), 'UPI-2')
    await user.selectOptions(await screen.findByLabelText('Collected by'), 'Fictional Sales')
    await user.click(screen.getByRole('button', { name: 'Record payment' }))
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: student.enrollmentId,
        kind: 'admission_fee',
        method: 'upi',
        amountPaise: 500000,
        transactionId: 'UPI-2',
        collectedBy: '00000000-0000-4000-8000-0000000000b1',
      }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('DXR-000002')
    expect(mocks.attach).not.toHaveBeenCalled()
  })
  it('requires a transaction ID except for cash', async () => {
    const user = userEvent.setup()
    renderApp(<PaymentsPage portal="staff" />)
    await user.click(
      await screen.findByRole('button', { name: 'Open payments for Fictional Student' }),
    )
    await user.type(await screen.findByLabelText('Amount (₹)'), '100')
    await user.selectOptions(await screen.findByLabelText('Collected by'), 'Fictional Sales')
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeDisabled()
    await user.selectOptions(screen.getByLabelText('Method'), 'Cash')
    expect(screen.getByRole('button', { name: 'Record payment' })).toBeEnabled()
  })
  it('gives admins the ledger, corrections and agreed fees', async () => {
    const user = userEvent.setup()
    mocks.correct.mockResolvedValue(undefined)
    renderApp(<PaymentsPage portal="admin" />)
    expect(await screen.findByText('All payments')).toBeInTheDocument()
    await user.click(
      await screen.findByRole('button', { name: 'Open payments for Fictional Student' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Correct DXR-000001' }))
    await user.type(screen.getByLabelText('Correction (₹)'), '-1,000')
    await user.type(screen.getByLabelText('Correction reason'), 'Typed too much')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))
    expect(mocks.correct).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: payment.paymentId, amountPaise: -100000 }),
    )
    expect(screen.getByText('Agreed fee for this student')).toBeInTheDocument()
  })
})
