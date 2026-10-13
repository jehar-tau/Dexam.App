# Decision required — D-028: MFA enforcement boundary

Status: Approved — Option B
Date: 2026-10-13
Risk: Red — MFA removal, session validity, and high-privilege recovery

The product owner explicitly approved Option B on 2026-10-13. The interface retains a last-factor guard; the server guarantee is live-state denial of sensitive privileges after factor/session removal. This supersedes D-027's literal provider-side deletion prohibition.

## Question

Should Dexam strictly prevent deletion of the final authenticator by extending provider-owned Auth tables, or enforce immediate loss of application privileges if a factor is removed through the provider API?

## Evidence and reason for a decision

D-027 Option B promised to prevent removal of the final verified factor while MFA-required authority remains assigned. Hiding a button does not enforce this rule: Supabase exposes authenticated self-service factor removal separately from Dexam's interface.

The committed local probe creates one disposable Auth user on a loopback URL, confirms public signup is rejected, enrols and verifies TOTP to `aal2`, calls the standard self-service removal API, checks the factor list, and deletes the fixture account. With Supabase CLI 2.118.0 and the running local Auth service on 2026-10-13, it reported `directFinalFactorRemovalAllowed=true` and `remainingFactors=0`. No credential, seed, code, token, or personal data was printed or retained.

Existing capability checks validate the JWT's `aal` claim. Supabase documents that access tokens may remain valid until expiry after session termination. The next safeguards must therefore check live session/factor state and explicitly test old tokens; a browser redirect alone is insufficient.

This decision changes either the approved final-factor policy or the architecture's relationship with provider-owned authentication tables. It is not a routine PR approval.

## Options

### A — Strict prevention with custom provider-table enforcement

Prototype a transactional database guard on provider-owned factor storage, linked to Dexam's capabilities and independently approved recovery operations. The final-factor deletion must be rejected across direct API and administrator paths except for the explicitly authorized recovery case.

- Preserves D-027's literal prohibition.
- Adds tight coupling to Auth migrations, provider transactions, and factor/session internals. Concurrent deletion, provider upgrades, account teardown, administrator recovery, and failure recovery all require compatibility testing before adoption.
- No extra subscription is proposed, but the maintenance burden is higher. Successful support/compatibility validation is a prerequisite, not assumed.

### B — Immediate privilege loss with live enforcement (recommended)

Keep the Dexam interface's last-factor guard, but revise the server guarantee: any provider-side factor removal causes sensitive Dexam operations to fail until a currently verified factor and a valid live `aal2` session exist again. Enforce that in database authorization and trusted server operations by checking live session/factor state in addition to the JWT. Perform recovery through the supported administrator API after independent approval, with explicit application session invalidation and audit evidence.

- Protects access even when the provider permits a direct removal request.
- Uses provider-owned tables only as a narrowly scoped read source; avoids custom triggers that can interfere with Auth writes.
- Changes the policy from preventing every deletion to preventing continued sensitive access after deletion. Staff must re-enrol and verify before regaining sensitive access.
- Requires direct API, stale-token, refresh, concurrency, revocation, role-removal, and recovery tests. No paid plan or provider is proposed.

## Recommendation

Choose B. The important security outcome is that a removed authenticator cannot leave usable high-privilege access behind. Live authorization checks protect that outcome while keeping Auth writes on supported provider APIs. The interface still prevents accidental final-factor removal.

## Work while pending

Option B is approved. Continue F015 using read-only live provider metadata checks and supported provider mutation APIs. Recovery, audit, and revocation remain implementation work rather than a pending policy choice.

## Implementation evidence

Migration `20261013150000` adds a narrowly scoped boolean RPC and updates the existing capability helper in place. Sensitive access requires an `aal2` token plus an owned, unexpired live `aal2` session associated with a verified TOTP factor owned by that user. No provider-owned table or trigger is modified. Browser MFA state uses the same RPC before reporting verified assurance.

The disposable local Auth probe reached verified `aal2`, confirmed live assurance, removed its final factor through the supported self-service API, and replayed the original token. Live MFA changed from true to false; the fixture account was removed. Database regressions cover missing/malformed sessions, wrong owners, session downgrade/expiry/deletion, unverified/deleted factors, and loss of sensitive capability with an unchanged role and stale JWT.

## Sources

- Supabase self-service factor removal: https://supabase.com/docs/reference/javascript/auth-mfa-unenroll
- Supabase session lifetime and termination: https://supabase.com/docs/guides/auth/sessions
- Supabase user/session checks: https://supabase.com/docs/guides/auth/managing-user-data
- Supabase administrator factor deletion: https://supabase.com/docs/reference/javascript/auth-admin-deletefactor
