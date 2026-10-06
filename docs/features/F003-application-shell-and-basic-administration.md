# F003 — Application Shell and Basic Administration

Status: In progress — first Enrolment Operator slice
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
- Fictional development preview while employee sign-in is being implemented

## Out of scope

- Employee invitation and production sign-in implementation
- Creating or matching canonical people
- Bulk issuance, exports, printing, messaging, or automatic delivery
- Activated-account recovery
- Offering or cohort administration
- Production deployment

## Permissions

The interface is not a security boundary. The trusted backend rechecks current employee membership and `enrollment.operate` capability. The development preview is available only in the local development build and never calls production services.

## Business rules

- Staff never set, view, or transmit the student's password.
- The raw activation pack is displayed only in the successful issuance response.
- Reissue is a separate, reason-required action and is not included in the first screen.
- The operator must verify the selected enrolment before issuing the pack.

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
- The production path remains unavailable until employee authentication supplies a current access token.
- Copy actions are explicit and the screen warns the operator to use an approved delivery route.
- Browser tests use fictional values and intercepted local responses.

## Relevant sources and ADRs

- D-006 employee verified-email authentication
- D-007 activation-pack format and lifecycle
- D-008 Enrolment Operator authority
- D-009 offering, cohort, and enrolment structure
- F001 Authentication
- F002 Roles and Permissions
- F004 Course and Enrolment Foundation

## Acceptance criteria

- An operator can understand which enrolment is being activated before confirming.
- Success presents the Member ID, activation link, backup code, and expiry distinctly.
- The screen explains that credentials are shown once and passwords remain private.
- Loading, error, denial, empty, and successful states remain accessible by keyboard and assistive technology.
- Local preview code cannot be activated in a production build.
- Unit and browser tests cover confirmation and successful pack display.

## Verification plan

- Unit tests for review, confirmation, success, and error states
- Browser journey using fictional development-preview data
- Responsive and keyboard inspection
- Full repository verification and production build

## Open decisions

- Final employee sign-in and session UI details
- Queue filtering, sorting, assignment, and pagination
- Approved physical/digital delivery procedures
- Whether a printable pack is permitted
