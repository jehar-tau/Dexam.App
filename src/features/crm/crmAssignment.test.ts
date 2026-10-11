import { assignCrmEnquiry, listCrmAssignmentQueue, listCrmEligibleOwners } from './crmAssignment'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc }),
}))

describe('CRM assignment data access', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('maps only the bounded assignment and owner fields', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            id: 'enquiry-id',
            subject_name: 'Fictional Prospect',
            contact_relationship: 'guardian',
            source: 'manual',
            interest_summary: 'NID preparation',
            target_intake: '2027 entrance',
            stage: 'engaged',
            current_owner_person_id: null,
            current_owner_name: null,
            owner_is_eligible: false,
            follow_up_due_at: null,
            created_at: '2026-10-11T09:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ person_id: 'owner-id', display_name: 'Fictional Sales Owner' }],
        error: null,
      })

    await expect(listCrmAssignmentQueue('unassigned', 25, 'Prospect')).resolves.toMatchObject([
      { id: 'enquiry-id', subjectName: 'Fictional Prospect', currentOwnerPersonId: null },
    ])
    await expect(listCrmEligibleOwners()).resolves.toEqual([
      { personId: 'owner-id', displayName: 'Fictional Sales Owner' },
    ])
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'list_crm_assignment_queue', {
      p_limit: 25,
      p_search: 'Prospect',
      p_queue: 'unassigned',
    })
  })

  it('sends the expected owner state with every single-record assignment', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null })

    await assignCrmEnquiry({
      enquiryId: 'enquiry-id',
      expectedOwnerPersonId: null,
      ownerPersonId: 'owner-id',
      reason: '  Assigned after intake review  ',
    })

    expect(mocks.rpc).toHaveBeenCalledWith('assign_crm_enquiry', {
      p_enquiry_id: 'enquiry-id',
      p_owner_person_id: 'owner-id',
      p_reason: 'Assigned after intake review',
      p_expected_owner_person_id: null,
      p_expect_unassigned: true,
    })
  })

  it('turns a concurrency error into a safe refresh instruction', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '40001' } })

    await expect(
      assignCrmEnquiry({
        enquiryId: 'enquiry-id',
        expectedOwnerPersonId: 'previous-owner-id',
        ownerPersonId: 'owner-id',
        reason: 'Recovered after owner suspension',
      }),
    ).rejects.toThrow(/assigned by someone else/)
  })
})
