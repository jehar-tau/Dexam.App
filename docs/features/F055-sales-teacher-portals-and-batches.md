# F055 — Sales and Teacher portals, batch creation and placement

Status: owner-directed 2026-11-06 (D-066). Implemented locally on `feature/sales-teacher-portals-batches`, stacked on F054. Not merged, not deployed. Risk: Red, because it changes roles, permissions and student data visibility.

## Owner direction (D-066)

- **Portals.** The staff entrance becomes the **Sales portal**. It holds CRM, CRM assignment, Handoffs, Enrolments, Batches and Course closeout. The **Teacher portal** holds Reviews (filterable by batch), Content, Distribution, Batches (placement only), Classes and Curriculum preview. **Privacy** moves to the **Admin portal**.
- **Who creates batches.** Sales create batches per course, service type and start date. Elevated Admins can too. Teachers cannot.
- **Who places students.** Both Sales and teachers can place students into batches or move them. Teachers can only do this within their course scope. Every move is recorded with its reason, the previous batch and who made it.
- **Service types.** End-to-end learning, Crash course, Portfolio, and Interview preparation. Each has a default duration that pre-fills the end date, and Sales can edit it per batch.
- **What students see.** Students see the batch name only, never its start or end date.

## Design

- **Batches are the existing `cohorts`.** Cohorts gain `service_type`, `created_by_person_id` and `revision`. New batches pin the course's latest published curriculum if one exists.
- **Capabilities.**
  - `batch.manage` (create/edit) is a role default for `sales` and `elevated_admin`.
  - `batch.assign` (place/move) is a role default for `sales`, `teacher` and `elevated_admin`. It follows the teacher's existing global or course scope.
  - No individual grants were created.
- **RPCs.** `get_batch_workspace`, `list_batch_students`, `save_batch` and `assign_student_batch`. All are security-definer, re-check authority after their writes, and are idempotent per request key. Optimistic checks are made against the batch revision and the student's current batch.
- **History.** `cohort_change_history` and `cohort_assignment_history` are private. The browser has no grants on them.
- **Effect on admissions.** A placement bumps the F054 access-window revision so stale admissions editors refresh. Access dates and state are unchanged.
- **Curriculum rule.** This is the same rule as the F054 admin batch transfer.
  - A student whose curriculum is pinned through a batch can only move to a batch with the same curriculum.
  - An enrolment with its own directly pinned curriculum cannot be moved here; an admin migration is required. The UI says so.
- **Hiding dates from students.** The `cohorts` SELECT grant is now column-level and excludes `starts_at`/`ends_at` for every browser role. Staff read dates only through the batch RPCs.
- **Review queue.** `list_feedback_review_queue` adds `batch_name`. The queue gets a Batch filter.
- **Admin entrance for privacy operators.** The Admin portal now also opens for privacy operators. They see only Privacy. Every admin tool keeps its own capability, MFA and server checks.
- **Route compatibility.** Legacy `/staff/assignments`, `/staff/classes` and `/staff/curriculum-impact` now render with the Teacher presentation, and `/staff/crm/privacy` with the Admin presentation. Old links keep working with their original guards.
- **Assignment-completion notifications.** These already exist (`submission_ready_for_review` to reviewing teachers) and are unchanged.

## Placeholders and limits

- **Default durations are placeholders until the owner confirms them:** end-to-end 365 days, crash course 45, portfolio 90, interview 30. They only pre-fill the end date.
- **Batch availability.** "According to availability" is handled by Sales choosing dates. Seat capacity or limits are not modelled (DW-049).
- **Upcoming batches at conversion.** The enrolment handoff still lists only batches that have already started. Upcoming batches are filled from the Batches page after conversion (DW-050).
- **Changing default durations.** There is no screen yet; it needs a migration (DW-051).

## Acceptance evidence (local, fictional)

- **Database.** pgTAP `00530_batch_management` has 38 checks:
  - Sales create, edit, retry idempotently, and are refused on stale or invalid input.
  - Teachers cannot create, and a scoped teacher can move a student.
  - Teachers of other courses, unrelated employees, students and anonymous users are denied.
  - Students read the batch name but are denied its dates.
  - History is recorded, and curriculum is preserved.
  - The full suite passes on a clean reset: 54 files, 1,664 checks.
- **App tests.** Unit tests for the batch service, component tests for the Batches page in both portals, the review batch filter, and the portal split and access rules.
