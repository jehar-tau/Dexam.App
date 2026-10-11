# F012 — Enrolment Handoff and Identity Resolution

Status: Implemented and product-owner approved — D-024 Option B; pull request pending
Risk: Red — canonical identity, duplicate resolution, enrolment approval, and student access

## Purpose and problem

F010 lets assigned Sales staff request enrolment review without creating student access. F004 provides canonical students, offerings, cohorts, enrolments, and activation packs. The missing bridge is a safe Enrolment Operator workflow that consumes only explicit CRM requests, resolves possible identity matches, chooses the correct learning context, and creates the approved enrolment without widening CRM access.

## Users

- **Enrolment Operator:** reviews pending handoffs through current `enrollment.operate` authority.
- **Sales owner:** submits or resubmits a request and sees its operational disposition, but cannot see candidate student records or approve access.
- **Existing student:** may receive an additional active enrolment on the same canonical identity.
- **New student:** receives a permanent Member ID only after operator approval, then remains in the existing activation queue until credentials are issued.

Teachers, ordinary Sales staff outside the assigned enquiry, suspended employees, and students cannot access the handoff inbox.

## User flow

1. Sales moves a qualified assigned enquiry into explicit enrolment review with a bounded note.
2. The Enrolment Operator opens the Handoff inbox and sees oldest pending requests first.
3. The operator reviews minimum subject/contact context and any weak contact-match evidence.
4. The operator confirms a new student or deliberately selects an existing canonical student through bounded search.
5. Presented match candidates are classified as the same person or different people; weak evidence never auto-merges.
6. The operator selects an active offering and optional compatible active cohort.
7. The operator either returns the request to Sales with a reason or confirms approval with a reason.
8. The trusted transaction validates everything again and records immutable resolution evidence.
9. A new unclaimed student enters the existing activation queue; an existing claimed student receives an active enrolment without duplicate credentials.
10. The CRM enquiry becomes converted only after the enrolment transaction succeeds.

## In scope

- Explicit pending handoff inbox for `enrollment.operate`
- Bounded search and oldest-first ordering
- Minimum prospect, contact-relationship, request-note, and identity-evidence detail
- Bounded existing-student search by immutable Member ID or operational display name
- Confirm-new versus link-existing student choice
- Same-person/different-people disposition for presented CRM identity candidates
- Active offering and compatible cohort picker
- Reason-required return to Sales and resubmission history
- Reason-required single-request approval
- Secure Member ID generation for a confirmed new student
- Student membership creation or safe reuse
- Approved enrolment creation for a new/unclaimed student
- Direct active enrolment for an existing claimed active student
- Existing activation queue integration
- CRM converted state only after successful enrolment creation
- Fictional desktop/mobile preview and complete automated tests

## Out of scope

- Automatic/fuzzy/AI identity matching or merging
- Destructive duplicate deletion or exceptional post-activation identity correction
- Broad CRM, academic-history, submission, payment, or staff-profile access
- Sales approval, activation-pack issuance, or credential visibility
- Payments, discounts, scholarships, receipts, or purchase verification
- Bulk conversion, import/export, external messages, or paid providers
- Remaining enrolment lifecycle transitions
- Production personal data or deployment

## Permissions

- Inbox, candidate detail, student lookup, and mutation require current `enrollment.operate` authority on every request.
- Sales can create/resubmit only for an enquiry they currently manage and only through the trusted CRM function.
- Candidate results reveal only the fields necessary for identity resolution; Sales never receives them.
- Direct table writes remain denied to authenticated clients.
- Suspension, role revocation, capability revocation, or scope expiry denies the next request.

## Business rules

- A CRM review request is not an enrolment and grants no access.
- Only one pending request may exist for an enquiry, while returned and resolved attempts remain immutable history.
- Weak phone/email evidence always requires a human disposition.
- Selecting an existing student links the handoff outcome; it does not silently delete historical CRM people.
- A confirmed new subject receives one cryptographically generated, non-guessable, immutable Member ID.
- A person cannot receive a duplicate open enrolment for the same offering/cohort context.
- Cohorts must belong to the chosen offering and be currently available for enrolment.
- Approval and CRM conversion occur atomically; a partial conversion is never reported as complete.
- A new student still requires the existing final activation-pack review.
- An existing claimed active student never receives a second activation pack.
- Return and approval reasons are bounded operational evidence, not a place for unnecessary sensitive notes.

