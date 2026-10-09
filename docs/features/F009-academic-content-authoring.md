# F009 — Academic Content Authoring

Status: Implemented locally — awaiting product-owner visual approval
Risk: Red — staff authority, published academic content, and private files
Owner: Product owner with Codex engineering support

## Purpose and problem

The product owner and future authorized academic staff need to change curriculum material and manage assignments without asking engineering to edit the database. Students must continue to see only deliberately published, assigned versions; routine editing must never silently rewrite historical learning content.

## Users

- Product owner managing and publishing Dexam academic content
- Authorized content editors working within explicitly granted offerings
- Authorized content publishers reviewing and releasing immutable versions

## User flow

1. An authorized editor opens the staff Content workspace and chooses an offering.
2. They create a blank draft or copy an existing published curriculum into a new draft version.
3. They add, reorder, edit, or remove draft sections, topics, lessons, and lesson material.
4. They create assignment groups and assignment drafts, link each assignment to one or more topics, and add structured instructions and evaluation criteria.
5. If D-016 permits it, they attach validated private assignment files.
6. They preview the exact student-facing curriculum/assignment content.
7. An authorized publisher supplies a release note and publishes the immutable version.
8. Assigning or migrating that version to cohorts/students remains a separate deliberate operation.

## First implementation slice

- Staff Content workspace protected by current employee status and explicit capability
- Offering and curriculum-version list
- Create a blank draft or copy a published curriculum into a new draft
- Edit draft curriculum title, sections, topics, lessons, summaries, and text-first lesson bodies
- Reorder draft sections, topics, and lessons
- Preview the student-facing result
- Publish through a dedicated audited action rather than generic browser updates
- Assignment groups and draft assignment definitions linked many-to-many with topics
- Structured assignment instructions and versioned evaluation rubric
- Private staff-provided assignment material uploads only if D-016 approves them

## Later slices

- Assignment publication to cohorts or selected students
- Due dates, late policy, withdrawals, and per-student instances
- Student submissions, corrections, and resubmissions
- Teacher review, voice feedback, and human-approved AI drafts
- Curriculum migration for learners already pinned to another published version

## Permissions

- Draft mutation and publication are separate capabilities governed by D-015.
- Draft editors can access only explicitly granted offering scopes unless they hold a separately granted global capability.
- Publishers can review and publish only within their current capability scope.
- Sales and Enrolment Operators receive no content mutation or private assignment-file access through their operational roles.
- Students never receive staff workspace access and cannot read drafts.
- Suspension, employee-membership end, role revocation, or capability revocation blocks the next protected request.

## Business rules

- Published curriculum and assignment versions are immutable.
- Editing a published item starts a new draft version; it never edits the published row in place.
- Publication requires a preview and release note and records the publishing person and time.
- Draft copies retain lineage to the source version for auditability.
- Assignments link to one or more topics instead of being embedded in lesson text.
- Assignment instructions remain text-first even when files are attached.
- Publication does not automatically migrate existing cohorts or distribute an assignment to students.

## Interface states

- Loading, empty, error/retry, and permission-denied states
- No draft yet, editing draft, unsaved changes, saving, save failed, and saved
- Preview exactly as student
- Publish confirmation showing the immutable effect and release note
- File absent, validating, uploading, upload failed, attached, and removal pending
- Conflict state if a draft changed elsewhere after the editor loaded it

## Data and privacy

- Curriculum text and assignment definitions contain no student personal data.
- Staff-provided files are private and use opaque object paths rather than original names for authorization.
- Existing student names/comments from source sheets remain reference-only and are not imported.
- Every publish operation and material attachment change is attributable.

## Acceptance criteria

- An authorized editor can manage draft material through the app without database access.
- An editor cannot change a published curriculum or assignment in place.
- An unauthorized, suspended, revoked, Sales, or student account cannot read or mutate the workspace.
- A publisher can preview and publish only within their authorized scope.
- A new published version does not silently change existing cohort/student assignments.
- Assignment definitions can link to multiple topics and recover the rubric/material version that was published.
- File restrictions and private access match D-016 if uploads are enabled.

## Verification plan

- Database tests for scoped editor/publisher allow and deny cases, revocation, immutability, lineage, topic links, and audit records
- Storage tests for bucket privacy, file validation, draft-only attachment changes, and revocation
- Unit tests for safe mapping, optimistic concurrency, unsaved state, and validation
- Browser tests for copying a version, editing material, linking an assignment, previewing, publishing, access denial, and mobile layout
- Product-owner visual approval before merge

## Open decisions

- D-015 academic content authoring and publishing authority (Option B approved 2026-10-10)
- D-016 staff-provided assignment-material file policy (Option B approved 2026-10-10)
- Assignment distribution, due dates, late behavior, and withdrawal policy in a later F006 slice
- Existing-learner curriculum migration workflow
