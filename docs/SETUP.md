# Setup Guide

This guide will evolve as the application scaffold is created. Commands are intentionally not presented as ready-to-run until prerequisites and foundation decisions are approved.

## Current machine state

Git and GitHub SSH access for `jehar-tau` work. GitHub CLI, a user-managed Node.js runtime, Docker, and Supabase CLI are not currently available on the shell path.

## Stage 1 — GitHub

Recommended remote: a private repository named `dexam-platform` under the GitHub account or organization chosen by the owner. Install and authenticate GitHub CLI, or create the empty private repository in GitHub's web interface. Do not initialize it with a README because this local repository already has history.

After creation, connect and push:

```bash
git remote add origin git@github.com:jehar-tau/dexam-platform.git
git push -u origin main
```

Change the owner portion if an organization is selected.

## Stage 2 — local prerequisites

Install a supported Node.js LTS through a version manager, Corepack/pnpm, Docker Desktop, and the Supabase CLI. Record exact versions in the repository when the scaffold is generated. Avoid relying on Codex's bundled runtime because it is not the user's normal development environment.

## Stage 3 — frontend

Bootstrap a React + TypeScript application with strict types, routing, lint/format rules, Vitest/Testing Library, and Playwright. Build semantic design tokens and the application shell before feature-specific UI.

## Stage 4 — backend

Initialize Supabase locally. Commit configuration, migrations, seed data containing only fictional users, database tests, and edge functions. Never commit generated local credentials or production secrets. Roles and every exposed table require tested RLS.

## Stage 5 — continuous integration

GitHub Actions should install from the lockfile and run formatting checks, lint, typecheck, unit/integration tests, a production build, secret checks, and a deliberate subset of browser tests. Protect `main` once the workflow exists.

## Stage 6 — environments

Create separate staging and production Supabase projects and deployments. Use environment-scoped GitHub secrets, migrations rather than dashboard-only schema edits, synthetic staging data, and manual approval for production releases.

## Daily workflow

Issue/specification → Decision Gates resolved → feature branch/worktree → implementation and tests → PR → risk-based independent review → staging → owner acceptance when required → merge → controlled production release.
