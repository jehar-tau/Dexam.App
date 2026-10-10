# F010 — CRM Leads and Follow-ups

Status: D-022 Option B implemented and product-owner approved — pull-request review pending
Risk: Red — prospective-student and guardian contact data, duplicate identity, sales authority, consent, and conversion into enrolment

## Purpose and problem

Dexam needs a trustworthy source of truth for enquiries before a student enrols. Sales staff need to know which leads belong to them, what happened previously, and when the next follow-up is due. The F008 notification foundation cannot safely automate marketing or admissions alerts until lead ownership and follow-up state exist as real domain records.

The CRM must remain separate from the public marketing website and must not silently turn an enquiry into a student account, enrolment, marketing-consent record, or external message.

## Users

- **Sales:** creates or receives assigned enquiries, records bounded activity, schedules follow-ups, and requests enrolment review.
- **Lead assigner:** a separately authorized employee who assigns or reassigns enquiries and can see the operational pipeline within an approved scope.
- **Enrolment Operator:** receives an explicit conversion/enrolment-review request and performs the existing duplicate and enrolment checks; does not inherit unrestricted CRM access.
- **Elevated Admin:** exceptional audited operational access only; not the routine CRM operator.
- **Prospective student/guardian:** data subject, but no CRM login or portal is included in the first slice.

Students and teachers have no CRM access.

## Proposed first user flow

1. An authorized employee records an enquiry manually using only the minimum approved details and its source.
2. A trusted workflow normalizes contact values and checks for possible existing people/enquiries without exposing unrelated records to Sales.
3. The enquiry is assigned to exactly one current Sales owner. Ownership changes retain history.
4. The owner sees an assigned queue ordered by overdue follow-up, due follow-up, and then newest unworked enquiry.
5. The owner records a bounded activity outcome and schedules, completes, replaces, or cancels the next follow-up.
6. F008 creates in-app alerts for a new assignment and a due/overdue follow-up. No external message is sent.
7. If the prospect is ready, Sales submits an enrolment-review request. Sales cannot create a student membership, approve an enrolment, issue credentials, or access academic records.
8. An Enrolment Operator reviews possible identity matches and either links or creates the canonical student through the existing controlled enrolment workflow.

## Proposed first-slice scope

- Manual enquiry creation; no public website ingestion yet
- Identity-aware prospect and guardian/self contact relationships under D-022
- Minimum contact route, source, target exam/interests, and target intake/year only when operationally needed
- Assigned-owner queue and bounded search
- Append-only ownership and lifecycle transition history
- Activity outcomes such as attempted contact, connected, counselling arranged, no response, and note added
- One current follow-up task with due time, disposition, replacement/cancellation, and history
- Pipeline states approved by D-022
- Reversible dead-enquiry handling: seven-day Recently dead area followed by a common time-derived Dead archive
- Explicit enrolment-review request handoff
- In-app `lead_assigned` and `lead_follow_up_due`/overdue notifications through F008
- Loading, empty, success, validation, retry, permission-denied, suspended-owner, and unassigned states

## Implemented local slice

- Identity-aware prospect and guardian records without creating Auth users, memberships, enrolments, or student access
- Normalized contact points, possible-match review candidates, explicit person relationships, and request-key idempotency
- Assigned-owner access checks, separate assignment authority, append-only ownership and lifecycle histories, and immediate current-state revocation
- Assigned Sales queue/detail workspace with bounded search, manual enquiry creation, activity outcomes, replaceable follow-ups, stage movement, and explicit enrolment-review handoff
- Free F008 in-app alerts for assignment and due follow-up, with protected CRM deep links and no personal contact details in alert text
- Fictional local desktop/mobile previews; no external message, paid service, website intake, or production personal data
- Database, unit/component, and browser coverage for identity, authorization, duplicate candidates, stale alerts, conversion boundaries, responsive behavior, and failure states

## Out of scope

- Public marketing-website forms, webhooks, imports, or shared browser storage
- Email, WhatsApp, SMS, calling, push notifications, or paid automation providers
- Promotional broadcasts, campaigns, bulk messaging, drip sequences, or lead scoring
- Recording calls, storing full message transcripts, or copying private conversations into unbounded notes
- Payment collection, discounts, pricing commitments, or order history
- Student-account creation, enrolment approval, credential issuance, or academic access by Sales
- Automatic identity merge or automatic conversion based only on phone/email
- Destructive deletion or copying dead enquiries into a separate ungoverned datastore
- Analytics exports or unrestricted pipeline downloads
- AI-written sales messages, AI lead scoring, or automated consequential decisions

## Permissions

- `lead.manage_assigned` remains the Sales capability for reading and changing only currently assigned enquiries.
- A proposed separate `lead.assign` capability controls assignment/reassignment and unassigned-queue access.
- `enrollment.request_review` allows Sales to create the handoff but not approve it.
- Current employee membership, active role/capability, and current assignment are rechecked for every protected request.
- Removing an owner, role, or employee membership blocks the next request and prevents protected notifications from being read.
- Reassignment does not erase historical attribution.
- Enrolment Operators receive only the minimum prospect data needed for duplicate/enrolment review through the explicit handoff.

## Proposed business rules

