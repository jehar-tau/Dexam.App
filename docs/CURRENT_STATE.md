# Current State

Last updated: 2026-10-10

## Current phase

Student access implementation — Member ID sign-in and first self-service enrolment workspace.

## Completed

- Located and inspected the separate marketing website at `../../Dexam website/Website-Dexam`.
- Created the local `dexam-platform` repository structure and canonical agent guidance.
- Documented the product/engineering working agreement, decision policy, provisional architecture, testing strategy, roadmap, and setup path.
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

## Not yet started

- Hosted staging environment
- Remaining enrolment transitions beyond activation-pack issuance
- Student account recovery workflow
- Two-person approval workflow and elevated administration interface
- Porting the remaining shared primitives as a feature needs them (navigation, overlays, and tables)
- F008 channel, consent, preference, and first-milestone notification decisions

## Environment findings

- Git and GitHub SSH authentication are available for GitHub user `jehar-tau`.
- The repository is connected to `git@github.com:jehar-tau/Dexam.App.git`; `main` tracks `origin/main`.
- GitHub CLI is not installed.
- Homebrew 7.0.6 is installed under `/opt/homebrew`.
- User-managed Node.js 24.21.0 and pnpm 11.19.0 are available in login shells.
- Colima 0.10.3 provides the local Docker runtime; Docker CLI 29.8.1 and Docker Compose 5.5.1 are installed.
- Supabase CLI 2.118.0 is a pinned project dependency; the local Supabase stack is operational.

## Next safe action

Merge the student sign-in and self-service workspace pull request after all required GitHub checks pass.

## Blockers

- Employee invitation, student/employee recovery, MFA, and security-triggered all-device session revocation remain future F001 slices.
