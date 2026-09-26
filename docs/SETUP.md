# Setup Guide

The D-002 architecture is approved and the foundation scaffold exists. These commands describe the current repository.

## Current machine state

Git and GitHub SSH access for `jehar-tau` work. Homebrew, Node.js 24, pnpm 11, Colima, Docker CLI, Docker Compose, and the repository-pinned Supabase CLI are installed. Colima provides the free local container runtime.

## Stage 1 — GitHub

Recommended remote: a private repository named `dexam-platform` under the GitHub account or organization chosen by the owner. Install and authenticate GitHub CLI, or create the empty private repository in GitHub's web interface. Do not initialize it with a README because this local repository already has history.

After creation, connect and push:

```bash
git remote add origin git@github.com:jehar-tau/dexam-platform.git
git push -u origin main
```

Change the owner portion if an organization is selected.

## Local prerequisites

The current Mac is configured through Homebrew with Node.js 24, pnpm 11, Colima, Docker CLI, and Docker Compose. New login shells load Homebrew and the versioned Node runtime through `~/.zprofile`.

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

If the Mac has restarted, start the container runtime first:

```bash
colima start
pnpm supabase:start
```

To release memory when development is finished:

```bash
pnpm supabase:stop
colima stop
```

## Continuous integration

GitHub Actions installs from the lockfile and runs formatting, lint, typecheck, unit tests, production build, and a Chromium smoke test. Database CI will be added with the first schema migration. Protect `main` after the first workflow run is confirmed.

## Stage 6 — environments

Create separate staging and production Supabase projects and deployments. Use environment-scoped GitHub secrets, migrations rather than dashboard-only schema edits, synthetic staging data, and manual approval for production releases.

## Daily workflow

Issue/specification → Decision Gates resolved → feature branch/worktree → implementation and tests → PR → risk-based independent review → staging → owner acceptance when required → merge → controlled production release.
