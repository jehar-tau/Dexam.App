# F015 — Staff MFA and Session Security

Status: Setup/challenge implemented; enforcement and recovery await D-028 — D-027 Option B approved 2026-10-13
Risk: Red — staff account takeover, elevated authority, factor recovery, and session revocation

## Purpose and problem

Dexam already denies MFA-required database operations to password-only `aal1` sessions, but employees cannot yet enrol or challenge a TOTP factor through the application. F015 will make the approved D-006 and D-008 security boundary usable without creating a recovery bypass or paid messaging dependency.

## Users

- **Employee:** may enrol and challenge TOTP, manage permitted factors, and sign out safely.
- **MFA-required employee:** must reach `aal2` before using a sensitive capability.
- **Elevated Admin requester:** may propose a lost-factor reset for another employee with a recorded reason.
- **Different Elevated Admin approver:** may approve or reject the reset after reviewing minimum evidence.
- **Product owner:** retains the explicit D-008 emergency bootstrap procedure until two active Elevated Admins exist.

## Proposed user flow under recommended D-027 Option B

1. An active employee signs in with verified email and password at `aal1`.
2. If a verified factor exists, the application routes the employee to TOTP challenge before an MFA-required destination.
3. If MFA-required authority exists but no verified factor exists, the application routes the employee to enrolment.
4. Enrolment displays a one-session QR code and manual secret; the employee enters a current TOTP code to verify the factor and reach `aal2`.
5. An `aal2` employee may add a separately stored backup TOTP factor or remove a permitted factor. The final verified factor cannot be removed while MFA-required authority remains active.
6. If every factor is lost, one Elevated Admin proposes a reset and a different active Elevated Admin approves it. The trusted server rechecks both actors, deletes the selected factor, revokes all refresh sessions, and records the outcome.
7. The affected employee signs in again and must re-enrol before regaining MFA-required access.

## In scope if D-027 Option B is approved

- TOTP enrolment, challenge, and factor listing using supported Supabase Auth APIs
- Mandatory `aal2` routing for existing MFA-required capabilities
- Optional backup TOTP factor
- Safe current-device sign-out and security-triggered global refresh-session revocation
- Minimal two-person factor-reset request, approval, rejection, expiry, execution, and audit flow
- In-app/audit notification evidence for fictional staging
- Responsive, accessible staff security screens using the approved design system
- Database, unit/component, Edge Function, and browser tests for every authority boundary

## Out of scope

- Student MFA
- SMS or phone factors
- Supabase experimental recovery codes
- Passkeys, social login, or SSO
- Employee invitation, password/email recovery, or production SMTP
- Full administration of every two-person action listed in D-008
- Production deployment, real employee data, or a paid service

## Permissions and business rules

- Public or student sessions cannot access staff factor-management or reset operations.
- TOTP secrets and verification codes never enter Dexam business tables, logs, analytics, URLs, screenshots, or audit payloads.
- An employee must be active before enrolment, challenge routing, or factor management can succeed.
- Factor removal requires `aal2`; deleting the final factor is denied while current authority requires MFA.
- Reset proposer and approver must be different active people with current Elevated Admin authority and recent `aal2` assurance.
- Approval expires, is single-use, and rechecks target state and both actors at execution time.
- Reset revokes all refresh sessions. Existing short-lived access tokens remain subject to current database person, membership, capability, and suspension checks.
- Current-device sign-out explicitly uses local scope so a routine sign-out does not unexpectedly remove every device.
- No operation silently grants, restores, or widens a role or capability.

## Interface states

- MFA not required / optional enrolment
- MFA required / enrolment required
- QR and manual-key enrolment
- Verification pending, invalid code, expired challenge, network failure, and successful `aal2` state
- Factor list with primary/backup labels and guarded removal
- Lost-factor support guidance without account-existence disclosure
- Reset proposed, awaiting independent approval, rejected, expired, executed, or no longer valid
- Session revoked, employee inactive, capability removed, and safe sign-in return

## Data, privacy, and audit

- Store only factor identifiers and non-secret display metadata when operationally required; Supabase Auth remains the factor source of truth.
- Reset records contain target, proposer, approver, reason, timestamps, status, and non-secret provider outcome.
- Do not persist QR images, `otpauth` URIs, TOTP seeds, current codes, passwords, access tokens, or refresh tokens.
- No product analytics events are authorized for security screens. Use minimized security audit events only.

## Acceptance criteria

- An active MFA-required employee can enrol TOTP and reach `aal2` without a paid provider.
- An enrolled employee at `aal1` is routed to challenge rather than receiving an unexplained denial.
- Password-only, inactive, revoked, wrong-role, stale-capability, and self-approval attempts fail closed.
- The final verified factor cannot be removed while the employee holds MFA-required authority.
- A reset cannot execute without two distinct active authorized people at `aal2`, except through the separately recorded D-008 bootstrap emergency procedure.
- Successful reset deletes only the approved factor, revokes refresh sessions, records non-secret evidence, and requires re-enrolment before sensitive access.
- Routine sign-out affects only the current device; security-triggered revocation affects all refresh sessions.
- No secret or personal data is exposed in the browser bundle, database audit payloads, logs, test artifacts, or repository.

## Verification plan

- Unit tests for routing, generic errors, factor-state mapping, local/global sign-out selection, and approval state transitions
- Database tests for active-state, capability, `aal2`, actor separation, expiry, replay, and stale-authorization denial
- Local Auth/Edge Function tests for enrolment/challenge integration and administrator factor deletion
- Chromium journeys for enrolment, challenge, backup factor, guarded removal, lost-factor request, independent approval, revocation, and re-enrolment
- Desktop/mobile visual inspection, keyboard navigation, focus order, labels, error summaries, and no horizontal overflow
- Hosted fictional acceptance only after local checks and reviewed merge

## Authenticator UI slice — 2026-10-13

The `/staff/security` route now provides deliberate TOTP enrolment, a QR image and separately revealed manual key, challenge verification, unfinished-setup cancellation, and backup-factor enrolment after `aal2`. It uses the approved sign-in layout and existing Input, Card, Button, and Callout primitives. Setup material stays in transient component state and is cleared after verification. Current active employee membership is checked before rendering this route.

Enrolled password-only staff are routed to challenge when opening staff workspaces. The existing privacy route requires MFA enrolment/challenge before its capability check can succeed; database `aal2` enforcement remains authoritative. Local TOTP enrolment and verification are enabled in committed Supabase configuration. Hosted provider behaviour and a complete real TOTP journey remain acceptance work.

Verified-factor removal, provider-level final-factor enforcement, reset approval/execution, recent-MFA policy enforcement, audit integration, and global session revocation remain unfinished. No verified-factor removal control is exposed in this slice.

Verification: 134 unit/component tests, 42 Chromium journeys, 594 database assertions, formatting, lint, types, and build passed locally. Component tests exercise enrolment material, challenge, cancellation failure, generic errors, and safe return paths; boundary tests cover challenge/enrolment routing, provider failures, and inactive employees.

## Dependencies

- D-028 pending: a live local Auth probe confirmed direct final-factor deletion at `aal2`. The provider-level last-factor guarantee and stale-session enforcement architecture require the recorded choice before factor management and recovery completion.
- Local email/password provider configuration is corrected while global public signup remains disabled. The reproducible local probe proves provisioned-user sign-in, TOTP enrolment/challenge, and direct final-factor removal, then removes its disposable Auth account.

- D-004 current-state revocation
- D-006 Option B authentication model
- D-008 Option B staff authority and two-person boundaries
- D-026 fictional staging boundary
- D-027 Option B approved 2026-10-13
