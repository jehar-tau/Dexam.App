# DECISION REQUIRED — D-034

Status: Option B approved 2026-10-14

## Question

Should the next slice provide a class schedule and in-app schedule-change alerts?

## Why this needs your decision

DW-022 preserves the owner's request for class scheduled/rescheduled/cancelled notifications. F008's outbox exists, but a notification cannot be the source of truth for a class. Scheduling also introduces staff authority, a student-visible calendar and new records; those rules need approval. D-031 A remains the teacher-review-only decision.

## Options

### A — Defer class scheduling

Keep current coursework, assignments, feedback and notifications; staff communicate class changes elsewhere. ₹0 extra vendor spending for fictional/local work and smallest scope, but no class schedule in Dexam. Reversible through later approval.

### B — Scoped staff scheduling and student agenda (recommended)

An Ordinary Admin with an explicit offering-scoped scheduling capability creates one-off classes for an offering or its cohort, changes their time or cancels them. Students view an agenda only for their own active course/cohort. Display title, start/end time with explicit timezone and optional plain-text classroom/location; no meeting creation or external join-link integration. Record changes transactionally and produce generic in-app scheduled/rescheduled/cancelled alerts that open the currently authorized schedule, suppressing obsolete revisions and duplicate delivery. Cancellation never deletes history. No teacher permissions, roster exposure, attendance, recurring series, advance reminders, external calendar/email/push or production. ₹0 extra vendor spending on the existing stack for fictional/local work; more authorization, time/DST and stale-event tests. Reverting UI exposure is possible; historical changes remain attributable.

Proposed retention: retain each session and its attributable change history for 12 months after its latest scheduled end or cancellation time, whichever is later, then delete the session/history through governed cleanup. A student's course closeout ends schedule access immediately; it does not extend schedule retention. Existing 12-month inbox retention applies independently. Production notice, operational scheduling and retention ownership remain launch gates.

### C — Broader teaching operations discovery first

First define teacher scheduling authority, recurring timetables, attendance, rosters, makeup classes and reminder rules. This needs explicit privacy/teacher-authority decisions beyond D-031 A; no implementation yet. ₹0 extra vendor spending for discovery but larger scope and more owner decisions.

## Recommendation

B addresses the requested class-change use case using the existing in-app foundation without introducing attendance surveillance, external delivery or new teacher access.

## What can continue while pending

Finish F020 checks/release and low-risk engineering verification. Do not add scheduling records, permissions or class notifications before the owner chooses. No option approves real personal data, production, paid services or another vendor.

## Approved decision

The owner approved Option B on 2026-10-14. Implement only scoped Ordinary Admin one-off scheduling, own-active-course/cohort student agenda and generic in-app revision-aware alerts, with the stated session/history retention. No attendance, recurrence, reminder scheduling, external delivery, teacher authority, production or paid services are approved. F020 protected fictional staging release `38517869882` passed before this slice.
