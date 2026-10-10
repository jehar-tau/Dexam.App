# F007 — Teacher Feedback

Status: Core implementation verified locally, visually approved, and opened as PR #12
Risk: Red — educational evaluation, biometric-adjacent audio, and AI-assisted decisions
Owner: Product owner with Codex engineering support

## Purpose and problem

Teachers need to review student submissions and return useful feedback efficiently. Dexam requires normal playable voice feedback, speech-to-text dictation that becomes editable writing, and optional AI proofreading of teacher-authored or dictated text. Dexam may also use AI to prepare assignment-specific feedback for a manually selected batch of students. Transcription and AI outputs must remain under accountable human control.

## Users

- Teachers reviewing assigned student work
- Students receiving approved feedback
- Authorized academic staff configuring assignment rubrics and initiating approved bulk AI assistance

## User flow

### Human feedback, voice notes, dictation, and proofreading

1. A scoped teacher opens a submitted attempt.
2. The teacher types feedback, records/uploads a normal voice note, uses speech-to-text dictation, or combines these methods.
3. Dictation produces an editable written draft. Dictation audio remains temporary unless the teacher deliberately keeps it as the normal voice note.
4. The teacher may manually request AI proofreading, compares the original with the suggestion, and accepts, edits, or rejects it.
5. The system verifies and privately stores any deliberately retained voice note.
6. The teacher reviews the complete writing/audio combination and explicitly publishes it.
7. Only the student who owns the submission can read the published writing or play its published voice note.

### AI-assisted bulk feedback

1. An authorized teacher selects one assignment and a bounded cohort/student set with submitted work.
2. The system resolves the immutable assignment rubric/instructions applicable to those submissions.
3. The teacher manually starts an asynchronous batch.
4. AI produces a separate draft for each submission with evidence references and an uncertainty or failure state.
5. A teacher reviews, edits, records voice if desired, and approves each result before the student can see it.
6. The final feedback records the human approver, rubric version, AI run metadata, and released content.

## In scope

- Private teacher voice notes attached to a specific submission attempt
- Speech-to-text teacher dictation that always returns editable draft writing
- Typed or dictated written feedback
- Manually triggered AI proofreading with original/suggestion comparison and teacher acceptance
- Draft and published feedback lifecycle
- Assignment-specific evaluation rubrics/instructions with immutable versions
- Manually triggered, bounded AI-feedback batches
- Per-student AI draft state, failure/retry state, and human approval
- Attribution and audit evidence without storing hidden reasoning

## Out of scope

- Automatically publishing AI feedback to students
- Automatically accepting a transcript or proofreading suggestion
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
- Dictation transcripts and proofreading suggestions remain drafts until accepted by the teacher.
- The original teacher text is preserved when proofreading is requested; AI may improve language but must not invent evaluation content.
- Feedback can be saved as a draft without student visibility.
- Publication is an explicit attributable action.
- Each assignment has a versioned rubric describing evaluation dimensions, evidence expectations, prohibited assumptions, and feedback style.
- A bulk run cannot mix assignments with different rubrics.
- Partial AI failures do not block completed drafts and never create student-visible partial feedback.
- Editing an AI draft does not erase the fact that AI assistance was used.

## Interface states

- Recording, paused, preview, upload, retry, and ready-to-publish voice-note states
- Dictation recording, transcribing, editable transcript, retry, accepted, and discarded states
- Proofreading idle, processing, comparison, accepted, rejected, edited, and failure states
- AI batch queued, processing, partially completed, failed, cancelled, and ready-for-review states
- Feedback draft, validation, published, and permission-denied states
- Written-first accessible presentation with optional playable audio

## Data and privacy

- Teacher audio and student work are private educational records.
- Audio uses opaque private-storage keys and short-lived authorized playback URLs.
- Dictation-only audio is temporary and is purged after acceptance/discard, with a maximum 24-hour cleanup window.
- Proofreading receives only the current teacher-written draft; rubric evaluation receives only the minimum selected submission content and rubric.
- AI receives only the minimum submission content and rubric required for the selected task.
- Provider retention, training use, region, deletion, and cost require approval before any external AI integration.
- Hidden model reasoning is not requested or stored; retain output, evidence references, model/config identifier, timestamps, and human disposition.

## Analytics events

