# F011 — CRM Assignment Operations

Status: Approved — D-023 Option B; implementation active
Risk: Red — prospect personal data, cross-owner visibility, and staff assignment authority

## Purpose and problem

F010 lets Sales work only on enquiries currently assigned to them and already provides an audited assignment function. It does not yet give an operational user a safe way to find unassigned enquiries, recover enquiries whose owner is no longer active, or select a new current owner. Without this link, newly created unassigned records or revoked-owner records can become operationally stranded.

## Users

- **CRM Coordinator:** an active Sales employee with a separate current `lead.assign` capability grant, if D-023 Option B is approved.
- **Elevated Admin:** exceptional operational access through the same capability boundary, not the routine queue owner.
- **Sales owner:** receives assigned enquiries but cannot browse or assign other owners' work.

Students, teachers, Enrolment Operators without `lead.assign`, suspended employees, and unprivileged Sales staff have no access to these queues.

## User flow

1. The coordinator signs in and opens CRM Assignment.
2. The workspace shows bounded **Unassigned** and **Needs reassignment** queues.
3. The coordinator opens one enquiry and sees only the minimum identity, interest, current-owner, and follow-up context required to allocate it.
4. The coordinator selects an eligible active Sales owner, enters a reason, reviews the change, and confirms.
5. The trusted operation rechecks coordinator authority, target-owner eligibility, enquiry state, and current ownership in one transaction.
6. Ownership history is appended. Any open follow-up is replaced for the new owner and obsolete notifications become non-actionable.
7. The new owner receives the existing F008 in-app assignment alert.

## In scope

- Explicit capability-gated assignment workspace
- Unassigned and inactive/revoked-owner recovery queues
- Bounded search over the minimum enquiry fields already approved in F010
- Minimum active-Sales owner picker
- Single enquiry assignment and reassignment
- Required reason and confirmation
- Optimistic-conflict detection and safe refresh
- Existing history, follow-up, and in-app notification consequences
- Fictional preview plus desktop/mobile states

## Out of scope

- Bulk selection or bulk reassignment
- Round-robin, scoring, workload balancing, geography, or automatic routing
- New employee invitation, Sales-role grant, or capability-grant administration screens
- Enrolment Operator handoff inbox or identity resolution
- External messages, campaigns, imports, exports, analytics, or paid services
- Public website intake or production personal data
- CRM retention, correction, or deletion operations

## Permissions

- Queue reads and owner discovery require current `lead.assign` capability.
- Under recommended D-023 Option B, the capability grant is effective only while its required Sales role and employee membership are current and active.
- A target owner must have current `lead.manage_assigned` authority when the transaction commits.
- Ordinary Sales staff retain assigned-only access and cannot infer unassigned counts, owner lists, or other owners' enquiries.
- Revocation, suspension, or expiry denies the next request without relying on cached navigation state.

## Business rules

- An unassigned enquiry has no current owner but retains its creator and lifecycle history.
- “Needs reassignment” means the recorded owner no longer has current `lead.manage_assigned` authority; the record is not silently unassigned or reassigned.
- Every ownership change records prior owner, new owner, assigner, reason, and time.
- Assignment is one record at a time in the first slice.
- Assigning the already-current owner is a safe no-op and does not create false history.
- A concurrent ownership change prevents stale confirmation from overwriting the newer owner.
- Reassignment never restores the previous owner's read access.

## Interface states

- Loading queue and owner candidates
- Unassigned queue
- Needs-reassignment queue with clear inactive-owner status
- Empty queue and no-search-results states
- Assignment review and reason validation
- Saving and success confirmation
- Concurrent-change conflict with refresh action
- Target owner became ineligible
- Connectivity/retry and permission-denied states
- Immediate access-loss state after coordinator revocation

## Data and privacy

- Return only the enquiry fields needed to allocate work; do not expose full contact-match evidence, academic data, or employee profiles.
- Owner discovery returns stable person ID and operational display name only.
- Do not copy contact or reason text into notification bodies or security logs.
- All automated examples, previews, and screenshots use fictional identities.

## Analytics events

No external product analytics are authorized. Assignment history and notification events remain first-party operational records.

## Security considerations

- Deny direct table mutation; use trusted functions with current-state capability checks and row locks.
- Recheck the expected current owner to prevent lost updates.
- Bound queue sizes, search length, and reason text.
- Prevent enumeration through unprivileged counts, errors, and owner discovery.
- Preserve immediate denial for suspended or revoked employees and owners.

## Relevant sources and ADRs

- D-003 role and permission principles
- D-004 identity and immediate revocation
- D-008 staff authority boundaries
- D-022 CRM prospect identity and first milestone
- D-023 CRM assignment authority and queue
- F002 Roles and Permissions
- F008 Notifications and Automation
- F010 CRM Leads and Follow-ups
- DW-040 in `../DEFERRED_WORK.md`

## Acceptance criteria

- Only a current `lead.assign` holder can list unassigned/stranded enquiries or eligible owners.
- An ordinary Sales user cannot infer those records, counts, or owner candidates.
- A coordinator can assign one unassigned enquiry with a reason and immutable history.
- A coordinator can recover an enquiry from an inactive owner without restoring that owner's access.
- Reassignment replaces an open follow-up for the new owner and invalidates stale owner notifications.
- Concurrent or stale assignment confirmation fails safely and refreshes the current owner.
- Ineligible/suspended targets cannot receive an enquiry.
- Revoking the coordinator's employee, Sales, or capability state denies the next request.
- No bulk, automated, external-message, export, or paid-provider path exists.

## Verification plan

- pgTAP coverage for queue secrecy, coordinator grants, target eligibility, inactive owners, immutable history, concurrency, follow-up replacement, notifications, and immediate revocation
- Unit/component tests for mapping, reason validation, queue states, conflicts, and safe errors
- Chromium journeys for unassigned assignment and inactive-owner reassignment at desktop/mobile widths
- Full format, lint, type, unit, database, build, and visual verification

## Open decisions

- D-023 Option B approved 2026-10-11
- Whether real volume later justifies bounded bulk or automatic routing
- Enrolment Operator handoff remains a separate F012/DW-041 slice
