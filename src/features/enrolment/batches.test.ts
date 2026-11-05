import {
  addDays,
  assignStudentBatch,
  getBatchStudents,
  getBatchWorkspace,
  istDate,
  istMidnight,
  saveBatch,
} from './batches'
const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../auth/supabaseClient', () => ({ getSupabaseClient: () => ({ rpc: mocks.rpc }) }))
const offering = '00000000-0000-4000-8000-0000000000a1'
const batch = '00000000-0000-4000-8000-0000000000b1'
const enrolment = '00000000-0000-4000-8000-0000000000c1'
const workspace = {
  canManage: true,
  serviceTypes: [{ key: 'crash_course', label: 'Crash course', defaultDurationDays: 45 }],
  offerings: [{ id: offering, title: 'Fictional course', canAssign: true }],
  batches: [
    {
      id: batch,
      offeringId: offering,
      code: 'B261115-ABCDEF',
      name: 'Fictional batch',
      serviceType: 'crash_course',
      status: 'active',
      startsAt: '2026-11-14T18:30:00+00:00',
      endsAt: '2026-12-29T18:30:00+00:00',
      revision: 1,
      studentCount: 0,
    },
  ],
}
describe('batch service', () => {
  beforeEach(() => mocks.rpc.mockReset())
  it('stores calendar dates as India midnight and pre-fills durations', () => {
    expect(istMidnight('2026-11-15')).toBe('2026-11-15T00:00:00+05:30')
    expect(() => istMidnight('15/11/2026')).toThrow('valid date')
    expect(istDate('2026-11-14T18:30:00+00:00')).toBe('2026-11-15')
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(addDays('2026-11-15', 45)).toBe('2026-12-30')
  })
  it('validates the workspace and fails closed on malformed data', async () => {
    mocks.rpc.mockResolvedValue({ data: workspace, error: null })
    expect((await getBatchWorkspace()).batches[0]?.name).toBe('Fictional batch')
    mocks.rpc.mockResolvedValue({ data: { ...workspace, batches: [{ id: 'x' }] }, error: null })
    await expect(getBatchWorkspace()).rejects.toThrow('Batches could not be loaded')
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } })
    await expect(getBatchWorkspace()).rejects.toThrow('Batches could not be loaded')
  })
  it('maps the roster without extra fields', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          enrollment_id: enrolment,
          member_id: 'DXM-2K3M9Q2RW5TY',
          display_name: 'Fictional Student',
          cohort_id: null,
          movable: true,
        },
      ],
      error: null,
    })
    expect(await getBatchStudents(offering)).toEqual([
      {
        enrollmentId: enrolment,
        memberId: 'DXM-2K3M9Q2RW5TY',
        displayName: 'Fictional Student',
        batchId: null,
        movable: true,
      },
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_batch_students', { p_offering_id: offering })
  })
  it('sends explicit batch fields and explains stale or denied saves', async () => {
    mocks.rpc.mockResolvedValue({ data: batch, error: null })
    await saveBatch({
      requestKey: enrolment,
      batchId: null,
      expectedRevision: null,
      offeringId: offering,
      name: 'Fictional batch',
      serviceType: 'crash_course',
      startsOn: '2026-11-15',
      endsOn: '2026-12-30',
      status: 'active',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('save_batch', {
      p_request_key: enrolment,
      p_cohort_id: null,
      p_expected_revision: null,
      p_offering_id: offering,
      p_name: 'Fictional batch',
      p_service_type: 'crash_course',
      p_starts_at: '2026-11-15T00:00:00+05:30',
      p_ends_at: '2026-12-30T00:00:00+05:30',
      p_status: 'active',
    })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001', message: 'x' } })
    await expect(
      saveBatch({
        requestKey: enrolment,
        batchId: batch,
        expectedRevision: 1,
        offeringId: offering,
        name: 'Fictional batch',
        serviceType: 'crash_course',
        startsOn: '2026-11-15',
        endsOn: '2026-12-30',
        status: 'active',
      }),
    ).rejects.toThrow('changed since you opened it')
  })
  it('moves a student with the expected batch and reason', async () => {
    mocks.rpc.mockResolvedValue({ data: batch, error: null })
    await assignStudentBatch({
      requestKey: enrolment,
      enrollmentId: enrolment,
      expectedBatchId: null,
      batchId: batch,
      reason: 'Converted lead',
    })
    expect(mocks.rpc).toHaveBeenCalledWith('assign_student_batch', {
      p_request_key: enrolment,
      p_enrollment_id: enrolment,
      p_expected_cohort_id: null,
      p_cohort_id: batch,
      p_reason: 'Converted lead',
    })
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'private' } })
    await expect(
      assignStudentBatch({
        requestKey: enrolment,
        enrollmentId: enrolment,
        expectedBatchId: null,
        batchId: batch,
        reason: 'Converted lead',
      }),
    ).rejects.toThrow('cannot place students')
  })
})
