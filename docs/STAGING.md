# Hosted Staging Runbook

Status: hosted foundation, synthetic acceptance, and advisor hardening live; guarded rebuild rehearsal remains under F014 / approved D-026 Option B
Data classification: fictional test data only

## Purpose

Staging gives the product owner a stable online acceptance environment. It is not production, has no real users, and may be rebuilt without preserving its mutable data.

## Ownership boundary

- The product owner owns the Supabase organization, Cloudflare account, GitHub repository, recovery methods, and billing authority.
- Codex may prepare configuration and operate authenticated setup with the owner present, but must not create an agent-owned account or add a payment method.
- Provider access belongs in the access inventory and must be revoked promptly when an employee or collaborator leaves.

## Required resources after owner authorization

1. One Supabase Free project named clearly as staging.
2. One Cloudflare Pages project connected to `jehar-tau/Dexam.App` with `main` as the only build branch.
3. One GitHub environment named `staging` (created 2026-10-11; deployment secrets are added only as their provider resources are verified).
4. Synthetic credentials for acceptance users, stored outside Git and rotated when shared access changes.

## GitHub staging secrets

| Secret                       | Purpose                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`      | Scoped CLI deployment token for the staging project                                                                      |
| `STAGING_PROJECT_ID`         | Public project reference used by the deployment workflow                                                                 |
| `STAGING_DB_PASSWORD`        | Server-only password used to apply reviewed migrations                                                                   |
| `ACTION_TOKEN_PEPPER`        | Long random server-only value for one-time action-token hashing                                                          |
| `STAGING_SYNTHETIC_PASSWORD` | Long credential shared only by the protected bootstrap job and owner Keychain; rotated on every rebuild or access change |

Do not store the service-role key in GitHub, the frontend, or a `VITE_*` variable. The reviewed bootstrap job obtains it ephemerally from the Supabase Management API through the scoped deployment token, masks it immediately, and discards it when the job ends.

## Cloudflare Pages build configuration

- Production branch: `main`
- Preview branch builds: disabled
- Build command: `pnpm build:staging`
- Build output directory: `dist`
- Node.js: 24
- pnpm: 11.19.0 through Corepack
- `VITE_APP_ENV=staging`
- `VITE_SUPABASE_URL=<staging project URL>`
- `VITE_SUPABASE_ANON_KEY=<staging publishable key>`
- `VITE_ENABLE_OPERATOR_PREVIEW=false`
- `VITE_ENABLE_STUDENT_PREVIEW=false`

The Supabase URL and publishable key are intended for browser use and are protected by RLS. They still belong only to the staging project and must never be substituted with a service-role or secret key.

## Supabase configuration checklist

- Keep email signup and anonymous login disabled.
- Set the Auth site URL to the exact Cloudflare staging origin.
- Allow only exact required redirect URLs; no wildcard production domains.
- Confirm every browser-accessible table has RLS enabled.
- Confirm all storage buckets remain private.
- Add the action-token pepper through Supabase server-side secrets.
- Run security and performance advisors; record and triage findings.
- Never make schema changes only in the Dashboard.

## Release flow

1. A pull request passes the `Verify` workflow.
2. The owner approves and merges it into `main`.
3. The successful `Verify` push run triggers `Deploy staging backend`.
4. The workflow links only the staging project, previews pending migrations, applies them, configures the server-only pepper, deploys all declared functions, obtains job-scoped API keys without persisting them, reruns the deterministic fictional bootstrap, verifies hosted authorization boundaries, and prints migration identifiers.
5. Cloudflare builds the same `main` commit with staging public configuration.
6. Hosted acceptance checks `/health`, direct nested-route refresh, sign-in boundaries, and the changed journey.

If database deployment fails, do not retry by editing the dashboard. Fix or add a migration in a reviewed pull request. Staging may be rebuilt if its fictional state is no longer trustworthy.

### Guarded rebuild mode

The same workflow exposes a manual `rebuild-fictional-staging` operation. It is intentionally unavailable on automatic pushes and fails unless the protected `STAGING_PROJECT_ID` is the reviewed project `ienwcencjbgdsqxfyxmj`.

The operation resets that database from committed migrations with generic seeding disabled, then continues through migration verification, advisor enforcement, server-only secret configuration, Edge Function deployment, deterministic fictional bootstrap, all nine hosted authorization checks, and remote migration-state output. It records elapsed time only after every check passes. Do not use this operation for a future production project.

## Recovery model

Supabase Free does not provide automatic downloadable backups. Staging therefore has no promise to preserve mutable records or uploaded files.

The recovery source is:

- committed migrations;
- declared Edge Functions and configuration;
- deterministic fictional bootstrap instructions;
- safe fixture files that contain no credentials or personal data.

The F014 acceptance run must prove a clean reconstruction and record the time, failures, and manual steps. Production requires a separate durable backup and restore policy.

## Current setup checkpoint

- Repository staging controls are merged through PR #19 at commit `cc7b144c964e4f74c35de7344e4780ca3419e7a4`, and the GitHub `staging` environment is active.
- The owner-controlled Supabase Free project is named `Dexam Staging`, project reference `ienwcencjbgdsqxfyxmj`, with URL `https://ienwcencjbgdsqxfyxmj.supabase.co`.
- `STAGING_PROJECT_ID`, `STAGING_DB_PASSWORD`, a generated `ACTION_TOKEN_PEPPER`, and the named `SUPABASE_ACCESS_TOKEN` are stored only as GitHub `staging` environment secrets.
- GitHub email verification is complete. The Cloudflare Pages GitHub App installation is restricted to `jehar-tau/Dexam.App`, and the connected `dexam-staging` Pages project deploys only `main` to `https://dexam-staging.pages.dev`.
- A named Supabase CLI deployment token was created through Supabase's browser authorization, stored in the owner's macOS Keychain, verified by listing the owner-controlled `Dexam Staging` project, and copied directly into the encrypted GitHub `staging` environment as `SUPABASE_ACCESS_TOKEN` without printing it.
- Supabase Auth uses `https://dexam-staging.pages.dev` as the exact site URL. Public signup, manual linking, and anonymous sign-in are disabled; email confirmation remains enabled. No redirect URLs are currently required because OAuth and email callback flows are not implemented.
- No payment method, paid plan, real data, or production deployment has been introduced.

