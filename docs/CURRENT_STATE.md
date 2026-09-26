# Current State

Last updated: 2026-09-26

## Current phase

Foundation implementation — application scaffold.

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

## Not yet started

- First confirmed GitHub Actions run
- Hosted staging environment
- Detailed product model and role/permission matrix
- F001 Authentication and F002 Roles and Permissions specifications
- Design tokens and component library

## Environment findings

- Git and GitHub SSH authentication are available for GitHub user `jehar-tau`.
- The repository is connected to `git@github.com:jehar-tau/Dexam.App.git`; `main` tracks `origin/main`.
- GitHub CLI is not installed.
- Homebrew 7.0.6 is installed under `/opt/homebrew`.
- User-managed Node.js 24.21.0 and pnpm 11.19.0 are available in login shells.
- Colima 0.10.3 provides the local Docker runtime; Docker CLI 29.8.1 and Docker Compose 5.5.1 are installed.
- Supabase CLI 2.118.0 is a pinned project dependency; the local Supabase stack is operational.

## Next safe action

Confirm the first GitHub Actions run and prepare the F001 Authentication and F002 Roles and Permissions specifications using D-003/D-004/D-005.

## Blockers

- No local environment blocker remains.
