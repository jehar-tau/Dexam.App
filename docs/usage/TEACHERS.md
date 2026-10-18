# Teacher guide

[Handbook home](README.md) · [Access and help](ACCESS_AND_TROUBLESHOOTING.md)

## Access and current scope

Teachers sign in at `/teacher/sign-in` with their established employee email/password and land at `/teacher`, with a review-focused layout. This is the same identity, not a new teacher account. Teacher access uses specifically assigned review authority—not automatic CRM, administration, content-editing, scheduling or full curriculum-reading access.

Choose **Reviews** (`/teacher/reviews`) from the teacher menu. Existing `/staff/reviews` bookmarks/notification links still work with the teacher layout and original guards. Without current review scope, the new teacher workspace is denied—not granted extra authority. Eligible portal-switch links change the workspace, not the signed-in person.

Keep your own employee account and required MFA current. If Reviews is missing/denied, the operator should verify your active membership, review capability and teaching scope. A missing assignment may also mean the student has not finalized a submission. The wider teacher coursework reader/roster/attendance dashboard remains deferred under D-031 A.

## Review a submission

1. Select a student/submission in **Feedback review**. Confirm the student, assignment, attempt number, version and submitted files. Multiple attempts may await review separately.
2. Inspect visible file thumbnails. Click a file's preview control to expand it on the same page; close the expanded viewer when finished. Use the provided private file/download actions for supported work. An image preview does not replace checking every submitted file, including PDFs.
3. Obtain the approved assignment-specific instructions/evaluation guidance through your authorized academic staff/current permitted material. The review screen currently shows assignment title/group but does not fetch/display the full assignment brief or rubric. Do not infer criteria from the title or use another role's account to obtain them. A new in-app guidance reader requires its separately scoped approval under the existing teacher-workspace decision.
4. Enter **Written feedback**. Keep it specific, constructive and understandable to the student. Do not include other students' information.
5. Choose **Save private draft** when you are not ready to publish. Saved private feedback is not a student-visible result.

Students can edit until feedback is published. An edit creates a new version and makes the old draft ineligible for publication, without deleting it. Reload the queue, inspect the current files and confirm **I have reviewed the updated files for this version** before preparing feedback on an edited version. **Previous version draft — reference only**, where available, shows the immediately preceding private writing; it is not silently copied or published. If publication reports changed work, do not retry the old draft blindly. Published feedback locks that exact attempt. Students may still submit a separate numbered attempt while eligible; reviewing an older attempt does not replace the newer attempt's assignment status.

## Dictation versus a voice note

These are two different uses of recording:

- **Dictate feedback** records speech intended to become editable written feedback. Start deliberately, allow microphone access in your browser, watch the listening indicator and stop when finished. Correct the resulting text before publishing.
- A **Voice note** is optional audio the student can play after publication. Record or select a permitted audio file. The current teacher composer does not yet wire a playable draft-audio source or provide a dedicated remove control; do not rely on its empty playback control to verify a recording. Prefer an independently checked file or written feedback until this usability defect is fixed, and do not publish unverified audio. The teacher must supply the required written equivalent; audio is not a way to omit accessible written feedback.

Recordings are limited to five minutes and 10 MB; permitted uploads are WebM, MP3/MPEG and MP4 audio. Device/browser permissions and supported audio formats affect recording. Use typed feedback when the microphone is denied/unavailable. Stop recording before leaving or switching accounts.

Important: recording UI exists, but production speech-to-text is not activated. A successful recording does not guarantee transcription. In fictional preview, generated/transcribed content is demonstration data, not proof of a live AI service. Do not send real student content to an unapproved provider.

## Proofreading assistance

Use **Proofread with AI** only when that environment's approved service is available. Review original and suggested wording side by side; edit and explicitly accept/reject the suggestion. Accepting a suggestion is not publishing it. Preserve your intended meaning and academic judgment.

Production proofreading and rubric-based bulk AI providers remain disabled/gated. The current review interface is not a production batch-AI evaluation console. Do not promise automatic grades, auto-publication or student-visible AI evaluation without teacher review.

## Choose the student's next step

- **Publish & complete review** publishes the final feedback and closes the review outcome for this attempt.
- **Publish & request correction** publishes feedback and asks the student for another attempt. Write a clear **Correction request** first.
- **Dictate correction** and **Proofread correction with AI** apply to that correction text. Their provider/recording limitations are the same as above. Accept/reject a wording suggestion deliberately, then publish the intended outcome.

Check the final text/audio and selected outcome before either publication action. Draft saving, proofreading and audio upload do not publish feedback. Publication is the deliberate student-visible step. Refresh after an uncertain response before repeating it.

## Notifications and account security

Use `/teacher/notifications` for assigned-review updates and protected deep links; existing staff notification links remain compatible. Notification availability follows current assignment and account authority; old notices cannot preserve revoked access. In-app notifications are not external email or push.

Open `/teacher/security` (or compatible `/staff/security`) for authenticator setup/verification and session controls. **Sign out all devices** invalidates prior application sessions; after password recovery, existing MFA still matters. Lost-MFA recovery requires two eligible administrators other than the affected person. Never send an MFA seed, QR image, code or student file to a general support chat.

## What a Teacher role does not imply

Teacher review authority alone cannot enrol students, resolve duplicate identities, change access, create/edit curriculum, distribute assignments, schedule classes, view broad CRM data, manage employee roles, recover accounts or grant itself more permissions. If a teacher also holds an independently approved staff responsibility, follow the corresponding [Staff guide](STAFF.md); it is a separate grant, not a hidden expansion of Teacher.
