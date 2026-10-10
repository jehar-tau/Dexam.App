# ADR-019 — Teacher Voice Feedback and Rubric Policy

Status: Option B approved 2026-10-10
Date: 2026-10-10
Decision ID: D-019
Risk: Red — private educational records, teacher audio, and student-facing evaluation

## Question

How should teachers record and publish playable voice feedback, dictate speech into editable writing, provide an accessible written equivalent, control evaluation rubrics, and retain private audio?

## Why this needs your decision

Teachers need two distinct voice tools: a normal recording that the student can play and dictation that turns the teacher's speech into editable written feedback. Both can make detailed feedback faster, but recordings are private educational records and may incidentally contain sensitive background speech. Long recordings and broad formats also consume storage quickly. The product must set a clear transcription, accessibility, retention, and rubric-authority boundary before implementing recording, upload, playback, dictation, or publication.

## Options

### A — Written feedback only for the first release

Teachers type and publish written feedback; recording, uploaded audio, and speech-to-text dictation are deferred.

- **Impact:** Most accessible and simplest to review, but does not deliver either requested voice workflow.
- **Cost:** Lowest implementation, storage, and bandwidth cost.
- **Risk:** Lowest privacy and browser-compatibility exposure.
- **Reversibility:** High; voice can be added later.

### B — Bounded private voice notes plus editable speech-to-text dictation (recommended)

Allow a teacher to record in the browser or upload one private voice note for a feedback revision. A note may be no longer than 5 minutes and no larger than 10 MB. The trusted upload path accepts only commonly playable audio formats: WebM/Opus, MP3, and MP4/M4A with AAC. Browser recording uses mono speech-oriented audio at a conservative bitrate when the browser supports it; unsupported browsers use the upload fallback. The backend verifies declared type, detected signature, size, duration metadata where reliable, current teaching scope, and draft ownership. Direct storage writes remain denied.

Microphone capture starts only after an explicit teacher action and visible browser permission. The interface supports record, pause, resume, preview, replace, upload, retry, and discard before publication. Draft audio may be replaced or deleted. Publication creates an attributable immutable feedback revision; a correction is a new revision rather than an overwrite. Audio uses opaque private object keys and short-lived authorized playback URLs.

Provide a separate **Dictate feedback** action. It captures the teacher's speech and requests a draft transcript through the approved transcription boundary defined by D-020. The returned text always opens in an editable field; it is never treated as correct, saved as final, or published automatically. The teacher may continue dictating, correct the text, retry, or discard it. Dictation-only audio is temporary and is deleted after the teacher accepts or discards the text, with a maximum 24-hour cleanup window. If the teacher also wants the student to hear the recording, the teacher must deliberately choose to keep it as the normal voice note rather than Dexam silently retaining dictation audio. Do not silently use a browser- or operating-system-vendor speech service that bypasses the approved provider/privacy gate.

Allow the teacher to use either or both outputs: written feedback created by typing or dictation, and a playable voice note. Before publishing a voice note, the teacher must confirm that the written feedback contains every actionable point in the audio. It may be a concise structured equivalent rather than a word-for-word transcript, but students must not lose essential instructions when they cannot hear or play the recording. The student interface presents writing first and audio as an additional format.

Evaluation guides remain part of the existing content-authoring boundary. A user with `content.manage_drafts` may prepare an assignment-specific guide; `content.publish` is required to release an immutable rubric version. A reviewer cannot silently alter the pinned rubric while evaluating submissions. Any replacement rubric creates a new published version and affects only reviews explicitly pinned to it.

Purge abandoned draft audio 30 days after its last activity. Retain published audio while the related enrolment is active and for 12 months after it ends, matching the approved submission-file boundary. Keep only minimum audit metadata after deletion. No teacher voice model, biometric template, emotion analysis, or performance analytics may be derived from recordings.

- **Impact:** Delivers both requested voice workflows while preserving editable teacher control, a usable written alternative, and an auditable rubric boundary.
- **Cost:** Uses browser capture and the existing private Supabase storage path. The interface and adapter can be built without a paid service; real transcription remains disabled until D-020's provider/cost activation. Duration and retention limits bound storage growth.
- **Risk:** Moderate-to-high but controlled through explicit recording, temporary dictation audio, private storage, current-state authorization, immutable publication, teacher-confirmed writing, and deletion schedules.
- **Reversibility:** High for future limits and formats; deleted audio cannot be restored.

### C — Long recordings with automatic transcription and indefinite retention

Allow longer recordings and more formats, send every recording to an external transcription service, and retain both audio and transcripts for the member's lifetime.

- **Impact:** Most convenient for teachers and creates searchable transcripts.
- **Cost:** Highest storage, bandwidth, transcription, monitoring, and support cost.
- **Risk:** Highest privacy, consent, vendor, and accessibility-correction exposure.
- **Reversibility:** Low once recordings are sent externally or users expect permanent retention.

## Recommendation

Approve Option B. It provides both a normal playable voice note and teacher-controlled speech-to-text dictation, keeps essential feedback accessible in writing, reuses the approved private-storage pattern, and gives curriculum publishers—not individual reviewers—control over the rubric used for evaluation. D-019 defines the product behavior; D-020 separately controls when a real transcription engine may receive audio and incur cost.

## What approval authorizes

Option B would authorize the local database/storage foundation, trusted upload path, normal voice-note interface, dictation/transcript editing states, provider-neutral transcription adapter, student playback interface, retention cleanup, and automated tests with fictional fixtures. It would not authorize an external transcription provider, AI inference, paid services, real audio transmission, production deployment, or importing real student data.

## Approval

The product owner approved Option B on 2026-10-10. F007 will support both bounded private voice notes and speech-to-text dictation that always returns editable writing. Dictation-only audio is temporary; published voice notes require a teacher-confirmed accessible written equivalent. Rubric publication remains separated from review, and no external transcription provider or paid usage is authorized by this decision.
