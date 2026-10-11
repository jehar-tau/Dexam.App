# F014 — Hosted Staging and Release Foundation

Status: In progress — D-026 Option B approved
Risk: Red — hosted credentials, migrations, release automation, Auth redirects, and future production boundary

## Purpose and problem

Dexam's product journeys work locally, but the owner cannot yet review them at a stable online URL and the application has not exercised a real hosted database, Edge Function, redirect, or release path. F014 creates a fictional-only staging environment that is intentionally separate from production and cheap enough to keep during product development.

## Users

- **Product owner:** reviews complete desktop and mobile journeys at a stable hosted URL and owns all provider accounts.
- **Development agent:** prepares reviewed migrations, functions, configuration, automated checks, and deployment evidence without receiving unnecessary provider ownership.
- **Authorized test employee/student:** fictional account used only to exercise real Auth, RLS, storage, and workflow behavior in staging.
- **Future release operator:** follows a documented, auditable process rather than editing hosted schema or secrets ad hoc.

## User flow

1. A pull request passes application, database-security, and browser checks against disposable local infrastructure.
2. The approved pull request is merged into `main`.
3. The staging deployment verifies the exact commit, applies new migrations, deploys declared Edge Functions, and builds the static frontend with staging-only public configuration.
4. Safe health checks confirm the frontend, backend, and expected migration state.
5. The owner opens the staging URL, signs in with a synthetic role-specific account, and reviews the relevant journey.
6. A failed deployment is visible, does not fall through to production, and is repaired through a new reviewed commit or a documented staging rebuild.
7. A rebuild drill proves that the environment can be recreated from migrations and fictional bootstrap assets.

## In scope

- Owner-controlled Supabase and Cloudflare staging projects selected by D-026
- GitHub `staging` environment and minimum deployment secrets
- Static Vite deployment configuration including SPA fallback and safe security headers
- Main-only functional staging releases
- Migration and Edge Function deployment automation after required verification
- Explicit inventory of every deployed Edge Function and its server-only secrets
- Exact Auth site/redirect allowlist for staging
- Deterministic fictional bootstrap and synthetic acceptance accounts
- Preview-mode policy that prevents public shortcut access
- Frontend/backend/migration health evidence without leaking configuration
- Rebuild rehearsal and staging runbook
- Hosted Chromium smoke journeys for the highest-value role boundaries
- Cost/usage checklist and free-tier limitation warnings

## Out of scope

- Production project or deployment
- `app.designexam.com` or another production hostname
- Real student, employee, guardian, prospect, audio, assignment, or submission data
- Production email, SMS, WhatsApp, push, analytics, AI, or payment providers
- Paid Supabase, Cloudflare, monitoring, backup, or branching features
- Per-pull-request hosted databases
- Production uptime, backup, recovery-time, or support guarantees
- Automatically running destructive privacy or retention operations
- Treating the staging access gate as a substitute for application authorization or RLS

## Permissions

- Provider organizations and recovery methods belong to the product owner.
- Repository deployment secrets are available only to the `staging` GitHub environment and the minimum workflow jobs that need them.
- The browser receives only the Supabase project URL and publishable key; all privileged secrets stay in GitHub or Supabase's server-side secret store.
- Synthetic staff still pass current employee, capability, scope, MFA-assurance, and RLS checks applicable to the journey.
- Revoking a synthetic employee must immediately deny the same application paths as a future real employee.

## Business rules

- Staging is fictional-only and may be reset without notice.
- `main` is the source for functional staging. A pull-request frontend must not silently point at the shared staging backend when its schema may be incompatible.
- A green build is not enough: migrations, functions, environment wiring, and safe health checks must also succeed.
- Database changes are migration-only; dashboard edits are treated as drift and must be reconciled into the repository before continued use.
- Deployments are serialized. A newer commit supersedes an older queued deployment.
- Staging and future production never share projects, passwords, secrets, storage, Auth users, or provider access tokens.
- A free-project pause is acceptable; hidden keepalive traffic is not part of the design.
- The staging recovery source is versioned schema/configuration plus fictional bootstrap data, not an assumption of provider backups.

