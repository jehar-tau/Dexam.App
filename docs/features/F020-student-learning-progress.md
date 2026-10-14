# F020 — Student learning progress

Status: Implementation authorized — D-033 Option B approved 2026-10-14
Risk: Red — student-linked records and course access/retention boundaries

## Purpose

Resolve DW-008's undefined progress semantics without confusing study planning, assignment review, attendance and demonstrated mastery.

## Approved Option B scope

An owning active student can explicitly mark/unmark an assigned published topic as studied. This is a private, self-reported checklist only. No passive reading events, teacher/dashboard access, percentages, grades, streaks, prerequisite enforcement, reminders or automatic course completion. Existing assignment statuses remain independent.

Records belong to an exact enrolment and assigned curriculum topic. Ended courses permit no changes; own checklist reads are limited to the existing 12-month work archive window and do not grant lessons/reference access. Purge identifiable checklist records after that window. No cross-course copying, curriculum reassignment or indefinite portfolio promise.

## Required verification if approved

Own current live session/membership, assigned-version/published-topic and active-course checks; cross-student/topic/course denial; explicit unmark and retry behavior; closeout/write serialization; suspension/session revocation; archive expiry and deletion; no staff access or new analytics; clear self-report labels and responsive accessibility. Use fictional local fixtures only.

## Decision and deferred boundaries

D-033 Option B is approved. Teacher-verification/reporting, learning analytics, curriculum migration and production remain separately gated; D-031 A is unchanged.

## Implementation and verification

Student `/student/study-checklist` requires a real live student session (no preview bypass) and presents exact enrolment/topic marks. Marking is explicit and retry-safe; undo deletes the current record without keeping passive engagement history. The mark RPC acquires the enrolment share lock before current ownership/membership/active-course/exact published curriculum checks, serializing with F019 closeout. No direct browser table grants or staff read authority exist.

The curated archive reader provides topic labels/current mark only through the existing 12-month own-course window, never lessons/reference bodies. Expired marks become unreadable immediately. A service-only bounded purge is integrated into the existing submission-retention worker; physical deletion occurs on its next successful maintenance run. Production scheduler/monitoring and retention ownership remain launch gates, not enabled by this fictional/local slice.

Verified 237 application tests, 898 database assertions, actual Auth/SDK/Chromium mark/undo, concurrent closeout serialization, post-closeout write denial, membership denial, archive expiry and bounded purge. Desktop/mobile views inspected. Disposable fictional fixtures/private objects/audit removed; corrected dependency ordering and reconciled the failed test fixture, with original trigger flags restored and FK/RLS maintained. Browser regressions and independent review are recorded in the pull request.
