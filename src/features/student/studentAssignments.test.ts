import { getStudentAssignments, startStudentAssignmentAttempt } from './studentAssignments'

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  order: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ order: mocks.order }) }),
    rpc: mocks.rpc,
    storage: {
      from: () => ({ createSignedUrl: mocks.createSignedUrl }),
    },
  }),
}))

describe('studentAssignments', () => {
  beforeEach(() => {
    mocks.order.mockReset()
    mocks.rpc.mockReset()
    mocks.createSignedUrl.mockReset()
  })

  it('maps published feedback and creates only a short-lived authorized voice URL', async () => {
    mocks.order.mockResolvedValue({
      data: [
        {
          id: 'instance-id',
          status: 'review_completed',
          assigned_at: '2026-10-10T09:00:00.000Z',
          assignment_release: {
            due_at: null,
            status: 'active',
            assignment_version: {
              id: 'version-id',
              group_name: 'Drawing foundations',
              title: 'Line confidence practice',
              instructions: 'Complete one page.',
              assignment_definition: { code: 'LINE_CONTROL' },
            },
          },
          submission_attempts: [
            {
              id: 'attempt-id',
              attempt_number: 1,
              status: 'submitted',
              submitted_at: '2026-10-11T09:00:00.000Z',
              submitted_late: false,
              submission_files: [],
              feedback_revisions: [
                {
                  written_text: 'Keep the pressure consistent.',
                  outcome: 'review_completed',
                  correction_reason: null,
                  published_at: '2026-10-12T09:00:00.000Z',
                  ai_assisted: true,
                  feedback_audio_files: [
                    {
                      object_path: 'revision-id/audio-id.webm',
                      kind: 'voice_note',
                      status: 'ready',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      error: null,
    })
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://private.test/voice' },
      error: null,
    })

    const assignments = await getStudentAssignments()

    expect(assignments[0]?.attempts[0]?.feedback).toEqual({
      writtenText: 'Keep the pressure consistent.',
      outcome: 'review_completed',
      correctionReason: null,
      publishedAt: '2026-10-12T09:00:00.000Z',
      aiAssisted: true,
      voiceUrl: 'https://private.test/voice',
    })
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('revision-id/audio-id.webm', 900)
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
              feedback_revisions: [],
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
            feedback: null,
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
