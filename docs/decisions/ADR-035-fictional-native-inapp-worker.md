# D-035 — Native fictional in-app worker

Status: Engineering implementation choice within approved D-002/D-021/D-034 scope, 2026-10-14

Use Supabase native `pg_cron` to execute bounded existing SQL notification work once per minute in fictional staging. This supplies background delivery for already-approved in-app alerts; it does not add reminders, another channel, staff access, a paid plan or production.

Migration adds service-only tick/health/configuration functions but schedules nothing. Protected bootstrap validates the exact fictional project URL/reference before calling configuration; the database also requires the known fictional offering/student markers. These markers are safety checks, not cryptographic proof of a project: the trusted server-side target guard remains essential. Cron commands contain function names/limits only, never service keys.

Keep one private health row with timestamps/counts/SQLSTATE, not recipient IDs, titles, content or credentials. Keep only this job's run logs for seven days. Local tests roll back schedule configuration; hosted acceptance must observe a real scheduled tick. Disabling this named job is reversible without deleting unrelated jobs or its extension.

The hosted Free project can pause, and workload shares its existing capacity. No additional vendor is introduced; this is not a guarantee that arbitrary future scale is free. Production capacity, maintenance ownership and escalation remain launch gates.

Sources: [Supabase Cron](https://supabase.com/docs/guides/cron), [Cron quickstart](https://supabase.com/docs/guides/cron/quickstart). Supabase's SQL Management API is experimental; avoid relying on it for steady-state delivery or new token permissions. Configuration uses the already trusted protected service-client bootstrap.
