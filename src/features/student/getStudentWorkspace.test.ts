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
      return {
        select: () => ({ order: mocks.enrollments }),
      }
    },
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
          id: 'enrolment-id',
          status: 'active',
          approved_at: '2026-10-05T10:00:00.000Z',
          activated_at: '2026-10-06T10:00:00.000Z',
          offering: { title: 'Design Entrance Foundation' },
          cohort: { name: 'Studio Batch' },
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
          status: 'active',
          approvedAt: '2026-10-05T10:00:00.000Z',
          activatedAt: '2026-10-06T10:00:00.000Z',
          offeringTitle: 'Design Entrance Foundation',
          cohortName: 'Studio Batch',
        },
      ],
    })
  })

  it('accepts an enrolment without a cohort', async () => {
    mocks.profile.mockResolvedValue({
      data: { member_id: 'DXM-2K3M9Q2RW5TY', display_name: null },
      error: null,
    })
    mocks.enrollments.mockResolvedValue({
      data: [
        {
          id: 'enrolment-id',
          status: 'active',
          approved_at: null,
          activated_at: null,
          offering: { title: 'Portfolio Workshop' },
          cohort: null,
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
