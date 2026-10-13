# F017 — Student assisted account recovery

Status: Accepted for fictional/local execution through PR #40 and protected staging release `38461876121` — D-030 Option B approved 2026-10-14; hosted execution disabled
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

Verified-contact self-service and real delivery, lost-contact replacement, guardian-specific evidence/handover, emergency recovery, and production reconciliation require their own prerequisites/approval. DW-001/DW-045 and `PRODUCTION_READINESS.md` retain these launch gates after local acceptance.

## Pack and consumption implementation — 2026-10-14

The approval foundation merged in PR #39 and protected fictional staging release `38459283926` succeeded. Migration `20261014004000` adds service-only pack issue/claim/finish and live provider-session checks for student identities as well as employees. `/staff/student-recovery` is protected by current `student_recovery.assist` and recent MFA with preview bypass disabled; `/student/recover` captures and clears only exact fragment credentials before rendering. Password mutation uses an isolated nonpersistent client and the supported Auth Admin password-only API. It cannot replace the canonical account, email, factors, roles, memberships or enrolment.

Implementation limits: a proposal lasts 15 minutes; an issued pack lasts 15 minutes and permits eight incorrect proof attempts. Both recorded administrator sessions must remain live, recently verified (15 minutes) and authorized at issuance, consumption and known-outcome finalization. A late pack therefore may require both administrators to reverify the same recorded sessions, or deliberate cancellation and a fresh independent request. The public worker allows 20 attempts per HMAC Member ID/hour and a shared 100/hour local budget; untrusted forwarding headers cannot increase it. Counters expire after 72 hours. These are conservative fictional-local budgets, not approved production abuse/retention policies.

Link secrets contain 256 random bits; ten-character unambiguous backup codes use rejection sampling. Only purpose-separated HMAC hashes reach the private token ledger. Raw credentials appear once to the authorized issuer in transient component memory, never query caches, persistent storage, logs or audit. The issuer hands the pack privately to the verified student and explicitly hides it after handover; loss requires deliberate cancellation/fresh approval. Student passwords are selected privately (12–128 characters), never entered by staff. Errors sanitize malformed responses and never echo credentials. The local link is fixed to `http://127.0.0.1:5173/student/recover`; no caller-controlled redirect is accepted.

Trusted workers are disabled unless `STUDENT_RECOVERY_MODE=local-only` **and** the API is an exact local endpoint. Hosted execution remains disabled. Durable cutoffs commit before and after provider mutation; consumed proofs cannot execute twice. An uncertain result stays exclusively `executing`, blocks current/new application sessions, and cannot be cancelled or superseded on expiry. Production reconciliation remains DW-045; no operational override is provided.

Verification: 824 database assertions; actual disposable local SDK reset plus Chromium independent admin review/approval/issue/private-hide and student link consumption, wrong proof/replay, old password/JWT/refresh denial, fresh canonical identity, unchanged historical enrolment, supported direct-provider password-change denial, and cleanup. Desktop/mobile screenshots are captured only after credentials are hidden. Independent Codex security reviews found no blocking backend/frontend defect; their schema-error privacy recommendation was applied. Full application/browser suite totals and merge/release evidence are maintained in CURRENT_STATE.
