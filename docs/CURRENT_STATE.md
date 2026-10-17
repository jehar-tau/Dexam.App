# Current State

Last updated: 2026-10-17

## Current phase

F033 merged PR #81 (`c7a56dc`) with all required CI and independent security review passed. Role-separated portals and updated role handbooks are accepted in the fictional/local scope; no production activation. Added dated printable PDF/Word exports and a permanent online handbook entry through the existing public GitHub repository. Markdown remains authoritative; exports require regeneration and all-page render inspection when guides change. No new hosting provider, domain, account, runtime permission or spending.

D-048 B approved 2026-10-17; F033 locally implements separate student/teacher/staff/admin entrances and layouts on the existing backend. Teacher `/teacher/sign-in`, staff `/staff/sign-in`, admin `/admin/sign-in`, student `/sign-in`; employee defaults now role-appropriate homes, not universal Enrolments. Same-account switches, live existing-scope/admin-role presentation checks, safe returns, retained legacy URLs, unchanged MFA/operation authority and preview denial for admin aliases are implemented. Full local evidence: 439 app tests, 1,140 DB assertions, 75 Chromium journeys, actual admin/MFA alias and student account-isolation/revocation acceptance with exact cleanup, build budget and Storybook; independent review clear. Required CI/PR acceptance follows. Handbook and approved PortalFrame spec/stories updated. No new grants, schema, provider or production activation. The older shared-shell audit below is historical, superseded by F033.

Usage/portal audit (2026-10-17): verified student login/routes and permission-aware navigation, but all routes share AppShell and teachers/staff/admins share `/staff/sign-in`; separate teacher/admin entrances and four distinct visual shells are not built. D-048 records the proposed separation options without new access grants. Added `docs/usage/README.md` and separate student/teacher/staff/admin/access guides covering implemented flows, limits, recovery/security, troubleshooting and disabled/deferred services. Independent review corrected employee-reissue instructions and identified teacher draft audio playback/removal (DW-048) and missing in-review brief/rubric context (DW-010/D-031 A); the guides disclose these gaps rather than promising those controls. These are current-implementation instructions, not production approval or a claim the requested portal split is finished. Build packaging/output-isolation PR #79 merged as `9eed4a5` after independent review and all required CI passed.

Build/readiness follow-up (2026-10-17): split stable browser dependencies without route/permission changes, enable strict module execution ordering, and enforce a tested 500,000-byte per-JavaScript-chunk engineering budget on normal/staging builds. Largest chunk is 312.90 KB versus the prior 941.83 KB monolith; total cold-load JavaScript is slightly larger, so no latency/total-byte reduction is claimed. Full verification passed 385 tests plus formatting/lint/types/build; all 67 Chromium journeys passed and independent review is clear. A first browser run collided with a normal build replacing shared `dist`; preview test output now uses ignored `dist-e2e`, with the normal build leaving its asset hashes unchanged. No preview/authorization guard was weakened. Required PR CI follows. `RELEASE_STATUS.md` now separates implemented core, remaining launch dependencies and deferred modules. No new owner questions are needed for this engineering slice; provider, human, budget, real-data and production gates remain explicit.

Owner planning input (2026-10-17): staffed 24/7 support/incident coverage is available. Product owner remains primary and Rohin backup. This supersedes earlier unknown-hours notes, but does not verify staffing or establish a response-time promise. Private contact channel, shift/handover, acknowledgement/escalation timing, fallback and fictional incident rehearsal remain launch prerequisites; no provider, account/access or production activation is implied. F030 cleanup-test follow-up merged PR #77 (`ee64e1d`) with all required CI passing.

Owner planning input (2026-10-17): Siddhant Modi nominated as third trusted admin, alongside the product owner and Rohin. This resolves the missing nominee only—not eligibility, provisioning, MFA, access grants, availability or recovery rehearsal. No account/access changes authorized. Support remains product owner primary and Rohin backup. See `LAUNCH_PLAN.md` for remaining human operating prerequisites.

Maintenance-test follow-up (2026-10-17): ten additional F030 helper regressions cover protected/changed/unknown-scope work, failed Storage deletion and uncertain completion, without changing executable cleanup behaviour or installing schedules. Focused suite: 13 tests passed; full verification passed 372 app tests, formatting, lint, types and build (existing bundle warning). Required CI evidence follows in its PR. PR #76 (`c6a7c8e`) previously merged all 67 browser journeys and clean required CI for admissions alternate paths. Email remains deferred; production gates are unchanged. A third trusted administrator nominee was requested for planning only because two total admins cannot recover either admin under the existing two-non-target-actor rule; no new account/grant or recovery bypass is authorized.

