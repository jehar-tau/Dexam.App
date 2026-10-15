# Fictional backup/restore rehearsal plan

Status: specification under F028 / D-042 A; execution awaits D-043. No production recovery policy or backup provider is selected.

## Outcome

Demonstrate that an isolated copy can recover both application records and actual file bytes, preserve access boundaries, and avoid exposing data erased after the backup. A successful fictional exercise does not establish production RPO/RTO, off-site durability or provider-managed Auth recovery.

Initial launch planning is up to 50 students. The product owner leads support/incidents and Rohin is backup. Neither this document nor the exercise provisions either person or changes recovery authority.

## Isolation contract

- Use a separately created disposable local source and destination, exclusively fictional fixtures. Do not dump the existing developer database, hosted staging or any production account. Verify exact local container/project identities and distinct ports before writing.
- Create the source from committed migrations and explicit synthetic fixtures. Record commit and migration versions. Capture only the disposable source, with a unique run identifier.
- Keep outgoing delivery, scheduled jobs and provider-backed AI disabled. Block non-loopback destinations in the runner; fail closed on ambiguous identities or occupied resources.
- Put temporary backup material outside Git in a restricted run directory. Logs contain only stage results, counts and timings; never credentials, file contents, session tokens or recovery packs. Clean up only resources recorded as owned by this run; preserve diagnostic state safely if ownership is uncertain.
- No reset, deletion, stop or port takeover of existing development services. If resources cannot coexist locally, report the limitation without using the existing database as a shortcut.

## Capture inventory

| Layer               | Proposed rehearsal evidence                                                                                                                                                                      | Limitation                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Application DB      | Schema/version plus fictional enrolment, published coursework, release, submission and feedback records; constraints and RLS retained                                                            | An app-only export is not a full provider-managed project backup                                                                                                        |
| Private files       | Inventory every bucket created by the migrations; include lesson files, assignment materials, submissions and teacher audio; record bucket/path, byte length and SHA-256 in the private manifest | SQL metadata is not the object bytes; missing or changed bytes fail recovery                                                                                            |
| Auth and roles      | Recreate disposable fixture identities through supported APIs and explicitly validate restored identity mappings/authority                                                                       | This deliberately does not claim restoration of production password hashes, sessions or MFA factors; supported full Auth recovery remains a separate launch requirement |
| Configuration       | Record non-secret versions and required configuration names; use fresh local fixture credentials                                                                                                 | Secret custody, encryption keys and off-site restoration remain untested                                                                                                |
| Post-backup changes | Separate fictional erasure/expiry/revocation evidence newer than the backup                                                                                                                      | Production needs a durable, independently recoverable source of this evidence; the same stale backup cannot supply it                                                   |

The implementation must discover all current file references from migrations, rather than treating the examples as an exhaustive bucket list. Use supported Storage operations to restore bytes; do not insert provider Storage metadata as a substitute for uploading objects.

## Exercise sequence

1. Create source fixtures: active student, another student, scoped teacher, revoked staff, published lesson/material, finalized submission and published feedback/audio. Verify initial positive and negative access through the app's normal APIs.
2. Quiesce writes in the disposable source. Capture application records and a complete byte manifest at a recorded boundary; reject incomplete exports. This is a controlled consistency exercise, not a design for live concurrent backups.
3. After capture, erase a fictional CRM subject through the existing approved workflow, revoke a fixture's access and advance an expiry case using supported fixture setup. Preserve the newer minimized reconciliation evidence separately. Do not invent a generalized production deletion executor.
4. Recover into the distinct, initially empty local destination using supported tooling. Recreate fixture Auth identities explicitly and account for changed IDs; a skipped mapping is a failed test, not a silent repair.
5. Keep access closed while applying newer deletion/expiry/revocation evidence under existing rules. If those rules cannot safely reconcile a restored record, report a launch blocker; do not expose that record or improvise an administrative bypass.
6. Verify exact file hashes and ordinary API visibility: intended active student can read permitted work, other student cannot, revoked staff remain denied, expired/erased records stay unavailable, and unpublished feedback stays private. Verify actual file bytes, not just row counts.
7. Record capture/recovery durations, missing references, byte totals, authorization results and gaps. Remove only owned disposable resources and verify cleanup. Report each result as pass/fail/not exercised.

## Required failure cases

- Missing object, corrupt bytes, mismatched migration version and incomplete manifest each block acceptance.
- Missing newer erasure/revocation evidence prevents opening access; a stale snapshot is not authoritative current policy.
- Interrupted restore can be discarded and retried in a fresh owned destination; it never overwrites the source or a shared target.
- Unexpected remote URL, source/destination equality, conflicting resource identity and unknown cleanup target each abort before mutation.
- A cleanup failure is surfaced without broad deletion or secret-bearing debug output.

## Acceptance and remaining production work

Deliver a repeatable guarded local command, focused guard/failure tests, and a sanitized evidence report for the exact commit. Independently review the recovery and isolation boundaries before merge. No numerical service promise follows from one laptop run.

Production still needs a separately approved supported Auth/project recovery procedure, encrypted off-site DB and object copies, custody/key recovery, retention and erasure handling, continuous-write consistency, independent post-backup tombstone/revocation durability, measured production-sized timing, budget and explicit activation. Proposed 24-hour data-loss/four-hour restoration targets in `LAUNCH_PLAN.md` remain unaccepted discussion targets.
