import { listActivationQueue } from './listActivationQueue'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc }),
}))

describe('listActivationQueue', () => {
  beforeEach(() => {
    mocks.rpc.mockReset()
  })

  it('maps the minimal queue response to application fields', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          enrollment_id: '94000000-0000-4000-8000-000000000001',
          member_id: 'DXM-2K3M9Q2RW5TY',
          student_display_name: 'Aarohi Deshmukh',
          offering_title: 'Design Entrance Foundation',
          cohort_name: 'Studio Batch',
          source_type: 'authorized_staff',
          requested_at: '2026-10-01T10:00:00.000Z',
          approved_at: '2026-10-02T10:00:00.000Z',
        },
      ],
      error: null,
    })

    await expect(listActivationQueue()).resolves.toEqual([
      {
        enrollmentId: '94000000-0000-4000-8000-000000000001',
        memberId: 'DXM-2K3M9Q2RW5TY',
        displayName: 'Aarohi Deshmukh',
        offeringTitle: 'Design Entrance Foundation',
        cohortName: 'Studio Batch',
        sourceType: 'authorized_staff',
        requestedAt: '2026-10-01T10:00:00.000Z',
        approvedAt: '2026-10-02T10:00:00.000Z',
      },
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_student_activation_queue', {
      p_limit: 25,
      p_search: null,
    })
  })

  it('accepts an offering without a cohort', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          enrollment_id: '94000000-0000-4000-8000-000000000001',
          member_id: 'DXM-2K3M9Q2RW5TY',
          student_display_name: 'Aarohi Deshmukh',
          offering_title: 'Portfolio Workshop',
          cohort_name: null,
          source_type: 'authorized_staff',
          requested_at: '2026-10-01T10:00:00.000Z',
          approved_at: '2026-10-02T10:00:00.000Z',
        },
      ],
      error: null,
    })

    await expect(listActivationQueue(10, '  aarohi  ')).resolves.toEqual([
      expect.objectContaining({ cohortName: null }),
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_student_activation_queue', {
      p_limit: 10,
      p_search: 'aarohi',
    })
  })

  it('fails closed when the server response is incomplete', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ enrollment_id: '94000000-0000-4000-8000-000000000001' }],
      error: null,
    })

    await expect(listActivationQueue()).rejects.toThrow(
      'The activation queue could not be loaded. Check your access and try again.',
    )
  })

  it('maps database authorization failures to one safe message', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })

    await expect(listActivationQueue()).rejects.toThrow(
      'The activation queue could not be loaded. Check your access and try again.',
    )
  })
})
