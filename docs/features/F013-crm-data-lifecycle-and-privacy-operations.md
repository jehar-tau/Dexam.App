# F013 — CRM Data Lifecycle and Privacy Operations

Status: Implemented under delegated product-owner approval — D-025 Option B; pull request pending
Risk: Red — prospective-student and guardian personal data, correction, erasure, legal holds, and irreversible operations

## Purpose and problem

F010–F012 created a controlled CRM and enrolment-handoff path, but production personal data remains prohibited because Dexam has no approved retention, correction, erasure, or data-subject request workflow. F013 must define how long CRM data remains useful, who may correct it, how erasure is reviewed and executed, and what minimal evidence survives without turning the audit trail into another copy of the personal data.

This is a technical and operational foundation, not legal advice. Before production launch, Dexam should have the final policy and notices reviewed for its actual entity, users, processing purposes, and other applicable laws.

## Users

- **Privacy Operator:** a separately authorized active employee who records and investigates correction or erasure requests and performs reversible corrections.
- **Elevated Admin approver:** reviews high-impact erasure proposals and cannot approve a proposal they created.
- **Sales and CRM Coordinator:** see whether an enquiry is restricted or no longer available, but cannot perform privacy operations or retrieve erased values.
- **Prospective student, student, or guardian:** the data subject or authorized representative whose request is being handled; no self-service portal is included in this slice.
- **Service worker:** performs approved, due minimization and erasure jobs through a trusted, idempotent operation.

## User flow

1. An authorized employee records a privacy request using a minimum case reference and the asserted relationship to the person.
2. The Privacy Operator verifies the requester through a documented, bounded method without storing identity-document images.
3. The operator sees a dry-run inventory of affected CRM records and any reason that a field cannot yet be erased.
4. A correction is applied through a trusted operation with field-level scope and reason. Raw prior values are not copied into the audit record.
5. An erasure proposal records its scope, justification, retention exceptions, and expiry.
6. A different current Elevated Admin approves or rejects the proposal.
7. The service executes an approved erasure/minimization transaction, makes stale CRM alerts non-actionable, and records non-content evidence.
8. A subject-linked tombstone causes the same erasure to be reapplied if an older backup is ever restored.

## In scope

- CRM lifecycle states for active, restricted, minimization-due, held, and erased records
- A tiered retention policy approved through D-025
- Staff-recorded correction and erasure cases
- Bounded requester/representative verification metadata without document uploads
- A separate `privacy.manage` capability
- Field-scoped, reason-required correction with non-content audit evidence
- Dry-run impact preview before erasure
- Distinct proposer/approver enforcement for irreversible erasure
- Time-limited legal or operational holds with reason, owner, and review date
- Idempotent trusted minimization/erasure operations
- Backup-restoration erasure tombstones that contain no contact value or free-text content
- Restricted access after closure and before minimization
- Fictional local preview plus database, unit/component, and browser tests

## Out of scope

- Public or student self-service privacy-request intake
- Legal advice or a claim that the software alone provides compliance
- Government-ID uploads, Aadhaar storage, facial verification, or identity-document images
- Automatic acceptance of an unverified correction or erasure request
- Selective editing of provider-managed backups
- Production scheduling, production personal data, or production deployment
- Marketing consent, opt-out, external messaging, analytics exports, or data brokering
- Erasure of active student academic records, payments, statutory records, or unrelated product data
- Exceptional post-activation identity merge or split

## Permissions

- `privacy.manage` is separate from `lead.manage_assigned`, `lead.assign`, and `enrollment.operate`.
- In the first release, only explicitly granted active Elevated Admins may receive `privacy.manage`; role name alone must not silently grant it to other staff.
- Sales and CRM Coordinators cannot list privacy cases, view request verification evidence, correct contact identity, place holds, or approve erasure.
- Correction requires current `privacy.manage` authority.
- Erasure requires a current `privacy.manage` proposer and a different current Elevated Admin approver; the service rechecks both actors and the approved scope at execution time.
- Revocation, suspension, expiry, or loss of either required authority fails closed on the next request.

## Business rules

- A dead-enquiry archive is an operational queue, not indefinite retention permission.
- Retention is computed from authoritative events; staff cannot extend it merely by viewing a record.
- A meaningful subject interaction, correction/erasure request, conversion, closure, or approved hold may change the due date according to D-025. Internal browsing and automated reminders do not reset it.
- Holds require a bounded reason code, responsible person, start time, review-by date, and explicit release. No permanent hold is allowed.
- Corrections update the authoritative current value. Audit evidence stores field names, actor, reason, time, and keyed fingerprints of old/new values rather than readable copies.
- Erasure removes or irreversibly anonymizes direct identifiers, contact values, and free-text CRM content when no approved purpose or legal requirement remains.
- A converted CRM enquiry never deletes the canonical student, membership, enrolment, coursework, submission, feedback, or payment record. Those domains require their own retention policies.
- Minimal non-content evidence may survive only for security, request accountability, duplicate execution prevention, or another documented lawful requirement, and must have its own expiry.
- An erasure tombstone contains stable internal IDs, execution time, policy version, and request reference only; it must not contain names, phone numbers, email addresses, notes, or reconstructed values.
- Erasure and minimization are idempotent and safe to retry.

