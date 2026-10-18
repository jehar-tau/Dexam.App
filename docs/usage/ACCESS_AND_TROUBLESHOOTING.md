# Access, navigation and troubleshooting

[Handbook home](README.md)

## Current entrances

| Purpose                     | Path               | Credentials / requirement                                                                                      |
| --------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------- |
| Student sign-in             | `/sign-in`         | Dexam Member ID and student's password                                                                         |
| Student initial activation  | `/activate`        | Privately issued one-time activation proof/backup entry                                                        |
| Student recovery            | `/student/recover` | Assisted instructions or privately approved recovery pack; hosted execution disabled                           |
| Staff operations            | `/staff/sign-in`   | Established employee email/password; current membership and permitted scope                                    |
| Teacher sign-in             | `/teacher/sign-in` | Established employee identity; review scope or explicit same-course Teacher/content authority checked on entry |
| Admin sign-in               | `/admin/sign-in`   | Established employee identity; current Elevated Admin role and required MFA checked on workspace entry         |
| Employee initial activation | `/staff/activate`  | Invitation proof; current implementation uses fictional/local capture                                          |
| Employee forgotten password | `/staff/recover`   | Established unchanged email and exact recovery proof; real delivery not activated                              |
| Own staff security          | `/staff/security`  | Current employee; sensitive actions require the relevant MFA/current authority                                 |
| Service health              | `/health`          | Non-sensitive environment/health information; not a private data or admin bypass                               |

F033/D-048 B separates the four entrances/layouts on one identity/backend. This does not create independent browser sessions for each role. Menus show only the current portal's permitted tools; eligible **Switch to … portal** links retain the same signed-in person. Sign out before changing people on a shared browser. Legacy routes remain supported; URL/portal selection grants no role or broader scope.

Default landings are `/student`, `/teacher`, `/staff` and `/admin`, rather than sending every employee to Enrolments. Safe in-portal return paths preserve intended work; cross-portal/external/unsafe returns fall back to that entrance's home. Private operations still enforce existing membership/capability/MFA/current-state checks. An employee may use the staff entrance but sees no unassigned operational powers; Teacher alone does not become an operator. Recovery remains the established shared employee flow, not four new recovery mechanisms.

## Why a link is missing or denied

| Condition                                    | Meaning and next step                                                                                                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No configured backend / service unavailable  | Engineering must check the environment; do not create another account or use a production service as a workaround.                                                        |
| Signed out                                   | Open the appropriate student/employee entrance. A Dexam password is not automatically the same as a Zoho, GitHub or Resend password.                                      |
| Current membership ended/suspended/revoked   | Access is denied from current state. Old sessions, menu links and notices cannot restore it. Ask the accountable operator to review the established record.               |
| Missing capability or offering/teacher scope | The job is separately restricted. A broad role label or guessed URL grants nothing.                                                                                       |
| MFA/recent verification needed               | Use your own enrolled authenticator and re-verify. Never borrow another admin's code or remove the requirement.                                                           |
| No active/assigned material                  | Verify enrolment, published curriculum assignment and deliberate assignment release with the responsible staff.                                                           |
| Navigation verification failed               | Use **Retry navigation** where offered. The app fails closed rather than assuming access.                                                                                 |
| Old signed file link expired                 | Request a fresh permitted download from the application; do not save/share a long-lived public copy. Download expiry and underlying course access are different controls. |

Current navigation refreshes in the foreground periodically; it is not a promise that revoked content instantly disappears from every already-open screen or downloaded file. Server/database authorization remains decisive for subsequent operations.

## Safe handling after errors

- Retry a failed read using the page's refresh/try-again control.
- For uploads, submissions, releases, publication, approvals, recovery and closeout, inspect current state before repeating a write. A lost response can occur after a successful operation.
- Never manually delete a possibly attached file to compensate for uncertainty. Never use another logged-in person's authority to finish a retired account's operation.
- An uncertain password mutation stays fenced. Investigation/expiry is not proof the provider did not change it.
- Close a shared-browser session when changing people. Do not assume refresh of an old token creates a new authorized session.

## Microphone and assistance troubleshooting

Recording needs a supported browser/device and microphone permission. A permission denial or unavailable input should lead to typed feedback, not a request for unrelated device access. Check the browser's microphone setting yourself and start recording deliberately; watch the listening state and stop when done. Use only permitted audio formats/limits.

Recording a voice note, transcribing dictation and AI proofreading are separate operations. The production transcription/proofreading providers are not active. Preview-generated text is fictional. A provider-unavailable result is not fixed by entering a personal API key into the browser or sending student work to an unapproved service.

## Support information to provide

Give the accountable support operator the affected workspace, approximate time/timezone, intended action, visible safe error/status and whether the issue occurred locally or on fictional staging. Share private identity references only through the approved restricted channel when needed. Crop/redact screenshots before sharing; never include passwords, OTPs, activation/recovery links, backup codes, QR images, service keys or other students' work.

Do not post raw provider responses or signed file URLs in public GitHub issues. The current repository is public. No production support email/phone or guaranteed response time is published in this handbook; private contact/handover/escalation details still need operational validation.

## Quick glossary

- **Member ID:** stable student-facing identifier, independent of any one course.
- **Offering:** reusable course/programme definition.
- **Cohort:** optional delivery batch within an offering.
- **Enrolment:** a student's record/access lifecycle for an offering/cohort.
- **Published version:** locked content/rubric/material snapshot; later drafts do not rewrite it.
- **Assignment release:** deliberate assignment distribution to eligible enrolments, separate from publication.
- **Attempt:** a draft or finalized submission; finalized attempts are immutable.
- **Capability/scope:** explicit permission plus the context in which it may be used, not merely a job title.
- **Archive:** bounded private own-work/published-feedback access after course end, not lifetime lessons.
- **Fictional preview:** demonstration state that does not establish real backend changes.
