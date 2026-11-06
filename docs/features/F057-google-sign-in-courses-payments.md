# F057 — Google sign-in for everyone, courses and fees, payment ledger

Decision: D-068 (`decisions/ADR-068-google-sign-in-payments-ledger.md`). Branch `feature/google-only-payments-ledger`. Risk: Red (authentication, authorization and money records).

## Scope

1. **Google-only sign-in** for all four portals when Google sign-in is switched on. Password sign-in, activation and password-recovery links are hidden but kept in the code.
2. **Staff security** from Google instead of Dexam's own two-step verification.
3. **Single-admin approval** for every new action.
4. **Courses and fees** in the admin portal: add courses, set length, total fee and admission fee.
5. **Payment ledger** in the Sales portal (record, see totals) and the Admin portal (full ledger, corrections, agreed fees), with private receipts and a "collected by" dropdown.
6. **Admission fee unlocks the Dexam App** for listed students.

## Screens

- Sales portal → **Payments** (`/staff/payments`): find a student, see course fee, paid, balance and admission fee; record a payment (type, amount, date, method, transaction ID, collected by, optional receipt, note).
- Admin portal → **Courses** (`/admin/courses`): add and edit courses.
- Admin portal → **Payment ledger** (`/admin/payments`): all payments with search, plus everything in the Sales view, corrections and agreed fees.
- Google sign-in list shows **Admission fee pending** for a listed student who has not paid.

## Database

Migration `20261107010000_google_sign_in_courses_payments.sql`:

- `current_session_is_google()`; `current_session_has_live_mfa()` accepts a live Google session.
- `offerings`: `duration_days`, `total_fee_paise`, `admission_fee_paise`, `revision`; `offering_change_history`.
- `student_payments` (append-only), `enrollment_fee_agreements`, `enrollment_fee_history`, receipt sequence.
- Capabilities `course.manage`, `payment.record`, `payment.ledger.read`, `payment.correct`.
- RPCs `list_courses`, `save_course`, `list_payment_collectors`, `list_payment_students`, `list_student_payments`, `list_payment_ledger`, `record_student_payment`, `correct_student_payment`, `set_enrollment_fee`, `attach_payment_receipt`.
- Storage bucket `payment-receipts` with insert/read policies.
- `claim_app_google_login` checks the admission fee before linking; `list_student_google_logins` returns `admission_paid`; `get_batch_workspace` returns each course's length; navigation adds `courses`, `payments`, `paymentLedger` (22 keys).

## Evidence

- pgTAP: full suite 1,785 checks pass on a clean reset, including new `00550_google_courses_payments` (staff Google sessions, courses, ledger, visibility, receipts, corrections, append-only, agreed fees) and updated `00540` (unpaid student refused and not linked).
- Real HTTP acceptance on the disposable local stack (29 checks, fictional data, simulated Google provider record): Google admin passes staff security, password-only admin is refused; admin adds a course; unpaid listed student refused before linking; half the admission fee is not enough; UPI payment with receipt upload and attach; another Sales person cannot upload or download it, nor see transaction details; non-receipt file types refused; full admission fee opens the App and the student portal; admin ledger, correction and totals; Sales cannot correct or open the ledger; no direct table reads.
- App: `pnpm verify` (lint, types, 787 unit/component tests, build and bundle budget); 136 Playwright journeys including a new check that Payments and Courses never open from fictional preview.
- Browser: Payments (Sales), Courses and Payment ledger (admin) inspected locally at desktop and phone width; a payment recorded through the form updated the totals; no sideways scroll at 375 px.

## Limits and follow-ups

- Real Google sign-in needs the owner's OAuth test user; the provider's `oauth` session record was simulated locally. Supabase links a Google account to an existing staff account only when the emails match.
- Staff whose Google email differs from their stored email, and new staff, still use the existing invitation flow (DW-055).
- Google-only is enforced in the sign-in screens, not by the server (DW-056).
- The gated F054 admission flow still writes its own receipt table; ledger totals include it (DW-057).
- Mock Test access from the student portal waits on the Mock Test backend (DW-054, DW-052 now decided).
