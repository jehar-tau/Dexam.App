# Supabase Staging Advisor Triage

Last reviewed: 2026-10-12
Scope: owner-controlled fictional-only staging project `ienwcencjbgdsqxfyxmj`

## Recorded baseline

The CLI advisor report taken before the hardening migration contained no errors:

| Finding                                    | Level       | Count | Disposition                                     |
| ------------------------------------------ | ----------- | ----: | ----------------------------------------------- |
| Anonymous `SECURITY DEFINER` execution     | Warning     |     3 | Fix now                                         |
| Authenticated `SECURITY DEFINER` execution | Warning     |    83 | 82 intentional; one trigger fixed               |
| Leaked-password protection disabled        | Warning     |     1 | Accepted on free staging; production gate       |
| Multiple permissive policies               | Warning     |    10 | Accepted and monitored                          |
| RLS enabled with no policy                 | Information |    21 | Intentional deny-by-default tables              |
| Unindexed foreign keys                     | Information |    72 | Defer until query/load evidence                 |
| Unused indexes                             | Information |    50 | No action on a new low-traffic staging database |

Security contained 21 informational findings and 87 warnings. Performance contained 122 informational findings and 10 warnings. Counts are observations, not a permanent allowlist: the deployment gate evaluates the finding type and severity rather than accepting a fixed total.

## Fix-now findings

`current_person_id`, `current_person_is_active`, and the `sync_crm_privacy_lifecycle` trigger function inherited anonymous execution. The first two returned only `null` or `false` without a session, and PostgREST could not invoke the trigger function as a normal RPC, but none needed anonymous authority.

Migration `20261012120000_database_advisor_hardening.sql`:

- removes `PUBLIC` and `anon` execution from every existing public-schema function;
- restores anonymous execution only for `platform_health`, which returns the constant `ok` and reads no data;
- removes direct authenticated execution from the CRM trigger function;
- changes future `postgres`-owned public functions to deny `PUBLIC`, `anon`, and `authenticated` execution until a migration grants the intended role explicitly.

The pgTAP suite now proves those boundaries and proves that every public `SECURITY DEFINER` function pins an empty `search_path`.

## Intentionally authenticated privileged functions

The pre-fix report contained 83 authenticated `SECURITY DEFINER` findings. A comparison against versioned grants found that 82 are explicitly granted to `authenticated`; these are the app's guarded RPC or RLS-helper surface. The only finding without an explicit authenticated grant was `sync_crm_privacy_lifecycle`, which inherited access and is fixed by this slice.

The remaining authenticated functions are intentional only with their existing current-person, current-membership, ownership, scope, capability, and MFA checks. Their positive and denial paths remain covered by the feature-specific pgTAP files. A callable privileged function is not accepted merely because an older finding existed; every new function still requires an explicit grant and relevant authorization tests.

## Accepted or deferred findings

- **Leaked-password protection:** Supabase exposes this feature only on paid plans. D-026 authorizes free staging, so the warning is accepted for fictional accounts with generated credentials. It remains a production launch gate alongside MFA, recovery, session revocation, and the final security review.
- **Multiple permissive policies:** the 10 warnings are overlapping `SELECT` paths for academic/content tables. They deliberately separate student enrolment, teaching, content-authoring, publishing, and enrolment-operator access. Combining them now would increase authorization-change risk for negligible benefit at staging scale. Revisit with query plans and production-like load before launch.
- **RLS with no policy:** these 21 tables are deliberately inaccessible through direct browser table access and are reached only through guarded RPCs, trusted workers, or triggers. Adding permissive policies would weaken the design.
- **Unindexed foreign keys:** review when representative data volume and slow-query evidence exist. Add indexes only for real lookup/delete paths, with migration and query-plan evidence.
- **Unused indexes:** staging has just been created and has synthetic low-volume traffic, so usage statistics cannot justify removal. Reassess after representative workload and statistics retention.

## Continuing gate

Every protected staging deployment captures fresh security and performance advisor JSON after migrations. `scripts/staging/validate-advisor-findings.mjs` prints only grouped counts and blocks deployment on:

- any error-level advisor finding;
- anonymous `SECURITY DEFINER` execution;
- anonymous Auth being enabled;
- mutable function search paths;
- an RLS policy on an RLS-disabled table; or
- a public-schema table with RLS disabled.

The full raw report remains ephemeral in the job and is deleted before the job exits. It contains schema metadata rather than application records, but retaining unnecessary deployment artifacts is still avoided.
