# DECISION REQUIRED — D-027

## Question

Which identity-operations slice should Dexam build first now that fictional staging is accepted?

## Why this needs your decision

The remaining identity gaps affect what staff and students experience, who can recover an account, and how high-impact authority is protected. The order also changes cost and launch risk:

- Current staff sign-in works, but password-only sessions remain at `aal1`; privacy and elevated-administration operations deliberately deny those sessions.
- Student recovery, employee invitation/recovery, TOTP MFA, all-device revocation, and two-person approval are all unfinished.
- Supabase TOTP MFA is available on the Free plan, while real employee invitation and email recovery require production-grade custom SMTP rather than Supabase's restricted development mail service.
- Recovery from a lost MFA device is itself a high-impact security action and cannot be implemented as an unreviewed bypass.

## Options

### A — Student recovery first

Build generic Member ID recovery requests, verified-contact self-service when a delivery provider exists, and assisted recovery packs under D-007.

- **Impact:** Students gain a path back into locked accounts sooner.
- **Cost:** Local and staging workflows can remain free, but real self-service delivery still needs a later email or messaging provider decision.
- **Risk:** Existing elevated and privacy operations remain unusable because no staff session can reach `aal2` through the application.
- **Reversibility:** The sequence is reversible, but it postpones the strongest protection for staff authority.

### B — Staff MFA and security revocation first (recommended)

Build the smallest complete high-privilege safety slice:

1. TOTP enrolment by an already authenticated employee, with QR and manual-key alternatives.
2. TOTP challenge after password sign-in whenever an enrolled factor can raise the session from `aal1` to `aal2`.
3. Mandatory enrolment before an employee can use an MFA-required capability; ordinary staff MFA remains optional in this slice.
4. A factor-management screen that requires `aal2`, permits a separately stored backup TOTP factor, and prevents removal of the final verified factor while MFA-required authority remains active.
5. Lost-factor reset through a reason-required request and a different active Elevated Admin's approval. Execution uses the trusted server to delete the factor and globally revoke refresh sessions; the requester cannot approve their own reset.
6. The D-008 recorded product-owner emergency procedure remains the only bootstrap fallback until two active Elevated Admins exist. It is never a hidden browser bypass.
7. Explicit current-device sign-out uses local scope; security-triggered revocation uses global scope while current database-state checks continue to deny stale access tokens immediately.

Do not depend on Supabase's experimental recovery-code API in this slice. Factor reset evidence contains identifiers, reason, actors, timestamps, and outcome, but never a TOTP secret or code. Staging notifications remain in-app/audited; a real outbound notification waits for the employee-email provider decision.

- **Impact:** Unlocks the already-built privacy and elevated boundaries without weakening them and creates the first reusable two-person approval path.
- **Cost:** ₹0 on the current Supabase Free staging project; no SMS, email vendor, or paid plan is required for this slice.
- **Risk:** More security-sensitive than a student-only flow, so factor reset, actor separation, session revocation, and audit tests must fail closed.
- **Reversibility:** UI details can change. The durable rules are MFA for elevated authority, no self-approval, immediate current-state denial, and attributable reset evidence.

### C — Build every remaining identity flow together

Implement student recovery, employee invitation/recovery, MFA, session revocation, and the full elevated-administration interface in one program.

- **Impact:** Produces the broadest identity experience at once.
- **Cost:** Requires an email-provider and production-delivery decision earlier and creates a much larger testing surface.
- **Risk:** Highest scope and review risk; a flaw could span student recovery, staff onboarding, and high privilege simultaneously.
- **Reversibility:** Individual components remain changeable, but the large coupled release is harder to validate and roll back safely.

## Recommendation

Approve Option B. It closes the clearest existing security gap with no new vendor cost, makes current MFA-gated operations genuinely usable, and establishes the approval/revocation primitives that later employee and student recovery can reuse. After this slice, proceed to employee invitation/recovery and then student recovery as separately reviewable vertical slices.

## What can continue while pending

Only documentation, source inspection, and non-mutating technical validation may continue. No MFA, factor-reset, recovery, invitation, or new authority behavior should be implemented before this choice is approved.

Please choose A/B/C or give another direction.

## Sources reviewed

- Supabase TOTP MFA: https://supabase.com/docs/guides/auth/auth-mfa/totp
- Supabase MFA enforcement: https://supabase.com/docs/guides/auth/auth-mfa
- Supabase administrator factor deletion: https://supabase.com/docs/reference/javascript/auth-admin-deletefactor
- Supabase session sign-out scopes: https://supabase.com/docs/reference/javascript/auth-signout
- Supabase custom SMTP limits: https://supabase.com/docs/guides/auth/auth-smtp
- NIST SP 800-63B authenticator event management: https://pages.nist.gov/800-63-4/sp800-63b/events/
