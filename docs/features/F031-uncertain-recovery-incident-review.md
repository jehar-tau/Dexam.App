# F031 — Uncertain password-recovery incident review

Status: concrete launch-readiness specification under D-042 A. D-045 awaits an owner choice before new incident authority or implementation. No production approval.

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
