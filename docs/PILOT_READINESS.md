# Fictional pilot readiness

Status: Active under owner-approved D-039 Option B, 2026-10-14. Not production ready.

This is a bounded first milestone, not a promise that every roadmap feature is finished. Use only invented accounts/content on localhost or the approved fictional staging project. No real students, employee contacts, external delivery, paid provider or production activation. Codex leads setup/testing; the designer owner should not have to diagnose environments or create PRs.

## Evidence map

| Existing workflow                                         | Evidence rerun in F025                                                                                                                                                               | Boundary / remaining limitation                                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared-browser account change                             | Actual Edge sign-in and Chromium, delayed second private read, open membership revocation; unit direct switch/late requests/draft reset/token refresh                                | Pending-request isolation and retired-workspace continuation safeguards; server checks remain authoritative, no instant remote screen erasure claim |
| Initial student activation                                | `verify-local-student-activation-link.mjs`: actual pack, secure link clearing, password choice, canonical login, replay denial, desktop/mobile                                       | Private handover and exact real launch callbacks remain gates                                                                                       |
| Employee invitation/recovery                              | `verify-local-employee-invitation.mjs --browser`, `verify-local-employee-recovery.mjs --browser`: actual OTP captured locally, MFA, cancellation/reissue, replay, old-session denial | Captured local email is not real deliverability; real provider and uncertainty reconciliation not activated                                         |
| Student recovery                                          | `verify-local-student-recovery.mjs --browser`: independent approval, pack/password, old JWT/refresh denial and stable Member ID                                                      | Hosted worker remains disabled; two-admin operations/retention/abuse policy required before live use                                                |
| Submission, published feedback, closeout, private archive | `verify-local-enrollment-closeout.mjs`: actual upload/finalize/teacher publication/download, queued writes, another-course/identity invariance                                       | Some academic records are seeded by the harness; not proof of a complete CRM-to-distribution browser journey                                        |
| Checklist, classes and latest alerts                      | Same closeout harness: real mark/undo, schedule/cancel, current agenda/alerts, expiry/purge and desktop/mobile                                                                       | Teacher-only wider workspace and advance reminders remain deferred                                                                                  |
| Versioned lesson files / impact preview                   | `verify-local-lesson-files.mjs`: actual signature validation, private uploads/downloads, publication pinning, copy/purge locks, revocation, minimal read-only preview                | Preview grants exist only on disposable fixtures; no actual migration, archive lesson access or new Teacher scope                                   |
| Native in-app delivery                                    | `verify-local-native-worker.mjs`: actual scheduled tick/private fresh health, not manual invocation                                                                                  | Own job/log/health cleanup; production ownership/escalation/capacity and Storage cleanup scheduling not approved                                    |
| CRM/coordinator/handoff/privacy                           | Current pgTAP suites `00140`–`00170` plus existing Chromium preview journeys and hosted role checks                                                                                  | Actual composed Sales → operator → new-student activation journey remains a pilot acceptance gap; previews are not live-API proof                   |

All rerun disposable fixture scripts passed and removed exact test accounts/domain objects/mail/files/job logs. HMAC abuse counters intentionally expire under their existing policy, not by global deletion. The first account-switch run passed behavior but cleanup used the wrong FK order; two orphaned disposable Auth IDs were resolved and removed via supported Admin deletion, then the corrected script passed cleanup. Existing unrelated accounts were untouched.

## Current implementation defects addressed

- One account now owns one query-provider subtree; sign-out/account change retires private cache/forms. Same-account token refresh preserves drafts.
- Late startup lookup and completed sign-in/sign-out promises cannot override newer Auth events. Login validation uses isolated sessions and cannot log out a replacement shared account.
- Multi-step assignment material writes use a fixed starting JWT and reject account-change continuation. Pre-attachment compensation never borrows replacement-account authority. Uncertain metadata completion does not trigger destructive object deletion.
- Retired teacher workspaces cannot continue draft/save/publish/assistance requests. Microphones/tracks stop on unmount, including permission arriving late. Student multi-file loops stop before the next request after retirement.
- Foreground staff/student membership checks repeat every 30 seconds and fail closed on error/denial. This is UI freshness, not a substitute for live backend authorization.

## Remaining fictional-pilot acceptance work

1. Compose actual CRM intake/ownership → handoff identity review → enrolment/activation acceptance across disposable role sessions. Verify denied cross-role actions and exact cleanup, not only preview clicks.
2. Exercise deliberate content authoring/publication and assignment distribution into the same student/teacher journey without relying on harness-seeded academic rows.
3. Add a repeatable local pilot command/runbook covering preconditions, environment safety, fixture cleanup and the evidence map; avoid resetting a shared local database or running global purge against unrelated records.
4. Review the approved screens with the owner using fictional accounts and record defects separately from new product requests. Responsive automated checks are not a substitute for the designer's final UX review.

These acceptance tasks use existing approved rules. New policy choices still require a Decision Gate. No calendar completion estimate or percentage is claimed from test counts.

## Required before real launch — not included by D-039 B

See `PRODUCTION_READINESS.md` for authoritative unchecked gates: real authentication email, accountable security/support/offboarding, assisted recovery activation and uncertainty reconciliation, scheduled retention/Storage cleanup and failure monitoring, backup/restore, privacy notices/request handling/professional review, capacity/cost budgets and explicit deployment approval.

Newly confirmed operational gap: assignment-material uploads can remain unattached when the initiating identity cannot compensate, or require reconciliation after uncertain attachment confirmation. A privileged ledger/orphan scanner/deletion workflow is not silently added; define ownership, evidence, holds/retention and controlled cleanup before real data (DW-046).

Commerce/payments, assessments, provider-enabled transcription/AI, richer media, analytics, curriculum migration and lifelong-college/professional features remain outside this fictional milestone, as tracked in `DEFERRED_WORK.md`.
