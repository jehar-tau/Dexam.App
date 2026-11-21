import {
  admitStudent,
  editAdmission,
  getAdmissionHistory,
  listAdmissions,
  type AdmissionDraft,
} from './admissions'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), assertCurrent: vi.fn(), dispose: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({}) }))
vi.mock('../auth/accountOperation', () => ({
  captureAccountOperation: () =>
    Promise.resolve({
      client: { rpc: mocks.rpc },
      assertCurrent: mocks.assertCurrent,
      dispose: mocks.dispose,
    }),
}))
const person = 'ab100000-0000-4000-8000-000000000004'
const enrollment = 'ab900000-0000-4000-8000-000000000001'
const request = 'ab700000-0000-4000-8000-000000000001'
const draft: AdmissionDraft = {
  requestKey: request,
  existingPerson: person,
  name: 'Fictional Learner',
  email: ' Student.Name+Course@Fixture.Invalid ',
  offeringId: 'ab500000-0000-4000-8000-000000000001',
  cohortId: null,
  startsAt: '2027-01-01T00:00:00Z',
  expiresAt: '2028-01-01T00:00:00Z',
  method: 'cash',
  amount: '2500.50',
  paidAt: '2026-11-01T00:00:00Z',
  reference: 'Fictional receipt',
  reason: 'Reviewed identity',
  confirmed: true,
}
const row = {
  personId: person,
  memberId: 'DXM-TEST',
  name: 'Fictional',
  loginEmail: 'student@fixture.invalid',
  loginRevision: 4,
  enrollmentId: enrollment,
  offeringId: draft.offeringId,
  programme: 'Fictional',
  cohortId: null,
  batch: null,
  revision: 2,
  startsAt: draft.startsAt,
  expiresAt: draft.expiresAt,
  state: 'active' as const,
}

describe('shared admissions contract', () => {
  beforeEach(() => vi.resetAllMocks())
  it('binds exact manual evidence and deliberate person without normalizing dots or plus', async () => {
    mocks.rpc.mockResolvedValue({
      data: { personId: person, enrollmentId: enrollment, receiptId: request, replayed: false },
      error: null,
    })
    await admitStudent(draft)
    expect(mocks.rpc).toHaveBeenCalledWith(
      'admit_student',
      expect.objectContaining({
        p_request_key: request,
        p_existing_person: person,
        p_email: 'student.name+course@fixture.invalid',
        p_amount_paise: 250050,
        p_confirmed: true,
        p_method: 'cash',
      }),
    )
    expect(mocks.assertCurrent).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('never sends unconfirmed or zero manual evidence', async () => {
    await expect(admitStudent({ ...draft, confirmed: false })).rejects.toThrow('Confirm')
    await expect(admitStudent({ ...draft, amount: '0' })).rejects.toThrow('positive')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('rejects a reversed custom window before creating a receipt', async () => {
    await expect(
      admitStudent({ ...draft, expiresAt: '2027-01-01T05:29:00+05:30' }),
    ).rejects.toThrow('Access expiry must be after its start')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('accepts a later instant within the same millisecond of a stored window', async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
    await editAdmission({
      enrollment: { ...row, expiresAt: '2028-01-01T00:00:00.000001Z' },
      requestKey: request,
      action: 'renewal',
      expiresAt: '2028-01-01T05:30:00.000002+05:30',
      reason: 'Reviewed expiry',
    })
    expect(mocks.rpc).toHaveBeenCalledOnce()
  })

  it('distinguishes rejected input from a missing response without exposing SQL details', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: '22023', message: 'private detail' },
    })
    await expect(admitStudent(draft)).rejects.toThrow('Review the admission inputs')
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '', message: 'Failed to fetch' } })
    await expect(admitStudent(draft)).rejects.toThrow('Keep this form unchanged to retry safely')
  })

  it('retains a safe recoverable conflict without echoing provider details', async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '40001', message: 'private provider detail' },
    })
    await expect(admitStudent(draft)).rejects.toThrow('Refresh and deliberately review')
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('rejects malformed directory responses without leaking data', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ private: 'secret' }], error: null })
    await expect(listAdmissions('query')).rejects.toThrow('response could not be verified')
  })
  it('preserves directory scope, offset and the last microsecond of the India expiry date', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    await listAdmissions('DXM', 'scheduled', {
      offeringId: draft.offeringId,
      cohortId: request,
      expiresBefore: '2027-01-01T23:59:59.999999+05:30',
      offset: 50,
    })
    expect(mocks.rpc).toHaveBeenCalledWith('list_admissions_directory', {
      p_search: 'DXM',
      p_state: 'scheduled',
      p_offering: draft.offeringId,
      p_cohort: request,
      p_expires_before: '2027-01-01T23:59:59.999999+05:30',
      p_offset: 50,
    })
  })
  it('reads one enrolment history page with manual receipt evidence and public audit fields', async () => {
    const receipt = {
      id: request,
      evidenceKind: 'manual',
      method: 'cash',
      amountPaise: 500000,
      currency: 'INR',
      paidAt: draft.paidAt,
      reference: 'Fixture receipt',
      confirmedBy: person,
      confirmedByName: null,
      confirmedAt: draft.paidAt,
    }
    const change = {
      id: 1,
      actorId: person,
      actorName: 'Fixture admin',
      action: 'admitted',
      reason: 'Fixture admission',
      at: draft.paidAt,
      prior: {},
      next: { receiptId: request, request: { internal: true } },
    }
    mocks.rpc.mockResolvedValue({
      data: { changes: [change], receipts: [receipt], hasMore: false },
      error: null,
    })
    const page = await getAdmissionHistory(enrollment, 1)
    expect(mocks.rpc).toHaveBeenCalledWith('get_admission_history_page', {
      p_enrollment: enrollment,
      p_page: 1,
    })
    expect(page.changes[0]?.next).toEqual({ receiptId: request })
    expect(page.receipts).toEqual([receipt])
    mocks.rpc.mockResolvedValue({
      data: { changes: [], receipts: Array(26).fill(receipt), hasMore: true },
      error: null,
    })
    await expect(getAdmissionHistory(enrollment, 0)).rejects.toThrow(
      'response could not be verified',
    )
  })
  it('discards responses after account changes', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    mocks.assertCurrent.mockImplementation(() => {
      throw new Error('Session changed')
    })
    await expect(listAdmissions('')).rejects.toThrow('Session changed')
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('checks date edits and non-extending renewals against the selected enrolment', async () => {
    const base = { enrollment: row, requestKey: request, reason: 'Reviewed access dates' }
    await expect(
      editAdmission({
        ...base,
        action: 'dates',
        startsAt: draft.startsAt,
        expiresAt: draft.startsAt,
      }),
    ).rejects.toThrow('Access expiry must be after its start')
    await expect(
      editAdmission({ ...base, action: 'renewal', expiresAt: '2028-01-01T05:30:00+05:30' }),
    ).rejects.toThrow('Renewal must extend')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('sends both optimistic revisions and no identity replacement', async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
    await editAdmission({
      enrollment: row,
      requestKey: request,
      action: 'suspension',
      reason: 'Reviewed suspension',
    })
    expect(mocks.rpc).toHaveBeenCalledWith(
      'edit_admission',
      expect.objectContaining({
        p_expected_revision: 2,
        p_expected_person_revision: 4,
        p_action: 'suspension',
        p_name: null,
        p_start: null,
        p_expiry: null,
        p_cohort: null,
      }),
    )
  })
})
