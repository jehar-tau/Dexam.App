# F002 — Roles and Permissions

Status: Draft — detailed approval required before implementation
Risk: Red
Governed by: D-003, D-004, and D-005

## Outcome

Each person can perform only the actions required for an active role and assigned scope. Suspension overrides every role. Historical ownership and audit attribution survive access removal.

## Authorization model

Authorization is calculated from current database records:

- `people` — canonical identity and active/suspended state
- `auth_identities` — approved login identities linked to a person
- `memberships` — time-bound student or employee relationship and status
- `role_assignments` — role, scope, start/end time, grantor, and status
- `teacher_assignments` — teacher-to-course/cohort/student scope
- `entitlements` — time-bound access to an offering or resource
- `permissions` — named capabilities attached to roles
- `audit_events` — append-only evidence of sensitive changes

A request is allowed only when the person and applicable membership are active, the permission is currently granted, and ownership/assignment scope matches the requested record. Deny by default.

## Directional permission matrix

| Capability                    | Student     | Teacher       | Sales                | Ordinary Admin         | Elevated Admin             |
| ----------------------------- | ----------- | ------------- | -------------------- | ---------------------- | -------------------------- |
| View own profile/learning     | Own         | Own           | Own                  | Support need           | Support need               |
| View student academic data    | Own         | Assigned only | No by default        | Approved support scope | Approved operational scope |
| Review submissions/feedback   | Own results | Assigned only | No                   | No by default          | Exceptional audited action |
| View leads/enrolment pipeline | No          | No            | Assigned sales scope | Approved operations    | Approved operations        |
| Create enrolment invitation   | No          | No            | Assigned workflow    | Yes                    | Yes                        |
| Grant ordinary roles          | No          | No            | No                   | No                     | Yes with MFA + audit       |
| Suspend employee access       | No          | No            | No                   | No                     | Yes with MFA + audit       |
| Export sensitive data         | No          | No            | No                   | Explicit grant + MFA   | Explicit grant + MFA       |
| Change system/security policy | No          | No            | No                   | No                     | Explicit elevated grant    |

“Admin” is not one unlimited role. Ordinary operational administration and elevated security administration are separate. No role automatically grants raw database, GitHub, hosting, or vendor-dashboard access.

## Rules

- A person may hold multiple current roles, but permissions are additive only within explicit scopes.
- Teachers see only assigned learners, cohorts, courses, and submissions.
- Sales users do not receive academic submissions, teacher feedback, or unnecessary sensitive profile data.
- Students see only their own records unless a future collaborative feature is separately approved.
- Entitlement to content does not imply a staff role or administrative permission.
- Role grants, scope changes, exports, impersonation-like support, suspension, and restoration are audited.
- The application UI hides unavailable actions, but database policies and trusted server operations remain the security boundary.
- Service-role credentials are limited to trusted server processes and never shipped to the browser.

## Acceptance criteria

- Cross-student, cross-teacher-assignment, and cross-sales-scope access is denied.
- Missing or expired roles and entitlements deny access.
- Suspension overrides otherwise valid roles, ownership, and entitlements immediately.
- Ordinary admins cannot grant roles, suspend employees, or export sensitive data unless explicitly elevated.
- Elevated actions require recent MFA and produce an immutable audit event.
- Direct database/API calls cannot bypass restrictions visible in the UI.
- Removing a role or assignment blocks the next protected request without waiting for token refresh.

## Required tests

- Database/RLS tests for every allow and deny boundary in the approved matrix
- Tests for overlapping roles, expired grants, and conflicting scopes
- Stale-token tests after suspension, role removal, and assignment removal
- Browser tests that each role sees only its intended navigation and actions
- Audit-integrity tests for every elevated change

## Open decisions

- Exact capability names and complete permission matrix
- Who may appoint the first elevated administrator
- Whether two-person approval is required for selected actions
- Support-access workflow and whether impersonation is ever allowed
- Export formats, limits, watermarking, and retention
- Emergency access and recovery ownership
