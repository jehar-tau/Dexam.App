# ADR-004 — Identity Deduplication and Access Revocation

Status: Approved
Date: 2026-09-26
Decision ID: D-004
Risk: Red — identity, employee access, student privacy, and incident response

## Context

Dexam must uniquely identify students and employees, prevent accidental or deliberate duplicate accounts, and rapidly remove access when a person leaves or becomes a security risk. A disgruntled or terminated employee must not retain access to Dexam-controlled application, database, source-code, hosting, storage, analytics, communication, or administration systems.

Authentication accounts are not themselves the canonical person record. Email addresses can change, families may share phone numbers, a person can use more than one login method, and duplicate accounts can be created unless application and database workflows explicitly prevent them.

## Approved outcomes

- Every student and employee has one canonical Dexam person record with a permanent, opaque internal identifier that is never reassigned.
- A person may have approved login identities attached to that record, but additional login methods must not create a second person.
- Student and employee account creation is controlled, checked for duplicates, and auditable.
- Shared employee accounts are prohibited.
- Suspending a person blocks authorization in Dexam immediately, even if a previously issued access token has not expired.
- Offboarding removes access from every Dexam-controlled system, not only the application.
- Past academic, financial, and audit history remains attributable after access is removed.

## Canonical identity model

### Person record

- Use a generated UUID as the internal primary identifier.
- Store human-friendly Student and Employee IDs separately. They are unique, immutable after issuance, and contain no birth date, phone number, government identifier, or other personal data.
- Authentication-provider user IDs link to the canonical person record; they are not used as the business identity displayed in records.
- Student, employee, lead, guardian, and future alumni relationships attach to the canonical person rather than creating unrelated copies.

### Matching attributes

- Normalize and uniquely constrain verified email addresses where the workflow guarantees one address belongs to one person.
- Normalize phone numbers to an international format, but do not assume a phone number uniquely proves a student because families can share numbers and numbers can be reassigned.
- Store guardian contact relationships explicitly rather than copying a guardian phone number into multiple student identities as if it belonged to each student.
- Use enrolment/application references and approved purchase references as additional matching evidence.
- Do not collect Aadhaar or another government identifier merely for deduplication. Any future collection of government identity requires a separate legal, privacy, retention, and security Decision Gate.

## Duplicate prevention

- Public unrestricted account creation remains disabled.
- Account creation occurs through a trusted invitation, approved enrolment, verified purchase, or authorized staff workflow.
- Before creating a person, the trusted workflow searches normalized verified identifiers and presents potential matches for review.
- Database unique constraints and transaction-safe creation prevent concurrent duplicate records.
- A suspected match is reviewed rather than automatically combining two people on weak evidence.
- Confirmed duplicates are merged through an audited workflow that preserves enrolments, submissions, payments, feedback, and identity history.
- Deleting one duplicate record without reconciliation is prohibited.

No system can guarantee that the same human will never use different contact details. The design combines controlled entry, strong identifiers, database constraints, matching signals, and manual review instead of making a false promise of perfect automatic detection.

## Employee access

- Employee accounts are invite-only and individually attributable.
- Prefer a Dexam-controlled work email when operationally available; personal email use requires explicit approval and stronger offboarding checks.
- Employees receive only the application and vendor access required for their role.
- Production database, hosting, source-code, storage, analytics, email, payment, and communication access are granted separately and recorded in an access inventory.
- Service-role keys, database passwords, owner accounts, and recovery credentials are never embedded in employee-facing applications or shared in chat.
- High-risk administrative actions require re-authentication and, when available within the approved cost tier, multi-factor authentication.

## Immediate suspension design

Every protected database operation must verify current server-side state, including:

- the canonical person is active;
- the relevant employment or enrolment membership is active;
- the requested permission is currently assigned;
- ownership or assignment scope allows the specific record;
- elevated operations satisfy any additional assurance requirement.

Do not rely only on role or status embedded in a JWT. Supabase documents that JWT claims can remain stale until refresh and that an access token can remain valid until its expiry even after refresh tokens are revoked. Dexam policies therefore consult current authorization tables for access decisions, and sensitive operations may additionally validate that the token's session still exists.

Suspension performs all of the following as one controlled workflow:

1. Mark the Dexam person/membership suspended so RLS denies subsequent application data access.
2. Remove current application roles and elevated permissions.
3. Revoke all refresh sessions so no new access tokens can be minted.
4. Remove access from every external Dexam system in the access inventory.
5. Rotate any credential that was shared or may have been copied.
6. Preserve audit evidence and notify the designated owner that offboarding completed.

Deleting an authentication user is not the primary record-retention mechanism. Academic and audit history remains tied to the canonical person, while login capability and active authorization are removed.

## Offboarding coverage

The checklist must include, when applicable:

- Dexam application roles and sessions
- Supabase organization and project access
- GitHub repository and organization access
- Cloudflare access
- Google Drive/source-vault access
- Email accounts and forwarding rules
- Analytics and monitoring
- Payment-provider dashboards
- WhatsApp, Telegram, SMS, and CRM systems
- Password manager, recovery codes, API tokens, SSH keys, and shared devices

The security owner records who completed each removal, when it occurred, and any credentials rotated.

## Limits

- Revocation controls Dexam-managed systems. It cannot remotely erase information previously downloaded, copied, photographed, or sent outside approved systems.
- Export permissions, download minimization, watermarking where appropriate, audit logs, contractual controls, and rapid offboarding reduce that risk.
- Device management and remote wipe are separate operational decisions and are not assumed in the first milestone.

## Required tests

- Duplicate normalized email creation is rejected.
- Shared/guardian phone workflows do not incorrectly merge students.
- Concurrent account creation cannot produce two canonical people for the same verified identity.
- A suspended student cannot read or modify their former data.
- A suspended employee cannot access any student, course, sales, or admin data using an existing access token.
- Revoked role and assignment changes take effect without waiting for JWT role claims to refresh.
- Cross-role and cross-assignment access remains denied.
- Merge operations preserve references and create immutable audit records.

## Follow-up decisions

- Human-readable Student and Employee ID formats
- Exact matching thresholds and staff review workflow
- Approved employee email policy
- Access-token lifetime and sensitive-session validation scope
- MFA requirements and any paid-plan dependency
- Data retention and deletion periods
- Export and watermarking policy
- Formal incident-response owners and notification procedure

## Sources reviewed

- Supabase Row Level Security and stale JWT considerations: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase sessions and session validation: https://supabase.com/docs/guides/auth/sessions
- Supabase sign-out and token revocation behavior: https://supabase.com/docs/guides/auth/signout
- Supabase removal of account access: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase platform access control: https://supabase.com/docs/guides/platform/access-control

## Approval

Approved by the product owner on 2026-09-26 through the explicit requirements for unique student/employee identification, duplicate-login prevention, and comprehensive revocation for disgruntled or departed employees.
