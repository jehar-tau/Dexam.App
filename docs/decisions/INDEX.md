# Decision Register

| ID    | Decision                                                                                      | Status                                  | Record                                                    |
| ----- | --------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| D-001 | Foundation package: repository boundaries, source vault, agent harnesses, and first milestone | Approved 2026-09-26                     | `ADR-001-foundation.md`                                   |
| D-002 | Application stack and deployment architecture                                                 | Approved 2026-09-26                     | `ADR-002-application-stack-and-deployment.md`             |
| D-003 | Role and permission principles                                                                | Approved 2026-09-26                     | `ADR-003-role-and-permission-principles.md`               |
| D-004 | Identity deduplication and access revocation                                                  | Approved 2026-09-26                     | `ADR-004-identity-deduplication-and-revocation.md`        |
| D-005 | Lifelong member architecture                                                                  | Strategic principle approved 2026-09-26 | `ADR-005-lifelong-member-architecture.md`                 |
| D-006 | Authentication and recovery model                                                             | Option B approved 2026-09-26            | `ADR-006-authentication-and-recovery-model.md`            |
| D-007 | Member ID issuance, activation, and recovery                                                  | Option B approved 2026-09-26            | `ADR-007-member-id-activation-and-recovery.md`            |
| D-008 | Staff authority and approval boundaries                                                       | Option B approved 2026-09-26            | `ADR-008-staff-authority-and-approval-boundaries.md`      |
| D-009 | Offering, cohort, and enrolment structure                                                     | Option B approved 2026-10-04            | `ADR-009-offering-cohort-and-enrolment-structure.md`      |
| D-010 | Design system source of truth and hosting                                                     | Superseded in part by D-011 2026-10-04  | `ADR-010-design-system-tooling.md`                        |
| D-011 | Shared design system repository (`dexam-portfolio-design-system`)                             | Approved 2026-10-04                     | `ADR-011-shared-design-system-repository.md`              |
| D-012 | Live Enrolment Operator queue identity and initial volume                                     | Option B approved 2026-10-07            | `ADR-012-live-enrolment-queue-identity.md`                |
| D-013 | Coursework hierarchy and curriculum versioning                                                | Option B approved 2026-10-10            | `ADR-013-coursework-hierarchy-and-versioning.md`          |
| D-014 | Teacher feedback delivery and AI authority                                                    | Option B approved 2026-10-10            | `ADR-014-feedback-delivery-and-ai-authority.md`           |
| D-015 | Academic content authoring and publishing authority                                           | Option B approved 2026-10-10            | `ADR-015-academic-content-authoring-authority.md`         |
| D-016 | Staff-provided assignment-material file policy                                                | Option B approved 2026-10-10            | `ADR-016-assignment-material-file-policy.md`              |
| D-017 | Assignment distribution, deadlines, and revision lifecycle                                    | Option B approved 2026-10-10            | `ADR-017-assignment-distribution-and-lifecycle.md`        |
| D-018 | Student submission file limits and retention                                                  | Option B approved 2026-10-10            | `ADR-018-student-submission-file-and-retention-policy.md` |
| D-019 | Playable voice feedback, speech-to-text, rubric authority, and retention                      | Option B approved 2026-10-10            | `ADR-019-teacher-voice-feedback-and-rubric-policy.md`     |
| D-020 | Transcription/AI provider, proofreading, privacy, disclosure, and cost activation             | Option B approved 2026-10-10            | `ADR-020-ai-feedback-provider-privacy-and-cost-gate.md`   |
| D-021 | Notification foundation, first milestone, channels, and retention                             | Option B approved 2026-10-10            | `ADR-021-notification-foundation-and-first-milestone.md`  |
| D-022 | CRM prospect identity, ownership, follow-ups, and first milestone                             | Option B approved 2026-10-10            | `ADR-022-crm-prospect-identity-and-first-milestone.md`    |
| D-023 | CRM assignment authority and unassigned/stranded queue                                        | Option B approved 2026-10-11            | `ADR-023-crm-assignment-authority-and-queue.md`           |
| D-024 | CRM-to-enrolment handoff, identity resolution, and routine approval                           | Option B approved 2026-10-11            | `ADR-024-enrolment-handoff-and-identity-resolution.md`    |
| D-025 | CRM data lifecycle, correction, erasure, and privacy operations                               | Option B approved 2026-10-11            | `ADR-025-crm-data-lifecycle-and-privacy-operations.md`    |
| D-026 | Hosted staging ownership, release automation, recovery, and cost boundary                     | Option B approved 2026-10-11            | `ADR-026-hosted-staging-and-release-foundation.md`        |
| D-027 | Identity-operations sequencing and first staff security slice                                 | Option B approved 2026-10-13            | `ADR-027-identity-operations-sequencing.md`               |

