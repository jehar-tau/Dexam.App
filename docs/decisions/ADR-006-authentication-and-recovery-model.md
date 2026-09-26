# ADR-006 — Authentication and Recovery Model

Status: Proposed — product-owner approval required
Date: 2026-09-26
Decision ID: D-006
Risk: Red — account security, identity recovery, and operating cost

## Context

Dexam needs a low-cost sign-in model that works for students who may not own a stable email address or phone number, while employees need individually attributable and rapidly revocable access. The login credential must remain separate from the canonical person record approved in D-004 and must support the lifelong account direction in D-005.

## Options

### Option A — Personal email and password for everyone

This uses Supabase's standard email flow, but excludes students without stable personal email, risks guardian/shared addresses, and makes a lifelong identity depend on a changeable contact method.

### Option B — Dexam Member ID for students; verified email for employees (recommended)

- Students sign in with a permanent, non-personal Dexam Member ID and password.
- The trusted backend maps the Member ID to an internal Supabase authentication identity. The implementation may use a synthetic internal email solely as an adapter; it is never shown as a real contact address.
- Student and guardian email/phone contacts are stored and verified separately and never become the canonical person identity.
- Employees sign in using an individually controlled, verified email and password.
- Elevated administrators must use TOTP multi-factor authentication. TOTP is also required when granting roles, suspending employees, or exporting sensitive data.

This avoids mandatory SMS cost, works without student email, and preserves a stable lifelong identifier. It requires Dexam-managed activation and recovery workflows.

### Option C — Phone OTP for students; email for employees

This feels simple but creates recurring SMS cost, fails where phones are shared or reassigned, and makes phone availability part of every login and recovery.

## Recommended controls for Option B

- No unrestricted public sign-up.
- Student accounts are activated from an approved enrolment or authorized staff workflow.
- Employee accounts are invitation-only.
- Minimum password length is 12 characters; passwords are never logged or stored by Dexam application tables.
- Login and recovery responses are generic so they do not reveal whether an account exists.
- Apply Supabase and application-level rate limits to login and recovery.
- Recovery verifies multiple approved signals and is auditable; staff cannot read or choose a user's password.
- Recovery or sensitive identity changes revoke existing sessions.
- Every protected request checks current person, membership, role, assignment, and suspension state as required by D-004.
- TOTP is initially optional for students and required for elevated administration. Revisit MFA for all employees before production access to sensitive student data.
- Use custom SMTP before depending on email invitations or recovery in production. Supabase's default email service is only suitable for development/testing and has restrictive limits.
- Enable leaked-password screening if a future paid plan makes it available; it is not assumed in the free-first launch architecture.

## Consequences

- Member IDs must be memorable enough to use but opaque, immutable, unique, and never recycled.
- Dexam must design secure student account handover and recovery, particularly when a guardian initially controls contact details.
- Internal synthetic authentication addresses must never be used for communication, identity matching, or display.
- Social login, SMS OTP, passkeys, and institutional SSO remain future decisions.

## Approval requested

Approve Option B, reject it, or request changes. Approval authorizes specification and local implementation; it does not authorize a paid service or production launch.

## Sources reviewed

- Supabase TOTP MFA: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Supabase password security: https://supabase.com/docs/guides/auth/password-security
- Supabase Auth rate limits: https://supabase.com/docs/guides/auth/rate-limits
- Supabase user management and server-side invitations: https://supabase.com/docs/guides/auth/users
- Supabase identity linking: https://supabase.com/docs/guides/auth/identities
