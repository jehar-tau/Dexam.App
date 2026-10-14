# F021 — Class schedule foundation

Status: Implementation authorized — D-034 Option B approved 2026-10-14
Risk: Red — staff authority, student visibility, time-based state and linked retention

## Purpose

Provide the authoritative scheduling domain needed by the owner's class scheduled/rescheduled/cancelled alert request, tracked in DW-022. Reuse F008's durable outbox; do not make notifications the class record.

## Approved Option B scope

Offering-scoped Ordinary Admin scheduling capability; one-off offering/cohort sessions with title, explicit start/end/timezone and optional plain-text location. A current owning active student can see only their course/cohort agenda. Scheduling, rescheduling and cancellation produce attributable revision history and generic in-app alerts with current-authorization destinations, duplicate suppression and obsolete-revision checks.

No teacher capability expansion (D-031 A), roster, attendance, recurring timetable, generated meetings/external links, reminders, external calendar/messages, backdated import, course reactivation or production. Session/history retention is 12 months after the latest scheduled end or cancellation time, whichever is later, followed by governed deletion. Student course closeout ends schedule access immediately and never extends that retention. Existing inbox retention is independent. D-034 B approves this fictional/local scope; production remains gated.

## Required verification if approved

Current actor/session/membership/scope and student active-course/cohort boundaries; cross-offering/student denial; end after start and explicit timezone/DST; confirmed cancellation/history; stale-request and duplicate event handling; transaction/outbox integrity; obsolete alert suppression; closeout/revocation effects; retention/deletion; accessible desktop/mobile staff form and student agenda. Fictional/local fixtures only.

## Open decision

D-034 B is approved. Other options are retained in the ADR for history only. No production, external delivery or broader teacher authority is approved.

## Engineering sequence

1. Add the scoped session/revision ledger, exact-request operations, current student agenda reads and bounded retention functions; test the full permission/time/replay matrix.
2. Integrate revision-aware delivery with the existing outbox/worker without changing assignment/CRM notifications. Never interpret a class ID as an assignment instance.
3. Build staff scheduling and student agenda using pinned shared components, then test real fictional SDK/browser flows, concurrent changes, closeout/revocation, obsolete alerts and retention.
4. Obtain independent security review, run all checks, create/merge the PR automatically when clean, and verify protected fictional staging.

## Implementation and evidence

Staff `/staff/classes` and student `/student/agenda` require real current sessions; preview bypass is disabled. The existing grant-role contract is preserved: a current Ordinary Admin role and explicit `class.schedule` grant must match the offering. No global bypass or automatic teacher capability is added. Scheduling grants are demonstrated only by the explicitly labelled fictional staging Enrolment Operator, using a separate offering-scoped role/grant.

Session changes use expected revision, deliberate confirmation and actor-bound exact-request keys; authority is rechecked after blocking locks. Cancellation cannot reassign audiences or retain ignored arbitrary fields. UTC instants and an explicit display timezone avoid guessing ambiguous local times; the initial form accepts timestamps with a UTC offset. Class location is bounded plain text, never an external join link.

Events remain transactional source facts. Latest-revision alerts use current student/course/cohort eligibility, hide obsolete alerts and cannot restore access after closeout. The worker reserves capacity for existing assignment/CRM events when both queues are eligible; a one-item call chooses the oldest eligible domain. Session locks fail/retry safely against mutation/retention. The existing service-authorized notification maintenance worker performs bounded session/history/event/notification cleanup after retention. Scheduling and monitoring that maintenance before real data remains a production gate.

Verified 241 application tests, 936 DB assertions and 63 Chromium regression journeys. Actual SDK/Chromium acceptance covers scheduling, own agenda, cancellation/current alerts, a writer demonstrably queued on a lock then rejected after grant revocation, closed-course denial, mobile layout and fixture cleanup. The shared local acceptance script also repeats F019/F020 checks. Independent security findings for mixed-role authorization, post-lock revocation, ignored cancellation payload and worker fairness were corrected and cleared. Fictional domain/private-object/Auth fixtures were removed; the interrupted harness run was reconciled using exact fixture IDs. No credentials or real personal data enter artifacts.