IDs are stable. Do not reuse retired decision IDs.

D-028 — MFA enforcement boundary — Option B approved 2026-10-13 — `ADR-028-mfa-enforcement-boundary.md`.

D-029 — Employee invitation and password recovery — Option B approved 2026-10-13 — `ADR-029-employee-invitation-and-recovery.md`.

D-030 — Student assisted recovery — Option B approved 2026-10-14 — `ADR-030-student-assisted-recovery.md`.

D-031 — First teacher teaching workspace — Option A selected 2026-10-14: existing review queue only; broader workspace deferred — `ADR-031-teacher-workspace-scope.md`.

D-032 — Enrolment closeout and past-work access — Option B approved 2026-10-14 — `ADR-032-enrolment-closeout-and-history.md`.

D-033 — Student learning progress — Option B approved 2026-10-14 — `ADR-033-student-learning-progress.md`.

D-034 — Class schedule foundation — Option B approved 2026-10-14 — `ADR-034-class-schedule-foundation.md`.

D-035 — Native fictional in-app worker — engineering follow-up within approved in-app scope — `ADR-035-fictional-native-inapp-worker.md`.

D-036 — Advance class reminders — Option A selected 2026-10-14; deferred, existing alerts only — `ADR-036-class-reminder-scope.md`.

D-037 — Private lesson materials — Option B approved 2026-10-14; fictional/local only — `ADR-037-private-lesson-materials.md`.

D-038 — Existing-student curriculum upgrades — Option B approved: restricted read-only impact preview; actual migrations deferred — `ADR-038-curriculum-upgrade-scope.md`.
D-039 — Next milestone — Option B approved: fictional pilot readiness within existing rules; no new modules or real launch — `ADR-039-next-milestone.md`.
D-040 — Pilot navigation scope — Option B approved: existing-authority-aware links with current styles and no new grants — `ADR-040-pilot-navigation-scope.md`.
D-041 — Next milestone — Option A approved: guided fictional pilot/designer review; no production activation or new modules — `ADR-041-guided-pilot-review.md`.
D-042 — Post-pilot milestone — Option A approved 2026-10-15: launch-readiness planning only, no spending/activation/real data — `ADR-042-post-pilot-milestone.md`.

D-043 — Fictional restore rehearsal — Option B approved: isolated local implementation and execution, no production activation — `ADR-043-fictional-restore-rehearsal.md`.

D-044 — Assignment upload reconciliation — Option B approved 2026-10-16: tracked uploads, 30-day unreferenced cleanup, referenced/legacy protection; fictional/local only — `ADR-044-assignment-upload-reconciliation.md`.

D-045 — Uncertain password-recovery incident review — Option B approved 2026-10-17: two non-target administrators record investigation; uncertain execution remains blocked; fictional/local only — `ADR-045-uncertain-recovery-incident-review.md`.

D-046 — Authentication email transport preparation — Option B approved 2026-10-17: provider-neutral message and mocked Resend candidate, no account/setup/sending activation — `ADR-046-authentication-email-transport.md`.

D-047 — Authentication sender verification — Option B approved 2026-10-17; external setup subsequently deferred pending owner login/terms acceptance; no sending — `ADR-047-authentication-sender-verification.md`.

