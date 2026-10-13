# F016 — Employee invitation and password recovery

Status: Implementation active — D-029 Option B approved 2026-10-13
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

## First foundation slice — 2026-10-13

Migration `20261013200000` adds a private invitation ledger and narrowly granted recent-Elevated-Admin RPCs for duplicate search, preparation, masked queue, and cancellation. Preparation creates or links only the deliberate canonical person and a pending employee membership. It does not create an Auth identity, activate access, or grant a role. Suspended/ended memberships and established-email replacement are denied. Invitations use the existing local provider's one-hour expiry as the initial upper bound, with a one-minute deliberate reissue cooldown; no provider setting has been pushed to staging.

The local-only capture adapter accepts reserved `.invalid` recipients and allowlisted loopback/local container origins only. It refuses hosted Auth, disabled configuration, unsafe callbacks, redirects, and transport failures; messages are plain text and never released to an SMTP relay. Its 18 security assertions are part of the normal Vitest suite. The provider probe reached real captured invitation delivery, email confirmation, replay denial, and employee-chosen password using one disposable local Auth account; account and captured mail were removed. No credential-bearing payload was printed or saved.

Independent security review found and resolved separate cleanup failure handling and capture redirect/timeout concerns. Foundation review is not acceptance of the full F016 workflow. Trusted delivery, owned confirmation/finalization, expiry/cancellation races, recovery session invalidation, abuse controls, and the interfaces remain to be built and reviewed.

## Invitation delivery and activation slice — 2026-10-14

Foundation PR #35 is merged. Migration `20261013203000` adds service-only claim, private Auth binding, delivery outcome, and atomic acceptance. Every stage rechecks current issuer/target authority; acceptance requires the same owned live provider OTP session, an unchanged confirmed email, a chosen password, and an unpredictable 256-bit application proof bound to the exact invitation. Only its SHA-256 hash is stored in the private ledger. Cancellation, expiry, and replay deny access. Reissue preserves the explicit canonical person and existing provider identity; it cannot change established email or restore suspended/ended employees.

The public `auth_identities` linkage is deferred until atomic acceptance. A pending employee account therefore cannot resolve the person's existing student business data. No invitation grants a role. The administrator sees only a masked queue and safe outcomes, never provider tokens, application proofs, or passwords.

`/staff/employees` requires current role-grant authority and recent Elevated Admin MFA; it has no preview bypass. `/staff/activate` captures the exact fragment into transient memory and clears the browser URL before rendering. Verification, password selection, and acceptance use an isolated nonpersistent Auth client, not the account shared with other browser tabs. The employee signs in again after completion. Reloading a consumed link is not a resume mechanism; uncertain delivery/activation outcomes require queue inspection and deliberate cancellation/reissue.

Concurrent duplicate delivery remains a fail-closed availability limitation: an overlapping provider operation may invalidate an earlier email token. Do not repeatedly click delivery after an uncertain response. Refresh, inspect status, and cancel/reissue if needed. Production email/provider activation remains disabled and separately gated.

Independent review identified and resolved both cancelled-A/replacement-B proof confusion and cross-tab shared-session password mutation. The database suite passes 715 assertions; application/component tests pass 196; 47 browser journeys pass, including missing-link mobile/desktop states, malformed-fragment removal, and invitation-preview denial. Actual local provider/Edge integration passed exact-proof reissue, no pre-acceptance canonical linkage, and replay denial with disposable cleanup. The real local browser also consumed the captured application link, cleared the URL, chose a password, completed activation, and retained no activation session in localStorage; its disposable people/accounts/mail were removed. Password recovery is not implemented or accepted by this slice.

## Employee password recovery slice — 2026-10-14

Invitation PR #36 is merged; protected deployment `38452055191` passed the advisor gate, all nine existing hosted authorization checks, and hosted staff MFA recovery. Password recovery is now implemented locally and independently reviewed; merge/release verification remains pending.

Migration `20261014001000` creates a private recovery ledger and service-only preparation, proof delivery, exclusive claim, and provider-outcome finalization. Only an active person with an active employee membership and unchanged confirmed `employee_email` identity is eligible. Public requests always acknowledge generically; account lookup, provider generation, and local capture run after acknowledgment using the supported background-task mechanism. No account-existence or delivery outcome is returned. HMAC-only counters allow five requests per recipient per hour and a shared local-testing budget of 100/hour; forwarding headers cannot rotate this shared bucket. Deliberate reissue has a one-minute cooldown, invalidates prior unclaimed requests, and never replaces an executing password mutation. Counter windows older than 72 hours are removed; production retention for operational recovery records remains a launch policy gate.

Captured links expire within one hour and contain an exact-request random proof in the URL fragment. `/staff/recover` clears that fragment before rendering and uses an isolated, nonpersistent OTP session. The trusted worker validates the verified owner, owned live OTP session, current target, unchanged email, and exact proof before committing a durable session cutoff. It changes only the provider password through the supported administrator API; existing factors, identities, roles, and suspension state are untouched. Finalization advances the cutoff again to deny sessions created during the provider mutation window. A successful recipient must sign in again and satisfy existing MFA.

Migration `20261014002000` closes a confirmed direct-provider bypass: every employee-email identity now requires its owned live provider session, even when no application cutoff exists. Direct provider password updates delete other provider sessions, so still-valid employee JWTs cannot regain Dexam access. Student Member ID behavior remains unchanged. Older rolled-back database fixtures now represent explicit owned employee sessions rather than sessionless fictional JWTs; intentional invalid/missing-session security tests remain intact.

An uncertain password mutation remains `executing`, denies employee application access, and exclusively prevents another password mutation. A timeout, network exception, 5xx, missing/mismatched success payload, or mere link expiry is not proof the provider operation stopped. No automatic expiry-based unlock is provided. A confirmed owned success or explicit provider rejection can finish the request; ambiguous outcomes require separately approved, evidence-based operational reconciliation. This avoids a delayed old update overwriting a newer completed password. See DW-045 and the mandatory production checklist.

Local acceptance passed the actual provider/Edge recovery flow, preserved TOTP, required fresh MFA for sensitive authority, denied old and refreshed sessions, rejected replay and suspended targets, and completed the real Chromium recovery screen without persistent Auth tokens. The direct-provider regression now denies the old JWT. Database verification passes 753 assertions, including delayed-provider overlap modeling and both session cutoffs; 211 application tests and 51 browser journeys pass. Independent review has no remaining blocking finding for this local-only slice. Desktop/mobile completion screenshots were visually inspected and contain only the cleared completion screen, never email credentials or password fields. No real email, paid provider, production account, or assisted lost-email recovery is authorized.

Provider behavior was checked against the [pinned Auth v2.197.0 password-update implementation](https://github.com/supabase/auth/blob/v2.197.0/internal/models/user.go) and the actual local regression. Background acknowledgment follows [Supabase's supported background-task API](https://supabase.com/docs/guides/functions/background-tasks); the local runtime already uses `per_worker`.

## Open decisions

D-029 Option B is approved. Real delivery and assisted recovery remain later gates. Real authentication email delivery and controlled uncertain-mutation reconciliation are mandatory launch requirements in `../PRODUCTION_READINESS.md`, not optional functionality dropped by choosing local testing.
