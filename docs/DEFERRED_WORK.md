# Deferred Work Register

Last updated: 2026-10-13

This is the canonical register for functionality Dexam has discussed but is not building in the current slice. It prevents useful ideas, incomplete feature slices, and required follow-up work from being lost between tasks.

`ROADMAP.md` defines broad sequence. Feature specifications define product behavior. ADRs record approved decisions. This register only tracks what remains and the safest point from which to resume it; it does not approve implementation, spending, external data sharing, or a speculative feature.

## Status vocabulary

- **Next slice** — known missing work that may be proposed after the current slice.
- **Discovery active** — specification and Decision Gate are being prepared; implementation is not yet approved.
- **Implementation active** — an approved slice exists locally and is awaiting review or merge; it is not complete yet.
- **Deferred, foundation ready** — the current architecture deliberately supports it, but a later decision or activation is required.
- **Waiting for source feature** — cannot be reliable until another domain becomes the source of truth.
- **Roadmap phase** — intentionally outside the first product milestone.
- **Research only** — idea preserved for discovery; not an approved feature or promise.

When work resumes, read the linked source, verify the current code and recent commits, create any missing feature specification or Decision Gate, and update this register in the same pull request. Completed items move to the completion log rather than disappearing.

## Identity, security, and administration

| ID     | Status                     | Deferred functionality                                             | Resume trigger and prerequisites                                                                                                                                                                        | Authority          |
| ------ | -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| DW-001 | Discovery active           | Student self-service account recovery                              | D-027 is deciding identity-work sequence; define trusted recovery evidence, staffing/escalation, token expiry, delivery route, abuse controls, and audit behavior. No mandatory phone/email assumption. | F001, D-006, D-007 |
| DW-002 | Discovery active           | Employee invitation and recovery                                   | D-027 is deciding identity-work sequence; define invite issuer, verified-email lifecycle, reset handling, revocation behavior, and audit trail.                                                         | F001, D-006, D-008 |
| DW-003 | Discovery active           | TOTP MFA for elevated administration                               | Recommended first under D-027 with the F015 staff-security interface and lost-factor support policy; recheck current-session assurance for every elevated action.                                       | D-006, D-008, F015 |
| DW-004 | Discovery active           | Security-triggered all-device session revocation                   | Recommended in F015 under D-027; preserve immediate current-state denial even before refresh-session cleanup completes.                                                                                 | D-004, F001, F015  |
| DW-005 | Discovery active           | Two-person approval and elevated-administration interface          | Recommended first F015 action is lost-factor reset with proposer/approver separation, expiry, evidence, session revocation, and the D-008 bootstrap emergency procedure.                                | D-008, F002, F015  |
| DW-006 | Deferred, foundation ready | Time-limited staff support session or impersonation                | Requires a separate red-risk Decision Gate covering visible indication, purpose, consent, duration, prohibited actions, and immutable audit evidence.                                                   | D-008              |
| DW-007 | Next slice                 | Remaining enrolment lifecycle transitions and entitlement behavior | Define pause, transfer, withdrawal, completion, expiry/end rules, and their effects on content, submissions, retention, and re-enrolment.                                                               | F004, D-009        |

## Academic experience and content

| ID     | Status                     | Deferred functionality                                   | Resume trigger and prerequisites                                                                                                                                | Authority   |
| ------ | -------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| DW-008 | Next slice                 | Student topic/lesson progress and learning analytics     | Define what counts as progress, correction rules, student visibility, staff scope, retention, and whether any analytics are necessary.                          | F005        |
| DW-009 | Deferred, foundation ready | Private lesson media beyond text-first content           | Establish media formats, upload authority, storage/delivery cost limits, accessibility equivalents, retention, and mobile behavior.                             | F005, D-002 |
| DW-010 | Next slice                 | Teacher curriculum-reading and cohort teaching workspace | Reuse explicit offering scope and current capability checks; decide the minimum teacher view before adding authoring powers.                                    | F005, F002  |
| DW-011 | Next slice                 | Deliberate curriculum-version reassignment or migration  | Define who may move a cohort/enrolment, how students are warned, what happens to progress and assignment links, and how historical versions remain explainable. | F005, D-013 |
| DW-012 | Next slice                 | Student download/export before submission-file expiry    | Add clear expiry notice and authorized bulk or per-file export before the 12-month post-enrolment purge.                                                        | F006, D-018 |
| DW-013 | Deferred, foundation ready | Exceptional audited early deletion of student work       | Define authorized role, lawful reasons, approval level, user notice, evidence retained, and irreversibility warning.                                            | D-018       |
| DW-014 | Next slice                 | Broader academic-lead/reviewer roles                     | Add only from demonstrated workflow need with explicit scoped capabilities; do not silently widen Teacher.                                                      | D-003, F002 |

