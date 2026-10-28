# ADR-058 — Google-only public sign-up (D-058)

Status: Approved by the product owner on 2026-10-28 (Option A).

## Context

Test-series candidates (F039) sign in with Google, so Supabase Auth must allow new accounts. Today `auth.enable_signup = false` blocks every new account.

The email provider has to stay on, because staff and students sign in with it. Switching sign-up on without a guard would therefore also let anyone create an email/password or phone account.

## Decision

Switch public sign-up on, and install a Supabase **before-user-created** hook, `public.hook_before_user_created`. It allows:

- **Google sign-ups**;
- **staff invitations:** the email account behind a staff-approved employee invitation that is being delivered (`employee_invitations.status = 'delivering'`, unbound, not expired).

It rejects every other new account with HTTP 403.

## Evidence

The rule was proven on a throwaway local Supabase stack (GoTrue v2.197) with sign-up and the hook switched on:

| Path                                                                                    | Result                             |
| --------------------------------------------------------------------------------------- | ---------------------------------- |
| Public email sign-up                                                                    | Rejected 403                       |
| Public phone sign-up                                                                    | Rejected                           |
| `auth.admin.createUser` (student activation, fixtures, verification scripts)            | Allowed: does not trigger the hook |
| `auth.admin.generateLink({type: 'invite'})` with a delivering invitation for that email | Allowed                            |
| The same without an invitation                                                          | Rejected 403                       |

The invite event is identical to a public email sign-up (same provider, no `invited_at`, and user metadata can be set by the public), so only server-side invitation state can tell them apart. Google sign-up cannot be exercised without an OAuth client; `supabase/tests/00430_google_only_signup_hook.test.sql` covers the rule.

## Consequences

- **Local:** `config.toml` switches sign-up and the hook on. The Google provider stays off until the owner's OAuth client is configured.
- **Staging (owner instruction: prove there first):**
  1. After the migration is deployed, switch the hook on first, then sign-up, in the staging Auth settings.
  2. Probe that public email sign-up is rejected, a service-role user can still be created, and an invite without an invitation is rejected.
  3. Rerun the protected deployment so its fixture and account checks run with the hook on.
- **Residual risk:** while an invitation is being delivered, someone who knows that exact staff email could create an unconfirmed email account. They cannot confirm a `.invalid` address. Invitation binding checks that the account belongs to the invitation, so the attempt grants no access. This is accepted and recorded here.
- **Reversibility:** switching sign-up off (or disabling the hook) restores today's behaviour without a migration.
