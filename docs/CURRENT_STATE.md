# Current State

Last updated: 2026-10-14

## Current phase

F014 is accepted through PR #25 and protected rebuild run `38298241510`. F015 staff MFA/session security is accepted for fictional staging through PR #33 and protected deployment run `38422519675` under approved D-027/D-028 Option B. F016 is accepted for fictional/local scope through PRs #35–#37 under D-029 Option B, with real email delivery disabled. F017 independently approved student assisted recovery is accepted locally through PR #40 and protected staging release `38461876121` under D-030 Option B; hosted reset execution is disabled. Initial activation-link repair merged through PR #41. D-031/F018 teacher workspace scope awaits an owner decision. The free staging environment remains fictional-only. `PRODUCTION_READINESS.md` records required real-email, uncertain-mutation reconciliation, and other launch work; local acceptance never approves production or a paid provider.

## Completed

- Located and inspected the separate marketing website at `../../Dexam website/Website-Dexam`.
- Created the local `dexam-platform` repository structure and canonical agent guidance.
- Documented the product/engineering working agreement, decision policy, provisional architecture, testing strategy, roadmap, and setup path.
- Added `DEFERRED_WORK.md` as the canonical register for missing, postponed, and research-only functionality, with stable IDs, prerequisites, approval gates, and completion history.
- Initialized the local Git repository on `main` and created the foundation commit.
- D-001 foundation package approved by the product owner.
- D-002 application stack and deployment architecture approved with free-first spending constraints.
- Added a free-first cost model covering development, launch, and growth scenarios; no paid service is authorized.
- Added the React/Vite/strict-TypeScript application shell with routing and design-token foundations.
- Added Vitest/Testing Library unit tests and a passing Playwright Chromium smoke journey.
- Initialized versioned local Supabase configuration, fictional-only seed policy, and an initial RLS database safety test.
- Added GitHub Actions checks for formatting, lint, types, unit tests, build, and browser smoke testing.
- D-003 role and permission principles approved for Student, Teacher, Sales, and Admin.
- D-004 canonical identity, duplicate prevention, employee gatekeeping, and immediate revocation requirements approved.
- D-005 lifelong member architecture approved as a strategic direction; college/professional features remain research ideas, not V1 scope.
- Installed a user-managed Node.js 24/pnpm 11 toolchain, Homebrew, Colima, Docker CLI, and Docker Compose.
- Started the local Supabase stack and passed the initial database/RLS safety test.
- Drafted F001 Authentication, F002 Roles and Permissions, and D-006 Authentication and Recovery Model.
- Recorded F008 as a shared, event-driven notification and automation capability for pre-enrolment operations and students.
- D-006 Option B approved: students use Dexam Member ID/password, employees use verified email/password, and elevated administration requires TOTP MFA.
- Added the first identity migration with canonical people, authentication links, memberships, deny-by-default RLS, and current-state suspension checks.
- Drafted D-007 for Member ID issuance, one-time activation, and layered account recovery.
- D-007 Option B approved and its local persistence foundation implemented with immutable Member IDs, server-only hashed action tokens, expiry/invalidation constraints, and security audit events.
- Added the student activation page, trusted Edge Function, and atomic service-role-only activation finalization with compensation if Auth creation cannot be finalized.
- Drafted D-008 to separate Sales, routine Enrolment Operator, and Elevated Admin authority and define two-person approval boundaries.
- D-008 Option B approved: Sales requests enrolment, scoped Enrolment Operators perform routine identity/enrolment work, and Elevated Admins control recovery and high-impact actions.
- Added the F002 role/capability schema, current-state authorization helpers, MFA and two-person metadata, one-time Elevated Admin bootstrap, deny-by-default RLS, and database security tests.
- Added database security tests as a required GitHub Actions job.
- Merged the F002 capability foundation through PR #2 with all required checks passing.
- Drafted F004 Course and Enrolment Foundation and D-009 for the minimum offering/cohort/enrolment structure.
- D-009 Option B approved: reusable offerings with optional delivery cohorts and separate enrolment records.
- Added the F004 offering, optional cohort, enrolment, transition-history, RLS, and activation-eligibility database foundation.
- Added F004 database security tests; the complete database suite now passes 79 tests, including denial of duplicate initial activation after an account is claimed.
- Added the trusted Enrolment Operator activation-pack workflow with atomic enrolment activation, secure one-time credential generation, reason-required reissue, invalidation, and audit evidence.
- Expanded the complete database suite to 97 passing tests, including Sales denial, operator revocation, claimed-account denial, expiry limits, and reissue behavior.
- Merged the activation-pack workflow through PR #4 and synced local `main`.
- Started frontend development with the first Enrolment Operator queue, review, and one-time activation-pack result flow.
- Added a development-only fictional preview plus unit and browser coverage; the preview flag is absent from the normal production build.
- D-010 design system tooling approved: Figma Variables export as the token source of truth, an in-repo component library documented with Storybook, and GitHub Pages hosting.
- Added the Storybook scaffold and the Storybook GitHub Pages deployment workflow.
- D-011 approved, partially superseding D-010: the product owner produced a full design system via Claude Design, scoped it to both the portfolio site and Dexam, and it now lives in its own public repository, `dexam-portfolio-design-system`, rather than a future Figma export.
- Vendored that repository's tokens into `src/styles/design-system/` and rewired `tokens.css`/`global.css` and existing component styles to consume them directly (names now match the shared system, e.g. `--surface-card`, `--text-body`, `--accent-primary`).
- Ported the first approved generic primitives from the shared design system: Button, Badge, Card, Callout, Avatar, and Data Row.
- Added a Storybook story and an approved local usage specification for every ported primitive.
- Refactored the Enrolment Operator queue, final review, and activation-pack result to consume the shared primitives and verified the complete journey at desktop and mobile widths without horizontal overflow.
- Merged the first Enrolment Operator interface and shared design-system primitives through PR #5, then synced local `main`.
- Added the shared Input primitive with an approved usage specification and Storybook states.
- Added employee email/password sign-in, persisted browser sessions, current-device sign-out, and safe staff return routing through Supabase Auth.
- Added a protected staff boundary that rechecks active employee membership and `enrollment.operate` against current database state before rendering the Enrolment Operator workspace.
- Added generic credential failures, inactive-employee session cleanup, configuration and connectivity states, and responsive unit/browser coverage.
- Merged employee sign-in and staff access protection through PR #6 and synced local `main`.
- D-012 Option B approved: the first live queue uses a constrained operational display name alongside the immutable Member ID and bounded search across those two fields.
- Implemented the live Enrolment Operator queue with authorization-checked minimal data, oldest-approved-first ordering, search, loading/error/empty states, current-session activation issuance, 109 passing database tests, and the shared Empty State primitive.
- Merged the live Enrolment Operator queue through PR #7 and synced local `main` before starting the student slice.
- Added public student Member ID/password sign-in through a trusted Edge Function; the synthetic Supabase email mapping remains server-side.
- Added privacy-preserving application throttles for repeated Member ID and network sign-in attempts without storing raw Member IDs, IP addresses, or passwords in the throttle table.
- Added a current-state student access boundary that rechecks active person and student membership before protected content renders and fails closed if access cannot be verified.
- Added the first student self-service workspace showing the signed-in student's permanent Member ID and only their own enrolments through existing RLS policies.
- Added explicit fictional preview, responsive interface states, and unit, database, and browser coverage for student sign-in and workspace access; the complete database suite now passes 121 tests.
- Product owner visually approved the student Member ID sign-in and first self-service workspace on 2026-10-10.
- Merged the approved student Member ID sign-in and self-service workspace through PR #8 and synced local `main`.
- Drafted F005 Coursework and D-013 for the curriculum hierarchy and versioning boundary required before modules, lessons, assignments, or progress.
- Reviewed the owner-provided Class Scheduling/Topics and Student Assignment Tracker Google Sheets as read-only product sources.
- Refined D-013 around the real Drawing and Aptitude topic streams, keeping assignment groups separate and allowing assignments to link to multiple topics.
- Drafted F006 Assignment Definition and Submission from the real assignment groups and workflow states without importing legacy student-name columns.
- Drafted F007 Teacher Feedback and D-014 for private teacher voice notes, assignment-specific versioned rubrics, manually triggered bulk AI drafts, and mandatory human approval before student release.
- D-013 Option B approved: versioned curricula contain ordered subject areas, topics, and optional lessons, while assignment groups remain separate.
- D-014 Option B approved: AI may prepare assignment-specific drafts after a bounded manual trigger, but a current authorized teacher must approve every student-visible result.
- Added the D-013 curriculum foundation with immutable published versions, ordered sections/topics/optional lessons, cohort or cohort-free enrolment pinning, and same-offering constraints.
- Added current-state student curriculum RLS; draft, retired, unassigned, cross-offering, suspended, employee, and ended-enrolment reads fail closed.
- Added the protected student coursework browser with Drawing/Aptitude preview content, topic selection, safe plain-text lesson rendering, and workspace navigation.
- Verified the complete local foundation with 149 database tests, 52 unit/component tests, 13 Chromium browser journeys, a production build, and desktop/mobile visual inspection without horizontal overflow or console errors.
- Product owner approved the first student coursework interface on 2026-10-10 and confirmed that authorized curriculum/material and assignment editing should be built next.
- Opened PR #9 for the approved F005 versioned student coursework foundation.
- Drafted F009 Academic Content Authoring plus D-015 for scoped draft/publish authority and D-016 for conservative private assignment-material uploads.
- D-015 Option B approved: offering-scoped draft management and separate deliberate publication capabilities.
- D-016 Option B approved: private PDF/JPEG/PNG/WebP assignment materials, limited to five files and 10 MB per file, with no paid service authorized.
- Added the F009 content-authoring database foundation with offering-scoped draft/publish checks, immutable version lineage, audited publication, assignment-topic links, and private storage policies.
- Added the protected staff Content workspace for topic and lesson editing, assignment creation/editing, assignment-specific evaluation guides, conservative private uploads, version copying, and deliberate release notes.
- Verified F009 locally with 196 passing database tests, 57 unit/component tests, 15 Chromium browser journeys, a production build, and desktop/mobile visual inspection without horizontal overflow or console errors.
- Product owner approved proceeding with the F009 Content workspace on 2026-10-10; committed and opened stacked PR #10 with all GitHub checks passing.
- Merged the F005 coursework foundation through PR #9 and the dependent F009 Content workspace through PR #10, then synced local `main`.
- Started F006 on `feature/f006-assignment-submission` and drafted D-017 for assignment distribution/lifecycle plus D-018 for student submission files/retention.
- D-017 and D-018 Option B approved: deliberate scoped distribution, soft deadlines, teacher-authorized revisions, private bounded student files, browser-side compression, and 12-month post-enrolment retention.
- Added the F006 database foundation with scoped assignment distribution, cohort/selected-enrolment snapshotting, retry-safe release, separate private student instances, optional soft deadlines, immutable attempts, correction-authorized revisions, and auditable transitions.
- Added private student-submission storage with a trusted upload function that validates file signatures, 10-file/10-MB/50-MB limits, direct-storage denial, short-lived authorized reads, draft-only removal, and finalized-file immutability.
- Added browser-side image orientation correction, metadata removal, maximum 3,200-pixel dimensions, conservative compression, before/after size preview, and a higher-quality safeguard; PDFs remain unchanged.
- Added service-only retention cleanup for 30-day abandoned draft files and finalized files 12 months after enrolment end, without introducing a paid service.
- Added the protected staff Assignment Distribution workspace and student Assignments workspace with fictional local previews at `/staff/assignments?preview=1` and `/student/assignments?preview=1`.
- Verified F006 locally with 253 passing database tests, 66 unit/component tests, 20 Chromium browser journeys, a production build, Edge Function compilation, and desktop/mobile visual inspection without horizontal overflow or console errors.
- Product owner visually approved the F006 staff distribution and student assignment/submission interfaces on 2026-10-10.
- Opened PR #11 for the approved F006 assignment distribution and student submission implementation.
- Merged F006 assignment distribution and student submission through PR #11 and synced local `main`.
- Started F007 Teacher Feedback and drafted D-019 for bounded private voice feedback/rubric authority plus D-020 for a free-first, provider-neutral AI workflow with production inference disabled until a later provider activation.
- Refined F007 from product-owner input to require both normal playable voice notes and speech-to-text dictation, plus optional teacher-triggered AI proofreading with original/suggestion comparison and explicit acceptance.
- D-019 and D-020 Option B approved: bounded private voice notes, editable speech-to-text dictation, teacher-controlled AI proofreading, provider-neutral rubric assistance, ₹0 external-processing spend, and a later provider-activation gate.
- Added F007's current-scope teacher review queue, retry-safe private feedback drafts, immutable publication, and deliberate `review_completed` or `correction_requested` assignment transitions.
- Added the private `teacher-feedback-audio` storage boundary, trusted signature-checked recording upload/removal, 5-minute/10-MB limits, short-lived authorized reads, accessible written-equivalent gate, 24-hour temporary dictation cleanup, and 12-month post-enrolment retention.
- Added provider-neutral transcription, proofreading, and bounded rubric-batch request records with explicit human disposition and audit metadata; all external providers remain disabled at ₹0 spend.
- Added the protected teacher Feedback Review interface at `/staff/reviews`, including editable dictation, original/suggestion proofreading comparison, explicit accept/reject, optional playable voice notes, and deliberate outcome publication.
- Refined teacher review with compact visible submission thumbnails, an accessible same-page expanded viewer, clearly activated microphone/listening states, and separate dictation plus AI-proofreading controls for correction requests.
- Added published feedback to the owning student's assignment history with clear AI-assisted-and-teacher-reviewed disclosure and optional private voice playback.
- Verified F007 locally with 315 database/security assertions, 71 unit/component tests, 23 Chromium browser journeys, both new Edge Functions in the local runtime, production builds, desktop/mobile visual inspection, and zero preview console errors.
- Product owner visually approved the F007 teacher feedback experience on 2026-10-10.
- Opened PR #12 for the approved F007 teacher feedback implementation.
- Merged F007 through PR #12 and synchronized local `main` at merge commit `c9bccd5`.
- Started F008 Notifications discovery and drafted D-021 for a free, event-backed, in-app-only first milestone covering essential assignment, submission-review, and feedback alerts.
- D-021 Option B approved: build the free event/outbox and in-app notification foundation now while preserving external channels as later approved adapters.
- Added the F008 transactional assignment-event outbox, versioned safe-summary templates, retry-safe recipient materialization, service-only worker/retention cleanup, and 12-month in-app retention.
- Added current-state student/teacher notification authorization so suspended people, revoked employees, ended enrolments, or removed teaching scope cannot read an inbox record or regain access through its link.
- Added responsive student and teacher notification centres with exact navigation unread counts, all/unread filters, mark-one/mark-all read actions, protected deep links, and preview flows.
- Verified F008 locally with 361 database/security assertions, 79 unit/component tests, 26 Chromium browser journeys, production builds, Edge Function compilation/unauthorized-call rejection, and desktop/mobile visual inspection without horizontal overflow.
- Committed the approved F008 decision and implementation as `c99fd7a` and `ffa4b07`, then pushed `feature/f008-notification-foundation` to GitHub for pull-request review.
- Merged F008 through PR #13 at `a58bf0a` and synchronized local `main`.
- Started F010 CRM Leads and Follow-ups discovery so internal marketing/admissions notifications can rely on real lead ownership and follow-up records.
- Drafted D-022 with a recommended identity-aware, free-first CRM foundation that preserves the separation between Sales work and student enrolment/access authority.
- D-022 Option B approved: build the identity-aware, manually operated CRM foundation and free in-app Sales alerts without external messaging, website intake, paid services, or production personal data.
- Added the F010 CRM foundation with explicit prospect/guardian identities, normalized contact points, possible-match candidates, assigned-owner access, separate assignment authority, immutable ownership/lifecycle history, replaceable follow-ups, and controlled enrolment-review requests.
- Added a protected Sales CRM workspace at `/staff/crm` for fictional/manual enquiry creation, assigned-queue search, bounded activity logging, follow-up scheduling, deliberate stage changes, and a handoff that cannot create student access.
- Added reversible dead-enquiry management: reason-required removal from Active, a seven-day Recently dead holding area, automatic time-derived Dead archive placement, follow-up/alert invalidation, and reason-required restoration of the same audited enquiry.
- Extended F008 with safe `lead_assigned` and `lead_follow_up_due` domain events, Sales-only in-app notifications, protected CRM deep links, current-assignment authorization, and stale-alert cancellation without external messages or paid providers.
- Verified F010 locally with 430 database/security assertions, 88 unit/component tests, 31 Chromium browser journeys, a production build, desktop/mobile visual inspection without horizontal overflow, and zero preview console errors.
- Product owner approved the F010 CRM workspace, including the reversible dead-enquiry workflow, on 2026-10-11.
- Opened F010 PR #14 with the verified scope, decision, risk, and security notes. Future approved feature branches should have their pull requests created automatically after push under the repository agent guide.
- Merged F010 through PR #14 at `384af75`.
- Audited the remaining roadmap: the internal-pilot path is approximately 55–65% complete, safe public-launch work is approximately 40–50% complete, and later commerce/assessment/media/AI phases remain outside the current milestone.
- Drafted F011 and D-023 for the next launch-critical CRM gap: an explicit CRM Coordinator grant, unassigned and inactive-owner recovery queues, reason-required single assignment, and no bulk or automated routing.
- D-023 Option B approved: selected active Sales employees may receive a separate revocable `lead.assign` grant for single-record assignment and inactive-owner recovery without bulk or automated routing.
- Added the F011 trusted database operations for capability-gated unassigned and inactive-owner queues, current active Sales owner discovery, concurrency-safe reason-required assignment, immutable ownership history, and follow-up replacement.
- Added the protected CRM Assignment workspace at `/staff/crm/assignments` with fictional unassigned and inactive-owner recovery previews, minimum allocation details, single-record assignment, safe errors, and responsive desktop/mobile behavior.
- Verified F011 locally with 463 database/security assertions, 95 unit/component tests, 34 Chromium browser journeys, full format/lint/type/build checks, desktop/mobile inspection without horizontal overflow, and zero preview console errors.
- Product owner visually approved the F011 CRM Assignment workspace on 2026-10-11.
- Merged F011 CRM Assignment Operations through PR #15 at `ff98b5f` and synchronized local `main`.
- Started F012 discovery for the explicit CRM-to-Enrolment Operator handoff, canonical identity resolution, offering/cohort selection, and routine enrolment approval.
- Drafted D-024 with a recommended guided, single-request Enrolment Operator workflow that reuses the existing activation queue and never auto-merges weak contact matches.
- D-024 Option B approved: Enrolment Operators deliberately resolve new versus existing students, weak matches, offering/cohort placement, and return or approval while Sales remains unable to create access.
- Implemented F012's capability-gated handoff inbox, explicit identity-candidate disposition, bounded existing-student search, active offering/cohort selection, reason-required return/resubmission, cryptographic Member ID issuance, and atomic enrolment/CRM conversion.
- New and unclaimed students reuse the existing activation queue; claimed existing students receive active enrolment without duplicate credentials, people, memberships, or Member IDs.
- Added Sales-visible returned-review reasons while keeping candidate student records private to current Enrolment Operators.
- Verified F012 with a clean database reset, 518 passing pgTAP checks, 103 passing unit/component tests, 37 passing Chromium journeys, a production build, and desktop/mobile visual inspection without console errors or horizontal overflow.
- Product owner approved the F012 fictional Enrolment Operator preview on 2026-10-11.
- Merged F012 Enrolment Handoff and Identity Resolution through PR #16 at `998d58e` and synchronized local `main`.
- Drafted F013 and D-025 for the next production-data blocker: purpose-based CRM retention, restricted archives, correction evidence without readable old values, separate privacy authority, two-person erasure, time-limited holds, and backup-restoration tombstones.
- Reviewed the official DPDP Act, notified 2025 Rules, and commencement notification as the current legal baseline; final policy, notices, and production launch still require professional review for Dexam's actual processing context.
- D-025 Option B approved under the product owner's delegated unattended-run authority: tiered CRM retention, separate privacy authority, minimized correction evidence, two-person erasure, time-limited holds, idempotent execution, and backup-restoration tombstones.
- Added F013's MFA-gated privacy capabilities, lifecycle due dates, verified cases, keyed non-content correction evidence, server-side erasure dry runs, distinct proposer/approver checks, bounded holds, and service-only idempotent execution.
- CRM minimization now removes direct contact and free-text content, expires CRM alerts, preserves protected canonical student and academic domains, and records a non-content tombstone for safe backup restoration.
- Added the protected CRM Privacy workspace at `/staff/crm/privacy` with masked fictional cases, request intake, field-scoped correction, independent erasure approval, and temporary hold/release flows.
- Verified F013 after a clean reset with 579 database assertions, 114 unit/component tests, 41 Chromium browser journeys, a production build, desktop visual inspection, and mobile overflow coverage.
- Merged F013 CRM Data Lifecycle and Privacy Operations through PR #17 at `f932c67` after all three GitHub checks passed, then synchronized local `main`.
- Started F014 hosted-staging discovery and drafted D-026 with a recommended owner-controlled, reconstructable ₹0 staging environment using one Supabase Free project and Cloudflare Pages.
- Reverified current vendor constraints: Supabase Free has two active projects, 500 MB database size, 1 GB file storage, 5 GB egress, no automatic backups or database branching, and low-activity pausing; Cloudflare Pages Free permits 500 monthly builds and static Vite hosting.
- D-026 Option B approved: build an owner-controlled, reconstructable, fictional-only staging environment on Supabase Free and Cloudflare Pages without paid services or production authority.
- Added the F014 repository foundation: strict staging environment validation, public preview denial, SPA routing and safe headers, non-production marking, a non-sensitive backend health operation, complete Edge Function declarations, serialized post-verification database/function deployment, and a staging runbook.
- Merged F014's hosted-staging foundation through PR #19 at `cc7b144`, configured all four GitHub `staging` secrets, applied the reviewed migrations to the clean owner-controlled `Dexam Staging` project, configured the server-only action-token pepper, deployed all eight declared Edge Functions, and recorded remote migration state.
- Connected the narrowly scoped Cloudflare GitHub App to `jehar-tau/Dexam.App`, created the free `dexam-staging` Pages project, and deployed the same `main` commit to `https://dexam-staging.pages.dev` with Node 24, pnpm 11.19.0, `pnpm build:staging`, and non-privileged staging browser configuration. Automatic preview-branch deployments are disabled; the strict build guard rejected the one preview attempt made before that provider setting was corrected.
- Verified hosted `/health`, nested SPA routes, the non-production banner, safe indexing/frame/MIME headers, staff and student preview-bypass denial, and safe unauthenticated rejection for all eight Edge Functions.
- Set the exact Supabase Auth site URL, disabled public signup/manual linking/anonymous sign-in, retained email confirmation, and confirmed no wildcard redirect URLs. Provider advisors show zero errors but unresolved warning/suggestion sets that remain explicit F014 review work.
- Merged the deterministic fictional bootstrap through PR #21 at `9045098`, then confirmed the protected deployment created or rotated all nine accounts and passed hosted Student, Teacher, Sales, CRM Coordinator, Enrolment Operator, Privacy Operator, Elevated Admin, revoked-employee, and inactive-employee authorization checks.
- Merged the database advisor hardening through PR #22 at `50f89c7`. Protected deployment run `38293373701` applied the migration, reduced anonymous privileged-function findings from three to zero, passed the advisor gate with only documented accepted/deferred categories, and repeated all nine hosted authorization checks successfully.
- Merged the guarded rebuild workflow and deployment hardening through PRs #23–#25. The Supabase server-side bundler's repeated `500` responses were isolated from application code; the normal CLI bundling path deployed the same source successfully and is now used serially with bounded retries.
- Accepted F014 after protected rebuild run `38298241510` reset the exact fictional staging project, reapplied all 21 migrations, passed the 235-finding documented advisor gate, deployed all eight functions, recreated nine fictional accounts and one enrolment, passed all hosted role/current-state checks, matched remote migration state, and recorded 79 seconds. The public health route remained HTTP 200 with safe headers afterward.

