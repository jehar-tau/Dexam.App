# Staff security operations — fictional staging

Authority: F015, D-027 Option B, D-028 Option B. No production data or paid service is authorized.

## Normal use

Open `/staff/security` after staff sign-in. Enrol an authenticator deliberately; keep its setup key only in the employee's authenticator, not a ticket, screenshot, chat, or repository. Verify its current code. A separately stored backup authenticator can be enrolled after verification.

Routine sign-out affects the current device. **Sign out all devices** establishes an application session cutoff before requesting provider cleanup. If cleanup fails, previous sessions remain blocked. Sign in again to create a genuinely new session; refreshing an old session does not bypass the cutoff.

The interface prevents final-factor removal for MFA-required authority. Direct provider removal still denies sensitive operations immediately through live session/factor authorization. Role and membership revocations are also checked from current state.

## Employee invitation and forgotten password — fictional local testing

`/staff/employees` requires a currently authorized Elevated Admin with recent MFA. Review canonical-person duplicates deliberately; only `.invalid` employee addresses are accepted. Prepare/deliver into the local capture inbox. Links expire after one hour; inspect uncertain outcomes and cancel before deliberate reissue to the same person and unchanged email. No work role is granted automatically.

Employees open the captured `/staff/activate` link and choose their own password. Activation uses a transient isolated session; links and passwords must never be copied into administrator notes or screenshots.

`/staff/recover` requests recovery to the unchanged established employee email. The response does not confirm account existence. Valid recovery blocks old application sessions before the provider password changes, then advances the cutoff after its confirmed outcome. Existing MFA stays enrolled and must be verified again for sensitive access. Every employee operation also checks its owned live provider session, so a provider-deleted session cannot continue with a still-valid JWT.

If a password update outcome is uncertain, the request remains exclusively `executing` and employee application access remains blocked. **Do not clear it, retry a second password mutation, or treat link expiry as cancellation.** Escalate for a separately recorded owner-approved operational review that proves the external mutation stopped and verifies provider state. No automatic reconciliation or one-person administrative override is provided. This procedure and retention/ownership must be completed before production email activation.

Local acceptance commands (fictional disposable fixtures and exact cleanup only):

```sh
node scripts/staging/verify-local-employee-invitation.mjs --browser
node scripts/staging/verify-local-employee-recovery.mjs
node scripts/staging/verify-local-employee-recovery.mjs --direct-provider-probe
node scripts/staging/verify-local-employee-recovery.mjs --browser
```

Run the local Edge runtime with the ignored local-capture environment file. Never use this configuration on hosted/production services. Real authentication email remains disabled pending its separate launch decision.

## Lost authenticator

1. Confirm the affected canonical employee and authenticator reference outside the application; never request their password or TOTP seed.
2. An Elevated Admin verifies TOTP again and proposes the reset at `/staff/security/recovery`, recording a symbolic reason.
3. A different Elevated Admin verifies TOTP again, reviews the employee and exact factor reference, and approves or rejects. Neither actor can be the target. Both verification and request windows are 15 minutes.
4. Execute the approved reset. The server rechecks both recorded actors and target state, blocks all previous target sessions, deletes only the selected factor using the supported Auth administrator API, and verifies factor absence.
5. The employee signs in again. Sensitive operations require live verified MFA; if no usable factor remains, enrol and verify a replacement. No role is restored or granted by this process.

## Failure and emergency handling

- Pending/approved expiry: do not execute; a fresh reviewed proposal can replace it.
- Executing without a confirmed outcome: refresh the queue first. Resume only while unexpired and both original actors remain currently authorized. Repeated execution does not establish a second cutoff or silently change the approved factor.
- Failed execution: old sessions remain blocked. Review current provider factor state before issuing a new independently approved request.
- Expired executing request: do not edit the database to clear the cutoff, fabricate a successful outcome, or return the target's old tokens. Escalate for a separately recorded owner-approved operational review of the exact request and provider state.
- Fewer than two available Elevated Admins: the normal queue is unavailable. D-008 requires a separately recorded product-owner-approved emergency procedure; there is no one-person browser bypass. No emergency reset is authorized merely by this runbook.
- Never write to provider-owned Auth tables, install Auth triggers, expose service-role keys in the browser, or retain factor setup secrets for recovery.

## Audit evidence

Dexam records minimized reset lifecycle events and durable session invalidation. Supported Auth enrolment, verification, and removal events remain in provider Auth audit logs. Review both sources without copying credential-bearing requests, QR images, codes, or tokens into incident notes. Provider audit storage/retention and production incident ownership must be settled before real-data launch.

## Reproducible local acceptance

Run the local Supabase stack and `pnpm supabase functions serve staff-reset-mfa --no-verify-jwt`, then:

```sh
node scripts/staging/probe-local-mfa-boundary.mjs
node scripts/staging/verify-local-staff-recovery.mjs
STAFF_SECURITY_UI_ACCEPTANCE=true node scripts/staging/verify-local-staff-recovery.mjs
```

Only disposable loopback fixtures are created and explicitly cleaned. The optional visual runner owns a temporary Vite server on port 4187, captures fictional queue screenshots under ignored `test-results/f015-recovery/`, and checks mobile overflow/focus. It never captures an enrolment QR or writes credentials to disk.

The protected staging deployment separately runs the exact-project allowlisted fictional recovery acceptance using job-scoped masked keys. A cleanup failure fails the deployment; investigate before rerunning. No general project selector or production target is permitted.

Source: [Supabase Auth audit event reference](https://supabase.com/docs/guides/auth/audit-logs), reviewed 2026-10-13.
