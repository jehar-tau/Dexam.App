# Decision required — D-032: Enrolment closeout and past-work access

Status: Awaiting owner decision — no implementation authorized
Date: 2026-10-14
Risk: Red — student access, historical work and retention

## Question

When an Enrolment Operator marks a student's active course completed or withdrawn, what should that student retain access to?

## Evidence and why this needs a decision

F004/D-009 provide lifecycle states and attributable transition history, but DW-007 records the missing closeout workflow and entitlement rules. Current coursework and student-assignment authorization require an active enrolment. D-018 retains finalized submission files for 12 months after enrolment end and requires a download opportunity; storage retention alone does not provide student read access. The permanent Member ID/person is independent of the course under D-005. Ending a course must not delete the account or silently change another enrolment.

This decision deliberately covers manual closeout of an **active** enrolment only. Pause, transfer, automatic expiry, backdated/future changes, cancellation before activation, reactivation/re-enrolment rules, payments/refunds and course-version migration remain separate scope. Teachers retain the existing review queue under D-031 A; no teaching reader/roster is implied.

## Options

### A — Immediate academic lock, with download before closeout

Add scoped, reason-required manual completion/withdrawal. Keep existing active-only academic read rules: ending the enrolment immediately ends its lesson, assignment and feedback access. Require the operator to confirm that the student was given the opportunity to download their submitted work **before** closeout; do not infer that retained files remain readable afterward.

- Impact: Smallest implementation, but staff must arrange the download opportunity before closing the course; no post-course work gallery.
- Cost: ₹0 additional vendor spend for fictional/local work on the current stack; more manual handover/support effort.
- Risk: Students can lose convenient access to past work despite files being retained. No new deletion or Member ID change.
- Reversibility: Add B later while files still exist; already purged files cannot be restored by changing access rules.

### B — End teaching access, retain a bounded private work archive (recommended)

Add the same manual completion/withdrawal workflow plus an owning-student, read-only archive of finalized submissions and already-published feedback for that enrolment, available until 12 months after the recorded end time. Show the expiry date and allow authorized per-file downloads before existing D-018 retention purges the files. No bulk ZIP/export service, public portfolio or indefinite storage.

New lessons/reference materials, assignment distribution, uploads, draft editing and resubmission remain unavailable for the ended course. Keep only the historical assignment labels/metadata needed to identify the student's own work; an archive is not access to the full curriculum. Existing teacher review permissions are unchanged; unfinished drafts are not automatically published, and no new post-course review authority is granted.

Current active person, student membership and live owned session remain required for the archive; suspension cannot be bypassed. Completion/withdrawal is course-specific, not account suspension. Other active enrolments and the permanent Member ID remain unchanged. Historical text/audit is not newly deleted or made public by the archive window; file retention remains D-018.

- Impact: Students can retrieve work after leaving the course; teaching access ends cleanly without treating the app identity as disposable.
- Cost: ₹0 additional vendor spend for fictional/local work using already-retained files; more authorization/UI/testing than A. Existing storage/egress limits still apply; no paid service approved.
- Risk: A new post-course read boundary must be tested against cross-student access, revoked/suspended sessions and expired/purged files.
- Reversibility: Archive UI and future policy can evolve; no new identity or storage provider is needed, and purged files remain unrecoverable.

### C — Specify the full lifecycle now

Extend discovery to pause/resume, cohort transfers, re-enrolment and automatic expiry in addition to closeout. Specify access duration, curriculum/assignment continuity, effective dates, correction authority and notification effects before implementing those business rules.

- Impact: More complete operations, but substantially more product/access decisions before development. Choosing C authorizes discovery, not guessed lifecycle policy.
- Cost: ₹0 additional vendor spend for discovery/local fictional work; significantly more engineering/testing. Real notifications, payments and production remain separate approvals.
- Risk: Larger state space and potential access/history mistakes.
- Reversibility: Modules may be staged; historical transfers or access decisions cannot be undone merely by changing a screen.

## Recommendation

Choose B. It implements the already-approved download opportunity without retaining work indefinitely or extending paid/teaching access. Preserve A/C as alternatives. No option approves real personal data, production, paid services, suspended-access restoration or the deferred teacher reader.

## Proposed common safeguards

Current scoped `enrollment.operate` authority, an explicit completion/withdrawal choice, symbolic reason and deliberate confirmation; backend end time is now (no backdating), immutable history/audit and concurrent-state/replay protection. No account deletion, Member ID change, role/membership grant, other-enrolment mutation, silent outstanding-token reuse or automatic feedback publication. An ended enrolment cannot issue new student credentials or academic access. Detailed specification and tests follow the selected option before implementation acceptance.

No D-032 answer is recorded. Only discovery/documentation may proceed while the choice is pending.