D-048 — Role-separated portals — Option B approved 2026-10-17: four distinct entrances/layouts on the existing identity/backend, F033 verification active; no new authority — `ADR-048-role-separated-portals.md`.

D-049 — Student attempt editing and repeat submission — Option B approved 2026-10-18: edits until published feedback with snapshot/stale-publication protection and independently numbered further attempts — `ADR-049-student-attempt-editing-and-repeat-submission.md`.

D-050 — Teacher content authoring, named attachments and draft topic removal — Option B approved 2026-10-18; explicit course-scoped editing/publication, named multi-file attachments and confirmed draft-only topic removal — `ADR-050-teacher-content-authoring.md`.

D-051 — First actual email connection test — Option A approved 2026-10-21: isolated local interactive one-message non-credential test to a privately designated owner inbox, hidden key entry, no production/authentication activation — `ADR-051-local-email-connection-test.md`.

D-052 — Administrator setup target — Option A approved 2026-10-21: separate administrator-only Free-eligible pilot, isolated from fictional staging; no students/public launch or paid upgrade — `ADR-052-administrator-pilot-target.md`.

D-053 — Assessment source and first slice — Option B approved 2026-10-27: independent Dexam assessment foundation and provenance-controlled official-paper import; no third-party processed database or production activation — `ADR-053-assessment-source-and-first-slice.md`.

D-054 — Test-series programme — Option A approved 2026-10-28 on all four choices: build inside dexam-platform after F037; full mixed bank with public paid sales gated on a legal view; release order self-paced R1, commerce R2, all-India live mock R3; official-style exam interface in Dexam's own code, no third-party code/text/branding — `ADR-054-test-series-programme.md`.

D-055 — Assessment bank-management permissions — Option A approved 2026-10-28: Admin role only for `assessment.bank.read` and `assessment.bank.import`; MFA required for import and answer-key access — recorded in `ADR-057-test-series-experience.md` and `../features/F038-assessment-question-bank.md`.

D-056 — Pre-push quality gate — standing owner rule 2026-10-28: every change passes every applicable test layer, a threat review (web, AI/agent, cloning/scraping) and a Claude code/security review before push, with evidence in the PR — `../QUALITY_GATE.md`.

D-057 — Test-series experience — approved 2026-10-28: separate `/tests` shell with its own sidebar; Dexam light theme by default with optional dark; official-looking exam window; no third-party assets — `ADR-057-test-series-experience.md`.
D-058 — Google-only public sign-up — approved 2026-10-28 (Option A): public sign-up on, with a before-user-created hook allowing only Google sign-ups and staff invitations being delivered; proven locally, staging next — `ADR-058-google-only-public-sign-up.md`.
D-059 — One student portal with a left sidebar — directed by the owner 2026-10-28: `/student` and `/tests` share one left-sidebar shell (coaching tools plus the test series; candidates see the test series only); Analytics merged into the Overview; Bookmarks and Sketches removed, with Part B feedback on the result page — `ADR-059-student-portal-sidebar.md`.
D-060 — Printed question blocks, owner review and timed drawing papers — directed by the owner 2026-10-28: every question cropped exactly as printed and shown that way once the owner approves it in a local review page; Part B and NID DAT 3-hour all-drawing mocks as timed drawing papers — `ADR-060-printed-blocks-and-drawing-papers.md`.
D-061 — Number-free question blocks, owner task collections and mixed NID DAT drawing mocks — directed by the owner 2026-10-29: question numbers blanked from every crop so questions mix into any paper; the owner's NID task collection ingested (290 tasks, all held for review); NID DAT 3-hour six-task mocks built per student from the whole drawing pool by type — `ADR-061-number-free-blocks-mixed-nid-mocks.md`.
D-062 — Analytics on Home, one Mock test tab, Part B in UCEED/CEED mocks — directed by the owner 2026-10-29: the test-series analytics move to Home; Papers, Mocks and Drawing become one Mock test tab with UCEED, CEED, NID and NIFT only; UCEED and CEED mocks get their Part B with the 10-minute upload window — `ADR-062-home-analytics-mock-test.md`.
