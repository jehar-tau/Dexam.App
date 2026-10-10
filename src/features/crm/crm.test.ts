import {
  createCrmEnquiry,
  listCrmEnquiries,
  recordCrmActivity,
  requestCrmEnrolmentReview,
  scheduleCrmFollowUp,
  updateCrmEnquiryStage,
} from './crm'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc }),
}))

describe('CRM data access', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('maps only the scoped CRM queue fields', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          id: 'enquiry-id',
          archive_at: null,
          closed_at: null,
          closed_reason: null,
          subject_name: 'Fictional Prospect',
          contact_name: 'Fictional Guardian',
          contact_relationship: 'guardian',
          contact_kind: 'phone',
          contact_value: '+919876543210',
          source: 'manual',
          interest_summary: 'NID preparation',
          target_intake: '2027 entrance',
          stage: 'engaged',
          owner_name: 'Fictional Sales',
          follow_up_id: 'follow-up-id',
          follow_up_due_at: '2026-10-11T09:00:00.000Z',
          last_activity_at: null,
          last_activity_outcome: null,
          possible_identity_match: true,
          review_requested_at: null,
          created_at: '2026-10-10T09:00:00.000Z',
        },
      ],
      error: null,
    })

    await expect(listCrmEnquiries(25, 'Prospect')).resolves.toMatchObject([
      { id: 'enquiry-id', subjectName: 'Fictional Prospect', stage: 'engaged' },
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_crm_enquiries', {
      p_limit: 25,
      p_search: 'Prospect',
      p_queue: 'active',
    })
  })

  it('uses trusted RPCs for CRM mutations', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [{ enquiry_id: 'enquiry-id', possible_identity_match: false }],
        error: null,
      })
      .mockResolvedValue({ data: null, error: null })

    await createCrmEnquiry({
      subjectName: 'Fictional Prospect',
      contactName: 'Fictional Prospect',
      contactRelationship: 'self',
      contactKind: 'email',
      contactValue: 'prospect@example.test',
      interestSummary: 'NID preparation',
      targetIntake: '2027 entrance',
      source: 'manual',
      requestKey: 'request-id',
    })
    await recordCrmActivity('enquiry-id', 'connected', 'Discussed the course.')
    await scheduleCrmFollowUp('enquiry-id', '2026-10-12T09:00:00.000Z')
    await updateCrmEnquiryStage(
      'enquiry-id',
      'closed',
      'marked_dead',
      'No response after repeated follow-ups.',
    )
    await requestCrmEnrolmentReview('enquiry-id', 'Ready for operator review.')

    expect(mocks.rpc).toHaveBeenCalledTimes(5)
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'record_crm_activity', {
      p_enquiry_id: 'enquiry-id',
      p_outcome: 'connected',
      p_note: 'Discussed the course.',
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(4, 'update_crm_enquiry_stage', {
      p_enquiry_id: 'enquiry-id',
      p_to_stage: 'closed',
      p_reason_code: 'marked_dead',
      p_note: 'No response after repeated follow-ups.',
    })
  })
})
