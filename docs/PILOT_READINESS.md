# Fictional pilot readiness

Status: Automated acceptance active under owner-approved D-039 Option B; updated 2026-10-15. Not production ready. Account hardening merged PR #58 (`86b2fba`); protected fictional release `38686939843` passed.

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

## Composed workflow evidence

`verify-local-admissions-journey.mjs` now passes a composed actual API/Edge/Chromium flow: scoped operator creates curriculum/sections/topics/lessons through RLS, deliberately publishes curriculum and an assignment, Sales creates and advances a retry-safe enquiry, an operator reviews identity and approves the same prospect, issues a one-time pack, and the student activates and signs in. A deliberate retry-safe assignment release reaches that student, who uploads/finalizes work; a separate scoped teacher publishes feedback visible in the student's browser. Cross-role publication/distribution/approval/activation/review denials and canonical identity invariance are checked. Test-only setup still creates staff identities, explicit scopes and offering/cohort; this is not a new course/staff provisioning UI. No real contact delivery or preview bypass.

Exact own-request/UUID cleanup removes private submission objects, domain/history/audit and supported Auth accounts, with original USER-trigger flags restored and FK/RLS preserved. Unknown references abort cleanup. Fictional staff emails are tracked before account creation so lost responses can be reconciled without broad account matching; startup failures and browser-close failures cannot leak config or skip remaining cleanup.

## Remaining fictional-pilot acceptance work

The consolidated `pnpm pilot:verify` passed on 2026-10-15: 285 app tests, 1040 DB assertions, 63 Chromium smoke journeys and all nine actual local acceptance scripts, including exact cleanup and the real scheduled tick. Independent review cleared harness/runner safety; desktop/mobile composed-workflow screenshots were inspected. `pilot:check` validates local services/DB/ports/Edge first, without resetting data or replaying provider logs.

Remaining: implement owner-approved D-040 B existing-authority-aware navigation, then review approved screens with the owner using fictional accounts. Automated responsive checks do not replace the designer's final UX review. Some authoring/distribution steps are SDK/API checks, not proof of every staff form click.

These acceptance tasks use existing approved rules. New policy choices still require a Decision Gate. No calendar completion estimate or percentage is claimed from test counts.

Visual QA identified shared staff-heavy navigation on the student screens; direct access is still denied by existing gates. D-040 presents the owner-visible options before changing navigation. The stale coursework message promising future assignments was corrected to link to the already-working assignments workspace, preserving explicit fictional preview routing.

## Required before real launch — not included by D-039 B

See `PRODUCTION_READINESS.md` for authoritative unchecked gates: real authentication email, accountable security/support/offboarding, assisted recovery activation and uncertainty reconciliation, scheduled retention/Storage cleanup and failure monitoring, backup/restore, privacy notices/request handling/professional review, capacity/cost budgets and explicit deployment approval.

Newly confirmed operational gap: assignment-material uploads can remain unattached when the initiating identity cannot compensate, or require reconciliation after uncertain attachment confirmation. A privileged ledger/orphan scanner/deletion workflow is not silently added; define ownership, evidence, holds/retention and controlled cleanup before real data (DW-046).

Commerce/payments, assessments, provider-enabled transcription/AI, richer media, analytics, curriculum migration and lifelong-college/professional features remain outside this fictional milestone, as tracked in `DEFERRED_WORK.md`.
