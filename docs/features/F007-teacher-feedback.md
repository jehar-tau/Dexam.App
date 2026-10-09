# F007 — Teacher Feedback

Status: Approved direction — implementation not started
Risk: Red — educational evaluation, biometric-adjacent audio, and AI-assisted decisions
Owner: Product owner with Codex engineering support

## Purpose and problem

Teachers need to review student submissions and return useful feedback efficiently. Dexam requires recorded voice feedback and may use AI to prepare assignment-specific feedback for a manually selected batch of students. AI must follow the rubric for that assignment and remain under accountable human control.

## Users

- Teachers reviewing assigned student work
- Students receiving approved feedback
- Authorized academic staff configuring assignment rubrics and initiating approved bulk AI assistance

## User flow

### Human voice feedback

1. A scoped teacher opens a submitted attempt.
2. The teacher records or uploads a voice note and may add written feedback.
3. The system verifies and stores the private audio object.
4. The teacher explicitly publishes the feedback.
5. Only the student who owns the submission can play the published voice note.

### AI-assisted bulk feedback

1. An authorized teacher selects one assignment and a bounded cohort/student set with submitted work.
2. The system resolves the immutable assignment rubric/instructions applicable to those submissions.
3. The teacher manually starts an asynchronous batch.
4. AI produces a separate draft for each submission with evidence references and an uncertainty or failure state.
5. A teacher reviews, edits, records voice if desired, and approves each result before the student can see it.
6. The final feedback records the human approver, rubric version, AI run metadata, and released content.

## In scope

- Private teacher voice notes attached to a specific submission attempt
- Optional written feedback
- Draft and published feedback lifecycle
- Assignment-specific evaluation rubrics/instructions with immutable versions
- Manually triggered, bounded AI-feedback batches
- Per-student AI draft state, failure/retry state, and human approval
- Attribution and audit evidence without storing hidden reasoning

## Out of scope

- Automatically publishing AI feedback to students
- AI determining grades, admission, suspension, or other consequential outcomes
- Continuous background evaluation of every upload
- Student voice collection
- Voice cloning, emotion inference, biometric identification, or teacher-performance scoring
- Selecting an AI vendor or incurring paid usage before a separate technical/cost approval

## Permissions

- Teachers can review only submissions inside their current teaching scope.
- Students can read or play only feedback published for their own submission.
- Starting a bulk AI batch requires an explicit capability and a bounded assignment/cohort selection.
- AI outputs grant no authority; only a current authorized teacher can publish feedback.
- Sales, Enrolment Operators, and unrelated teachers cannot access submissions, audio, rubrics, or drafts.

## Business rules

- Voice notes and AI drafts belong to one immutable submission attempt.
- Feedback can be saved as a draft without student visibility.
- Publication is an explicit attributable action.
- Each assignment has a versioned rubric describing evaluation dimensions, evidence expectations, prohibited assumptions, and feedback style.
- A bulk run cannot mix assignments with different rubrics.
- Partial AI failures do not block completed drafts and never create student-visible partial feedback.
- Editing an AI draft does not erase the fact that AI assistance was used.

## Interface states

- Recording, paused, preview, upload, retry, and ready-to-publish voice states
- AI batch queued, processing, partially completed, failed, cancelled, and ready-for-review states
- Feedback draft, validation, published, and permission-denied states
- Accessible transcript/caption state when an approved transcription path exists

## Data and privacy

- Teacher audio and student work are private educational records.
- Audio uses opaque private-storage keys and short-lived authorized playback URLs.
- AI receives only the minimum submission content and rubric required for the selected task.
- Provider retention, training use, region, deletion, and cost require approval before any external AI integration.
- Hidden model reasoning is not requested or stored; retain output, evidence references, model/config identifier, timestamps, and human disposition.

## Analytics events

No teacher-performance or student-evaluation analytics are authorized. Operational audit events may record recording upload, AI batch start/end, draft generation, human edits, publication, and failure without recording raw audio or submission content in logs.

## Security considerations

- Microphone use begins only after an explicit teacher action and browser permission.
- Audio and submission URLs are short-lived and scoped.
- Uploaded media is validated and served outside executable application content.
- Prompt injection inside student work is treated as untrusted submission content and cannot override the assignment rubric or system policy.
- Bulk selection, rubric version, model/configuration, requester, reviewer, and publication are auditable.

## Relevant sources and ADRs

- D-003 role and permission principles
- D-004 identity deduplication and revocation
- D-008 staff authority boundaries
- D-014 feedback delivery and AI authority (Option B approved 2026-10-10)
- [Student Assignment Tracker](https://docs.google.com/spreadsheets/d/17WnwLZjqAyoeANuQIHysIp0ZYNpDbSsF9vB-JDQDLxk/edit)

## Acceptance criteria

- A scoped teacher can record, preview, replace before publication, and publish a private voice note.
- Only the owning student can play published feedback for their submission.
- A rubric is assignment-specific, versioned, and recoverable for every review.
- A manually started AI batch is limited to one assignment and an explicit student/cohort selection.
- Every AI result remains a draft until an authorized teacher approves it.
- AI failure, timeout, or unsafe output never changes assignment state or exposes partial feedback.
- Suspension or teacher-assignment removal blocks the next protected request.
- Audit evidence distinguishes human-only, AI-assisted, edited, rejected, and published outcomes.

## Verification plan

- Database and storage tests for student ownership, teacher scope, audio privacy, rubric versioning, and publication state
- Unit tests for recording/upload states, AI batch state mapping, and safe failure messages
- Adversarial tests for prompt injection, cross-student access, stale teacher scope, replay, and partial batch failure
- Browser tests for voice recording fallback/upload, teacher approval, student playback, and responsive review flow

## Open decisions

- D-014 Option B approved on 2026-10-10
- Audio format, maximum duration, transcription, retention, and accessibility policy
- Approved AI provider/model, cost ceiling, data-processing terms, region, and retention
- Rubric-authoring authority and approval process
- Whether students see an “AI-assisted” disclosure and how it is worded