Admissions browser-coverage follow-up (2026-10-17): added three F012 fictional preview regressions for existing claimed-student linking, mobile reason-required return, and unresolved identity refusal. No runtime, schema, permissions or product changes. Initial test incorrectly expected an alert role; the existing visible validation message was present, and the assertion was corrected to check that exact message. Focused rerun and all 67 browser journeys passed, alongside formatting, lint and types; CI acceptance follows in the PR. Email setup stays deferred.

2026-10-17 post-email-deferral update: F032 merged through PR #74 (`39eda59`) after required CI and independent security review. D-047 B was approved, then the owner deferred external setup because account sign-in/reset was blocked and authorized continued fictional workflow testing. No DNS changes, verified sender, API keys or live delivery were completed. Resume only after owner login/terms acceptance; preserve root/Zoho DNS. The earlier pending-approval notes below are historical, superseded by this update.

Local regression passed: 362 app tests, all 1,140 DB assertions and 64 Chromium journeys, plus formatting/lint/types/build. Actual F030 Storage retry/reference/hold/legacy/late-byte/publication-race acceptance and F031 SDK/MFA/independent-review/browser/revocation acceptance passed with exact fixture cleanup. No defect was found in these checks. The existing preview on port 5173 was preserved; the consolidated pilot requiring that free port was not rerun. Recovery rehearsal evidence is recorded in `PILOT_READINESS.md`. Real-launch gates remain unchanged.

F029/D-043 B merged through PR #67 (`0602cb4`): isolated DB/four-bucket recovery, newer erasure/revocation/expiry evidence and interrupted restore/FK rejection passed; 298 app tests and independent review passed. Existing developer services were preserved. Full Auth/off-site/production recovery remains gated.

Active-enquiry erasure fix merged PR #68 (`92f6aff`); all 1,085 DB assertions, required CI and independent security review passed. Protected fictional staging release `38851209617` succeeded. PR #69 (`2430333`) adds active-enquiry replay and real student brief downloads; its expanded isolated rehearsal passed in 63 seconds with cleanup verified.

D-044 Option B approved 2026-10-16; F030 merged through PR #70 (`c3e3bd8`) on 2026-10-17 after all required checks and independent security review passed. Tracked assignment uploads, same-request reserve/attach retries, direct Storage mutation fencing, scoped status reporting and local-only 30-day unreferenced cleanup are implemented. Referenced files, holds and unknown legacy files are protected. Evidence: 304 application tests, 1,111 DB assertions, 63 browser regressions, real Storage/retry/late-byte/publication races and exact fixture cleanup; the isolated restore passed again in 62 seconds with this migration. The first CI database attempt failed before tests on an occupied runner port; rerun passed. Protected fictional staging release `38951224841` succeeded. No hosted cleanup worker, production activation or real-data processing is approved.

Planning PR #71 merged as `7d1acc2`. D-045 B approved 2026-10-17; F031 merged through PR #72 (`892cbd8`) after required CI and independent security review passed. It implements independent recovery investigation, a private exact-request ledger and `/staff/security/incidents`, preserving uncertain execution and session fences. Evidence: 312 app tests, 1,140 DB assertions, 64 browser journeys and actual SDK/MFA/browser/revocation/concurrent-retry acceptance with exact fixture cleanup. Protected fictional staging release `38953497213` succeeded, followed by release `38954032279` for planning PR #73 (`1eee333`).

D-046 B approved 2026-10-17; F032 implements provider-neutral message preparation and a closed scripted Resend mock adapter. It has no network/SDK/environment lookup or deployed-handler integration, accepts no real addresses/provider keys, and keeps existing local email guards unchanged. Fifty new adapter tests and all 25 local-capture cases passed; full verification passed 362 app tests, lint, types, formatting and build. Independent security review and required CI passed; PR #74 merged. Protected fictional staging release `38956074754` also passed. This mock does not enable live sending, real data or production.

The owner confirmed `designexam.com` for email planning. Read-only DNS shows DomainControl nameservers, existing Zoho root MX and an SPF record; `AUTH_EMAIL_SETUP_PLAN.md` proposes `auth.designexam.com` and `accounts@auth.designexam.com` without changing records or creating a sender. Actual provider account/domain verification, private recipients/terms, production callbacks, live integration and real-email validation remain unapproved. `MAINTENANCE_OPERATIONS_PLAN.md` inventories workers without activating schedules. DW-045 resolution, hosted cleanup/retention, operational contact/coverage, backups and explicit launch authorization remain open.

D-047 B permits scoped account/subdomain verification after owner login/terms acceptance, but that work is now deferred. It preserves root/Zoho DNS and authorizes no sending or runtime activation.

