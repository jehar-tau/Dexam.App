# F001 — Authentication

Status: Approved direction — implementation started
Risk: Red
Owner: Product owner with Codex engineering support

## Outcome

An approved student or employee can securely activate, sign in to, recover, and sign out of exactly one attributable Dexam account. Suspended people lose access immediately.

## Initial scope

- Controlled student activation from an approved enrolment or staff workflow
- Invite-only employee activation
- Student Member ID/password sign-in, subject to D-006
- Employee verified-email/password sign-in
- TOTP enrolment and challenge for elevated administration
- Sign-out from the current device and security-triggered revocation of all sessions
- Secure recovery and password change
- Friendly expired-session and suspended-account states
- Audit events for activation, recovery, identity change, MFA change, suspension, and administrative action

## User journeys

### Student activation and sign-in

1. An authorized workflow creates or matches the canonical person and active enrolment.
2. The system issues one immutable Member ID and a single-use, expiring activation path.
3. The student sets a password without exposing it to staff.
4. The student signs in with Member ID and password.
5. The server resolves the linked canonical person and confirms current active status before returning protected data.

### Employee activation and sign-in

1. An authorized administrator invites a verified individual email.
2. The employee activates the account and sets a password.
3. Elevated administrators enrol TOTP before elevated access is enabled.
4. Every protected request uses current database authorization, not only token claims.

### Recovery

- Recovery begins with a generic response regardless of whether the identifier exists.
- A verified self-service path is preferred; an assisted path requires staff authorization, evidence checks, an audit record, and notification to established contact channels.
- Successful recovery invalidates old sessions and single-use tokens.
- Staff never see, transmit, or set the final password.

### Suspension

- The D-004 suspension workflow changes current database state first.
- Existing tokens cannot bypass the suspended state.
- Refresh sessions and elevated permissions are revoked, and external-system offboarding proceeds from the access inventory.

## Acceptance criteria

- Public sign-up is unavailable.
- An unapproved person cannot activate an account.
- One approved person cannot create a second canonical person through activation or recovery.
- Credentials never appear in application logs, analytics, URLs, or Dexam business tables.
- Invalid login and recovery attempts do not disclose whether an account exists.
- Rate limits slow automated guessing and recovery abuse.
- Single-use tokens expire and cannot be replayed.
- A suspended student or employee is denied on the next protected request, including with a previously issued access token.
- A role removal or assignment change takes effect without waiting for JWT claims to refresh.
- Elevated administration is unavailable without the required TOTP assurance level.
- Authentication, recovery, MFA, and suspension events are attributable and auditable without recording secrets.

## Required tests

- Unit tests for Member ID normalization, generic error mapping, and recovery state transitions
- Integration tests for activation token expiry/replay, duplicate identity rejection, and session revocation
- Database tests proving active-state and role checks deny stale-token access
- Browser tests for student activation/login/recovery and employee login/MFA
- Abuse tests for enumeration resistance and rate-limited repeated attempts

## Out of scope

- Public self-registration
- SMS OTP, social login, passkeys, and institutional SSO
- Guardian login
- Production email/SMS vendor purchasing
- Final retention policy and legal identity verification

## Dependencies and open decisions

- D-006 Option B approved on 2026-09-26
- D-007 Option B approved on 2026-09-26
- Production email delivery and domain configuration
- Session duration and re-authentication intervals

## Implemented slices

### Student Member ID sign-in and route protection — 2026-10-10

- Added a public trusted Edge Function that maps the normalized Member ID to the internal synthetic Supabase Auth email without exposing that mapping to the browser.
- Added application-level rolling throttles for Member ID and network attempts using one-way HMAC keys rather than raw identifiers.
- Added a student sign-in interface with generic credential errors, safe local return routing, and no account-existence disclosure.
- Added a current-state student route boundary that checks active person and student membership on each protected-page load and denies stale sessions.
- Added local session cleanup when post-authentication membership is inactive or cannot be verified.
- Added unit, database, and browser coverage for normalization, invalid credentials, live membership denial, throttling, redirect behavior, and responsive rendering.

### Employee sign-in and staff route protection — 2026-10-07

- Added verified-email/password sign-in through the public Supabase browser client.
- Added a session provider with browser persistence and current-device sign-out.
- Added a staff access boundary that rechecks active employee membership and the route's current capability before rendering protected content.
- Added a safe local return path after sign-in; external and sign-in-loop destinations are rejected.
- Added generic credential errors so the interface does not disclose whether an employee email exists.
- Added the shared Input primitive, approved usage specification, and Storybook states required by the sign-in form.
- Added unit and browser coverage for credential errors, inactive employees, current capability checks, protected-route redirects, explicit fictional preview, and responsive sign-in rendering.

Employee invitation, recovery, MFA enrolment/challenge, and all-device revocation remain separate slices.
