# F056 — Dexam App Google sign-in for listed full-course students

Status: owner-directed 2026-11-06 (D-067). Implemented locally on `feature/app-google-student-login`, stacked on F055/F054. Not merged, not deployed. The App switch is off by default. Risk: Red, because it touches authentication and access.

## Owner direction (D-067)

- **Separate products.** The Dexam App (for full-course students) and Dexam Mock Test are different products, with separate logins controlled by separate admins.
- **Who is on the list.** Students who paid for the course or hold a membership are added to a Google sign-in list. Sales and App admins add them; App admins can revoke.
- **Who gets in.** Only listed students can enter the App with Google.
- **Method.** Reuse the Google sign-in method already designed for Mock Test (F039/D-058): Supabase's Google provider with `openid email profile`.

## Behaviour

- **Adding a student.**
  - Sales or an App admin finds a _current_ student (active student membership) and adds the Google email the student will use, with a reason.
  - The email is trimmed and lower-cased only; dots and plus tags are kept.
  - One approved email per student. A different email needs an admin to revoke the first one.
  - An email listed for one person cannot be listed for another.
- **Signing in to the App with Google.**
  - The App calls `claim_app_google_login`. It links the verified Google account to the listed student's existing record, keeping their Member ID, and lets them in.
  - Current staff whose employee email is approved also continue to work.
  - Everyone else is refused and signed out. **An App sign-in never creates a Mock Test candidate**; Mock Test keeps its own `provision_google_candidate` sign-up.
- **Revoking (App admins only, with two-step verification).**
  - The list entry becomes _revoked_. The Google account is unlinked and all of its sessions are cut off immediately.
  - The student's Member ID sign-in and their course access stay as they are. Course access is revoked separately in Admissions.
- **Restoring.** Only an App admin can restore a revoked entry. Sales cannot undo an admin's revocation.
- **History.** Every add, revoke and restore is recorded with who did it, when and why.
- **Switch.** `app_google_login_gate` is separate from the admissions gate and defaults to **off**. The Google button also needs `VITE_ENABLE_SHARED_GOOGLE_LOGIN=true`.
- **Where to find it.**
  - Sales portal: **Google sign-in list** at `/staff/google-access`.
  - Admin portal: **Google sign-in list** at `/admin/google-access`.

## Defaults chosen (confirm or change)

1. "Paid or membership" is interpreted as an **active student membership**. Recording the payment stays with admins (F054 Admissions).
2. **Revoke removes Google sign-in only**, not course access.
3. **Restoring is admin-only.**

## Limits

- **Real Google sign-in needs a Google OAuth client.** It is the same client Mock Test is waiting for (F039 "To switch Google on locally"). Until then, the claim is proven with simulated verified Google identities.
- **Mock Test sign-ups with the same Google account.** If a student already signed up to Mock Test with that account, the App refuses it for admin identity review rather than merging the two accounts (D-065). See DW-052.

## Acceptance evidence (local, fictional)

- **Database.** pgTAP `00540_app_google_student_list` has 35 checks. They cover:
  - Sales add, and retries are idempotent; Sales cannot revoke or restore.
  - Teachers, former students and Mock Test candidates are refused.
  - The listed student enters with their existing person record.
  - Unlisted and Mock Test Google accounts are refused, and no candidate is created.
  - Revoking with a stale view is refused.
  - Revocation ends the old session and refuses a fresh sign-in.
  - Revocation without two-step verification is refused.
  - History is recorded.
- **Existing tests.** The existing claim test `00520` still passes.
- **App tests.** Unit tests for the service and the App callback, and component tests for Sales and admin use.
