# Dexam Platform

The authenticated learning and operations platform for Dexam (Design Exam Academy). This application is intentionally separate from the public marketing website at `../../Dexam website/Website-Dexam`.

## Status

Foundation application scaffold. The repository now contains a typed React shell, local Supabase configuration, unit/component and browser test foundations, and GitHub Actions verification. Product features have not started. See [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) and [docs/SETUP.md](docs/SETUP.md).

## Working agreement

The product owner leads product and design. The development agent owns technical guidance and execution across frontend, backend, database, testing, security, CI, and deployment, while escalating material product/business/security choices through Decision Gates.

## Baseline

- React 19, Vite, and strict TypeScript
- Supabase/PostgreSQL configuration for backend, authentication, storage, and Row Level Security
- Vitest, Testing Library, SQL safety tests, and Playwright
- GitHub Actions continuous integration
- Separate local, staging, and production boundaries

The architecture is approved in `docs/decisions/ADR-002-application-stack-and-deployment.md`.

## Develop

Node.js 24 and pnpm 11 are required.

```bash
pnpm install
pnpm env:check
pnpm dev
```

Open `http://127.0.0.1:5173`.

## Verify

```bash
pnpm verify
pnpm exec playwright install chromium  # first browser-test run only
pnpm test:e2e
```

The local backend additionally requires a Docker-compatible runtime:

```bash
pnpm supabase:start
pnpm db:test
```
