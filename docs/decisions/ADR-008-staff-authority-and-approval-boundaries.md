# ADR-008 — Staff Authority and Approval Boundaries

Status: Proposed — product-owner approval required
Date: 2026-09-26
Decision ID: D-008
Risk: Red — student identity, staff privilege, recovery, and sensitive data

## Decision Gate

### Decision

Who may create a student, approve an enrolment, issue or reissue activation credentials, grant staff access, and perform exceptional security actions?

### Option A — Sales completes the entire enrolment and activation workflow

Sales staff can create the canonical student, approve enrolment, and issue activation credentials immediately after converting a lead.

- **Benefit:** Fastest operational workflow with the fewest handoffs.
- **Risk:** A compromised or pressured Sales account could create identities, grant learning access, and conceal duplicate or incorrect enrolments. Sales would receive more student information and authority than its role requires.

### Option B — Separate Sales, operational Admin, and Elevated Admin authority (recommended)

- **Sales** manages assigned leads and records a request for enrolment. Sales cannot create the canonical student, activate an enrolment, issue credentials, or access academic records.
- **Ordinary Admin with an explicit Enrolment Operator permission** reviews duplicate matches and approved enrolment evidence, creates or links the canonical student, activates the enrolment, and issues the initial activation pack.
- The same Enrolment Operator may invalidate and reissue an unused pack before account activation when a reason is recorded. They cannot reset an activated account, replace verified contacts during recovery, or grant themselves permissions.
- **Elevated Admin** grants ordinary staff roles, performs assisted recovery for an activated account, manages staff suspension/restoration, and handles exceptional security operations. MFA and audit evidence are required.
- Selected high-impact actions require a second authorized approver.

- **Benefit:** Preserves operational speed while separating sales pressure from identity/access approval and separating routine administration from security authority.
- **Risk:** Requires an Admin review step and a small approval queue.

### Option C — Elevated Admin performs every identity and enrolment action

Only an Elevated Admin can create students, approve enrolments, or issue any activation pack.

- **Benefit:** Very restrictive and simple to reason about.
- **Risk:** Creates a bottleneck, encourages unsafe credential sharing when the administrator is unavailable, and spends high privilege on routine work.

## Recommendation

Approve Option B. It applies least privilege without making normal enrolment dependent on the most powerful account.

## Proposed capability matrix

| Capability                           | Student           | Teacher | Sales               | Enrolment Operator         | Elevated Admin                 |
| ------------------------------------ | ----------------- | ------- | ------------------- | -------------------------- | ------------------------------ |
| Manage assigned lead                 | No                | No      | Yes                 | Support view when required | Audited operational view       |
| Request enrolment review             | No                | No      | Yes                 | Yes                        | Yes                            |
| Search possible identity duplicates  | No                | No      | Limited result only | Yes, for review            | Yes                            |
| Create/link canonical student        | No                | No      | No                  | Yes                        | Yes                            |
| Approve/activate enrolment           | No                | No      | No                  | Yes                        | Yes                            |
| Issue initial activation pack        | No                | No      | No                  | Yes                        | Yes                            |
| Reissue unused pre-activation pack   | No                | No      | No                  | Yes, reason required       | Yes                            |
| Recover an activated student account | Self-service only | No      | No                  | No                         | Yes, MFA + audit               |
| Replace verified recovery contact    | No                | No      | No                  | No                         | Two authorized approvers       |
| Grant ordinary staff role            | No                | No      | No                  | No                         | Yes, MFA + audit               |
| Grant/remove Elevated Admin          | No                | No      | No                  | No                         | Two authorized approvers       |
| Suspend employee immediately         | No                | No      | No                  | No                         | Yes, MFA + audit               |
| Restore suspended employee           | No                | No      | No                  | No                         | Two authorized approvers       |
| Bulk export sensitive data           | No                | No      | No                  | No                         | Explicit grant + two approvers |

Enrolment Operator is a scoped permission held by an Ordinary Admin, not a fifth universal role. A person receives it explicitly and can lose it without changing unrelated responsibilities.

## Two-person approval boundary

Two-person approval is required for:

- granting or removing Elevated Admin authority;
- replacing an established recovery contact during exceptional recovery;
- restoring a suspended employee;
- bulk export of sensitive personal or academic data;
- disabling or materially weakening security controls.

Immediate employee suspension requires only one Elevated Admin with recent MFA because delaying revocation increases risk. It creates an audit event and notifies the designated security owner. Routine student creation, approved enrolment, and initial activation-pack issuance do not require two people.

An approver cannot approve their own request. Approval records include requester, approver, action, target, reason, creation time, decision time, and expiry. Execution rechecks that both people remain active and authorized.

## First Elevated Admin bootstrap

The first Elevated Admin cannot be created through the ordinary application because no authorized administrator exists yet. Use a one-time, server-side bootstrap procedure with these controls:

- explicit product-owner approval recorded in the repository or release record;
- individually attributable employee account with verified email;
- TOTP enrolled before elevated capabilities become usable;
- no browser exposure of service-role credentials;
- immutable bootstrap audit event;
- procedure disabled after the first account is established.

Until a second Elevated Admin exists, an action normally requiring two approvers remains unavailable except through a separately recorded product-owner-approved emergency procedure. The system must not silently treat one person as two approvers.

## Support and impersonation

- Staff may view only the minimum information allowed by their role and active assignment.
- “View as student” must not bypass RLS or silently impersonate the student.
- Credential or session impersonation remains prohibited.
- Any future support-session feature requires a separate Decision Gate, visible indication, time limit, reason, consent rules, and audit trail.

## Consequences

- Activation-pack issuance must wait for the Enrolment Operator permission model and trusted staff interface.
- The database will model capabilities and scopes separately from broad role labels.
- Sales-to-enrolment handoff becomes an explicit, auditable state change.
- High-impact operations need a pending-approval record rather than immediate execution.
- Small-team bootstrap is supported without weakening the long-term two-person rule.

## Approval requested

Approve Option B, reject it, or request changes. Approval authorizes the role/capability schema, RLS policies, first-admin bootstrap tooling, and routine enrolment/activation-pack staff workflow. It does not authorize production access, data export, or recovery-contact replacement.
