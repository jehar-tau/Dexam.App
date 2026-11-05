# D-065 — Shared admissions, Google identity claims and bounded coaching access

Status: owner-directed scope approved 2026-11-05 in the supplied implementation brief. Local implementation in progress, not deployed. Risk Red. No new Dexam backend/project, production activation, real identity migration, invitations or live provider changes are authorized.

## Approved direction

One persistent canonical admissions/student directory in the existing Dexam database, shared by currently authorized administrators. No separate lists and no automatic creation/promotion of three administrators. Students and staff (teachers/Sales included) can use Google, but verified login alone grants no coaching/staff/admin authority. Preserve Member IDs, internal person IDs, existing passwords/recovery/MFA/session fences and the approved public candidate level.

Admissions explicitly choose student login email, offering/programme, batch, access start/expiry and a manual payment confirmation. Cash, online transfer and card-machine receipt records do not depend on Razorpay. Duration presets are 48/24/12 calendar months or exactly 30 days, with actual dates/timezone reviewed before save. Delivery-batch dates and access validity remain separate.

Admin-reviewed changes include non-identity details, dates, renewal, suspension/revocation and recorded batch transitions, with reasons, optimistic revisions and actor attribution. Financial records are append-only; a payment receipt is not a gateway capture event or a calculated full-payment claim. Do not infer instalment/default/discount/refund/backdating policies. An email edit must never relink ownership; verified email replacement retains existing higher-risk/two-person controls.

## Required engineering boundaries

- Dedicated normalized student login reservation, unique across canonical people, distinct from guardian/billing/enquiry contacts. Trim/case comparison only; preserve dots/plus tags. Serialize concurrent admissions/claims. Existing or ambiguous candidate/employee/legacy identities require deliberate resolution, not auto-merge.
- Verified Google provider evidence and owned live session before claiming an admin-reserved identity. Resolve approved claims **before** candidate provisioning. No user-editable profile claim, email text, route role, unconfirmed address or OAuth login alone can grant a membership/role.
- Keep current capability/scope/recent-MFA checks. Teacher/Sales retain their existing boundaries. No role grants are implied by admissions permission. Multi-role navigation uses one canonical identity without manufacturing roles.
- A transactional admission operation commits identity choice, receipt, enrolment/access and audit together, with request identity binding and no partial activation. Expected revisions prevent stale edits; payment corrections/history are never overwritten.
- Central database `[start, expiry)` and suspension/revocation checks on every academic/derived-test operation, independent of Cron. Preserve independently purchased/free assessment rights under their own rules and bounded own-work archive access; do not turn membership alone into perpetual coaching access.
- A transfer records delivery-group history and preserves pinned curriculum/assignment history and validity dates. Renewal is an explicit audited action, not an implicit side effect of transfer or payment.
- Existing signed bearer links cannot be made immediately revocable by merely checking before signing. Protected content needs authenticated retrieval checks rather than exposing long-lived bearer URLs. Before any live rollout, drain previously issued URLs within their documented maximum lifetime; do not rotate live provider credentials or move/delete content as an improvised revocation mechanism. Previously downloaded bytes cannot be recalled.

## Remaining policy question

The owner was asked whether automatic access expiry anchors the existing 12-month finalized-own-work/published-feedback archive at that expiry timestamp, or whether archive eligibility still requires explicit manual course closeout. This affects archive metadata/access, not physical retention. Do not enable scheduled-expiry archive behavior before the answer is recorded. Default access start, instalment/refund/discount/backdating policy, contact replacement and legacy identity migration remain unassumed; explicit reviewed dates and existing guards must be retained.

## Activation boundary

Implement and test with fictional people/accounts/payments. No production, real import/migration, live OAuth setting, additional secret, new Supabase project or real invitation is authorized. Inspect current environment/provider evidence before configuring a future environment. Use only openid/email/profile scopes and exact origins; production must not inherit local nonce-skip settings. Elements/cross-origin session integration is not assumed.

F054 records the implementation sequence, acceptance and limitations. D-056's complete applicable pre-push gate and independent/Claude security review remain mandatory. This direction supersedes the narrow F039 candidate-only no-coaching-link default only through a separately verified claim flow; the old default stays until that implementation passes acceptance.
