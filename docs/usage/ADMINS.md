# Administrator guide

[Handbook home](README.md) · [Staff procedures](STAFF.md) · [Security operations](../STAFF_SECURITY.md)

## 1. What administrator access means

Sign in through `/admin/sign-in` using your own established employee identity. The `/admin` home requires current global Elevated Admin role and the existing MFA check; it is a safe landing, not a broad data dashboard. Sensitive destinations retain exact capability, verified/recent MFA and other live checks. A different URL, administrator title or nomination does not grant every staff, privacy, publishing or academic permission.

The product owner, Rohin and Siddhant Modi are planning nominees; this handbook does not provision their accounts or establish their eligibility. Never share one administrator identity. Two-person actions need distinct eligible people; lost-MFA recovery of an admin needs two other eligible actors. A three-person nomination alone does not prove everyone is provisioned, available or independently attributable.

Admin aliases include `/admin/employees`, `/admin/security`, `/admin/recovery`, `/admin/student-recovery` and `/admin/incidents`. Existing `/staff/...` bookmarks used in the detailed procedures below remain supported with original checks. Use **Switch to Staff portal** for separately permitted staff/privacy responsibilities. Missing/denied tools mean authority or environment must be checked, not that a menu link should bypass the rule.

## 2. Own MFA and sessions

1. Open **Staff security** (`/staff/security`). Deliberately enrol and verify your authenticator. Store its setup secret only in your approved authenticator—not a screenshot, ticket or repository.
2. Enrol a separately stored backup factor when eligible. Do not assume removing the last factor is allowed for MFA-required authority.
3. Re-verify MFA when a sensitive action asks for recent verification. Signing in with a password is not equivalent to recent MFA.
4. Routine sign-out affects the current device. **Sign out all devices** establishes an application cutoff before provider cleanup. If provider cleanup fails, do not assume prior application sessions regain access.

Passwords and MFA seeds must never be collected from another person. Admin actions do not automatically restore revoked roles or memberships.

## 3. Employee invitations and activation

Open **Employees** (`/staff/employees`) only with the required Elevated Admin capability and recent MFA. Review the canonical person and possible duplicates, select the established identity deliberately, and prepare the invitation using the allowed address/context. Review the invitation queue and cancellation controls. For reissue, reselect the same established person/email and complete the duplicate-review confirmation; the current employee invitation form has no reissue-reason field. The recipient chooses their own password through `/staff/activate`; invitation does not automatically grant a work role.

Current scope is fictional/local: `.invalid` addresses and locally captured email, with one-hour invitation links. Real sender/domain verification, private recipients, live transport and delivery tests are not activated. Do not send a real employee invitation merely because the button exists. The mock Resend adapter cannot send, and changing SMTP alone does not implement Dexam's custom proof flow.

There is not a complete unrestricted role-provisioning/offering-setup admin UI. Existing fictional fixture bootstrap is not a production staff-provisioning procedure. Do not use broad SQL grants, shared service keys or fixture scripts to onboard real staff.

## 4. Employee forgotten password

The employee uses `/staff/recover`, which targets their unchanged established email and intentionally avoids confirming account existence. Successful recovery blocks old application sessions and preserves enrolled MFA. Real delivery remains gated; do not substitute a different email without a separately approved contact-change workflow.

If a password mutation outcome is uncertain, it remains fenced/executing. Do not clear it, submit another mutation, fabricate completion, use link expiry as proof of failure, or edit provider-owned Auth tables. Escalate under the exact-request investigation procedure. Full supported resolution remains a launch gap.

## 5. Student forgotten password

Open **Student recovery** (`/staff/student-recovery`) with the specific assisted-recovery capability and recent MFA.

1. Find the exact Member ID. Verify established student identity using evidence beyond name/Member ID, and check the admitted enrolment record.
2. Record a proposal only after both required verifications are true.
3. A different eligible Elevated Admin independently reviews the exact target and approves or rejects. The proposer cannot approve their own proposal.
4. Only after valid independent approval, issue the private one-time reset pack through the permitted controls. Hand it directly to the verified student and hide it afterwards.
5. The student opens `/student/recover` and chooses their own password. Preserve the same canonical person/Member ID. Never ask for or choose the student's password for them.
6. Refresh current state after uncertainty; follow the execution fence and incident procedure rather than reissuing blindly.

