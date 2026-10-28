# ADR-058 — Google-only public sign-up (D-058)

Status: Approved by the product owner on 2026-10-28 (Option A). Live on staging since 2026-10-28; see "Staging evidence".

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
- **Done on staging on 2026-10-28:** see "Staging evidence" below.
- **Residual risk:** while an invitation is being delivered, someone who knows that exact staff email could create an unconfirmed email account. They cannot confirm a `.invalid` address. Invitation binding checks that the account belongs to the invitation, so the attempt grants no access. This is accepted and recorded here.
- **Reversibility:** switching sign-up off (or disabling the hook) restores today's behaviour without a migration.

## Staging evidence (2026-10-28)

1. **Migration:** PR #99 merged as `4e364002deadf47824a8b1eea7d9c309c15273b4`. Protected deployment run `40647447243` applied `20261028050000_google_only_signup_hook.sql`, and the remote migration state lists it.
2. **Auth settings before the change:**
   - `disable_signup: true`;
   - email provider on; phone, anonymous and Google off;
   - before-user-created hook off.
3. **Order of the change:** both changes were made through the Supabase Management API, using the owner's Keychain CLI token; no key was printed or stored.
   - The hook was switched on first (`pg-functions://postgres/public/hook_before_user_created`), and the response confirmed sign-up was still off.
   - Only then was `disable_signup` set to `false`.
4. **Probe against the hosted project** (keys held in memory only; the one account it created was deleted again):

   | Probe                                                   | Result                                                             |
   | ------------------------------------------------------- | ------------------------------------------------------------------ |
   | Public email sign-up                                    | Refused, 403 "New Dexam accounts can only be created with Google." |
   | Public phone sign-up                                    | Refused, 400 (phone sign-ups disabled)                             |
   | Anonymous sign-in                                       | Refused, 422 (anonymous sign-ins disabled)                         |
   | Service-role `createUser` (the student-activation path) | Allowed                                                            |
   | `generateLink` invite without an approved invitation    | Refused, 403                                                       |

5. **Protected deployment rerun with the hook on:** run `40649476005` (manual `deploy` on `main`) succeeded. Every step passed: migrations, the database advisor gate, Edge Function deployment, the fictional fixture bootstrap (service-role account creation), hosted synthetic authorization checks, and the fictional staff MFA recovery probe.
6. **Auth settings after the change:**
   - `disable_signup: false`;
   - hook on, with the URI above;
   - email provider on; phone, anonymous and Google off.

**Not exercised on staging:**

- **A real staff invite with a delivering invitation.** It needs a fresh staff session with MFA; it was proven on the throwaway local stack and in pgTAP `00430`.
- **Google sign-up.** It waits for the owner's OAuth client; the staging redirect URL `https://dexam-staging.pages.dev/tests/welcome` must also be added then.
