# Setup Guide

The D-002 architecture is approved and the foundation scaffold exists. These commands describe the current repository.

## Current machine state

Git and GitHub SSH access for `jehar-tau` work. The repository contains Supabase CLI as a pinned development dependency. A user-managed Node.js runtime and Docker-compatible container runtime are not currently available on the shell path; Codex used its bundled Node 24 runtime for the initial scaffold.

## Stage 1 — GitHub

Recommended remote: a private repository named `dexam-platform` under the GitHub account or organization chosen by the owner. Install and authenticate GitHub CLI, or create the empty private repository in GitHub's web interface. Do not initialize it with a README because this local repository already has history.

After creation, connect and push:

```bash
git remote add origin git@github.com:jehar-tau/dexam-platform.git
git push -u origin main
```

Change the owner portion if an organization is selected.

## Local prerequisites

Install Node.js 24 through a version manager and enable pnpm 11. Use a free Docker-compatible runtime such as Colima for local Supabase. Avoid relying on Codex's bundled runtime because it is not the user's normal terminal environment.

Verify the application tools:

```bash
pnpm install
pnpm env:check
pnpm verify
```

Install the Playwright browser once:

```bash
pnpm exec playwright install chromium
```

## Frontend

Run `pnpm dev` and open `http://127.0.0.1:5173`. The application includes strict types, routing, lint/format rules, Vitest/Testing Library, Playwright, semantic design-token placeholders, and a temporary foundation shell.

## Backend

Start local Supabase after the container runtime is installed:

```bash
pnpm supabase:start
pnpm supabase:status
pnpm db:test
```

Configuration, fictional-only seed data, and an initial RLS safety test are committed. Never commit generated local credentials or production secrets. Roles and every exposed table require tested RLS.

## Continuous integration

GitHub Actions installs from the lockfile and runs formatting, lint, typecheck, unit tests, production build, and a Chromium smoke test. Database CI will be added with the first schema migration. Protect `main` after the first workflow run is confirmed.

## Stage 6 — environments

Create separate staging and production Supabase projects and deployments. Use environment-scoped GitHub secrets, migrations rather than dashboard-only schema edits, synthetic staging data, and manual approval for production releases.

## Daily workflow

Issue/specification → Decision Gates resolved → feature branch/worktree → implementation and tests → PR → risk-based independent review → staging → owner acceptance when required → merge → controlled production release.
