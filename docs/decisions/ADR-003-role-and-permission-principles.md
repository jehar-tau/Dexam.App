# ADR-003 — Role and Permission Principles

Status: Approved
Date: 2026-09-26
Decision ID: D-003
Risk: Red — authentication, authorization, staff access, and student privacy

## Context

Dexam initially needs four user roles: Student, Teacher, Sales, and Admin. These roles handle different types of personal, academic, operational, and commercial information. The authorization model must prevent staff convenience from becoming unrestricted access to student information.

This decision establishes the foundation. It does not define every screen or database policy. Detailed actions, exceptional cases, account lifecycle rules, and Row Level Security policies must be specified and tested through F001 Authentication and F002 Roles and Permissions.

## Approved principles

### Account entry

- Dexam will not begin with unrestricted public student registration.
- A student account is activated through an invitation, approved enrolment, or verified purchase flow.
- The exact invitation, enrolment, purchase, guardian, and identity-verification behaviors require feature specifications before implementation.

### Student

- A student accesses only their own profile, enrolments, coursework, submissions, progress, and feedback unless an approved feature explicitly introduces shared work.
- Students cannot assign roles, modify entitlements, or access staff interfaces.

### Teacher

- A teacher accesses only courses, cohorts, assignments, and students explicitly assigned to them.
- Teacher access does not automatically include sales records, payment details, or unrelated students.
- Broader academic-lead or reviewer permissions require an explicit future role or scoped permission; they are not silently included in Teacher.

### Sales

- A salesperson accesses leads, contact and follow-up information, approved sales notes, and the minimum enrolment status needed to perform their work.
- Sales cannot access student submissions, teacher feedback, detailed academic progress, scores, or private learning activity.
- Sensitive contact exports and bulk communication require separate approval and audit controls.

### Admin

- Admin is not treated as an invisible universal bypass in the interface or database.
- Ordinary operational administration and highly privileged security/data actions must be separated through scoped permissions or an elevated workflow.
- Consequential admin actions must be auditable.
- Production database service credentials are never a normal admin-user mechanism.

### Multiple roles

- One account may hold multiple roles only when each role is explicitly assigned.
- Permissions are additive only within documented boundaries; a second role must not bypass ownership, cohort, privacy, or elevated-action constraints.
- Role assignments, removals, and privilege changes are logged.

### Enforcement

- The interface may hide unavailable actions, but authorization is enforced in trusted server logic and PostgreSQL Row Level Security.
- Access is denied by default.
- Every table, storage bucket, and trusted operation receives positive and negative permission tests.
- Staff access should be scoped by assignment or operational need, not merely by role name.

### Account lifecycle

- Authorized staff can deactivate access without deleting academic or audit history.
- Deactivation, role changes, entitlement expiry, and account recovery must preserve auditability.
- Detailed retention, deletion, course-expiry, guardian/minor, suspension, and reactivation rules remain pending feature-level decisions.

## Explicitly not decided here

- Exact login methods: email/password, magic link, OTP, social login, or combinations
- Who creates invitations and how long they remain valid
- Guardian accounts or consent workflows for minors
- Teacher assignment hierarchy and substitute-teacher workflows
- Whether Dexam needs Academic Lead, Support, Finance, or Super Admin roles
- Admin elevation and re-authentication mechanics
- Course-expiry behavior and post-expiry information access
- Account deletion and data-retention periods
- Purchase-to-account matching
- Staff impersonation; it is forbidden unless separately proposed and approved

These questions will be presented as focused Decision Gates while preparing F001 and F002. Until decided, implementations must choose the more restrictive behavior or remain incomplete rather than inventing access.

## Consequences

- Sales and academic information are separated by design.
- Teachers require explicit assignment relationships in the data model.
- Role membership alone is insufficient for many queries; policies also check ownership or assignment.
- Admin tooling requires additional design rather than a single unrestricted dashboard.
- Audit records become part of the identity foundation.
- Authorization tests must cover cross-student, cross-teacher, cross-course, Sales-to-academic, and ordinary-Admin-to-elevated denial cases.

## Approval

Approved by the product owner on 2026-09-26 based on the role recommendations presented before this record was created.