Latest update (2026-10-15): F028/D-042 A launch-readiness plan merged through PR #63 (`a0ab457`), with capacity/admin inputs recorded through PR #64. Owner confirmed up to 50 students in the first three months and Rohin as second Admin for planning. The product owner handles student support and urgent incidents, with Rohin as backup. Coverage hours/escalation arrangements remain unconfirmed; two total admins do not cover recovery requiring two non-target admins. No account, role grant, provider, paid plan, real data or production activation is approved by these inputs. F027 merged PR #62 (`604c949`); all current layouts remain provisionally approved. Use `LAUNCH_PLAN.md`; all `PRODUCTION_READINESS.md` gates remain unchecked.

F026/D-040 B authorized navigation is accepted through PR #60 (`110f907`): 295 app tests, 1075 DB assertions, 63 Chromium smoke journeys, all nine actual pilot scripts and independent security review passed. Main Verify `38690978002`, Storybook `38690977933` and protected fictional backend release `38691212531` passed. Hosted role/navigation, advisor, MFA recovery and native scheduled-tick checks passed; the frontend serves the authorized-navigation bundle. D-041 Option A is approved: F027 guided designer review is active, starting with student assignments and feedback. No production, real data, spending or new modules approved. F025 composed acceptance merged PR #59; release `38688346251` passed. F024 remains read-only; actual curriculum migration stays deferred. See `PILOT_READINESS.md` and `LOCAL_PILOT_RUNBOOK.md`.

F014 is accepted through PR #25 and protected rebuild run `38298241510`. F015 staff MFA/session security is accepted for fictional staging through PR #33 and protected deployment run `38422519675` under approved D-027/D-028 Option B. F016 is accepted for fictional/local scope through PRs #35–#37 under D-029 Option B, with real email delivery disabled. F017 independently approved student assisted recovery is accepted locally through PR #40 and protected staging release `38461876121` under D-030 Option B; hosted reset execution is disabled. Initial activation-link repair merged through PR #41 and protected release `38463409962` succeeded. D-031 Option A was selected 2026-10-14: retain the existing teacher review queue and defer F018's broader teaching reader. The free staging environment remains fictional-only. `PRODUCTION_READINESS.md` records required real-email, uncertain-mutation reconciliation, and other launch work; local acceptance never approves production or a paid provider.

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
- Optional verified-contact student self-service recovery and production assisted-recovery activation/reconciliation (F017 local assisted recovery is complete)
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

Continue F028 discovery with the confirmed up-to-50 planning ceiling, product owner as support/incident lead and Rohin as backup/second-admin nominee; resolve coverage, escalation and admin recovery arrangements before launch. Detailed restore and exceptional-outcome specifications may be prepared within planning authority; implementation/activation policies retain their approval gates. Codex owns engineering and setup; do not delegate terminal work to the designer. All current UI layouts are provisionally approved, including unwalked screens; no further per-screen layout gate. DW-045/DW-046, Storage/DB restore, operational scheduling, real authentication delivery, privacy/security review, budgets and explicit production approval remain blocking. The plan does not authorise new grants, paid services or actual onboarding.

F021/D-034 B merged PR #49; protected release `38522570468` passed. F022 merged PR #50 (`838251e`) after clean checks and independent review. Protected fictional release `38525635333` passed advisor, real scheduled tick, hosted authorization and MFA recovery checks. Local evidence: 241 app tests, 955 DB assertions, 63 browser journeys and real native Cron acceptance with own fixture/job/log cleanup. D-036 Option A defers advance reminders; no reminder runtime, real data, production or paid services approved.

## Blockers

- D-036 Option A selected: advance reminders deferred; retain existing approved alerts. No reminder jobs or preferences may be added without a new decision. Production ownership/escalation and Storage cleanup remain gated.

- F019/D-032 B is implemented and released. D-031 A continues to defer the broader teacher workspace.
- F023/D-037 B accepted through PR #54 (`ef3d12e`) and protected fictional release `38594311834`. Local verification: 255 app tests, 1007 DB assertions, 63 browser journeys and actual SDK/Edge/Chromium file/concurrency/physical-purge acceptance with exact fixture cleanup. Independent review and CI passed; hosted release repeated migration/advisor/function/authorization/MFA/native-tick checks. D-031 A and D-036 A unchanged. D-038 B's read-only preview is now F024; actual curriculum migration remains deferred. F022 regressions merged PR #53.
- F016/F017 local recovery is accepted. Real email delivery, hosted student-recovery activation, uncertainty reconciliation, broader elevated actions and production security/incident ownership remain separate gates.
