import { getStudentAssignments, startStudentAssignmentAttempt } from './studentAssignments'

const mocks = vi.hoisted(() => ({ order: vi.fn(), rpc: vi.fn() }))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ order: mocks.order }) }),
    rpc: mocks.rpc,
  }),
}))

describe('studentAssignments', () => {
  beforeEach(() => {
    mocks.order.mockReset()
    mocks.rpc.mockReset()
  })

  it('maps only the private instances, immutable version, attempts, and files returned by RLS', async () => {
    mocks.order.mockResolvedValue({
      data: [
        {
          id: 'instance-id',
          status: 'submitted',
          assigned_at: '2026-10-10T09:00:00.000Z',
          assignment_release: {
            due_at: null,
            status: 'active',
            assignment_version: {
              id: 'version-id',
              group_name: 'Perspective',
              title: 'Draw a room',
              instructions: 'Upload one clear drawing.',
              assignment_definition: { code: 'ROOM_01' },
            },
          },
          submission_attempts: [
            {
              id: 'attempt-id',
              attempt_number: 1,
              status: 'submitted',
              submitted_at: '2026-10-11T09:00:00.000Z',
              submitted_late: false,
              submission_files: [
                {
                  id: 'file-id',
                  original_file_name: 'room.jpg',
                  mime_type: 'image/jpeg',
                  byte_size: 800000,
                  original_byte_size: 4000000,
                  was_compressed: true,
                  position: 1,
                  status: 'ready',
                },
              ],
            },
          ],
        },
      ],
      error: null,
    })

    await expect(getStudentAssignments()).resolves.toEqual([
      {
        id: 'instance-id',
        status: 'submitted',
        assignedAt: '2026-10-10T09:00:00.000Z',
        releaseStatus: 'active',
        dueAt: null,
        assignmentVersionId: 'version-id',
        assignmentCode: 'ROOM_01',
        groupName: 'Perspective',
        title: 'Draw a room',
        instructions: 'Upload one clear drawing.',
        attempts: [
          {
            id: 'attempt-id',
            attemptNumber: 1,
            status: 'submitted',
            submittedAt: '2026-10-11T09:00:00.000Z',
            submittedLate: false,
            files: [
              {
                id: 'file-id',
                name: 'room.jpg',
                mimeType: 'image/jpeg',
                byteSize: 800000,
                originalByteSize: 4000000,
                wasCompressed: true,
                position: 1,
                status: 'ready',
              },
            ],
          },
        ],
      },
    ])
  })

  it('starts an attempt only through the protected RPC', async () => {
    mocks.rpc.mockResolvedValue({ data: 'attempt-id', error: null })
    await expect(startStudentAssignmentAttempt('instance-id')).resolves.toBe('attempt-id')
    expect(mocks.rpc).toHaveBeenCalledWith('start_assignment_attempt', {
      p_assignment_instance_id: 'instance-id',
    })
  })
})
