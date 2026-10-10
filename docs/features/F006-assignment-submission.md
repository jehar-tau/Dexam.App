# F006 — Assignment Definition and Submission

Status: Draft — follows F005 and requires submission-policy decisions
Risk: Red — student work, private uploads, and academic records
Owner: Product owner with Codex engineering support

## Purpose and problem

Dexam currently tracks assignment groups, individual exercises, and each student's status in a wide spreadsheet. The product needs durable assignment definitions linked to curriculum topics, separate per-student assignment records, and private submission attempts that teachers can review without exposing one learner's work to another.

## Users

- Students receiving and submitting assignments
- Teachers reviewing work within an explicit teaching scope
- Authorized academic staff defining and publishing assignments

## User flow

1. Academic staff define an assignment within an assignment group and link it to one or more F005 topics.
2. The assignment records student instructions, required evidence, allowed file types, an optional due date, and an assignment-specific evaluation rubric.
3. The assignment is published to a cohort or explicitly selected students.
4. Each targeted student receives a separate assignment instance; “not given” means no instance exists.
5. The student uploads one or more files, checks the submission, and submits an immutable attempt.
6. The teacher reviews that attempt, requests correction or completes the review.
7. A correction creates another attributable attempt instead of overwriting the original submission.

## In scope

- Reusable assignment groups and assignment definitions
- Many-to-many assignment links to F005 topics
- Cohort or selected-student publication
- Separate per-student assignment instances and statuses
- Multi-file submission attempts for photographed drawing work and documents
- Private storage paths, upload completion checks, and retry-safe finalization
- Assignment-specific evaluation rubric/instructions for human and future AI-assisted review
- Statuses corresponding to the current workflow: assigned, submitted, correction requested, and review completed

## Out of scope

- AI-generated feedback publication
- Teacher voice feedback implementation, covered by F007
- Automatic scoring or ranking
- Plagiarism detection
- Payments, public portfolios, or peer-visible submissions
- Final file-size, file-type, retention, and resubmission limits until approved

## Permissions

- Students can read assignment definitions published to them and access only their own instances, attempts, and files.
- Students cannot change a finalized attempt.
- Teachers can read submissions only through a current explicit assignment to the relevant cohort/student scope.
- Sales and Enrolment Operators cannot access student work.
- Assignment definition and publication require a future approved academic-authoring capability.

## Business rules

- Assignment definition, publication, student instance, submission attempt, and feedback are separate records.
- “Not given” in the legacy tracker maps to no student assignment instance, not a submission status.
- Submitted work is immutable; corrections create a later attempt linked to the prior attempt.
- Required image counts, such as “at least 5,” are structured requirements when practical, not only title text.
- Every published assignment stores or references the evaluation rubric version that applied at publication time.
- File upload is not considered submitted until the trusted backend verifies every referenced private object.

## Interface states

- Loading: assignments or upload state is being verified.
- Empty: no assignments have been published to the student.
- Assigned: requirements are visible and submission can begin.
- Uploading/retry: individual file progress and safe retry are visible.
- Submitted: the attempt is locked and awaiting review.
- Correction requested: teacher feedback is available and a new attempt may be allowed.
- Review complete: final teacher-approved feedback is available.
- Permission denied or expired: protected work is not displayed.

## Data and privacy

- Student work is private educational data stored under opaque object keys.
- Original filenames are normalized and are never used as authorization boundaries.
- The legacy tracker contains student names and comments; it is a reference only and must not be imported directly.
- Retention and deletion require a later explicit policy.

## Analytics events

No personal-data product analytics are authorized yet. Durable domain events may later include assignment published, upload failed, submitted, correction requested, and review completed after F008 approval.

## Security considerations

- Storage and database authorization both recheck current identity, membership, enrolment, and teaching scope.
- Signed file access is short-lived and never grants directory-wide browsing.
- Content type, extension, byte size, object count, and finalized-object ownership are validated server-side.
- Student-supplied files are untrusted and must not execute in the application origin.

## Relevant sources and ADRs

Current decision state: D-013, D-015, and D-016 Option B are approved. The private file rules in D-016 cover staff-provided assignment material only; student submission files require a later policy.

- D-003 role and permission principles
- D-004 identity deduplication and revocation
- D-008 staff authority boundaries
- D-013 coursework hierarchy and versioning (Option B approved 2026-10-10)
- D-015 academic content authoring authority (Option B approved 2026-10-10)
- D-016 staff-provided assignment material policy (Option B approved 2026-10-10)
- [Student Assignment Tracker](https://docs.google.com/spreadsheets/d/17WnwLZjqAyoeANuQIHysIp0ZYNpDbSsF9vB-JDQDLxk/edit)

## Acceptance criteria

- Assignment definitions can link to one or more real curriculum topics without duplicating lesson content.
- Publishing creates separate private student assignment instances.
- A student can upload multiple files and finalize only their own attempt.
- Cross-student, Sales, unassigned-teacher, suspended-person, and ended-enrolment access is denied.
- Finalized attempts cannot be overwritten.
- Correction and resubmission preserve every attempt and its attributable state transition.
- The applicable assignment rubric version remains recoverable for review and audit.

## Verification plan

- Database tests for topic links, publication targeting, statuses, attempt immutability, and resubmission history
- Storage tests for ownership, object verification, short-lived reads, file restrictions, and revocation
- Unit tests for requirement mapping, state presentation, and retry-safe upload finalization
- Browser tests for multi-file upload, submission, correction, resubmission, and mobile behavior

## Open decisions

- Allowed file types, number of files, and size limits
- Default due-date and late-submission behavior
- Who may publish or withdraw assignments
- Resubmission limits and whether review completion can be reopened
- Retention and deletion policy for student work
