# F022 — Fictional in-app worker operations

Status: Implementation active — operational follow-up within D-002/D-021/D-034 approved boundaries
Local acceptance: 241 application tests, 955 database assertions, 63 browser journeys and an actual native scheduled tick (no manual invocation). Exact own job, disposable markers and test logs were removed; prior health restored. Independent security review cleared. A success older than three minutes is unhealthy, including after a statement timeout leaves the previous row unchanged. PR/hosted acceptance remains.
Risk: Red — service-only background processing and maintenance

## Purpose and scope

Deliver the already-approved in-app event alerts without requiring a person to invoke a worker. Use existing Supabase/Postgres infrastructure; no new vendor, paid plan, marketing, future reminder rules, external channel, staff permissions or student behavior is introduced.

Create a bounded database tick for existing outbox processing and existing notification/class-history retention. Keep one private minimized health record (timestamps, counts and SQLSTATE only). Configure one-minute native Cron only through the protected exact-fictional-project deployment path; migrations never activate recurring jobs by themselves. Prune only this job's run logs older than seven days. No token appears in a Cron command or database job record.

Production remains prohibited. Free-project pausing may stop jobs; fictional staging is not an uptime promise. Real operational ownership, alert/escalation channel, provider capacity and production scheduling require launch review. Existing file/audio storage purge workers remain separate; this SQL tick must never pretend to delete Storage objects.

## Verification

Anonymous/authenticated configuration, execution and health-read denial; target/fixture guards; bounded work and preserved existing notification behavior; same-offering cohort integrity; health outcomes without payloads; idempotent configuration; exact Cron command and permissions; real scheduled tick after deployment; own-job-only log retention; independent security review and clean CI.