This is accepted for fictional/local testing. Hosted student reset execution remains disabled until separately approved. It does not require all students to have an email/phone or create verified-contact self-service recovery.

## 6. Lost authenticator

Follow [Staff security operations](../STAFF_SECURITY.md) for exact current windows/failure handling.

At `/staff/security/recovery`, one recent-MFA Elevated Admin proposes the exact factor reset; a different recent-MFA Elevated Admin approves/rejects it. Neither can be the affected person. Both actors and target must still satisfy current rules at execution. The trusted operation fences previous sessions, removes only the approved factor using supported provider APIs and checks its absence. The employee signs in again and enrols/verifies a replacement when needed.

Current proposal/verification windows are 15 minutes. Expired or uncertain execution is not permission to bypass checks. Fewer than two available eligible non-target admins means the normal recovery route is unavailable; there is no one-admin emergency browser override.

## 7. Uncertain-reset investigations

Open **Recovery investigations** (`/staff/security/incidents`). Review the exact uncertain employee/student request within your existing authority. An eligible non-target admin acknowledges that the investigation keeps the reset blocked and selects **Open investigation**. A different eligible non-target admin records **Record independent review** after checking the exact case and current authority/MFA.

This records accountability; it does not retry/undo a password update, cancel the executing request, resolve provider ambiguity, unlock the account or restore prior sessions. If no eligible reviewer is available, keep the fence and contact the incident lead. Never put passwords, tokens, request payloads or MFA seeds into investigation notes or general alerts.

## 8. Privacy, publishing and academic powers

Privacy operations require their separate capabilities and recent MFA. Use the verified-case/impact/two-person process described in the [Staff guide](STAFF.md). Ordinary administrators do not automatically gain privacy correction/erasure, academic publishing, broad file downloads or a teacher's private work queue. Protected canonical/academic domains must not be erased merely to make a CRM action succeed.

Changing a staff role, granting new authority, replacing established contacts, impersonation, exports and other exceptional actions are not all implemented as a general admin console. Their deferred scopes remain separate. Do not improvise an unchecked admin superuser UI.

## 9. Support and incidents

Owner-confirmed planning: product owner is primary support/incident lead, Rohin backup, staffed 24/7 coverage available, Siddhant Modi third admin nominee. No guaranteed acknowledgement/resolution time or verified private escalation channel follows from these statements.

For an incident:

1. Identify the affected workflow and exact environment. Do not put real records into fictional staging to reproduce it.
2. Preserve minimized, authorized evidence. Never collect credentials, QR images, raw provider payloads or private student work in a general ticket.
3. For uncertainty, preserve execution fences/references/holds; do not repeat consequential operations until current state is understood.
4. Contact the accountable human through the approved private channel. If none is configured, this is an operational blocker—not proof the app can alert someone automatically.
5. Engineering investigates within existing authority. Privileged recovery, deletion or production changes keep their own approval and independent-review requirements.

Cross-system offboarding must cover application membership/capabilities, Auth sessions and relevant cloud/repository/provider access. A menu change alone is not complete offboarding. Use an approved attributable procedure; this handbook grants no new account-deletion authority.

## 10. Maintenance, backups and release

Cleanup workers, holds/retention and fictional Cron exist only within their documented boundaries. A 200 response does not prove every file was removed; compare examined/completed/failed outcomes. Unknown legacy objects, referenced files and holds stay protected. No production worker should be activated from this guide alone.

The isolated DB/private-file restore rehearsal is not full production Auth or off-site recovery. Keep configuration/secrets, newer erasure/revocation evidence, object bytes and supported recovery procedures accounted for. Never run a fictional reset/bootstrap against production.

Before real onboarding, complete [Release status](../RELEASE_STATUS.md), [Production readiness](../PRODUCTION_READINESS.md), [Launch plan](../LAUNCH_PLAN.md) and [Maintenance plan](../MAINTENANCE_OPERATIONS_PLAN.md). Real email, privacy/security review, operational drills, capacity/budget validation and explicit production approval remain necessary. Payment/AI/other providers are not enabled merely by administrator access.
