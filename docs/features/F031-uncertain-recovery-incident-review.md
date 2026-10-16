# F031 — Uncertain password-recovery incident review

Status: D-045 Option B approved 2026-10-17; fictional/local implementation verified. No production approval.

## Existing behavior and unresolved evidence

Employee and student reset workers commit an exclusive execution claim and session cutoff before changing the provider password. A correctly owned success or explicit rejection can finalize through the existing execution key. A timeout, exception, 408, 5xx or mismatched/missing account response leaves the reset executing. Existing identity/session helpers deny application access while that claim remains. Link expiry is never permission to release it.

An administrator reading the current account, seeing a recent timestamp, or observing a failed sign-in cannot prove a delayed earlier password update has stopped. Do not ask for or store the person's password to investigate. No supported provider cancellation proof has been established by current repository evidence. Any future resolution needs independently reviewed proof appropriate to the deployed provider, current identity/state checks and session invalidation before reopening access.

## Recommended bounded next slice: D-045 B

Build and test a fictional/local incident review workflow that preserves the execution fence. Two distinct eligible Elevated Admins, neither the target, independently inspect the exact recovery request. Both need current authorization and recent MFA; revocation, changed target identity or a changed request invalidates review. Reuse established administrative authority checks rather than adding a broad role or granting accounts through fixtures.

A private incident record references employee/student recovery type, exact request and target identity, current executing state, proposer, independent reviewer, bounded reason code and review timestamps. Display only existing necessary operational identifiers, state, execution-start time and whether the execution fence persists. Never expose execution keys, proofs, action URLs, provider tokens, passwords, email bodies, MFA seeds or raw support payloads. A review acknowledgment does not assert the provider stopped.

Allow one open incident per exact request, idempotent opening/review, independent review of the exact proposal revision, and a bounded administrative queue. Preserve canonical Member IDs, email identity, roles, membership suspension and factors. Neither the review acknowledgment nor closure of the investigation releases the reset or issues another pack. No new provider mutation or provider call occurs in this slice.

The product owner handles incidents with Rohin as backup, as already nominated for planning. Actual eligibility is checked at runtime; nominations do not grant access. Two non-target reviewers may be unavailable when an admin is the target. The workflow must explain the unavailable-review state and keep the fence; it must never add a one-person bypass.

Record only minimized application audit facts. The disposable fictional acceptance removes its exact incident fixtures; production incident/audit retention, support contact channel, coverage, provider evidence handling and an actionable resolution path remain launch gates. Do not attach screenshots, correspondence or personal documents to this slice.

## Acceptance evidence before merge

- Employee/student executing requests appear only to current eligible administrators; students, Sales, Teachers and ordinary operators are denied.
- Proposer, reviewer and target are distinct; recent MFA and target/request binding are checked after locking and after any waits.
- Duplicate/retried opening and review do not duplicate incidents; concurrent reviews cannot change the exact proposal silently.
- Revoked administrators, altered canonical identity and completed/replaced requests invalidate pending review.
- All review/closure operations preserve the executing request and existing session denial; expiry does not change either.
- UI uses existing approved components. Actual fictional SDK/browser acceptance, independent security review and exact fixture cleanup are required.

This makes investigation attributable but does not resolve DW-045 or approve hosted recovery. A later controlled-resolution proposal must specify a verified way to stop outstanding provider operations, evaluate current provider/session state and record independent approval of the exact action before implementation.

## Implementation evidence

The private incident ledger binds source type/request, canonical person/Auth ownership and a private SHA-256 execution fingerprint. Every mutation locks source → target person → incident, then checks current authority and source state. Neither execution keys nor the fingerprint appear in the queue or audit. One immutable proposal per exact request and idempotent review avoid duplicate records/audits. A revoked, changed or stale actor/source blocks further review; re-verifying the original proposing session can refresh MFA, but no replacement session silently rewrites the proposal. Reviewed status is informational and its current-state flag checks both administrators' authority.

`/staff/security/incidents` uses existing security styles/components, recent administrative authority and disabled preview bypass. The existing authorized staff-security navigation flag controls its link. Reads/writes capture the initiating account, hide unverified responses and use per-account query keys with no persistent query cache. The bounded queue returns up to 100 current eligible executing sources. If source eligibility changes, the request leaves this actionable queue; private incident evidence remains available only to the trusted operational data owner, without a new browser forensic/history API. No cancellation, reset, password input, closure or unlock control is added.

`pnpm pilot:recovery-incidents` creates disposable local users through supported Auth APIs, verifies real TOTP, exercises self/target denial, queued-review revocation and real browser independent review at mobile/desktop widths, then cleans exact domain/Auth fixtures. Historical executing requests are privileged synthetic setup; the exercise does not deliberately start an ambiguous real password mutation. Both employee and student execution/session fences are checked afterward. Existing pure provider-outcome/DB tests cover uncertainty semantics separately.

Verification: 312 application tests; 1,140 DB assertions across 37 files; 63 existing Chromium regressions plus the new preview-denial journey; actual SDK/MFA/browser acceptance and independent security review. Formatting, lint, types and build passed, with the existing bundle-size warning. Production incident/audit retention, provider-stop proof, a real resolution path and production activation remain gated.