## First hosted release evidence — 2026-10-12

- PR #19 passed application, database-security, and browser checks before owner-approved merge.
- GitHub run `38159997115` initially failed safely during the migration dry run because the first stored database password was not accepted. No migrations were applied during either failed attempt. The owner reset the password and updated the encrypted secret; after Supabase's password rotation propagated, the same protected run succeeded.
- The successful backend run linked only project `ienwcencjbgdsqxfyxmj`, previewed and applied all committed migrations, configured `ACTION_TOKEN_PEPPER`, deployed all eight declared Edge Functions, and recorded remote migration state.
- Cloudflare built the same merge commit with `pnpm build:staging` and published `dist` to `https://dexam-staging.pages.dev`.
- Cloudflare initially retained its default of building every non-production branch. The first PR #20 preview attempt was rejected by `build:staging` because its commit was not on `main`, proving the repository guard failed closed. Cloudflare branch control was then corrected to keep automatic production deployments enabled for `main` and disable all automatic preview-branch deployments.
- `/`, `/health`, `/staff/reviews`, and `/student/coursework` return the SPA document directly. All checked routes send `X-Robots-Tag: noindex, nofollow, noarchive`, `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`.
- `/health` reported both frontend and backend operational and identified the site as a non-production, fictional-data-only environment.
- Hosted `?preview=1` requests for `/staff/crm` and `/student` were redirected to their protected sign-in pages; public preview shortcuts did not bypass authentication.
- Empty unauthenticated POSTs to all eight declared Edge Functions failed closed: the two intentionally public student credential operations returned safe `400` responses, and the six protected operations returned `401` without exposing configuration.
- Supabase Studio initially summarized `0` errors, `86` warnings, and `21` informational suggestions. The later complete CLI triage returned `87` warnings; its exact categories and dispositions are recorded in `STAGING_ADVISOR_TRIAGE.md`.
- Supabase Performance Advisor reported `0` errors, `10` warnings, and `122` informational suggestions. These remain triage work and are not silently accepted.

