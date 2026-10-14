# F019 — Enrolment closeout and student work history

Status: Implementation authorized — D-032 Option B approved 2026-10-14
Risk: Red

## Purpose

Provide an explicit, scoped, audited end to an active enrolment while preserving the student's permanent identity and other courses. Resolve the gap between current active-only reads and D-018's download opportunity for retained finalized submissions.

## Approved Option B flow

1. A current authorized Enrolment Operator selects one active enrolment within existing granted scope and reviews its exact student/offering/cohort.
2. Deliberately choose completed or withdrawn, select a symbolic reason and confirm the course-specific access effect. Do not enter sensitive free-text or guess a historical end date.
3. The backend atomically rechecks current person/session/membership/capability/scope and expected enrolment state, records status and current end time, appends attributable history/audit and prevents unused credential reuse. Retrying cannot close a different enrolment or change the effective end time.
4. New academic access/writes stop for that course. Preserve the canonical person, immutable Member ID, existing Auth identity/membership and other enrolments. No suspension restoration or account deletion.
5. The current owning student can view/download finalized submissions and published feedback through a bounded read-only archive until 12 months after end, with expiry notice and current authorization. Do not expose lessons/reference materials, unpublished feedback, drafts, other students or the full curriculum through this archive.

## Scope boundaries

No payments/refunds, bulk exports, indefinite portfolios, pause/resume, cohort transfer, reactivation, automatic expiry, backdated/future closure, pre-activation cancellation, curriculum reassignment, real messaging or production. D-031 A's existing teacher review boundary remains unchanged. Existing file-retention rules are not extended; expired/purged files are never promised as recoverable.

## Verification required after approval

Actor/scope/revocation/suspension matrix; canonical identity and other-enrolment invariance; allowed state/expected-state/replay/concurrency; immutable reason/end history; unused token denial; active-only lesson/write denial; own finalized-only archive and published-feedback boundaries; missing/expired/purged objects; current live session checks; expiry notice/download; teacher authority unchanged; responsive confirmation/history/browser flows with fictional fixtures and no credentials or personal data in artifacts.

## Decisions and deferred work

D-032 B is approved. DW-007 and DW-012 track closeout and the download opportunity. Lifecycle expansion and bulk export remain separate scope. D-018 storage retention and D-005 permanent identity remain authoritative.

## Implementation and local evidence

Staff `/staff/enrolment-closeout` uses current offering/global `enrollment.operate` authority, explicit outcome confirmation and exact-request retry semantics. Enrollment locks serialize closeout against submission reservations; a trigger denies late completion/finalization without expanding active coursework policies. Unused activation credentials for the closed course are invalidated; identity, membership and other courses are unchanged.

Student `/student/archive` requires a live owning student session and exposes submitted-before-end attempts, ready nonpurged files and published feedback only. It does not expose lesson/reference content, drafts or unpublished feedback. `student-work-archive-file` checks caller authority before and after signing, verifies the provider token expires within the archive window, and issues download links lasting at most 60 seconds. Previously issued links may survive revocation for that short lifetime; downloaded copies cannot be revoked. Archive end and existing file retention are independent: a purged file cannot be recovered.

Local verification: 232 application tests, 862 database assertions, actual supported Auth/Storage/Edge SDK and Chromium acceptance (`scripts/staging/verify-local-enrollment-closeout.mjs`), concurrent reservation/closeout serialization, late upload/finalization denial, real private-file download, suspension denial, canonical identity/other-course invariance and desktop/mobile visual inspection. Fictional fixtures and private objects were removed, including reconciled failed runs; original test-only trigger flags restored and FK/RLS protections preserved. Independent Codex security review passed after correcting the narrow service-only retention purge exception. No credentials or real personal data enter artifacts.
