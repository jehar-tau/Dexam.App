# F017 — Student assisted account recovery

Status: Implementation authorized — D-030 Option B approved 2026-10-14
Risk: Red

## Purpose

Restore an activated student's password without replacing their canonical person, permanent Member ID, Auth identity, enrolment, coursework, assignments, or feedback. Reuse the approved layered recovery direction in D-007 and privileged boundaries in D-008; do not turn an unclaimed activation-pack reissue into an activated-account reset.

## Proposed first slice

D-030 Option B was approved on 2026-10-14. Every guided assisted reset requires independent approval. Only current Elevated Admins with recent live MFA may propose/review/execute; actors remain distinct and cannot be the target. Sales, Teachers, ordinary Admins, and Enrolment Operators remain unable to reset activated accounts.

The proposed flow reviews the exact canonical Member ID, claimed account, current student membership, and established identity/enrolment evidence with the student outside the app. Record only symbolic evidence categories and reason, not document copies, answers, or government identifiers. Weak matches, name/Member-ID knowledge alone, inconsistent evidence, suspicious requests, or unavailable independent approval fail closed for escalation.

After approval, issue a bounded one-time recovery pack using the existing cryptographic action-token foundation. Hand it only to the verified student. The student consumes it in an isolated recovery flow, chooses and confirms their own password, and signs in again. The final lifetime, attempt/cooldown budgets, exact evidence categories, safe handover, and uncertainty procedure must be documented and reviewed before implementation acceptance; materially new policy returns to the owner.

## Durable security boundaries

- Same canonical person, Member ID, and claimed Auth identity; no new student account or silent identity merge.
- No staff-created passwords, impersonation, enrolment restoration, suspension bypass, contact change, new authority, or public account-existence disclosure.
- Current actor/target checks at each phase, immutable independent decisions, expired/cancelled/replayed proof denial, and minimized attributable audit.
- Apply old-session/refresh denial to student identity paths, including direct provider password changes, rather than trusting UI sequencing. Employee safeguards stay unchanged.
- External password mutation remains exclusively fenced until a known terminal outcome. Expiry is not permission to supersede an uncertain provider update; DW-045's operational gate applies.
- No real contacts, messages, government identity, production data/access, or paid services.

## Proposed tests

Permission matrix for every actor; distinct proposer/approver/target; old/changed/revoked actors; inactive/suspended students; unknown/unclaimed/duplicate Member IDs; wrong Auth owner; changed identity; expiry/cancellation/reissue/replay; issuer proof and safe handover; missing evidence acknowledgment; concurrent issuance; mutation-window sessions; uncertain delayed provider overlap; no roles/enrolment changes; privacy-safe responses and audit; real local provider and responsive keyboard/browser flow without credential-bearing artifacts.

## Approval foundation — 2026-10-14

Migration `20261014003000` marks `student_recovery.assist` as requiring two people and adds the private request ledger, exact Member ID target lookup, proposal, independent evidence review, minimized queue, and audited cancellation. Both administrators need recent live MFA; neither can be the target. Eligibility requires the existing claimed synthetic Member ID Auth identity, confirmed unchanged mapping, active person/student membership, no provider ban, and admitted enrolment history. Completed/withdrawn/expired historical enrolments can establish prior identity without becoming active again. Evidence records contain only the two symbolic categories, never documents or answers.

Proposals expire after 15 minutes and have a one-minute deliberate re-proposal cooldown. An unexpired active request cannot be silently replaced; an `executing` request cannot be superseded on expiry. No credential or password change exists in this first slice. Full local database verification passes 789 assertions, including self-review, current actor revocation/suspension, changed/ineligible target state, Auth ownership, enrolment evidence, and role denial. The existing application/browser behavior is unchanged. Pack issuance, student consumption, live student-session denial, trusted provider mutation, interfaces, and actual integration remain unfinished.

## Deferred rather than dropped

Verified-contact self-service and real delivery, lost-contact replacement, guardian-specific evidence/handover, emergency recovery, and production reconciliation require their own prerequisites/approval. Keep DW-001/DW-045 and `PRODUCTION_READINESS.md` current when this feature is eventually approved.
