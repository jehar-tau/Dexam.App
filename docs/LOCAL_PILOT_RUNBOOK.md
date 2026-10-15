# Local fictional pilot acceptance

Codex owns this setup and execution; the designer owner should not need to debug terminals. This runbook is not a production launch procedure or approval to use real data.

## Preconditions

- Use the `dexam-platform` checkout and inspect branch, working tree, recent commits and current documentation first. Preserve Cloud Code/user changes.
- Node 24, pnpm 11, Docker/Colima, the existing local Supabase stack and Playwright Chromium are installed. Use existing tooling; do not reset the local DB, replace accounts, rotate keys or enable paid services to make a test pass.
- `pnpm exec supabase status` must be available, but do not paste its key-bearing output into chat/logs. The runner captures it privately and verifies loopback API/Mailpit/DB and the expected `supabase_db_dexam-platform` port mapping.
- Existing reviewed migrations are applied. Inspect pending local migration state rather than blindly rebuilding a shared DB.
- Local Edge Functions must already be served with the established **local-only captured-email and fictional student-recovery configuration**. Codex may start the existing configured service if absent, using the ignored `.env.employee-email.local`; never print its contents or replace it blindly. Existing setup command: `pnpm exec supabase functions serve --env-file .env.employee-email.local --no-verify-jwt`. This local gateway option does not remove the functions' own authentication/current-state checks or database RLS. Never use it as a production workaround.
- Ports 5173 and 4173 must be unused. Stop only a process known to belong to this test after confirming ownership; leave unrelated servers alone. No concurrent pilot/test runs or shared DB editing during acceptance.
- Global retention/native-worker acceptance refuses unrelated eligible records or conflicting fictional markers/jobs. Inspect and preserve them; do not broaden cleanup or delete other work just to unblock a test.

## Commands

From the platform checkout:

```sh
pnpm pilot:check
pnpm pilot:verify
```

`pilot:check` verifies the environment without creating application fixtures. It does not install tooling, start external services or reset data.

`pilot:verify` runs sequentially: static/app/build verification; database authorization tests; Chromium smoke journeys; actual account switching; composed academic/admissions/student/teacher journey; initial activation; captured employee invitation/recovery; independent student recovery; closeout/archive/checklist/class agenda; lesson files/impact preview; and a real native scheduled notification tick.

Each child creates exact disposable fictional fixtures and owns its cleanup. The runner prints stage names and pass/fail only, not raw provider/credential-bearing child output. Passing means every stage exited successfully, including its cleanup. It does not prove real email/AI delivery, owner UX acceptance or production readiness.

## If a stage fails

Stop the sequence. Record the safe stage name and inspect that exact script and current local state. Reproduce individually only after reviewing its secret-safe error handling. Never publish raw Supabase status, provider errors, passwords, OTPs, activation/recovery links, signed file paths or local email bodies.

Confirm which UUIDs/request keys/fictional addresses belong to the failed run before cleanup. Recover an uncertain account only from exact fictional markers, then use supported Admin deletion after linked fixture rows are removed. Preserve FK/RLS; immutable-history fixture cleanup may temporarily disable only named USER triggers inside a local transaction and must restore their original flags before commit. Unknown references must abort/roll back. Do not disable FK constraints or use global deletion.

Reconcile uncertain writes before deleting their files. Production orphan cleanup/metadata reconciliation remains DW-046, not an automatically authorized privileged repair job. HMAC throttle counters expire normally; do not clear global abuse controls. A repeat run can legitimately fail because a budget is exhausted—wait or obtain a narrowly scoped operational decision rather than removing controls.

If browser/process cleanup fails, still attempt domain/Auth cleanup and inspect only the known test process group. After forced interruption, do not assume `finally` ran; reconcile exact remaining fixtures before the next run.

## Handoff

Update `PILOT_READINESS.md`, the feature record and `CURRENT_STATE.md` with exact evidence and remaining gaps. Raise a PR automatically, inspect required checks/comments and obtain applicable independent review before merging. Keep real launch gates unchecked in `PRODUCTION_READINESS.md`.

The final designer walkthrough remains distinct: approved visual patterns, comprehension, mobile usability and real-browser microphone/download behavior should be reviewed using fictional content. New product requests discovered there require their own scope decision.
