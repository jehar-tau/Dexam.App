# Decision required — D-030: Student assisted recovery

Status: Approved — Option B
Date: 2026-10-14
Risk: Red — student account takeover and privileged support authority

## Question

Which first student password-recovery workflow should we build after F016?

## Why this needs your decision

D-007 approved layered recovery without mandatory student email/phone. D-008 reserves activated-account assisted recovery for an Elevated Admin with MFA and audit, while contact replacement needs two approvers. Neither decision selected the concrete student recovery interface/evidence workflow or required a second administrator for every ordinary reset. Making that stricter requirement universal is a real operational/product choice, not an engineering detail.

All options preserve the same canonical person, immutable Member ID, claimed Auth account, memberships, and enrolments. Students choose their own passwords; staff cannot view or set them. No option permits Sales/Teachers/Enrolment Operators to reset activated accounts, restores suspended access, changes contacts, collects government identity, or authorizes real personal data/production.

## Options

### A — Single-admin assisted recovery

Build a guided workspace where one current Elevated Admin with recent live MFA checks the canonical Member ID and established enrolment/identity evidence with the student, records only evidence categories/reason, and issues a short-lived single-use recovery pack. The student privately chooses a password; old sessions and outstanding packs are denied.

- Impact: Faster small-team support; remains within D-008's baseline ordinary assisted-recovery authority.
- Cost: ₹0 additional vendor spend for fictional/local implementation; no email/SMS service needed.
- Risk: One mistaken or compromised administrator can authorize takeover; conflict/suspicion must stop the workflow.
- Reversibility: A later independent-approval requirement can be added, but already performed recoveries cannot be undone by changing policy.

### B — Independent approval for every assisted reset (recommended)

Build A with a reason-required proposal reviewed by a different current Elevated Admin. Both use recent live MFA, neither can be the target, and execution rechecks both actors and the same canonical student. No recovery pack is issued before independent approval. The pack is delivered only after the student's identity was verified through established evidence; knowing a Member ID/name alone is insufficient. No mandatory contact collection.

- Impact: Stronger accountability; every recovery needs two available administrators and an extra review step. No one-person fallback is inferred.
- Cost: ₹0 additional vendor spend for fictional/local implementation using the existing approval primitives; more staff review time than A.
- Risk: Slower support when a second administrator is unavailable. An emergency alternative still needs separate owner approval.
- Reversibility: The approval staffing rule can change by later decision; identity continuity, private passwords, session invalidation, and audit remain durable.

### C — Verified-contact self-service plus assisted fallback now

Build optional verified student contact capture/verification, local fictional delivery, and student-controlled reset links, alongside independently approved assisted recovery for students without usable contacts. Email/phone would not become mandatory; existing guardian/shared contacts would not be silently treated as a student's verified personal channel.

- Impact: More convenient future remote recovery, but substantially larger contact, consent, privacy, notification, abuse-control, and support scope now.
- Cost: Fictional/local work can remain ₹0. Real delivery requires a separate provider/sender/volume/cost approval before activation; no real-message budget is authorized here.
- Risk: More recovery/contact states and potential identity confusion; contact replacement remains separately gated under D-007/D-008.
- Reversibility: Adapters can change, but collecting or sending real contact data cannot be recalled. None is authorized by this proposal.

## Recommendation

Choose B. It reuses the proven independent-approval pattern without adding a vendor or mandatory student contact, and reduces single-person recovery mistakes. This intentionally strengthens D-008 for ordinary student assisted recovery, so owner approval is required. Verified-contact self-service remains in DW-001 and can be added later without replacing Member IDs.

## Approval and next work

The product owner approved Option B on 2026-10-14. Implement F017 as a fictional/local independently approved student recovery slice, with tests and independent security review. Finish F016 staging release verification and documentation in parallel. Production delivery, contact replacement, lost-contact evidence, guardian substitution, and uncertain-mutation reconciliation remain separate gates.

No D-030 choice remains pending. Option A/C are recorded alternatives, not authorized scope.

## Sources and existing authority

- D-004, D-006, D-007, D-008, D-027, D-028, DW-001, and `F017-student-assisted-recovery.md`.
- [OWASP Forgot Password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), reviewed 2026-10-14: consistent public responses, bounded single-use proof, private password selection, and session invalidation. The two-admin policy is Dexam's proposed operational choice, not a claim that OWASP mandates it.
