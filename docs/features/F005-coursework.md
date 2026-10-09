# F005 — Coursework

Status: Implemented locally — product-owner interface approved 2026-10-10
Risk: Red — student-visible learning access and long-lived academic content
Owner: Product owner with Codex engineering support

## Purpose and problem

An enrolled student needs a clear place to find the learning material included in their Dexam offering. Dexam also needs to revise a course over time without silently changing the historical curriculum of an existing cohort or tying lifelong identity to one course structure.

## Users

- Students browsing coursework assigned through a current enrolment
- Teachers viewing the curriculum for their assigned offering or cohort
- Authorized academic staff preparing and publishing curriculum versions

## User flow

1. Authorized academic staff prepare a draft curriculum for an existing offering.
2. They organize ordered subject areas, topics, and optional lesson content, then publish an immutable curriculum version.
3. A cohort, or a cohort-free enrolment, is assigned one published version.
4. An active enrolled student opens their workspace and selects the offering.
5. The student sees only the published subject areas, topics, and lessons included in their assigned version.
6. A later curriculum revision creates a new version rather than silently rewriting the version already assigned to learners.

## In scope

- A versioned curriculum attached to the existing F004 offering
- Ordered curriculum sections such as Drawing and Aptitude, with ordered topics and optional lessons
- Student browsing of published lesson titles, summaries, and text-first content
- Assignment of one published curriculum version to a cohort or cohort-free enrolment
- Student-own read boundaries; assigned-teacher access remains a later teacher-workspace slice
- Draft, published, and retired curriculum lifecycle
- Loading, empty, unavailable, and access-denied interface states

## Out of scope

- Assignment definitions, topic links, submissions, grading, feedback, and resubmission
- Completion tracking, percentages, streaks, grades, or progress calculations
- Live class scheduling, attendance, or notifications
- Video hosting, private downloadable assets, ebooks, or a block-based content editor
- Programs, departments, semesters, credits, or institutional transcript structures
- Public course discovery, payments, and entitlements
- Moving an existing learner to a different curriculum version without a separately approved migration workflow

## Permissions

- Students can read only published coursework assigned through their own currently active enrolment.
- A suspended person or inactive student membership is denied on the next request.
- Teachers can read only curricula in a current explicit teaching scope; teacher assignment implementation may be a later slice.
- Sales and Enrolment Operators do not receive lesson content merely through their operational roles.
- Curriculum mutation remains trusted-backend only until an academic-authoring role and interface are approved.

## Business rules

- The existing offering remains the product a student joins; a curriculum version describes the learning content delivered for it.
- Published versions are immutable. Corrections create a new draft version and an explicit replacement decision.
- Section, topic, and lesson order is explicit and stable within a version.
- A topic is a reusable curriculum concept, not a student progress field. Assignments may later link to one or more topics without being stored inside lesson content.
- A cohort can reference only a published curriculum version belonging to the same offering.
- A cohort-free active enrolment can reference only a published version belonging to its offering.
- Archived or draft content never appears to students.
- Access to coursework comes from the current enrolment and curriculum assignment, not from knowing a lesson URL.

## Interface states

- Loading: current curriculum and topics are being retrieved.
- Empty: the enrolment is active but no curriculum version is assigned yet.
- Success: the student sees the assigned curriculum, ordered subject areas, topics, and available lessons.
- Unavailable: the curriculum was retired or the enrolment ended.
- Error/retry: content could not be verified or loaded; no partial private content is displayed.
- Permission denied: the current identity or enrolment does not authorize the requested lesson.

## Data and privacy

- Coursework contains academic content and stable record IDs, not copied student contact details.
- Reading a lesson does not yet create analytics or progress records.
- Author and publisher attribution is retained for auditability, without exposing private employee details to students.
- Text-first lesson content remains portable; private media storage is deferred.

## Analytics events

No lesson-view or engagement analytics are authorized in this slice. Events should be added only alongside an approved progress or product-intelligence policy.

## Security considerations

- RLS must derive student access from the current person, membership, enrolment, offering, and assigned published curriculum version.
- Direct lesson IDs cannot bypass enrolment or current-state checks.
- Browser clients cannot publish or mutate coursework.
- Cross-student data is not needed for student coursework reads.
- Published content uses a safe rendering pipeline; stored text cannot execute arbitrary HTML or script.

## Relevant sources and ADRs

- D-004 identity deduplication and access revocation
- D-005 lifelong member architecture
- D-009 offering, cohort, and enrolment structure
- D-013 coursework hierarchy and curriculum versioning (Option B approved 2026-10-10)

## Product source sheets

- [Class Scheduling and Topics](https://docs.google.com/spreadsheets/d/1RnxD8er9tjilJ_zDHHkYzaKS50-j3x6MoKI5YNHlKbE/edit) — current Drawing and Aptitude topics plus detailed Drawing descriptions
- [Student Assignment Tracker](https://docs.google.com/spreadsheets/d/17WnwLZjqAyoeANuQIHysIp0ZYNpDbSsF9vB-JDQDLxk/edit) — assignment groups, assignment titles, and legacy per-student workflow states

The source sheets are read-only product references. Existing student-name columns and comments are not authorized for direct import. Production migration requires a separate privacy-reviewed mapping and cleanup step.

## Acceptance criteria

- A student with a current active enrolment can browse only the published curriculum sections, topics, and lessons assigned to that enrolment context.
- A student cannot read draft, unassigned, cross-offering, or another learner's exceptional curriculum assignment.
- Suspension or enrolment termination denies the next coursework request.
- Publishing a new version does not change existing assigned learners automatically.
- Cohort and curriculum version must belong to the same offering.
- Browser clients cannot publish, reorder, or edit academic content.
- Empty, loading, retry, and access-denied states are understandable and responsive.

## Verification plan

- Database tests for version lifecycle, same-offering constraints, assignment, and immutability
- RLS tests for own-enrolment reads, draft denial, cross-offering denial, suspension, and ended enrolments
- Unit tests for safe response mapping and ordered section/topic/lesson rendering
- Browser tests for student curriculum browsing, empty state, direct unauthorized URL, and mobile layout
- Safe-rendering tests proving lesson content cannot execute scripts

## Implementation evidence — 2026-10-10

- Added draft, published, and retired curriculum versions with ordered sections, topics, and optional lessons.
- Added immutable publication and immutable cohort/cohort-free enrolment assignment guards.
- Added same-offering foreign keys and current-state student RLS derived from identity, membership, active enrolment, active offering, cohort, and assigned version.
- Added the protected `/student/coursework` browser with explicit fictional preview data sourced from the approved Drawing/Aptitude structure.
- Verified safe text rendering, loading/error/empty states, topic browsing, direct-route authentication, and responsive desktop/mobile layouts.
- Complete local checks: 149 database tests, 52 unit/component tests, and 13 Chromium browser journeys.

## Open decisions

- D-013 Option B approved on 2026-10-10
- Who receives the future academic-authoring capability
- Lesson release scheduling and prerequisites
- Progress definition and completion evidence
- Media and downloadable-asset policy