## Feedback and AI

| ID     | Status                     | Deferred functionality                                 | Resume trigger and prerequisites                                                                                                                                                                        | Authority               |
| ------ | -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| DW-015 | Deferred, foundation ready | Production speech-to-text for teacher dictation        | Approve provider/model, processing region, training use, retention/deletion, data terms, per-minute price, rupee ceiling, rate limits, alerts, kill switch, and staff validation with approved content. | F007, D-019, D-020      |
| DW-016 | Deferred, foundation ready | Production AI proofreading                             | Apply the same provider/privacy/cost activation gate; retain original, suggestion, teacher acceptance/rejection, and final human authority.                                                             | F007, D-020             |
| DW-017 | Deferred, foundation ready | Rubric-grounded bulk AI feedback drafts                | First run shadow evaluation against teacher feedback, define batch limits and monitoring, and require a current authorized teacher to review every student-visible result.                              | F007, D-014, D-020      |
| DW-018 | Roadmap phase              | Governed learning-AI evaluation and faculty comparison | Begin only after sufficient teacher-reviewed evidence, measurement criteria, bias/error review, and explicit authority/privacy approval exist.                                                          | ROADMAP phase 12, D-014 |

## Notifications, scheduling, and communication

| ID     | Status                     | Deferred functionality                                                                      | Resume trigger and prerequisites                                                                                                                                                                                                                                                    | Authority                        |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| DW-019 | Deferred, foundation ready | Option C external notification channels: transactional email, WhatsApp, SMS, and later push | Select one channel at a time. Approve provider, consent/legal basis, safe content, opt-out behavior, delivery retention, retries, monitoring, rate limits, and monthly cost ceiling before sending real messages. Reuse the F008 event outbox through replaceable channel adapters. | F008, D-021                      |
| DW-020 | Deferred, foundation ready | Notification preferences, consent records, quiet hours, and digests                         | First distinguish mandatory service/academic messages from optional/promotional messages; define defaults, user controls, timezone behavior, and emergency exceptions.                                                                                                              | F008, D-021                      |
| DW-021 | Deferred, foundation ready | Scheduled notification jobs, cancellation, replacement, and escalation                      | Add when the first real reminder/digest use case exists. Require deduplication, obsolete-job cancellation, bounded retries, and operational visibility.                                                                                                                             | F008, D-021                      |
| DW-022 | Waiting for source feature | Class scheduled, rescheduled, and cancelled alerts                                          | Build the authoritative class-scheduling domain first; alerts must be consequences of schedule state and must cancel obsolete reminders.                                                                                                                                            | F008, future scheduling feature  |
| DW-024 | Waiting for source feature | Promotional marketing broadcasts or automation                                              | Requires CRM audiences plus explicit consent, opt-out, template approval, sender authority, rate limits, audit, provider, and cost approval. No approval currently exists.                                                                                                          | F008, D-021, future CRM decision |
| DW-025 | Next slice                 | Production scheduling and monitoring of the in-app notification worker                      | Choose the free Supabase/Postgres scheduling mechanism during staging deployment; add failure visibility and alerts before relying on it operationally.                                                                                                                             | F008, D-021, D-002               |

## Platform, design system, and operations

| ID     | Status                     | Deferred functionality                                         | Resume trigger and prerequisites                                                                                                                     | Authority            |
| ------ | -------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| DW-027 | Next slice                 | Production deployment and `app.designexam.com`                 | Proceed only after staging, launch checklist, privacy/security review, backup/restore, operational ownership, and explicit production approval.      | D-002                |
| DW-028 | Next slice                 | Observability, error triage, and product-intelligence baseline | Define a privacy-minimizing event taxonomy, retention, access, alert thresholds, and whether a paid service is justified.                            | ROADMAP phase 11     |
| DW-029 | Deferred, foundation ready | Remaining shared UI primitives and patterns                    | Port incrementally from the pinned shared design-system repository only when a feature needs them; add an approved spec and Storybook state catalog. | D-011, DESIGN_SYSTEM |
| DW-030 | Deferred, foundation ready | Chromatic visual-regression hosting                            | Reconsider when component volume/regression risk justifies an external account and snapshot quota; approve cost and data exposure first.             | D-010                |
| DW-031 | Deferred, foundation ready | Publishable shared runtime component package                   | Reconsider only when a second real application needs runtime components and the shared repository is intentionally restructured as a package.        | D-011                |

