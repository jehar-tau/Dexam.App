# ADR-026 — Hosted Staging and Release Foundation

Status: Option B approved 2026-10-11
Date: 2026-10-11
Decision ID: D-026
Risk: Red — external infrastructure, credentials, database migrations, release authority, and future personal-data boundary

## Question

How should Dexam create its first hosted staging environment so the product owner can review complete application journeys online at ₹0 initial infrastructure cost without confusing staging with a production-ready service?

## Current constraints

- The application, migrations, RLS tests, Edge Functions, and fictional previews already pass locally and in GitHub Actions.
- Staging must be owned by the product owner, use a separate backend, and contain fictional data only.
- Supabase Free currently permits two active projects and includes 500 MB database size, 1 GB file storage, 5 GB egress, 50,000 monthly active users, and 500,000 Edge Function invocations. A low-activity free project may pause after about one week.
- Supabase Free does not include automatic backups or database branching. A free staging environment must therefore be disposable and reconstructable rather than treated as durable production infrastructure.
- Cloudflare Pages Free currently permits 500 builds per month, one concurrent build, 20,000 files per site, 25 MiB per static asset, and unlimited active preview deployments. Dexam only needs static Vite assets; trusted backend work remains in Supabase Edge Functions.
- Supabase recommends separate local, staging, and production environments, version-controlled migrations, and CI/CD rather than dashboard-only schema edits.

Official sources reviewed:

- [Supabase billing and current Free quotas](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Supabase pricing](https://supabase.com/pricing)
- [Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase environment workflow](https://supabase.com/docs/guides/deployment/managing-environments)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- [Cloudflare Pages Vite build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [GitHub Actions secrets](https://docs.github.com/en/actions/reference/security/secrets)

## Options

### Option A — Continue with local previews only

Keep the application on the owner's Mac and use `127.0.0.1` previews for every review.

- **Impact:** No external setup and no new credential surface, but review still depends on the owner's computer and running local services.
- **Cost:** ₹0.
- **Risk:** Delays real deployment, redirect, environment, migration, Edge Function, and hosted-browser testing until production pressure is higher.
- **Reversibility:** High, but it only postpones the required work.

### Option B — Owner-controlled, reconstructable free staging (recommended)

Create one owner-controlled Supabase Free project named for staging and one Cloudflare Pages project connected to this repository. The hosted environment remains explicitly non-production and fictional-only.

The operating model is:

1. `main` is the only branch that releases a functional hosted staging build.
2. Pull requests continue to use local Supabase in GitHub Actions. Supabase per-PR database branches are not purchased.
3. Cloudflare Pages builds the React/Vite application from `main` with `pnpm build:staging` and publishes `dist`.
4. The Pages build receives only the staging Supabase URL and publishable browser key. Service-role keys, database passwords, access tokens, and action-token peppers never use a `VITE_*` variable.
5. A GitHub `staging` environment holds narrowly scoped deployment secrets. An automated workflow applies committed migrations and deploys declared Edge Functions only after the existing verification workflow succeeds on `main`.
6. Staging Auth redirect URLs are allowlisted to exact staging origins. Signup and anonymous login stay disabled.
7. Staging contains fictional identities, coursework, submissions, audio, CRM records, and privacy cases only. Preview shortcuts are disabled on the ordinary public build; review uses explicitly created synthetic test accounts. If a temporary design preview is required before those accounts exist, it must be access-restricted and may expose only the existing fictional preview data.
8. Dashboard schema edits are prohibited. Changes originate in reviewed migrations and repository configuration.
9. Free staging data has no durability promise. Recovery means recreating the project from migrations, deterministic fictional bootstrap data, function configuration, and safe fixture files. The implementation includes a clean rebuild rehearsal and records its result.
10. A paused free project is manually resumed when needed. Dexam does not generate artificial traffic merely to avoid free-tier pausing.
11. Initial monitoring uses GitHub deployment status, Cloudflare deployment status, Supabase logs/advisors, and a safe application/backend health check. No analytics, alerting vendor, or paid monitor is authorized.
12. Production remains a separate later project, workflow, hostname, credential set, and explicit Decision Gate.

- **Impact:** Gives the owner a stable online acceptance environment and tests the real release boundary while keeping production isolated.
- **Cost:** Expected ₹0/month within the current free allowances. No payment method, paid plan, overage, custom Supabase domain, PITR, or Supabase branching is authorized.
- **Risk:** The free backend may pause, has no automatic backup, offers community support only, and cannot isolate every pull request. Shared staging may occasionally need a fictional-data reset.
- **Reversibility:** High. The frontend is static, the database is defined by PostgreSQL migrations, and both hosted projects can be replaced without changing the product architecture.

### Option C — Paid production-like staging now

Use Supabase Pro for staging, keeping Cloudflare Pages for the frontend.

- **Impact:** Avoids inactivity pausing and adds daily database backups plus higher quotas and support.
- **Cost:** Supabase Pro starts at USD 25/month plus tax; optional add-ons cost more. This would be recurring spend before real-user validation.
- **Risk:** Pays for reliability that staging does not yet need and still does not replace production privacy, recovery, or operational readiness.
- **Reversibility:** High technically, but billing and operating expectations begin immediately.

## Recommendation

Approve Option B. It is the cheapest responsible way to expose the real application flow for owner review, validates deployment before production, and preserves the approved React/PostgreSQL architecture. Its limitations are acceptable only because staging is fictional, reconstructable, and not promised to users.

## What approval would authorize

Option B would authorize:

- creation of one free Supabase staging project in an organization owned by the product owner;
- creation of one free Cloudflare Pages staging project connected to `jehar-tau/Dexam.App`;
- a GitHub `staging` environment and encrypted deployment secrets;
- repository workflows and scripts for verified staging migrations, Edge Function deployment, frontend configuration, health checks, fictional bootstrap, and rebuild rehearsal;
- exact staging Auth redirect configuration and synthetic staging test accounts;
- browser acceptance testing against the hosted staging URL.

The owner may need to sign in to Supabase and Cloudflare and approve their GitHub installations. Codex may guide and operate the setup through the authenticated browser, but the accounts, organizations, recovery methods, and billing authority must remain owner-controlled.

Approval would not authorize production deployment, `app.designexam.com`, real student/employee/prospect data, real email or messaging, paid services, a payment method, disabled spend controls, production credentials, public preview shortcuts, or a claim of production readiness.

## Consequences

- F014 becomes the implementation slice for DW-026.
- DW-025 notification scheduling may be rehearsed only after staging exists and requires its own bounded implementation review before Dexam relies on it.
- DW-027 production deployment remains blocked by identity/recovery/MFA work, notices, request-route controls, backup/restore policy, monitoring, operational ownership, and explicit production approval.
- A later production workflow must add manual approval, protected credentials, durable backups, incident ownership, and a release/rollback runbook rather than copying the relaxed staging assumptions.

## Reversibility and migration

No existing data is migrated into staging. The new project begins empty, receives committed migrations, and receives fictional bootstrap data through a repeatable trusted procedure. If the free project is paused, corrupted, or replaced, Dexam recreates it from repository state. Moving staging to a paid plan later changes reliability and quotas, not application architecture.

## Approval

The product owner approved Option B on 2026-10-11. Dexam may build the owner-controlled, reconstructable, fictional-only staging foundation described above and may create the named free Supabase, Cloudflare Pages, and GitHub staging resources when the owner authorizes the provider accounts.

This approval does not authorize production deployment, `app.designexam.com`, real personal data, external communication, paid services, a payment method, overage, disabled spend controls, or public preview shortcuts.
