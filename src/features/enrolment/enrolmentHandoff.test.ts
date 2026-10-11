import {
  approveEnrolmentHandoff,
  listEnrolmentHandoffChoices,
  listEnrolmentHandoffs,
  listEnrolmentIdentityCandidates,
  returnEnrolmentHandoff,
  searchEnrolmentStudents,
} from './enrolmentHandoff'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc }),
}))

describe('enrolment handoff data access', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('strictly maps the minimum handoff, candidate, student, and choice fields', async () => {
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            request_id: 'request-1',
            enquiry_id: 'enquiry-1',
            subject_name: 'Meera Kulkarni',
            contact_name: 'Kavita Kulkarni',
            contact_relationship: 'guardian',
            contact_kind: 'phone',
            contact_value: '+919811112222',
            interest_summary: 'NID foundation',
            target_intake: '2027',
            request_note: 'Documents checked.',
            sales_owner_name: 'Riya Shah',
            pending_identity_matches: 1,
            requested_at: '2026-10-11T09:00:00.000Z',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            candidate_id: 'candidate-1',
            new_person_name: 'Meera Kulkarni',
            existing_person_id: 'person-1',
            existing_display_name: 'Meera K.',
            existing_member_id: 'DXM-2K3M9Q2RW5TY',
            evidence_kind: 'phone',
            contact_value: '+919811112222',
            account_claimed: true,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            person_id: 'person-1',
            member_id: 'DXM-2K3M9Q2RW5TY',
            display_name: 'Meera K.',
            account_claimed: true,
            open_enrollment_count: 1,
            open_offering_titles: ['Portfolio Sprint'],
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            offering_id: 'offering-1',
            offering_title: 'Foundation 2027',
            cohort_id: null,
            cohort_name: null,
          },
        ],
        error: null,
      })

    await expect(listEnrolmentHandoffs()).resolves.toMatchObject([
      { requestId: 'request-1', subjectName: 'Meera Kulkarni', pendingIdentityMatches: 1 },
    ])
    await expect(listEnrolmentIdentityCandidates('request-1')).resolves.toMatchObject([
      { candidateId: 'candidate-1', existingMemberId: 'DXM-2K3M9Q2RW5TY' },
    ])
    await expect(searchEnrolmentStudents('Meera')).resolves.toMatchObject([
      { personId: 'person-1', accountClaimed: true },
    ])
    await expect(listEnrolmentHandoffChoices()).resolves.toMatchObject([
      { offeringId: 'offering-1', cohortId: null },
    ])
  })

  it('uses trusted RPCs for return and atomic approval', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({
      data: [
        {
          person_id: 'person-2',
          member_id: 'DXM-7K3M9Q2RW5TY',
          enrollment_id: 'enrollment-1',
          enrollment_status: 'approved',
          activation_required: true,
        },
      ],
      error: null,
    })

    await returnEnrolmentHandoff('request-1', 'Need proof of intake choice.')
    await expect(
      approveEnrolmentHandoff({
        requestId: 'request-2',
        resolutionMode: 'new',
        existingPersonId: null,
        offeringId: 'offering-1',
        cohortId: 'cohort-1',
        reason: 'Identity and course confirmed.',
        candidateDecisions: [{ candidateId: 'candidate-1', decision: 'distinct_people' }],
      }),
    ).resolves.toMatchObject({ memberId: 'DXM-7K3M9Q2RW5TY', activationRequired: true })

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'return_crm_enrolment_review', {
      p_request_id: 'request-1',
      p_reason: 'Need proof of intake choice.',
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'approve_crm_enrolment_review', {
      p_request_id: 'request-2',
      p_resolution_mode: 'new',
      p_existing_person_id: null,
      p_offering_id: 'offering-1',
      p_cohort_id: 'cohort-1',
      p_reason: 'Identity and course confirmed.',
      p_candidate_ids: ['candidate-1'],
      p_candidate_decisions: ['distinct_people'],
    })
  })

  it('fails closed on malformed rows and gives a safe stale-state error', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: [{ request_id: 'request-1' }], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: '40001' } })

    await expect(listEnrolmentHandoffs()).rejects.toThrow('could not be loaded')
    await expect(returnEnrolmentHandoff('request-1', 'Valid reason.')).rejects.toThrow(
      'This handoff changed',
    )
  })
})