No teacher-performance or student-evaluation analytics are authorized. Operational audit events may record recording upload, dictation request/result state, proofreading request/disposition, AI batch start/end, draft generation, human edits, publication, and failure without recording raw audio, feedback text, or submission content in logs.

## Security considerations

- Microphone use begins only after an explicit teacher action and browser permission.
- Transcription and proofreading require explicit teacher actions and never publish automatically.
- Audio and submission URLs are short-lived and scoped.
- Uploaded media is validated and served outside executable application content.
- Prompt injection inside student work is treated as untrusted submission content and cannot override the assignment rubric or system policy.
- Bulk selection, rubric version, model/configuration, requester, reviewer, and publication are auditable.

## Relevant sources and ADRs

- D-003 role and permission principles
- D-004 identity deduplication and revocation
- D-008 staff authority boundaries
- D-014 feedback delivery and AI authority (Option B approved 2026-10-10)
- D-019 playable voice feedback, speech-to-text, accessible writing, rubric authority, and retention (Option B approved 2026-10-10)
- D-020 transcription/AI provider, proofreading, privacy, disclosure, and cost activation (Option B approved 2026-10-10)
- [Student Assignment Tracker](https://docs.google.com/spreadsheets/d/17WnwLZjqAyoeANuQIHysIp0ZYNpDbSsF9vB-JDQDLxk/edit)

## Acceptance criteria

- A scoped teacher can record, preview, replace before publication, and publish a private voice note.
- Submitted image files appear as compact thumbnails and open in an accessible same-page expanded viewer; other supported files have an in-page document preview with an optional secure original link.
- A scoped teacher can dictate speech into an editable text draft without automatically retaining or publishing the dictation audio.
- A teacher can request proofreading, compare the original and suggestion, and accept, edit, or reject the result without losing the original.
- A teacher can separately dictate and proofread a correction request before explicitly publishing the next-attempt decision.
- Only the owning student can play published feedback for their submission.
- A rubric is assignment-specific, versioned, and recoverable for every review.
- A manually started AI batch is limited to one assignment and an explicit student/cohort selection.
- Every AI result remains a draft until an authorized teacher approves it.
- AI failure, timeout, or unsafe output never changes assignment state or exposes partial feedback.
- Suspension or teacher-assignment removal blocks the next protected request.
- Audit evidence distinguishes human-only, AI-assisted, edited, rejected, and published outcomes.

## Verification plan

- Database and storage tests for student ownership, teacher scope, audio privacy, rubric versioning, and publication state
- Unit tests for recording/upload, dictation, proofreading comparison, AI batch state mapping, and safe failure messages
- Adversarial tests for prompt injection, cross-student access, stale teacher scope, replay, and partial batch failure
- Browser tests for voice recording fallback/upload, dictation-to-editable-text, proofreading comparison, teacher approval, student playback, and responsive review flow

## Open decisions

- D-014 Option B approved on 2026-10-10
- D-019 Option B approved on 2026-10-10
- D-020 Option B approved on 2026-10-10; production external processing and spending remain disabled pending a later activation decision

## Implementation checkpoint — 2026-10-10

- Added a current-scope teacher review queue, retry-safe private drafts, deliberate publication, and `review_completed` or `correction_requested` assignment transitions.
- Added private bounded playable voice-note and temporary dictation-audio storage with signature checks, direct-storage denial, accessible written-equivalent enforcement, and retention cleanup.
- Added provider-neutral transcription, proofreading, and rubric-batch request records. All production external processing remains disabled with a ₹0 budget; only deterministic fictional test adapters are authorized.
- Added the teacher review interface at `/staff/reviews`, including editable dictation, original/suggestion proofreading comparison, explicit accept/reject controls, voice-note recording/upload, and publication gates.
- Added compact submission thumbnails with an accessible same-page expanded viewer, an explicit active-microphone state, and separate correction-request dictation/proofreading controls.
- Added published written/voice feedback to the owning student's assignment history with AI-assistance disclosure.
- Verified 315 database/security assertions, 71 unit/component tests, 23 Chromium browser journeys, both new Edge Functions in the local runtime, desktop/mobile layouts, production builds, and zero preview console errors.
- Product owner visually approved the teacher feedback review experience on 2026-10-10.
- Opened PR #12 for the approved F007 implementation.
