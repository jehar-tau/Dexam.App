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

## Not yet started

- User-managed Node.js and container runtime installation
- First confirmed GitHub Actions run
- Running local Supabase stack and database test (blocked on container runtime)
- Hosted staging environment
- Detailed product model and role/permission matrix
- F001 Authentication and F002 Roles and Permissions specifications
- Design tokens and component library

## Environment findings

- Git and GitHub SSH authentication are available for GitHub user `jehar-tau`.
- The repository is connected to `git@github.com:jehar-tau/Dexam.App.git`; `main` tracks `origin/main`.
- GitHub CLI is not installed.
- A user-managed Node.js runtime, Docker, and Supabase CLI are not currently available on the shell path.
- The Codex workspace provides a bundled `pnpm`, but the project should not rely on that as the developer machine setup.
- The scaffold was verified with bundled Node.js 24.19.0 and pnpm 11.19.0.

## Next safe action

Install the user-managed free prerequisites, confirm CI, run the local Supabase database safety test, and draft F001/F002 Decision Gates.

## Blockers

- Local database execution requires installing a Docker-compatible runtime such as Colima.
- Normal terminal development requires installing Node.js 24 and pnpm 11 outside Codex's bundled runtime.
