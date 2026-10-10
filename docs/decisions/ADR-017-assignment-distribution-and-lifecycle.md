# ADR-017 — Assignment Distribution and Lifecycle

Status: Option B approved 2026-10-10

## Question

How should an assignment be released to students, how should due dates and late work behave, and when may a student submit a revised attempt?

## Why this needs your decision

These rules directly shape the student and teacher experience. They also determine whether a published content change silently affects existing students, whether a deadline can lock a learner out, and whether earlier work remains trustworthy after a correction.

## Options

### A — Automatic release with one hard-deadline attempt

Publishing an assignment definition immediately gives it to every active student in the selected cohort. A due date is required, work is blocked after the deadline, and each student gets one final submission unless an administrator manually intervenes.

- **Impact:** Simple to explain and build, but content publication and student delivery become one risky action.
- **Cost:** Lowest initial implementation cost.
- **Risk:** High operational risk. An accidental publish reaches students immediately, absences can become support problems, and corrections require exceptional access.
- **Reversibility:** Moderate; separating content versions from releases later requires data migration.

### B — Deliberate scoped release with teacher-authorized revisions (recommended)

Keep content publication and student distribution separate. An offering-scoped staff member with a new `assignment.distribute` capability deliberately releases a published assignment version to a cohort or selected active enrolments. The release pins that assignment version, evaluation-guide version, and attached materials; publishing a newer definition never changes work already given.

Due dates are optional and use the offering's declared timezone. A due date marks later work as late but does not automatically block submission. Authorized staff may close a release when submissions must stop. Students may freely replace files while an attempt is a draft, but final submission locks it. A student receives another attempt only after an authorized teacher requests a correction. Every revision is a new immutable attempt, and repeated correction cycles are allowed when a teacher explicitly requests them. A completed review may be reopened only by an authorized academic staff member with a recorded reason.

Distribution is retry-safe: repeating the same release does not create duplicate student instances. Withdrawing an unreached assignment is allowed with a reason; once a finalized attempt exists, records are closed or voided rather than deleted.

- **Impact:** Matches a coaching workflow, gives staff control, keeps an auditable history, and avoids punishing students automatically for a deadline.
- **Cost:** Moderate implementation: a separate capability, release preview, per-student instances, lifecycle transitions, and audit records.
- **Risk:** Low within the existing current-state authorization model. Late work remains possible, but it is clearly labelled for teachers.
- **Reversibility:** High; stricter deadline or revision rules can be added later without rewriting historical attempts.

### C — Fully configurable scheduling and resubmission rules

Every assignment can configure scheduled release, grace periods, hard or soft deadlines, attempt counts, automatic reopening, and per-student exceptions.

- **Impact:** Maximum flexibility for future operations.
- **Cost:** Highest build, testing, training, and support cost.
- **Risk:** Complex combinations can produce inconsistent student treatment and permission mistakes.
- **Reversibility:** Low once different cohorts depend on many policy combinations.

## Recommendation

Approve Option B. It separates authoring from the consequential act of giving work to students, preserves exactly what each learner received, and supports iterative drawing feedback without silent overwrites. Soft deadlines are more suitable for coaching while still giving teachers a useful late indicator.

## Approval

The product owner approved Option B on 2026-10-10. Dexam will keep content publication separate from deliberate, offering-scoped assignment distribution; use optional soft deadlines; preserve immutable attempts; and allow another attempt only after an authorized correction request. Reopening a completed review requires authorization and a recorded reason.
