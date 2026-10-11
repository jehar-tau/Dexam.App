# Hosted Staging Runbook

Status: implementation foundation under F014 / approved D-026 Option B
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

| Secret                  | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Scoped CLI deployment token for the staging project             |
| `STAGING_PROJECT_ID`    | Public project reference used by the deployment workflow        |
| `STAGING_DB_PASSWORD`   | Server-only password used to apply reviewed migrations          |
| `ACTION_TOKEN_PEPPER`   | Long random server-only value for one-time action-token hashing |

Do not store the service-role key in the frontend or a `VITE_*` variable. Add a service-role secret only to a future bounded bootstrap job if that job is separately reviewed.

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
4. The workflow links only the staging project, previews pending migrations, applies them, configures the server-only pepper, deploys all declared functions, and prints migration identifiers.
5. Cloudflare builds the same `main` commit with staging public configuration.
6. Hosted acceptance checks `/health`, direct nested-route refresh, sign-in boundaries, and the changed journey.

If database deployment fails, do not retry by editing the dashboard. Fix or add a migration in a reviewed pull request. Staging may be rebuilt if its fictional state is no longer trustworthy.

## Recovery model

Supabase Free does not provide automatic downloadable backups. Staging therefore has no promise to preserve mutable records or uploaded files.

The recovery source is:

- committed migrations;
- declared Edge Functions and configuration;
- deterministic fictional bootstrap instructions;
- safe fixture files that contain no credentials or personal data.

The F014 acceptance run must prove a clean reconstruction and record the time, failures, and manual steps. Production requires a separate durable backup and restore policy.

## Current setup checkpoint

- Repository staging controls and the GitHub `staging` environment are prepared.
- The owner-controlled Supabase Free project is named `Dexam Staging`, project reference `ienwcencjbgdsqxfyxmj`, with URL `https://ienwcencjbgdsqxfyxmj.supabase.co`.
- `STAGING_PROJECT_ID` and a generated `ACTION_TOKEN_PEPPER` are stored only as GitHub `staging` environment secrets.
- GitHub email verification is complete. The Cloudflare Pages GitHub App installation is restricted to `jehar-tau/Dexam.App`, but Cloudflare did not receive the installation callback and still shows the account as disconnected. Re-authorize the installation from the Cloudflare Pages flow before creating the Pages project; do not widen repository access.
- A named Supabase CLI deployment token was created through Supabase's browser authorization, stored in the owner's macOS Keychain, and verified by listing the owner-controlled `Dexam Staging` project. Copying it into the GitHub `staging` environment as `SUPABASE_ACCESS_TOKEN` still requires the owner's Keychain-access confirmation.
- `STAGING_DB_PASSWORD` remains unset and must be entered by the owner without placing it in chat, shell history, Git, or documentation.
- No payment method, paid plan, real data, or production deployment has been introduced.

## Free-tier operations

- A low-activity Supabase Free project may pause. Resume it manually when staging review is needed.
- Do not schedule hidden keepalive traffic to defeat provider pausing.
- Review database, storage, egress, function, and build usage before every pilot expansion.
- No payment method, paid plan, overage, PITR, branching, custom Supabase domain, or monitoring vendor is approved by D-026.

## Incident and teardown

If a credential is exposed, stop deployment, rotate the affected secret/token, inspect GitHub and provider logs, and record the incident without copying the secret into an issue.

If staging is no longer needed, remove the Pages deployment, delete or pause the staging Supabase project after confirming it contains no real data, remove GitHub environment secrets, and update `CURRENT_STATE.md`.
