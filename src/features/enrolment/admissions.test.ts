import { admitStudent, editAdmission, listAdmissions, type AdmissionDraft } from './admissions'
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
  it('discards responses after account changes', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null })
    mocks.assertCurrent.mockImplementation(() => {
      throw new Error('Session changed')
    })
    await expect(listAdmissions('')).rejects.toThrow('Session changed')
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('sends both optimistic revisions and no identity replacement', async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null })
    await editAdmission({
      enrollment: {
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
        state: 'active',
      },
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
