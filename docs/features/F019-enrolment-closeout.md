# F019 — Enrolment closeout and student work history

Status: Draft — D-032 required; no implementation authorized
Risk: Red

## Purpose

Provide an explicit, scoped, audited end to an active enrolment while preserving the student's permanent identity and other courses. Resolve the gap between current active-only reads and D-018's download opportunity for retained finalized submissions.

## Proposed Option B flow

1. A current authorized Enrolment Operator selects one active enrolment within existing granted scope and reviews its exact student/offering/cohort.
2. Deliberately choose completed or withdrawn, select a symbolic reason and confirm the course-specific access effect. Do not enter sensitive free-text or guess a historical end date.
3. The backend atomically rechecks current person/session/membership/capability/scope and expected enrolment state, records status and current end time, appends attributable history/audit and prevents unused credential reuse. Retrying cannot close a different enrolment or change the effective end time.
4. New academic access/writes stop for that course. Preserve the canonical person, immutable Member ID, existing Auth identity/membership and other enrolments. No suspension restoration or account deletion.
5. If B is approved, the current owning student can view/download finalized submissions and already-published feedback through a bounded read-only archive until 12 months after end, with expiry notice and current authorization. Do not expose lessons/reference materials, unpublished feedback, drafts, other students or the full curriculum through this archive.

## Scope boundaries

No payments/refunds, bulk exports, indefinite portfolios, pause/resume, cohort transfer, reactivation, automatic expiry, backdated/future closure, pre-activation cancellation, curriculum reassignment, real messaging or production. D-031 A's existing teacher review boundary remains unchanged. Existing file-retention rules are not extended; expired/purged files are never promised as recoverable.

## Verification required after approval

Actor/scope/revocation/suspension matrix; canonical identity and other-enrolment invariance; allowed state/expected-state/replay/concurrency; immutable reason/end history; unused token denial; active-only lesson/write denial; own finalized-only archive and published-feedback boundaries; missing/expired/purged objects; current live session checks; expiry notice/download; teacher authority unchanged; responsive confirmation/history/browser flows with fictional fixtures and no credentials or personal data in artifacts.

## Decisions and deferred work

D-032 A/B/C must be selected before implementation. DW-007 and DW-012 track closeout and the download opportunity. Lifecycle expansion and bulk export remain separate even if B is selected. D-018 storage retention and D-005 permanent identity remain authoritative; this draft does not change either.