- An enquiry records a specific expression of interest; it is not the person, account, contact point, enrolment, or marketing-consent record.
- A person may make multiple enquiries over time without creating multiple accounts.
- A guardian and prospective student are separate people with an explicit relationship; a shared phone number is not proof that they are the same person.
- Weak matches produce a review candidate and never an automatic merge.
- Exactly one current owner exists for an assigned enquiry; every ownership change records actor, reason, and time.
- Only one current open follow-up is allowed in the first slice. Rescheduling closes/replaces the prior task rather than silently rewriting it.
- A due alert is derived from the follow-up record. Completing, cancelling, or replacing the task makes obsolete alerts non-actionable.
- Moving an enquiry to dead requires a bounded reason, removes it from the active queue, cancels its open follow-up, and makes its Sales alerts non-actionable.
- A dead enquiry remains in Recently dead for seven days and then appears automatically in Dead archive. Both are secure views over the same record; no scheduler, duplicate row, or destructive move is required.
- Restoring a dead enquiry requires a reason, returns the same record to `contact_in_progress`, and retains its closure/restoration transition history.
- Read notification state does not complete the follow-up task.
- Conversion means “request enrolment review,” not “create access.”
- Promotional consent is separate from permission to contact someone about the enquiry they initiated.
- Free-text notes are minimized and bounded. Staff are instructed not to store passwords, payment-card data, government identifiers, health data, or academic work in CRM notes.

## Proposed pipeline states

- `new`
- `contact_in_progress`
- `engaged`
- `qualified`
- `enrolment_review_requested`
- `converted`
- `closed`

Transitions are deliberate and historically recorded. A closed enquiry requires a bounded reason and may be reopened with a reason. Exact labels and transition authority require D-022 approval.

## Interface states

- Assigned queue with overdue/due indicators and last activity
- Active, Recently dead, and Dead archive areas with closure time, reason, automatic archive time, and a restore action
- Enquiry detail with identity/contact summary, source, interests, owner, timeline, and next follow-up
- Create, assign/reassign, log activity, schedule/reschedule, close/reopen, and request-review confirmations
- Duplicate-candidate warning without disclosing unrelated personal details
- Unassigned queue for `lead.assign`
- Empty queues and no-search-results states
- Loading, connectivity/retry, validation, stale-update/conflict, and permission-denied states
- Clear state when the current owner is suspended or no longer authorized

## Data and privacy

- Collect only fields required to respond to and manage an enquiry.
- Normalize contact values server-side; retain verification/source metadata rather than treating every supplied value as verified.
- Do not expose full normalized-contact matches to ordinary Sales users.
- Store prospective student and guardian relationships explicitly.
- Keep marketing consent, channel preference, and opt-out evidence separate and add them only after a dedicated communication decision.
- A CRM retention/deletion policy is required before production launch; source control, fixtures, tests, screenshots, and staging use fictional data only.
- Audit assignment, lifecycle, conversion handoff, and sensitive correction events without copying note/contact contents into logs.

## Analytics events

No personal-data product analytics are authorized in the first slice. Operational facts such as assignment, follow-up completion, and lifecycle transition remain first-party domain/audit records. Any external analytics integration requires a separate decision.

## Security considerations

- Deny-by-default RLS for every CRM table.
- Sales can read and mutate only current assigned scope; assignment authority is separate.
- Use trusted server/database functions for contact normalization, duplicate candidate checks, assignment, transitions, and conversion handoff.
- Enforce current-state suspension and capability checks instead of relying only on JWT claims.
- Prevent enumeration through search, errors, counts, and duplicate warnings.
- Bound free text, reject unsafe fields, and rate-limit public intake when that later exists.
- Make creation and transitions idempotent and concurrency-safe.

## Relevant sources and ADRs

- D-003 role and permission principles
- D-004 canonical identity, duplicate prevention, and revocation
- D-005 lifelong member architecture
- D-008 Sales/enrolment/admin authority separation
- D-009 offering/cohort/enrolment structure
- D-021 notification foundation and external-channel boundary
- F002 Roles and Permissions
- F004 Course and Enrolment Foundation
- F008 Notifications and Automation
- DW-023, DW-024, and DW-032 in `../DEFERRED_WORK.md`

## Acceptance criteria

- Sales cannot read, search, update, or receive protected alerts for another owner's enquiry.
- An authorized assigner can assign/reassign without erasing prior ownership.
- Shared phone/contact scenarios do not automatically merge a guardian and student.
- Repeated creation with the same idempotency key does not create duplicate enquiries.
- Follow-up completion/reschedule/cancellation makes obsolete due work non-actionable.
- Closing removes the enquiry from Active, exposes it in Recently dead for seven days, then exposes it in Dead archive without deleting or duplicating it.
- Restoring returns the same enquiry to Active while preserving closure history.
- A suspended or revoked employee loses CRM and notification access on the next request.
- Sales can request enrolment review but cannot create membership, approve enrolment, or issue credentials.
- No external message or paid-provider request can occur in this slice.
- All examples and automated tests use fictional identities and contact values.

## Verification plan

- pgTAP tests for RLS, ownership, role revocation, suspension, assignment history, transitions, duplicate candidates, follow-up replacement, and conversion boundaries
- Unit tests for data mapping, validation, states, and safe errors
- Browser journeys for Sales queue/detail/follow-up and assigner reassignment at desktop/mobile widths
- Notification tests for assignment and due follow-up idempotency/current-scope denial
- Production build, Edge Function compilation if used, and visual review before commit/PR

## Open decisions

- D-022 Option B approved: prospect identity, CRM first milestone, ownership, lifecycle, follow-up, and conversion boundary
- Minimum contact/profile fields and who may correct them
- CRM data retention/deletion before production launch
- First website-to-CRM integration and abuse controls
- External communication/marketing consent remains under a later F008 Option C decision
- Assigner/unassigned-queue interface, Enrolment Operator handoff inbox, public website intake, retention/deletion operations, and CRM reporting remain explicitly tracked in `../DEFERRED_WORK.md`
