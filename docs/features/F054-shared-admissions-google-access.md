# F054 — Shared admissions, Google login and time-limited coaching access

Status: D-065 owner-directed scope approved 2026-11-05; implementation active, no runtime/provider/deployment acceptance claimed. Scope is Dexam only, not DesignMocks.

## Existing implementation and gaps

Reuse canonical `people`, immutable Member IDs, `auth_identities`, student/employee/candidate `memberships`, offerings/cohorts/enrolments, transitions, employee invitation/recovery, current live sessions/MFA and scoped capabilities. Existing CRM handoffs deliberately resolve canonical identity before enrolment. Existing commerce stores gateway purchases, not offline coaching receipts; do not silently convert a cash receipt into a Razorpay event.

F039's Google provisioning currently creates a separate public candidate for an unmapped provider account. Approved coaching/staff claims must run first. Existing assessment helpers grant broad coaching rights from active student membership alone; replace that derived privilege with current coaching entitlement while keeping independent purchases/free candidate access. Google credential verification must use trusted provider records, not editable user metadata. Keep the existing live-session, recovery-execution and cutoff logic unchanged or equivalently enforced for new links.

Current lesson/assignment/review downloads expose signed bearer URLs (some lasting 15 minutes). A post-sign authorization check does not revoke those URLs. Full acceptance requires authenticated retrieval per request, expiry checks and no public redirects to bearer tokens, plus a legacy-link drain gate before live rollout. Cache/download limitations must be disclosed honestly.

## Implementation sequence

1. Record the approved boundary; implement shared pure input/date helpers and calendar/leap-boundary tests without activating any new authority.
2. Private normalized login reservations and race-safe directory/read/admission transactions: idempotent manual receipts, explicit enrolment validity, restricted audits, expected revisions and scope/MFA denial. No existing student/account migration.
3. Integrate per-enrolment validity/suspension, renewal/transfer history and all academic/assessment/file read/write checks. Preserve purchases and archive; resolve the expiry/archive anchor question before enabling that path. Deny stale tokens/tabs and direct RPC bypasses; do not depend on a scheduler.
4. Verified Google claim/callback/return for admitted students and invited employees before candidate fallback, retaining old sign-in/recovery, unchanged staff grants and strict MFA. Ambiguous/existing-account conflicts stay blocked for deliberate review. Inspect actual OAuth configuration separately; no live mutation.
5. Discovery directory, filters, admission review, date/payment preview and revision-aware editors. One shared database for all authorized admins; no parallel student list. Show manual versus gateway evidence, explicit timezone, irreversible-history rules, no sensitive card fields and no email-takeover text edit.
6. Fictional integration/security/concurrency, provider-mock/actual-local Auth acceptance, desktop/mobile/dark/keyboard/axe and complete quality gate. Give the owner a concrete local preview and an exact unconfigured/deferred list. Hosted/real acceptance remains a separately authorized release.

## Acceptance matrix

Three distinct authorized administrators share additions/edits; unapproved actors and out-of-scope Teacher/Sales/anon are denied. Sequential/concurrent duplicate email normalizes trim/case only, preserves dots/plus, separates guardian contact, preserves canonical IDs and allows a deliberate new enrolment. Claim races, stale edits and duplicate request retries never overwrite history, grant twice or create extra receipts.

48/24/12 calendar months and exact 30 days include leap years, month-end clamping and explicit timezone; preview is not authority and database recomputes/validates. Start/expiry is `[start, expiry)` even without a worker. Transfer does not restart duration or destroy old coursework links; renewal/suspension/revocation is explicit, reasoned and audited. Manual methods are cash, online transfer or card machine; integer minor-unit amount/date/reference/admin attribution, no full card/PIN/CVV/banking credentials, no invented outstanding-balance calculation.

Google signed/verified subject/email and live session claims the intended person or fails closed. Never automatically merge an existing candidate/person or rewrite an established Auth binding. Returning login, cancel, safe return, signout, old credentials/recovery, employee suspension, MFA and two-person safeguards remain valid. Unknown Google users get at most the existing separately approved candidate experience. Exact callback/environment behavior is tested; no production nonce skip.

Expired/revoked coaching access denies coursework, submissions, relevant files, attendance when implemented, and derived assessment bypasses with an existing session. Separately purchased access survives under its own conditions. Own-work archive is finalized/private/bounded, never lessons or unpublished work. A downloaded copy is outside server revocation; old bearer URLs require drain before rollout.

## Current evidence / not yet implemented

The checkpoint now includes private tables/RPCs, the protected `/admin/admissions` workspace, portal Google callback/buttons (flag off), verified reservation claims, canonical session/recovery fences, academic validity and exact-attempt assessment guards. Mutations remain disabled by `admissions_runtime_gate=false`. This is not a migration-wide feature switch: existing read/auth helpers change when migrations apply. No real account/receipt, provider setting, role grant or hosted deployment exists. Pure input/property and new component/contract tests are included. A prior full verification passed 703 app tests; current publication-gate reruns and review evidence are recorded in the handoff PR.

The isolated two-connection regression passes concurrent normalized-email admission (one receipt) and expiry after a real row-lock wait despite an unrelated purchase. Independent review found and prompted fixes for replay authority after waits, consistent identity lock order, post-lock exact-attempt checks using wall-clock validity and a central payload guard for old mock/live resume paths. This is checkpoint clearance, not completed-feature acceptance. Existing 130 browser journeys pass; dedicated authenticated F054 visual/provider/Storage acceptance remains incomplete. Authenticated file retrieval is not implemented, some assessment signed links last one hour, the automatic-expiry archive anchor is unanswered, and further directory/history/employee integration remains. See `../CLOUD_CODE_HANDOFF.md` for the exact continuation list. Do not merge, deploy or activate this draft as a completed feature.

## Sources

Reviewed 2026-11-05: [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking), [Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). Provider automatic identity linking is not canonical business-person linking; preserve Dexam's explicit evidence and conflict checks.
