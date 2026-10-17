# Dexam application handbook

Version: 2026-10-17. Audience: product owner, students, teachers, operational staff and administrators. This guide describes the implemented application, not a promise that it is ready for real students.

## Choose your guide

- [Students](STUDENTS.md): activation, coursework, assignments, feedback, classes, checklist and archive.
- [Teachers](TEACHERS.md): reviewing submitted work, written/audio feedback, correction requests and assistance limits.
- [Staff](STAFF.md): enquiries, allocation, admissions, content, assignment releases, classes and course closeout.
- [Administrators](ADMINS.md): invitations, MFA, recovery, privacy and launch operations.
- [Access and troubleshooting](ACCESS_AND_TROUBLESHOOTING.md): current sign-in routes, access rules, error handling and support.

Read the access guide first. A guide heading is not an access grant: accounts only see destinations permitted by current membership, capabilities and offering scope. A person may hold more than one approved responsibility. “Admin” does not automatically mean unrestricted access to all academic or CRM data.

## Where to open the app

For the current local server, use `http://127.0.0.1:5173` plus the path listed in the guide. The fictional hosted test site is `https://dexam-staging.pages.dev`; it is not the production app. A local server must be running for a localhost link to work. There is no approved public production login URL yet.

The development preview uses `?preview=1` only on explicitly supported pages and preview-enabled builds. Its people, files, saves and outcomes are fictional; actions there are not proof of persisted backend changes. Public/staging builds must not allow this bypass. Recovery, class scheduling, archive, checklist and other protected pages deliberately have no preview shortcut. Do not use real student information in previews or fictional staging.

## Portal separation: actual status

| Audience | Current sign-in                                                                                     | Current workspace                                                | Separate visual application?     |
| -------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------- |
| Student  | `/sign-in`, Member ID/password                                                                      | `/student` and learning routes                                   | Learning-first header/navigation |
| Teacher  | `/teacher/sign-in`, established employee email/password                                             | `/teacher`, `/teacher/reviews`, permitted notifications/security | Compact review rail              |
| Staff    | `/staff/sign-in`, established employee email/password                                               | `/staff`, individually permitted operations                      | Operations sidebar               |
| Admin    | `/admin/sign-in`, established employee email/password; current Elevated Admin role and required MFA | `/admin`, individually permitted account/security operations     | Protected administration layout  |

F033/D-048 B provides distinct entrances and layouts on one application/backend—not four independent identities or browser sessions. Current-portal menus stay separate; eligible **Switch to … portal** links use the same account and grant nothing. Sign out to change people. Server/database/MFA checks remain authoritative. Existing `/staff/reviews` and other legacy bookmarks/notifications remain supported with their original guards. Teacher alone does not gain staff operations. A deployed version must contain F033 before the new URLs are available.

## Common working rules

1. Sign in with your own assigned account. Never share passwords, MFA codes, activation/recovery links or backup codes.
2. Open the intended workspace through your authorized menu or its known path. If access is denied, ask the responsible operator to check your existing assignment—not to bypass the checks.
3. Check the exact student, offering, cohort, assignment/version and status before changing anything.
4. Save a private draft when preparing work. Publish, release, submit, approve and closeout are different deliberate actions; a draft is not automatically visible to its recipient.
5. After a timeout, refresh current state before repeating a consequential action. Never assume a failed response proves nothing was saved.
6. Sign out on shared devices. Downloaded files remain outside the app's session controls; store and remove them appropriately.

## What is available versus still gated

The core includes CRM/admissions, stable Member IDs, versioned content, deliberate assignment release, private submissions, teacher publication, in-app notifications, one-off classes, private checklists and a bounded own-work archive. Availability still depends on role/scope and configured services.

Real authentication email, hosted student-reset execution, live speech-to-text/AI proofreading/bulk AI, production cleanup/monitoring and full production recovery are not enabled merely because their screens or interfaces exist. Microphone recording is not the same as transcription. No payment, assessment/scoring, attendance, wider teacher curriculum reader, automatic curriculum upgrade, advance reminder or college/professional product is promised here.

For authoritative delivery gaps, use [Release status](../RELEASE_STATUS.md), [Production readiness](../PRODUCTION_READINESS.md) and [Deferred work](../DEFERRED_WORK.md).

## Example end-to-end journey

Sales records an enquiry → an authorized operator reviews identity/course and approves enrolment → an unclaimed student receives a private activation pack → authorized academic staff publish content and deliberately release an assignment → the student uploads and submits → an assigned teacher publishes feedback or requests correction → the student sees the update and responds. Content publication alone does not release an assignment; a Sales handoff alone does not create student access.

## Maintenance of this handbook

Engineering must update the relevant role guide when routes, labels, capabilities, statuses, limits or activation boundaries change. This handbook is checked against router/page code and feature/security records. It intentionally contains no test passwords, real contact lists, keys or private links. Product owner handles support/incidents, Rohin is backup, and Siddhant Modi is a third administrator nominee for planning only. Owner reports staffed 24/7 availability; private channels, handover, escalation and operational validation are still launch work, not a response-time guarantee.
