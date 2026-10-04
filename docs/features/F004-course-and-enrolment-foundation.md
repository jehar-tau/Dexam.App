# F004 — Course and Enrolment Foundation

Status: In review — database foundation implemented
Risk: Red
Owner: Product owner with Codex engineering support

## Purpose and problem

Dexam needs a small, trustworthy academic record that answers three questions before a student receives an activation pack: what they joined, which delivery group they belong to, and whether that enrolment is currently approved. The model must support the first entrance-preparation course without binding a lifelong member identity to one course, year, or institution.

## Users

- Students viewing their own active and historical enrolments
- Sales staff submitting an enrolment request and seeing only its operational status
- Enrolment Operators reviewing, approving, activating, and ending enrolments
- Teachers working only with explicitly assigned offerings, cohorts, and students
- Elevated Admins handling exceptional audited corrections

## User flow

1. An authorized employee creates an enrolment request for a selected offering and, when applicable, a cohort.
2. An Enrolment Operator checks the request and resolves or creates the canonical person under D-004.
3. The operator approves the enrolment.
4. The trusted backend activates the enrolment and may issue the student's initial activation pack under D-007.
5. The student later sees the enrolment after activating and signing in.
6. Completion, cancellation, expiry, or withdrawal changes the enrolment state without deleting the person or historical record.

## In scope

- A reusable learning-offering record with title, code, status, and optional active dates
- Optional cohorts as delivery groups within an offering
- One enrolment per person, offering, and cohort context
- Request, approval, activation, completion, cancellation, and withdrawal history
- Source and actor attribution for sensitive transitions
- Activation-pack eligibility based on an approved active enrolment
- Student-own, assigned-teacher, and authorized-operator access boundaries
- Database constraints, RLS, audit events, and automated tests

## Out of scope

- Payments, orders, refunds, coupons, or purchase verification
- CRM lead storage and follow-up automation
- Lesson content, assignments, submissions, grading, or progress calculations
- Attendance, timetables, certificates, college programs, and professional workshops
- Production notifications or external messaging
- Bulk import and destructive deletion

## Permissions

- Students can read only their own enrolments after authentication.
- Sales can request review through a trusted workflow but cannot approve, activate, or browse academic data.
- Enrolment Operators can manage enrolments only within an explicitly assigned scope.
- Teachers can see enrolments only through a current teaching assignment; teacher assignment implementation may follow this schema.
- Elevated actions and corrections remain audited; service-role credentials never reach the browser.

## Business rules

- A person exists independently of every enrolment.
- An offering describes what Dexam provides; a cohort describes an optional delivery group for that offering.
- Approval and activation are separate recorded transitions. Activation-pack issuance requires an approved, active enrolment.
- A person cannot hold two simultaneous enrolments for the same offering and cohort context.
- Historical enrolments are ended, never silently overwritten or deleted.
- Enrolment state cannot grant staff authority, and a commercial entitlement cannot replace an enrolment.
- Dates and labels remain editable only through authorized, audited operations.

## Interface states

- Loading: request or enrolment details are being retrieved.
- Empty: no enrolment requests or enrolments exist within the current scope.
- Success: request submitted, enrolment approved/activated, or status changed.
- Validation: offering, student match, cohort applicability, and effective dates are checked.
- Error: the operation fails without partially activating an enrolment or issuing credentials.
- Offline/retry: no transition is reported as complete until the server confirms it; retries are idempotent.
- Permission denied: the action is hidden in navigation and rejected by the trusted operation/database.

## Data and privacy

- Store stable IDs and minimum operational metadata; do not copy contact details into enrolments.
- Record the request source, current state, effective dates, reason codes, and attributable actors.
- Free-text notes are excluded from the first schema to reduce unnecessary sensitive data.
- Retention and deletion periods require a later policy decision; records are preserved by default for audit integrity.

## Analytics events

No personal-data analytics are authorized in this feature. Operational audit events are not product analytics.

## Security considerations

- Activation-pack issuance rechecks the current enrolment, person, membership, capability, and scope in one trusted workflow.
- Client code cannot directly approve or activate enrolments.
- Status transitions use database constraints or trusted functions and are tested against replay and conflicting updates.
- RLS denies cross-student, cross-scope, Sales-to-academic, suspended-person, and stale-role access.

## Relevant sources and ADRs

- D-004 identity deduplication and revocation
- D-005 lifelong member architecture
- D-007 Member ID activation and recovery
- D-008 staff authority and approval boundaries
- D-009 offering, cohort, and enrolment structure (pending)

## Acceptance criteria

- An approved active enrolment can authorize initial activation-pack issuance.
- A pending, rejected, cancelled, withdrawn, completed, or expired enrolment cannot authorize a new initial pack.
- Duplicate active enrolments in the same offering/cohort context are rejected.
- A student sees only their own enrolments.
- Sales cannot approve or activate an enrolment.
- An out-of-scope or revoked Enrolment Operator is denied immediately.
- Every approval, activation, rejection, cancellation, withdrawal, and correction is attributable and auditable.
- Ending an enrolment does not delete the canonical person or reuse the Member ID.

## Verification plan

- Database tests for valid transitions, uniqueness, effective dates, and activation eligibility
- RLS tests for student ownership and staff scope boundaries
- Integration tests for atomic enrolment activation plus activation-pack issuance
- Unit tests for status mapping and safe user-facing errors
- Browser journeys will be added when the Enrolment Operator and student enrolment interfaces begin

## Open decisions

- D-009 Option B approved on 2026-10-04
- Exact initial offering and cohort records to use as fictional local seed data
- Enrolment end/expiry rules and their future relationship to content entitlements
- Whether minors require a guardian relationship (separate privacy/product decision)

## Implemented foundation

- Reusable offerings with stable codes, type, lifecycle status, and optional availability dates
- Optional cohorts tied to exactly one offering, with independent delivery dates and status
- Person-to-offering enrolments with optional cohort, constrained lifecycle evidence, and duplicate-open-enrolment prevention
- Append-only enrolment transition records for attributable workflow history
- Deny-by-default mutation access and student-own versus authorized-operator read policies
- Trusted-server activation eligibility that rechecks the person, student membership, offering, cohort, and approved active enrolment
- Database tests for ownership, Sales denial, operator revocation, invalid approval state, duplicate prevention, and suspension