## Interface states

- Privacy case queue: new, verification required, under review, approval required, scheduled, completed, partially completed, rejected, and expired
- Impact preview grouped by CRM identity/contact, enquiry, activity/follow-up, notification, handoff, and retained evidence
- Correction comparison that masks values by default
- Hold creation, review, release, and expired-hold warnings
- Separate erasure approval showing proposer, scope, consequences, exceptions, and irreversibility
- Empty, loading, validation, conflict, already-processed, connectivity/retry, permission-denied, and authority-revoked states
- Clear status for data retained because of a current purpose or documented legal requirement

## Data and privacy

- Cases collect only what is needed to identify the request, verify authority, decide scope, and evidence the outcome.
- Do not store identity-document images or unnecessary copies of messages.
- Raw personal values must not be duplicated into audit logs, notifications, exception messages, or analytics.
- Case access is limited to current privacy authority and service operations.
- Production notices must explain the data categories, purposes, rights route, and business contact before real intake.
- Provider-managed backups follow their approved lifecycle; restore procedures must replay erasure tombstones before restored data becomes accessible.

## Analytics events

No external analytics are authorized. Aggregate operational counts may be derived internally only after direct identifiers and free text are excluded. Privacy-case and erasure records are first-party security/accountability evidence, not product analytics.

## Security considerations

- Deny direct authenticated writes to lifecycle, correction, hold, approval, and erasure tables.
- Use row-locking security-definer functions with fixed search paths and explicit current-state capability checks.
- Require distinct proposer and approver identities and reject self-approval.
- Generate impact previews server-side without returning unrelated people or hidden values.
- Keep value fingerprints keyed so ordinary contact hashes cannot be brute-forced.
- Prevent erased data from remaining searchable, appearing in notifications, or leaking through error messages and counts.
- Reapply erasure after backup restoration before opening restored services.

## Relevant sources and ADRs

- D-004 canonical identity, duplicate prevention, and revocation
- D-008 staff authority and two-person approval boundaries
- D-022 CRM prospect identity and first milestone
- D-024 enrolment handoff and identity resolution
- D-025 CRM data lifecycle, correction, erasure, and privacy operations
- F002 Roles and Permissions
- F008 Notifications and Automation
- F010 CRM Leads and Follow-ups
- F012 Enrolment Handoff and Identity Resolution
- DW-005, DW-026, DW-042, and DW-043 in `../DEFERRED_WORK.md`

## Acceptance criteria

- Ordinary Sales, CRM Coordinators, Enrolment Operators, teachers, and students cannot access privacy cases or operations.
- Retention due dates derive from approved events and cannot be extended by record views.
- Corrections change the current authoritative value without retaining readable old values in audit evidence.
- A dry run identifies affected CRM records and documented retention exceptions before erasure.
- The proposer cannot approve their own erasure request.
- Authority is rechecked at approval and execution; revoked staff cannot continue.
- Execution removes or anonymizes approved CRM personal data, invalidates related CRM notifications, and is safe to retry.
- Converted enquiries do not erase canonical student or academic data.
- Time-limited holds prevent premature erasure and cannot become indefinite silently.
- Backup restoration replays erasure tombstones before restored service access.
- All tests and previews use fictional data; production personal data remains blocked.

## Verification plan

- pgTAP coverage for authority, self-approval denial, lifecycle calculation, hold expiry, correction audit minimization, dry-run scope, transactional erasure, retries, converted-record boundaries, notification invalidation, and immediate staff revocation
- Unit/component tests for mapping, masked comparisons, state handling, validation, and safe errors
- Chromium journeys for correction, erasure proposal/approval, hold review, and mobile layouts
- Clean database reset, format, lint, types, production build, and desktop/mobile visual inspection
- Destructive-path test using fictional fixtures plus a restore-and-reapply rehearsal before production approval

## Open decisions

- D-025 Option B approved 2026-10-11
- Final production privacy notice, request-verification procedure, responsible business contact, and legal review
- Production scheduler and monitoring under DW-025/DW-026

## Implementation evidence

- Added separate MFA-gated `privacy.manage` and two-person `privacy.erase_approve` capabilities without silently granting either capability through a role.
- Added purpose-based CRM lifecycle state and a D025-v1 12-month minimization due date for closed or converted enquiries; record views and reminders do not extend it.
- Added verified correction and erasure cases, readable-value-free keyed correction fingerprints, server-prepared erasure impact, distinct proposer/approver enforcement, and immediate authority rechecks.
- Added time-limited holds with a 90-day maximum review window, service-only idempotent erasure, protected student/academic boundaries, notification expiry, and non-content backup-restoration tombstones.
- Added the protected `/staff/crm/privacy` workspace with masked case data, request intake, field-scoped correction, erasure proposal/decision, hold/release flows, safe failure states, and fictional previews.
- Verified a clean database reset, 579 passing database assertions, 114 passing unit/component tests, 41 passing Chromium journeys, a production build, desktop visual inspection, and mobile overflow coverage.
