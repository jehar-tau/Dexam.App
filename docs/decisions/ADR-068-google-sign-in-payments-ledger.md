# D-068 — Google sign-in for everyone, admin-managed courses and fees, and a payment ledger

Status: owner direction, 2026-11-06, in chat. Details: `features/F057-google-sign-in-courses-payments.md`.

## What the owner directed

- **Sign-in.** Google sign-in for everyone: students, Sales, Teachers and Admins. For now only Google emails sign in; this can change later. A staff member signs in when their Google email is the email Dexam already holds for them.
- **Two-step verification.** Removed for staff; simple Google sign-in instead.
- **Approvals.** A single admin is enough for sensitive actions.
- **Courses.** The admin portal lists every course. Admins add courses and decide each course's length and fees, and can change them.
- **Mock Test and Dexam App.** The same Google account is used for both products, with access controlled separately by what the student paid for. The Mock Test tabs in the student portal will open directly, without a second sign-in.
- **Payments.** Payments are taken by card machine, local QR/UPI and other means, at different times: an admission fee (for example ₹5,000 or ₹10,000), the year's fee once classes start, and the balance in later years. Each payment is recorded with a receipt, transaction ID, amount and who took it (a dropdown of Sales and Admin staff). Sales and admins record payments. Admins see the whole ledger; Sales see how much each student has paid.
- **Access.** A student can sign in to the Dexam App only once the admission fee is recorded.
- **Sales controls.** Payment-linked: the Google list only works once a payment exists.

## What was implemented

- **Staff security.** A live, provider-recorded Google session (`auth.mfa_amr_claims` = `oauth`, a Google identity on the account, no session cut-off) now satisfies every capability that previously required live TOTP (`current_session_has_live_mfa`). A password session still needs TOTP, so a leaked Dexam password alone cannot reach a sensitive action. Staff are asked to turn on 2-Step Verification in their Google account; Dexam cannot enforce it for personal Google accounts.
- **Google-only sign-in.** When `VITE_ENABLE_SHARED_GOOGLE_LOGIN=true`, the sign-in pages show only Google and the admin menu hides the password-recovery tools. Password sign-in remains in the code and returns with `VITE_ENABLE_PASSWORD_SIGN_IN=true`.
- **Single admin.** No new action needs a second admin. The existing two-person checks remain only inside the password and authenticator recovery tools, which leave the menu while sign-in is Google-only.
- **Courses.** `offerings` gain length, total fee, admission fee and a revision. `course.manage` (Elevated Admin, Google or TOTP session) adds and edits; the code is permanent; a course with open enrolments cannot be archived. A course's length pre-fills new batch end dates ahead of the service-type default.
- **Ledger.** `student_payments` is append-only (a trigger blocks edits and deletes except attaching a receipt once). Methods: cash, UPI/QR, card machine, bank transfer, cheque; a transaction ID is required except for cash. Receipt numbers `DXR-000001…` are generated. Admins record corrections (never below zero) and set a per-student agreed fee. Totals include the gated F054 admission receipts.
- **Visibility.** `payment.record` (Sales, Ordinary Admin, Elevated Admin) records and sees each student's paid total; full details only for payments they recorded. `payment.ledger.read` and `payment.correct` (Elevated Admin, Google or TOTP session) see and correct everything.
- **Receipts.** Private `payment-receipts` bucket (PDF/JPG/PNG/WebP, 5 MB). Only the recorder (within a day) or an admin uploads; a receipt is attached once; only the recorder and admins read it, per request.
- **Access.** `claim_app_google_login` refuses a listed student whose admission fee is not recorded, before the Google account is linked. A course without an admission fee needs any recorded payment. The Mock Test's own sign-up is unchanged.

## Defaults chosen (owner may change)

1. Payments are never edited or deleted; an admin records a correction with a reason.
2. A missed later payment does not lock a student out; admins see the balance and decide.
3. Each course has one admission fee amount; admins can set a different agreed total fee per student.
4. Ordinary Admins may record payments; only Elevated Admins see the full ledger, correct entries and manage courses.

## Reversibility

- `VITE_ENABLE_PASSWORD_SIGN_IN=true` brings password sign-in back; turning Google off restores the earlier pages.
- Restoring TOTP-only staff security is one function change (`current_session_has_live_mfa`).
- Capabilities are removed by deleting their `role_capabilities` rows. The ledger, fee and course history tables are additive.