## Interface states

- Stable staging URL and deployment identifier
- Frontend operational, backend unavailable, configuration missing, migration mismatch, and maintenance/rebuild states
- Authentication failure without provider-detail leakage
- Synthetic-account expired or revoked state
- Safe health response that contains no secrets, personal data, table contents, or internal error trace
- Clear non-production banner for authenticated staging journeys

## Data and privacy

- All names, contacts, submissions, voice notes, feedback, CRM records, and privacy cases are obviously fictional.
- No production export or owner contact list may be imported.
- Provider logs, GitHub artifacts, screenshots, and browser reports must not contain passwords, service keys, tokens, or uploaded fixture bytes that are not safe to disclose.
- Synthetic credentials are secrets even though the identities are fictional; they are not committed to Git.
- Temporary staging uploads may be deleted during every rebuild.

## Analytics events

No product analytics provider is authorized. Deployment and health status use provider-native operational logs only. Any future product-intelligence event taxonomy remains DW-028.

## Security considerations

- Scope the Supabase access token to the staging project and rotate it after suspected exposure.
- Store the database password and action-token pepper only in encrypted environment/provider secrets.
- Use exact redirect origins; do not permit wildcard production-like domains.
- Keep self-signup and anonymous authentication disabled.
- Require existing CI before deployment and fail closed when a secret or migration check is missing.
- Do not echo CLI environment, connection strings, tokens, generated passwords, or API responses containing secrets into logs.
- Apply application security headers and prevent indexing of the staging site.
- Run Supabase security/performance advisors and record actionable findings before acceptance.

## Relevant sources and ADRs

- D-002 Application Stack and Deployment Architecture
- D-004 Identity Deduplication and Access Revocation
- D-008 Staff Authority and Approval Boundaries
- D-026 Hosted Staging and Release Foundation
- `../ARCHITECTURE.md`
- `../SECURITY.md`
- `../SETUP.md`
- `../TESTING.md`
- DW-025, DW-026, DW-027, and DW-028 in `../DEFERRED_WORK.md`

## Acceptance criteria

- A commit that has not passed required GitHub checks cannot become the accepted staging release.
- The hosted frontend loads direct nested routes without a 404 and identifies itself as non-production.
- Staging connects only to the staging Supabase project.
- All migrations apply from a clean hosted project without dashboard schema edits.
- Every required Edge Function is declared, deployed, and rejects unauthorized calls safely.
- Browser configuration contains no privileged key or password.
- Public preview shortcuts cannot bypass hosted staging authentication.
- Synthetic Student, Teacher, Sales, CRM Coordinator, Enrolment Operator, Privacy Operator, and Elevated Admin boundaries behave as documented.
- Revoked or inactive synthetic employees fail closed.
- A failed backend/configuration health check is visible without leaking secrets.
- A rebuild rehearsal recreates schema and fictional baseline data and records elapsed time and limitations.
- Staging uses no real personal data and incurs no paid service charge.
- Production remains undeployed and independently gated.

## Verification plan

- Static checks for workflow permissions, secret names, preview flags, exact deployment branch, SPA fallback, and security headers
- Clean local database reset and full pgTAP suite before remote migration
- Staging migration dry run followed by applied migration-list verification
- Unauthorized-call checks for every deployed Edge Function
- Hosted Playwright smoke flows for health, sign-in, role boundary, nested-route refresh, and revocation
- Browser inspection for desktop/mobile layout, non-production marking, console errors, indexing headers, and network target
- Rebuild rehearsal from repository state using only documented owner-supplied secrets
- Cost dashboard check confirming free plans and no payment/overage activation

## Open decisions

- D-026 Option B approved 2026-10-11
- Exact owner-controlled Supabase organization and Cloudflare account selected during setup
- Exact staging URL generated by Cloudflare; no production custom domain is authorized
