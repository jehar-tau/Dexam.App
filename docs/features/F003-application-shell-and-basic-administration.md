# F003 — Application Shell and Basic Administration

Status: In progress — live Enrolment Operator queue foundation
Risk: Red
Owner: Product owner with Codex engineering support

## Purpose and problem

Authorized staff need a clear operational workspace that exposes only the actions their current role and scope permit. The first slice lets an Enrolment Operator review one approved enrolment and issue its initial activation pack without seeing or setting the student's password.

## Users

- Enrolment Operators with the current `enrollment.operate` capability
- Elevated Admins when they hold the same operational capability

## User flow

1. The employee signs in through the approved employee authentication path.
2. The workspace lists enrolments within the employee's current scope.
3. The operator opens an approved enrolment and reviews the student Member ID, offering, cohort, and activation eligibility.
4. The operator confirms issuance.
5. The trusted backend returns the activation pack once.
6. The interface presents the link, backup code, expiry, and safe-delivery warning for immediate handoff.

## In scope

- Responsive Enrolment Operator workspace shell
- Approved-enrolment review state
- Initial activation-pack confirmation and result state
- Copy controls for the link, Member ID, and backup code
- Loading, denial, error, and already-issued states
- Live, permission-scoped approved-enrolment queue ordered oldest approval first
- Bounded search by operational student display name or immutable Dexam Member ID
- Explicitly enabled fictional preview for local interface review

## Out of scope

- Employee invitation and recovery administration
- Creating or matching canonical people
- Bulk issuance, exports, printing, messaging, or automatic delivery
- Activated-account recovery
- Offering or cohort administration
- Production deployment

## Permissions

The interface is not the only security boundary. The route and trusted backend both recheck current employee membership and `enrollment.operate` capability. The fictional preview requires an explicit build flag plus URL switch, and the flag is absent from the normal production build.

## Business rules

- Staff never set, view, or transmit the student's password.
- The raw activation pack is displayed only in the successful issuance response.
- Reissue is a separate, reason-required action and is not included in the first screen.
- The operator must verify the selected enrolment before issuing the pack.
- The queue shows at most 25 records initially and searches only operational display name and Member ID.
- A student without a valid operational display name remains out of the queue until trusted staff complete the data.

## Interface states

- Sign-in required
- Loading enrolments
- Empty queue
- Approved enrolment ready for review
- Confirmation
- Issuing
- Success with one-time credentials
- Permission denied or ineligible enrolment
- Retryable service error

## Data and privacy

The screen uses the minimum identity and enrolment fields needed for handoff. The preview uses fictional data. Raw credentials are never sent to analytics or written to application logs.

## Security considerations

- No service-role secret is shipped to the browser.
- The production path requires an employee session plus current membership and capability checks before protected content renders.
- The browser receives queue fields only through an authorization-checked function and cannot browse or edit student profiles directly.
- Copy actions are explicit and the screen warns the operator to use an approved delivery route.
- Browser tests use fictional values and intercepted local responses.

## Relevant sources and ADRs

- D-006 employee verified-email authentication
- D-007 activation-pack format and lifecycle
- D-008 Enrolment Operator authority
- D-009 offering, cohort, and enrolment structure
- D-012 live queue identity and initial volume
- F001 Authentication
- F002 Roles and Permissions
- F004 Course and Enrolment Foundation

## Acceptance criteria

- An operator can understand which enrolment is being activated before confirming.
- Success presents the Member ID, activation link, backup code, and expiry distinctly.
- The screen explains that credentials are shown once and passwords remain private.
- Loading, error, denial, empty, and successful states remain accessible by keyboard and assistive technology.
- The normal production build does not enable fictional preview data.
- Unit and browser tests cover confirmation and successful pack display.
- Database and client tests cover bounded search, minimal returned data, Sales denial, and immediate operator revocation.

## Verification plan

- Unit tests for review, confirmation, success, and error states
- Browser journey using fictional development-preview data
- Responsive and keyboard inspection
- Full repository verification and production build

## Open decisions

- Queue assignment and pagination beyond the approved oldest-first initial page
- Approved physical/digital delivery procedures
- Whether a printable pack is permitted

## Live queue implementation — 2026-10-07

- Added an authorization-checked database function that returns only currently eligible approved enrolments and the minimum operational fields required for activation.
- The function rechecks current `enrollment.operate` authority, excludes suspended or already-claimed students, rejects unbounded result sizes, and orders results deterministically.
- Added service-side response validation and current-session activation-pack issuance.
- Added the approved shared Empty State primitive for a successfully loaded queue with no eligible records.
- D-012 Option B adds a constrained operational display name and bounded display-name/Member-ID search.
- Connected the responsive queue, review, issuance, loading, retry, and empty states to the live permission-scoped service.
