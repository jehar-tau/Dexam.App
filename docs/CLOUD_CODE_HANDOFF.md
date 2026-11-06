# Dexam continuation handoff — 5 November 2026

Repository: <https://github.com/jehar-tau/Dexam.App>

Branch: `feature/shared-admissions-google-access`. This is an **unfinished draft checkpoint**, not a release. Do not merge or deploy it merely because existing tests pass. `main` already contains Discovery styling through PR #111 (`8fffcd1`). Work on this branch, not a second admissions implementation.

## Start here

Read `AGENTS.md`, `docs/CURRENT_STATE.md`, `docs/DECISION_POLICY.md`, `docs/QUALITY_GATE.md`, `docs/design/DISCOVERY.md`, `docs/features/F054-shared-admissions-google-access.md` and `docs/decisions/ADR-065-shared-admissions-google-access.md`. Inspect status, commits and PR comments before edits; other agents may contribute. The owner is a designer and expects engineering/setup/testing assistance, not unexplained terminal tasks.

## Implemented checkpoint

- Private canonical login-email reservations; shared directory and identity search; recent-MFA/global elevated-admin authority, without new account/role grants.
- Atomic, idempotent manual admission/receipt/access/audit operations, integer paise, append-only evidence and revision-aware name/date/renewal/suspension/revocation/batch-transfer edits.
- India-time 48/24/12-calendar-month and exact-30-day preview helpers and server date helper, leap/end-boundary tests.
- `/admin/admissions` with directory search/state filters, deliberate canonical-person review, receipt entry and edits. No administrator preview bypass.
- Verified Google reservation claim before public candidate fallback; canonical recovery/session cutoffs; separate portal Google buttons/callback behind an off-by-default flag. Existing employee bindings require provider linking, never silent replacement.
- Exact-course curriculum/checklist/class/assignment access helpers and distribution/activation guards. Derived coaching test rights now inspect enrolment validity; independently purchased access stays separate. Creation-time attempt basis, post-lock checks and a central payload boundary prevent expired coaching from using unrelated purchases or old resume routes.
- Fictional SQL/component/contract/property tests and an isolated two-connection duplicate/expiry regression.

## Intentionally disabled and missing

1. **Keep `admissions_runtime_gate.enabled=false` and `VITE_ENABLE_SHARED_GOOGLE_LOGIN` unset/false.** Do not enable, migrate existing people, create real accounts, send invitations or change hosted OAuth settings. The database migrations still change existing read/auth helpers even with the admission-write gate off; the gate is NOT a migration-wide feature switch.
2. **Authenticated file retrieval: implemented locally (Claude continuation, 5 November).** No browser code or Edge Function issues a signed link; see F054 "Authenticated file retrieval" for the design, evidence and limits. Still required at rollout: drain links issued by the old code for at least 4 hours (the longest previous lifetime, bank figures), and allow `blob:` in any future CSP. Downloaded bytes cannot be recalled. No credential rotation/object deletion as a shortcut.
3. **Owner policy still unanswered:** does automatic expiry start the existing 12-month finalized-own-work archive, or does archive require explicit course closeout? Existing explicit-closeout behavior remains. Do not invent an expiry anchor or physical retention rule. Continue other work first; ask only when this decision blocks completion.
4. Finish real local Auth/Storage acceptance, staff invitation/reservation integration, multi-role/dual-login recovery and claim/admission races. SQL provider fixtures are not a live Google-provider test. No hosted configuration has been verified for this change; local nonce skipping must never reach production.
5. Finish admin receipt/audit history presentation, offering/batch/expiry filters and bounded pagination; UI currently offers name/email/Member-ID search plus state and caps the directory at 100 rows. Verify independent existing enrolments, transfers preserving pinned curricula, stale edits across courses, guardian/contact separation and uncertain retries.
6. Finish dedicated authenticated admissions/Google desktop/mobile/dark/keyboard/axe and visual acceptance. Existing 130 browser journeys passing is regression evidence, not full F054 UI acceptance. New component tests cover disabled gates, deliberate identity review and revision-bound edits.
7. Audit every assessment/storage/list/resume entrypoint against exact-attempt rights, and add direct mock/live resume regression coverage. Existing public candidate trials/purchases and legacy unmigrated identities deliberately retain their existing rules; do not silently migrate real records or grant perpetual coaching access.
8. Review input/calendar parity, explicit custom date validation, unconfirmed Auth-email conflicts, bounded history, request retry/account-switch races and lock ordering. Do not equate a manually confirmed receipt with a verified gateway capture or invent refund/instalment policy.

## Safe verification

Use Node 24 and the pinned pnpm/package lock. `pnpm install --frozen-lockfile`, then `pnpm verify`, `pnpm test:e2e`, `pnpm build-storybook`, `pnpm audit --prod`. Run clean migrations and all pgTAP tests on a **new isolated fictional Supabase stack**. Never run `pnpm db:reset` against an existing populated development/hosted database. Environment secrets are not in Git and should never be pasted into chat.

The previous machine has a disposable project `dexam-f054-3sjvyz` under `/tmp/dexam-admissions-test-3SjVyZ`, DB port 55432; it is not portable setup or a hosted project. The populated original local bank uses 54322 and must not be reset/stopped. Preserve all unrelated servers. Do not copy existing `.env` credentials to a cloud chat.

`node scripts/staging/verify-admission-concurrency.mjs <exact-owned-container>` accepts only an empty `supabase_db_dexam-f054-…` disposable DB, creates fictional fixtures, tests duplicate admission and queued expiry, then disables the gate. It leaves fixtures for inspection; reset only that owned disposable stack afterward. It is not a production load test.

Before every push follow D-056, including full-diff Claude correctness/security review and staged secret scan. Red-risk completion also needs independent security review and owner staging acceptance before merge. Do not auto-merge this handoff draft. Never touch/publish the separate marketing website, DesignMocks or another backend/project as part of Dexam work.

## Scope and authority

The supplied D-065 brief approves this local implementation, not production activation, real data/identity migration, paid services, live DNS/OAuth changes or automatic administrator grants. Preserve Member IDs, current privileges, MFA and independent recovery. Ask the owner only for a material policy/permission/cost decision, showing all options. Do not claim the whole app or F054 is complete.