The deterministic fictional bootstrap and all nine hosted role/account checks passed after PR #21. The advisor hardening and automated gate passed after PR #22 in run `38293373701`: anonymous `SECURITY DEFINER` findings fell from three to zero, 82 explicitly granted authenticated functions remained, and the documented free-plan/password and performance findings were accepted. The guarded rebuild rehearsal is the final F014 evidence item. Until it passes, this URL is a development staging environment rather than an accepted production candidate.

## Synthetic acceptance accounts

The bootstrap manifest contains only reserved `.invalid` email addresses, clearly fictional display names, deterministic application identifiers, and one fictional course enrolment. The password is not committed. It is stored as the encrypted `STAGING_SYNTHETIC_PASSWORD` environment secret and in the product owner's macOS Keychain under `Dexam Staging Synthetic Password`.

| Boundary                 | Sign-in identifier                         |
| ------------------------ | ------------------------------------------ |
| Student                  | Member ID `DXM-STG22STUDENT`               |
| Teacher                  | `teacher.staging@dexam.invalid`            |
| Sales                    | `sales.staging@dexam.invalid`              |
| CRM Coordinator          | `crm-coordinator.staging@dexam.invalid`    |
| Enrolment Operator       | `enrolment-operator.staging@dexam.invalid` |
| Privacy Operator         | `privacy-operator.staging@dexam.invalid`   |
| Elevated Admin           | `elevated-admin.staging@dexam.invalid`     |
| Revoked employee denial  | `revoked-employee.staging@dexam.invalid`   |
| Inactive employee denial | `inactive-employee.staging@dexam.invalid`  |

Every deployment rotates these Auth users to the encrypted staging password, upserts the fictional identity and permission baseline, and checks current database state after obtaining a real session. Privacy and security-sensitive permissions must remain denied at password-only `aal1`; successful `aal2` access remains gated by DW-003 rather than being weakened for staging.

## Synthetic acceptance evidence — 2026-10-12

- PR #21 merged as `9045098ff231d18fd1ee7d28548c85208a451261` after its Verify workflow passed.
- Backend deployment run `38286140338` applied the reviewed release, bootstrapped nine fictional accounts plus one enrolment, and passed all active-role, cross-role, revoked-employee, and inactive-employee checks against real hosted sessions.
- The bootstrap remained idempotent and no credential, privileged API key, or personal data was printed or committed.

## Advisor handling

The initial hosted report and each disposition are recorded in `STAGING_ADVISOR_TRIAGE.md`. The current branch fixes inherited anonymous privileged-function execution, enforces explicit future function grants, and adds a protected deployment gate. Supabase leaked-password protection remains unavailable on the authorized Free plan and is a production upgrade/security gate, not a reason to spend during fictional staging.

## Free-tier operations

- A low-activity Supabase Free project may pause. Resume it manually when staging review is needed.
- Do not schedule hidden keepalive traffic to defeat provider pausing.
- Review database, storage, egress, function, and build usage before every pilot expansion.
- No payment method, paid plan, overage, PITR, branching, custom Supabase domain, or monitoring vendor is approved by D-026.

## Incident and teardown

If a credential is exposed, stop deployment, rotate the affected secret/token, inspect GitHub and provider logs, and record the incident without copying the secret into an issue.

If staging is no longer needed, remove the Pages deployment, delete or pause the staging Supabase project after confirming it contains no real data, remove GitHub environment secrets, and update `CURRENT_STATE.md`.