## Implementation active

- F015 completed its approved fictional-stage scope: enrolment/challenge, backup factor, guarded removal, live MFA enforcement, durable previous-session denial, recent verification, independent recovery, supported provider deletion, and minimized audit. PRs #31–#33 merged after checks/review inspection. Local verification passed 156 application tests, 656 database assertions, 43 Chromium journeys, actual TOTP/Edge acceptance, and desktop/mobile visual checks. Protected run `38422519675` repeated nine existing role checks and real hosted recovery acceptance; disposable fixtures were removed. See `STAFF_SECURITY.md` for use/failure/escalation guidance.
- F016 / D-029 local scope accepted through PRs #35–#37. Invitations enforce recent-admin authority, canonical duplicate review, private masked queue/cancellation, exact-request email proof, and atomic activation without role grants. Recovery preserves established email/MFA and current membership, uses isolated transient browser sessions, blocks old/refresh sessions, requires live provider sessions for all employees, and keeps uncertain mutations exclusively fenced. Verification: 211 application tests, 753 database assertions, 51 browser journeys, actual provider/Chromium invitation/recovery and direct-provider regression, desktop/mobile visual QA, and disposable cleanup. Independent security findings were resolved before merge. Production email and DW-045 reconciliation remain required.
- F017 / D-030 Option B accepted for fictional/local execution through PR #40 (merge `5d6a759`) and protected staging release `38461876121`. Approval foundation merged through PR #39. Recent independent administrators authorize an exact claimed Member ID, private one-time pack/password selection, eight proof attempts, service-only mutation, live student-session checks, pre/post cutoffs and uncertain-execution fence. Verification: 223 application tests, 824 database assertions, 56 browser journeys, actual SDK/Chromium independent approval/issuance/private hide/student consumption/session-denial/direct-provider regression with disposable cleanup. Desktop/mobile visual QA and independent security review passed; credentials never enter artifacts. Hosted reset workers independently return 503 disabled; real data/production/paid services remain prohibited.

