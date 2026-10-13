# F016 — Employee invitation and password recovery

Status: Decision required — D-029 Option B recommended, not approved
Risk: Red

## Purpose and problem

Staff can sign in and use MFA, but employee accounts still require developer-controlled provisioning. Forgotten employee passwords have no application recovery journey. Build a controlled invite-only experience without exposing administrator-selected passwords or bypassing existing MFA and suspension rules.

## Users and proposed flow

- A currently authorized global Elevated Admin with recent live MFA reviews canonical-person duplicates and proposes an invitation for an individual employee email.
- The employee proves ownership through a single-use expiring email activation path and chooses their own password.
- Ordinary role grants remain explicit, attributable, and separately authorized. An invitation never bootstraps an Elevated Admin or restores a suspended employee.
- Password recovery responds generically, sends only to the unchanged established email, consumes a bounded single-use token, and invalidates old application sessions before reporting success. Existing MFA remains required.

## Proposed scope under D-029 Option B

- Employee invitation issuance, duplicate safeguards, activation, expiry, cancellation, and deliberate reissue.
- Generic password-recovery request and employee-controlled password update.
- Trusted server authority, current-state denial, minimized audit, bounded abuse controls, safe return routing, and explicit delivery-unavailable states.
- Real local Auth/email-capture integration with fictional addresses, browser journeys, and responsive approved UI patterns.
- Hosted delivery remains disabled/fail-closed until a separate sender/provider activation decision.

## Out of scope

Real recipients, production access, paid email plans, sender DNS changes, marketing messages, public signup, student recovery, automatic privileged role grants, suspension restoration, verified-contact replacement, assisted lost-email recovery, or MFA bypass.

## Data, privacy, and authority

Follow D-004's immutable canonical person linkage; never merge people by name alone or silently overwrite established identities. Do not persist plain invite/recovery credentials in Dexam business tables, logs, analytics, screenshots, or repository artifacts. Transient email-link credentials must be consumed and cleared safely; administrator interfaces never expose the employee's final password. No product analytics are proposed.

## Interface states

Loading, no authority, duplicate review required, pending invitation, activation successful, expired/cancelled invitation, generic recovery acknowledgment, invalid/expired link, password validation, completed session invalidation, suspended access denied, delivery unavailable, and safe retry.

## Acceptance and verification

- No unapproved or duplicate employee account gains protected access through an invitation.
- Public, Teacher, Sales, ordinary Admin, stale-MFA, revoked, and suspended issuers fail closed.
- Activation/recovery expiry, cancellation, replay, changed identity, current revocation, and partial-failure handling are tested.
- Recovery never removes MFA, changes established email, restores suspension, or widens authority.
- Old tokens—including refreshed old sessions—cannot regain access after completed recovery.
- Local fictional emails reach the capture inbox; no test sends to a real recipient.
- Browser flows are keyboard accessible, responsive, use approved primitives, and retain no credential-bearing screenshots or traces.

## Open decision

D-029 must be approved before implementation. After approval, document exact token lifetimes, reissue/throttle budgets, trusted delivery contract, and failure sequencing in the implementation specification; materially new user/security policy returns to the owner. Real delivery and assisted recovery remain later gates even if Option B is selected.
