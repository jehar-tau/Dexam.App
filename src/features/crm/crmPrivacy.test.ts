import {
  applyCrmPrivacyCorrection,
  createCrmPrivacyCase,
  decideCrmErasure,
  listCrmPrivacyCases,
  placeCrmPrivacyHold,
  previewCrmErasure,
} from './crmPrivacy'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('../auth/supabaseClient', () => ({
  getSupabaseClient: () => ({ rpc: mocks.rpc }),
}))

describe('CRM privacy data access', () => {
  beforeEach(() => mocks.rpc.mockReset())

  it('strictly maps the protected case queue and masked contact', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          id: 'case-id',
          enquiry_id: 'enquiry-id',
          kind: 'erasure',
          status: 'approval_required',
          subject_name: 'Fictional Prospect',
          masked_contact: 'f***@example.test',
          requester_relationship: 'self',
          verification_method: 'existing_contact_callback',
          request_summary: 'Verified erasure request.',
          proposal_reason: 'No remaining CRM purpose.',
          proposer_name: 'Fictional Operator',
          approver_name: null,
          requested_at: '2026-10-11T09:00:00.000Z',
          expires_at: '2026-11-10T09:00:00.000Z',
          privacy_state: 'restricted',
          minimization_due_at: '2027-10-11T09:00:00.000Z',
          hold_id: null,
          hold_review_by: null,
        },
      ],
      error: null,
    })

    await expect(listCrmPrivacyCases()).resolves.toMatchObject([
      {
        id: 'case-id',
        maskedContact: 'f***@example.test',
        lifecycleState: 'restricted',
      },
    ])
    expect(mocks.rpc).toHaveBeenCalledWith('list_crm_privacy_cases', {
      p_limit: 100,
      p_status: 'open',
    })
  })

  it('rejects malformed protected results instead of exposing partial data', async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: 'case-id', status: 'unknown' }], error: null })

    await expect(listCrmPrivacyCases()).rejects.toThrow(/could not be loaded/)
  })

  it('sends trimmed verified request and correction inputs', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: 'case-id', error: null })
      .mockResolvedValueOnce({ data: null, error: null })

    await createCrmPrivacyCase({
      enquiryId: 'enquiry-id',
      kind: 'correction',
      requesterRelationship: 'parent_guardian',
      verificationMethod: 'existing_contact_callback',
      requestSummary: '  Correct the intended exam.  ',
    })
    await applyCrmPrivacyCorrection({
      caseId: 'case-id',
      field: 'interest_summary',
      newValue: '  UCEED preparation  ',
      reason: '  Requester confirmed the correction.  ',
    })

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'create_crm_privacy_case', {
      p_enquiry_id: 'enquiry-id',
      p_kind: 'correction',
      p_requester_relationship: 'parent_guardian',
      p_verification_method: 'existing_contact_callback',
      p_request_summary: 'Correct the intended exam.',
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'apply_crm_privacy_correction', {
      p_case_id: 'case-id',
      p_field: 'interest_summary',
      p_new_value: 'UCEED preparation',
      p_reason: 'Requester confirmed the correction.',
    })
  })

  it('maps erasure impact without returning personal values', async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          category: 'Identity and contact',
          record_count: 1,
          planned_action: 'Remove CRM contact values.',
          protected_record: true,
        },
      ],
      error: null,
    })

    await expect(previewCrmErasure('case-id')).resolves.toEqual([
      {
        category: 'Identity and contact',
        recordCount: 1,
        plannedAction: 'Remove CRM contact values.',
        protectedRecord: true,
      },
    ])
  })

  it('preserves deliberate erasure and hold parameters', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: 'hold-id', error: null })

    await decideCrmErasure('case-id', true, '  Independently reviewed.  ')
    await placeCrmPrivacyHold({
      enquiryId: 'enquiry-id',
      reasonCode: 'active_investigation',
      note: '  Temporary evidence review.  ',
      reviewBy: '2026-11-01T10:00:00.000Z',
    })

    expect(mocks.rpc).toHaveBeenNthCalledWith(1, 'decide_crm_erasure', {
      p_case_id: 'case-id',
      p_approve: true,
      p_note: 'Independently reviewed.',
    })
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'place_crm_privacy_hold', {
      p_enquiry_id: 'enquiry-id',
      p_reason_code: 'active_investigation',
      p_note: 'Temporary evidence review.',
      p_review_by: '2026-11-01T10:00:00.000Z',
    })
  })

  it('turns lost authority into a safe sign-in instruction', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501' } })

    await expect(decideCrmErasure('case-id', true, 'Independent review.')).rejects.toThrow(
      /MFA assurance is no longer current/,
    )
  })
})