## Later product phases

| ID     | Status        | Deferred functionality                                                               | Resume trigger and prerequisites                                                                                                                                           | Authority               |
| ------ | ------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| DW-033 | Roadmap phase | Commerce, Razorpay, verified orders, entitlements, refunds, scholarships, and expiry | Decide products, tax/accounting responsibility, webhook trust, refunds, access entitlement rules, support, security, and cost before provider integration.                 | ROADMAP phase 8, D-005  |
| DW-034 | Roadmap phase | Assessments, question bank, autosave, scoring, and results                           | Specify exam types, response models, scoring authority, attempts, timing, integrity, accessibility, result visibility, and retention.                                      | ROADMAP phase 9         |
| DW-035 | Roadmap phase | Ebooks, larger private assets, and video delivery                                    | Validate learning need and usage; then decide storage/CDN/video provider, rights, accessibility, bandwidth, retention, and scale cost.                                     | ROADMAP phase 10, D-002 |
| DW-036 | Roadmap phase | Student-facing AI, authorization-aware API, and MCP surfaces                         | Build only after internal domain services and authorization are mature; define data exposure, action authority, confirmation, audit, rate limits, and model/provider cost. | ROADMAP phase 13        |
| DW-037 | Roadmap phase | Aptitude assessment/product and approved lead integration                            | Specify the product independently, then define if and how consented results create or enrich CRM leads.                                                                    | ROADMAP phase 14        |

## Research horizon — lifelong Dexam

| ID     | Status        | Deferred functionality                               | Resume trigger and prerequisites                                                                                                                                                                                                               | Authority |
| ------ | ------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| DW-038 | Research only | College-stage value after entrance-exam preparation  | Interview former/current students and identify a recurring valuable problem before proposing a feature. Possibilities include study support, workshops, community, mentorship, portfolio development, and opportunities; none is approved yet. | D-005     |
| DW-039 | Research only | Graduate/working-professional value and monetization | Validate willingness to pay for a concrete outcome before choosing subscriptions, workshops, memberships, marketplace, or another model. Do not retain extra data or promise lifetime access merely for possible monetization.                 | D-005     |

## CRM follow-up work

| ID     | Status                     | Deferred functionality                           | Resume trigger and prerequisites                                                                                                                                                                               | Authority          |
| ------ | -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| DW-043 | Deferred, foundation ready | Public website enquiry intake and abuse controls | Define minimum fields, consent wording, origin authentication, throttling, bot/spam defense, idempotency, failure handling, and website-to-platform trust before connecting the separate marketing repository. | F010, D-022, D-002 |
| DW-044 | Deferred, foundation ready | CRM pipeline reporting and controlled exports    | Validate the operational decisions a report supports; then define aggregate privacy, role scope, date filters, export authority, watermark/audit behavior, retention, and download limits.                     | F010, D-022        |

## Completion log

Move an item here only after its required implementation is merged or the product owner explicitly rejects it. Record the date, pull request/decision, and outcome so its history remains discoverable.

- 2026-10-11 — DW-023 completed through F010 / PR #14: free in-app CRM assignment and due-follow-up alerts now derive from durable CRM state.
- 2026-10-11 — DW-032 completed through F010 / PR #14: the approved first CRM lead, ownership, follow-up, conversion-request, and notification foundation is merged; remaining CRM work has separate IDs.
- 2026-10-11 — DW-040 completed through F011 / PR #15: explicit CRM Coordinator assignment plus unassigned and inactive-owner recovery queues are merged.
- 2026-10-11 — DW-041 completed through F012 / PR #16: the Enrolment Operator CRM handoff and identity-resolution inbox is merged.
- 2026-10-11 — DW-042 completed through F013 / PR #17: purpose-based CRM retention, governed correction, two-person erasure, bounded holds, and privacy operations are merged with production activation still gated.
- 2026-10-13 — DW-026 completed through F014 / PR #25 and protected run `38298241510`: the owner-controlled fictional staging environment rebuilt from all committed migrations, redeployed every function, recreated deterministic fixtures, passed hosted authorization and advisor gates, and recorded 79 seconds.