## Not yet started

The complete, maintained register is `DEFERRED_WORK.md`. Immediate known gaps are summarized here only for handoff convenience.

- Remaining enrolment transitions beyond activation-pack issuance
- Student account recovery workflow
- Two-person approval workflow and elevated administration interface
- Porting the remaining shared primitives as a feature needs them (navigation, overlays, and tables)
- Later F008 external-channel, consent, preference, quiet-hour, and digest decisions
- F007 production transcription/AI provider activation remains a separate future decision; the provider-neutral workflow fails closed until then

## Environment findings

- Git and GitHub SSH authentication are available for GitHub user `jehar-tau`.
- The repository is connected to `git@github.com:jehar-tau/Dexam.App.git`; `main` tracks `origin/main`.
- GitHub CLI is installed and authenticated as GitHub user `jehar-tau`.
- Homebrew 7.0.6 is installed under `/opt/homebrew`.
- User-managed Node.js 24.21.0 and pnpm 11.19.0 are available in login shells.
- Colima 0.10.3 provides the local Docker runtime; Docker CLI 29.8.1 and Docker Compose 5.5.1 are installed.
- Supabase CLI 2.118.0 is a pinned project dependency; the local Supabase stack is operational.

## Next safe action

Initial activation-link repair merged through PR #41 at `468071e` after clean checks and independent security review (226 application tests, 824 database assertions, 58 browser journeys, actual provider/Chromium fragment and legacy-query activation/replay/cleanup, desktop/mobile visual QA). Verify its protected fictional staging release. D-031 now requires the owner to select A (review queue only), B (recommended read-only assigned-offering curriculum/assignment reader), or C (broader roster/schedule/attendance discovery). All options are documented with costs/impact in ADR-031; do not implement F018 until answered. Hosted employee email and student reset execution remain disabled; uncertain mutation expiry never unlocks execution. The approved Storybook catalog is live at `https://jehar-tau.github.io/Dexam.App/`.

## Blockers

- D-029 is approved for fictional/local F016 implementation. Student recovery, real email delivery, broader elevated actions, and production security/incident ownership remain separate gates; F015 MFA and all-device invalidation are accepted for fictional staging.
