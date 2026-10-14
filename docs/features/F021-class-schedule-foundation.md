# F021 — Class schedule foundation

Status: Implementation authorized — D-034 Option B approved 2026-10-14
Risk: Red — staff authority, student visibility, time-based state and linked retention

## Purpose

Provide the authoritative scheduling domain needed by the owner's class scheduled/rescheduled/cancelled alert request, tracked in DW-022. Reuse F008's durable outbox; do not make notifications the class record.

## Approved Option B scope

Offering-scoped Ordinary Admin scheduling capability; one-off offering/cohort sessions with title, explicit start/end/timezone and optional plain-text location. A current owning active student can see only their course/cohort agenda. Scheduling, rescheduling and cancellation produce attributable revision history and generic in-app alerts with current-authorization destinations, duplicate suppression and obsolete-revision checks.

No teacher capability expansion (D-031 A), roster, attendance, recurring timetable, generated meetings/external links, reminders, external calendar/messages, backdated import, course reactivation or production. Proposed session/history retention is 12 months after the latest scheduled end or cancellation time, whichever is later, followed by governed deletion. Student course closeout ends schedule access immediately and never extends that retention. Existing inbox retention is independent. These rules are proposed, not approved.

## Required verification if approved

Current actor/session/membership/scope and student active-course/cohort boundaries; cross-offering/student denial; end after start and explicit timezone/DST; confirmed cancellation/history; stale-request and duplicate event handling; transaction/outbox integrity; obsolete alert suppression; closeout/revocation effects; retention/deletion; accessible desktop/mobile staff form and student agenda. Fictional/local fixtures only.

## Open decision

D-034 B is approved. Other options are retained in the ADR for history only. No production, external delivery or broader teacher authority is approved.

## Engineering sequence

1. Add the scoped session/revision ledger, exact-request operations, current student agenda reads and bounded retention functions; test the full permission/time/replay matrix.
2. Integrate revision-aware delivery with the existing outbox/worker without changing assignment/CRM notifications. Never interpret a class ID as an assignment instance.
3. Build staff scheduling and student agenda using pinned shared components, then test real fictional SDK/browser flows, concurrent changes, closeout/revocation, obsolete alerts and retention.
4. Obtain independent security review, run all checks, create/merge the PR automatically when clean, and verify protected fictional staging.
