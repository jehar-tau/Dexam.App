import { getStudentWorkspace } from './getStudentWorkspace'

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  enrollments: vi.fn(),
}))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'people') {
        return { select: () => ({ single: mocks.profile }) }
      }
      throw new Error('Unexpected table')
    },
    rpc: mocks.enrollments,
  }),
}))

describe('getStudentWorkspace', () => {
  beforeEach(() => {
    mocks.profile.mockReset()
    mocks.enrollments.mockReset()
  })

  it('maps the current student profile and enrolments', async () => {
    mocks.profile.mockResolvedValue({
      data: { member_id: 'DXM-2K3M9Q2RW5TY', display_name: 'Aarohi Deshmukh' },
      error: null,
    })
    mocks.enrollments.mockResolvedValue({
      data: [
        {
          enrollment_id: 'enrolment-id',
          access_state: 'expired',
          archive_available: true,
          approved_at: '2026-10-05T10:00:00.000Z',
          activated_at: '2026-10-06T10:00:00.000Z',
          offering_title: 'Design Entrance Foundation',
          cohort_name: 'Studio Batch',
        },
      ],
      error: null,
    })

    await expect(getStudentWorkspace()).resolves.toEqual({
      memberId: 'DXM-2K3M9Q2RW5TY',
      displayName: 'Aarohi Deshmukh',
      enrollments: [
        {
          enrollmentId: 'enrolment-id',
          status: 'expired',
          archiveAvailable: true,
          approvedAt: '2026-10-05T10:00:00.000Z',
          activatedAt: '2026-10-06T10:00:00.000Z',
          offeringTitle: 'Design Entrance Foundation',
          cohortName: 'Studio Batch',
        },
      ],
    })
    expect(mocks.enrollments).toHaveBeenCalledWith('list_my_student_enrollment_access')
  })

  it('accepts an enrolment without a cohort', async () => {
    mocks.profile.mockResolvedValue({
      data: { member_id: 'DXM-2K3M9Q2RW5TY', display_name: null },
      error: null,
    })
    mocks.enrollments.mockResolvedValue({
      data: [
        {
          enrollment_id: 'enrolment-id',
          access_state: 'expired',
          archive_available: true,
          approved_at: null,
          activated_at: null,
          offering_title: 'Portfolio Workshop',
          cohort_name: null,
        },
      ],
      error: null,
    })

    await expect(getStudentWorkspace()).resolves.toEqual(
      expect.objectContaining({
        displayName: null,
        enrollments: [expect.objectContaining({ cohortName: null })],
      }),
    )
  })

  it('fails closed when a related record is incomplete', async () => {
    mocks.profile.mockResolvedValue({
      data: { member_id: 'DXM-2K3M9Q2RW5TY', display_name: 'Aarohi' },
      error: null,
    })
    mocks.enrollments.mockResolvedValue({
      data: [{ id: 'enrolment-id', status: 'active', offering: null }],
      error: null,
    })

    await expect(getStudentWorkspace()).rejects.toThrow(
      'Your learning workspace could not be loaded. Please try again.',
    )
  })
})
