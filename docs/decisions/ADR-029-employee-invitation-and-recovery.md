# Decision required — D-029: Employee invitation and password recovery

Status: Decision required — recommended Option B
Date: 2026-10-13
Risk: Red — staff identity, account activation, password recovery, and email delivery

## Question

Should we implement employee invitation and password recovery with free local email capture first, or activate real outbound email now?

## Why this needs your decision

F015 provides live MFA and session safeguards. The next identity slice changes who may invite an employee, how that employee proves email ownership, and how a forgotten password is recovered. These are product/security rules, not routine engineering choices. Your standing PR merge authorization does not silently approve a new recovery policy.

Supabase's default hosted mail service is restricted to project-team addresses and is not intended for production. Real invitations need a separately configured delivery service and sender ownership. We can develop and test the entire flow locally without paying or emailing real people.

## Options

### A — Activate real email delivery now

Select an SMTP service, verify an owner-controlled sending domain, configure delivery, and test with explicitly authorized real recipients before releasing invitations.

- Impact: Real employee onboarding becomes possible sooner, but adds sender ownership, delivery monitoring, privacy, and operational responsibility now.
- Cost: Not estimated or authorized yet; provider, domain ownership, volume, and any upgrade must be separately confirmed.
- Risk: Authentication emails are security-sensitive; production access remains blocked even if mail works.
- Reversibility: Providers can change, but delivery mistakes and sent messages cannot be recalled.

### B — Build the free fictional/local workflow first (recommended)

Build F016 under these boundaries:

1. Only a current global Elevated Admin with recent live MFA may issue an employee invitation. Sales, Teachers, ordinary operational Admins, and public users cannot invite staff.
2. The issuer must select or deliberately create the canonical employee after duplicate review. Existing verified email/Auth links must be reused or rejected, never silently overwritten. A matching name alone must not merge people.
3. Invite-only activation proves control of the intended individual email before enabling employee access. The employee sets their own password; administrators never see or choose it.
4. Ordinary role assignment remains explicit and separately audited under D-008. An invitation cannot grant Elevated Admin authority, restore suspended staff, alter an established verified email, or widen the issuer's own authority.
5. Password recovery uses a generic response, a bounded single-use expiring link sent only to the unchanged established email, abuse throttling, and durable old-session invalidation. Password recovery must not remove or bypass MFA, restore suspension, or grant permissions.
6. Use the local Supabase email-capture inbox for fictional end-to-end tests. Hosted real email delivery remains disabled/fail-closed until sender/provider approval; do not add real people to the Supabase project team just to bypass its mail restriction.
7. Lost-email/contact replacement and assisted password recovery remain unavailable until a separate evidence/escalation decision. The already-approved two-person MFA reset remains separate.

- Impact: Delivers a testable onboarding/recovery experience without pretending that real email delivery is ready.
- Cost: ₹0 additional vendor spend for local development; no SMTP purchase or production activation.
- Risk: Red-risk identity workflow with isolated fictional tests, no real recipients, and no recovery-contact bypass.
- Reversibility: The delivery adapter can later use approved SMTP without redesigning identity or permissions. Activation of that adapter is a later gate.

### C — Defer employee onboarding and build student recovery next

- Impact: Student recovery progresses first, but staff accounts still need controlled developer provisioning.
- Cost: Fictional/local work can remain free; real student delivery still needs its own policy/provider decision.
- Risk: Student evidence and assisted recovery rules need another red-risk feature decision before implementation.
- Reversibility: A sequence change, not an architecture commitment.

## Recommendation

Choose B. It follows the approved staff-first sequence, preserves the free-first constraint, and keeps email delivery separate from identity authority. It authorizes fictional/local implementation only—not paid services, real employee invitations, sender DNS changes, or production.

## What can continue while pending

Complete F015 verification and operational documentation. Prepare the F016 specification and test plan, but do not implement invitation/recovery permissions or send authentication emails until this gate is approved.

## Sources

- [Supabase custom SMTP restrictions and sender configuration](https://supabase.com/docs/guides/auth/auth-smtp), reviewed 2026-10-13.
- F001, D-004, D-006, D-008, D-027, D-028, and DW-002.