## Interface states

- Loading inbox, request detail, candidate search, and offering choices
- Pending queue and empty queue
- No-search-results state
- New-student confirmation
- Existing-student selection
- Possible-match evidence requiring disposition
- Offering/cohort validation
- Return-to-Sales confirmation and success
- Approval confirmation and success
- Concurrently resolved request
- Duplicate open-enrolment conflict
- Permission loss, connectivity failure, retry, and fail-closed states

## Data and privacy

- Return only minimum handoff fields; do not expose general academic records, submissions, feedback, or unrelated contacts.
- Existing-student search returns Member ID, display name, account-claimed state, and only the minimum current-enrolment summary needed to avoid a duplicate.
- Keep request notes and operator reasons bounded and exclude them from notifications and security logs.
- Preserve identity-resolution evidence and references; do not destructively remove a suspected duplicate.
- All previews, tests, and screenshots use fictional identities.

## Analytics events

No external product analytics are authorized. Request, resolution, enrolment, membership, and CRM-transition records are first-party operational/audit evidence.

## Security considerations

- Use trusted, row-locking functions for return and approval.
- Recheck request state, operator authority, target person state, membership, offering/cohort, and open-enrolment uniqueness in the transaction.
- Generate Member IDs server-side with collision retry and the approved non-ambiguous alphabet.
- Prevent identity and queue enumeration through bounded searches, generic errors, and capability-gated functions.
- Preserve immediate employee revocation and deny direct table mutation.
- Do not copy Sales contact details into academic records.

## Relevant sources and ADRs

- D-004 canonical identity, duplicate prevention, and revocation
- D-007 Member ID issuance and activation
- D-008 staff authority and approval boundaries
- D-009 offering, cohort, and enrolment structure
- D-022 CRM prospect identity and handoff boundary
- D-024 enrolment handoff and identity resolution
- F004 Course and Enrolment Foundation
- F010 CRM Leads and Follow-ups
- DW-041 in `../DEFERRED_WORK.md`

## Acceptance criteria

- Only a current Enrolment Operator can list or resolve pending handoffs.
- Sales and unrelated staff cannot infer inbox counts, candidate people, or offering decisions.
- An operator can return a request with a reason; the assigned Sales owner can correct and resubmit it without losing prior history.
- A weak contact match is never automatically treated as the same person.
- A confirmed new student receives one immutable Member ID, one active student membership, and one approved enrolment.
- An existing canonical student is reused without creating a duplicate person, Member ID, membership, or activation pack.
- Invalid/inactive offerings, mismatched cohorts, and duplicate open enrolments fail safely.
- Approval atomically resolves the handoff, creates/activates the enrolment as appropriate, and converts the CRM enquiry.
- Revoked or suspended operators are denied immediately.
- No bulk, external-message, payment, export, paid-provider, or production-data path exists.

## Verification plan

- pgTAP coverage for inbox secrecy, current authorization, candidate visibility, request lifecycle, resubmission, Member ID uniqueness, new/existing student paths, offering/cohort validation, duplicate enrolments, atomic CRM conversion, and immediate revocation
- Unit/component tests for strict mapping, search, resolution choices, reasons, conflicts, and safe errors
- Chromium journeys for return, new-student approval, existing-student linking, and mobile overflow
- Full format, lint, type, unit, database, build, and visual verification

## Open decisions

- D-024 Option B approved 2026-10-11
- Retention/correction/deletion remains D-022/DW-042 and blocks production personal data
- Exceptional post-activation identity correction requires a separate elevated workflow

## Implementation evidence

- Added a capability-gated, oldest-first handoff inbox with minimum CRM context and bounded search.
- Added explicit new-versus-existing student resolution, bounded canonical-student lookup, and a required disposition for every weak identity match.
- Added active offering/compatible cohort selection plus reason-required return and approval paths.
- Added server-side Member ID generation and an atomic identity, membership, enrolment, candidate-resolution, and CRM-conversion transaction.
- Reused the existing activation queue for new or unclaimed students; existing claimed students receive an active enrolment without duplicate credentials.
- Added Sales-visible returned dispositions and immutable resubmission history without exposing candidate student records.
- Verified 518 database checks, 103 unit/component tests, 37 Chromium journeys, production build, and desktop/mobile visual states without console errors or horizontal overflow.
- The product owner approved the fictional Enrolment Operator preview on 2026-10-11.
