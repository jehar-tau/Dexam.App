# D-067 — Dexam App Google sign-in only for listed full-course students

Status: owner direction, 2026-11-06, in chat. Details: `features/F056-app-google-student-login.md`.

## What the owner directed

- **Separate products.** The Dexam App and Dexam Mock Test are separate products with separate logins and separate admins.
- **Who is listed.** Full-course students who paid or hold a membership are added to a Google sign-in list.
- **Who adds and revokes.** Sales and admins add students. Admins revoke.
- **Who gets in.** Only listed students may enter the App with Google.
- **Method.** Reuse the Mock Test Google method.

## What was implemented

- **Separate check.** The App uses its own sign-in check (`claim_app_google_login`). It does not use the Mock Test sign-up, so an unlisted Google account is refused rather than turned into a test-series candidate.
- **Role defaults:**
  - `student_login.approve` goes to `sales` and `elevated_admin`.
  - `student_login.revoke` goes to `elevated_admin` and requires live two-step verification.
- **Separate switch.** `app_google_login_gate` is off by default and is independent of the admissions gate.

## Defaults to confirm

1. An active student membership counts as "paid or membership".
2. Revoking removes Google sign-in only, not course access.
3. Only admins restore a revoked entry.

## Reversibility

- The switch can be turned off.
- Capabilities are removed by deleting their `role_capabilities` rows.
- The list and history are additive, and revocations are kept.
