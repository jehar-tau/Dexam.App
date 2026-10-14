# F022 — Fictional in-app worker operations

Status: Accepted fictional scope through PR #50 (`838251e`) and protected release `38525635333`; real scheduled tick verified
Local acceptance: 241 application tests, 955 database assertions, 63 browser journeys and an actual native scheduled tick (no manual invocation). Exact own job, disposable markers and test logs removed; prior health restored. Independent security review cleared. A success older than three minutes is unhealthy, including after a statement timeout leaves the previous row unchanged. Protected release `38525635333` observed a new healthy scheduled tick and passed existing hosted authorization/MFA checks.
Risk: Red — service-only background processing and maintenance

## Purpose and scope

Deliver the already-approved in-app event alerts without requiring a person to invoke a worker. Use existing Supabase/Postgres infrastructure; no new vendor, paid plan, marketing, future reminder rules, external channel, staff permissions or student behavior is introduced.

Create a bounded database tick for existing outbox processing and existing notification/class-history retention. Keep one private minimized health record (timestamps, counts and SQLSTATE only). Configure one-minute native Cron only through the protected exact-fictional-project deployment path; migrations never activate recurring jobs by themselves. Prune only this job's run logs older than seven days. No token appears in a Cron command or database job record.

Production remains prohibited. Free-project pausing may stop jobs; fictional staging is not an uptime promise. Real operational ownership, alert/escalation channel, provider capacity and production scheduling require launch review. Existing file/audio storage purge workers remain separate; this SQL tick must never pretend to delete Storage objects.

## Verification

Post-release regression coverage explicitly tests one-minute live refresh, preview isolation from backend polling, switching accounts without showing previous cached updates, and a late previous-account response that must not appear in the new account. These tests change no runtime behavior or communication policy.

Anonymous/authenticated configuration, execution and health-read denial; target/fixture guards; bounded work and preserved existing notification behavior; same-offering cohort integrity; health outcomes without payloads; idempotent configuration; exact Cron command and permissions; real scheduled tick after deployment; own-job-only log retention; independent security review and clean CI.
