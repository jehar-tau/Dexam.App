# F027 — Guided fictional pilot review

Status: Current-layout approval complete under owner-approved D-041 Option A; engineering acceptance verified locally, PR checks pending

2026-10-15 owner update: **all current UI layouts are approved provisionally for continued engineering**. The owner wants to see the whole application before requesting later visual changes. Stop screen-by-screen layout approval gates. This includes currently unwalked layouts, but is not evidence that every screen was personally inspected or that all functional/provider flows passed. New product rules, authority, paid services, real data and production remain separately gated. Preserve the existing design-system authority for later refinements.

No new product feature, permission, vendor or production activation. Walk through approved screens using fictional content; distinguish preview visual inspection from actual account behaviour. Codex handles tooling and keeps the review record; the designer supplies usability direction.

## Review order

1. Student assignments and published feedback: can students find the task, understand upload/submission versus review/correction state, and read the teacher's next step? Check desktop/mobile navigation, thumbnail expansion and readable feedback.
2. Teacher review: uploaded-file thumbnail/expansion, written feedback, microphone/dictation activation, optional voice note and next-step editing. External transcription/AI proofreading remain disabled until separately approved; do not treat preview simulations as working providers.
3. Student coursework, checklist, class agenda and bounded work archive: clear access, self-reported progress and expiry wording. Some screens require actual fictional accounts, not preview.
4. Scoped content authoring/distribution and Sales/operator handoff: draft versus publication, deliberate release, canonical identity and recovery boundaries.

## Review record

| Area                         | Owner observation                                                                             | Disposition                                                       | Evidence                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Student assignments/feedback | Owner explicitly approved the reviewed layout on 2026-10-15 and requested teacher review next | Layout accepted; no changes requested                             | F026 actual desktop/mobile screenshots inspected; live-account automation passed separately       |
| Teacher review               | Owner said "looks good" on 2026-10-15 after reviewing the teacher preview                     | Layout accepted; D-031 A review queue only remains                | Thumbnail expansion/close verified; external providers still disabled                             |
| Student coursework           | Owner explicitly approved the reviewed Perspective layout on 2026-10-15                       | Layout accepted; no changes requested                             | Topic switching and three lesson notes verified in preview                                        |
| Content management           | Owner explicitly approved the reviewed layout on 2026-10-15                                   | Layout accepted; no changes requested                             | Visual preview only; no actual publication performed                                              |
| Assignment distribution      | Included in owner's provisional approval of all current layouts                               | Layout accepted for continued engineering                         | Actual scoped form release, persisted request retry and single student instance verified          |
| Other existing workspaces    | Included in owner's provisional approval of all current layouts                               | No further per-screen approval needed; later refinements retained | Not all screens individually inspected; `PILOT_READINESS.md` retains functional evidence and gaps |

Record each accepted issue before implementation. Existing-behaviour bugs can be fixed and tested independently; changed patterns, workflow rules, authority or provider activation require a Decision Gate. Keep credentials, one-time links and real personal data out of this record.

## Engineering continuation

Extend the existing disposable local composed pilot to release an assignment through the actual scoped staff form, verify its persisted request and retry invariance, then continue through the existing student submission/teacher feedback flow. No new default grants, fixtures retained for real users, new UI or runtime authority. Existing exact cleanup remains mandatory.

2026-10-15 result: actual composed pilot passed with preview disabled, including staff form release, persisted request retry invariance, student submission and published teacher feedback. Exact fixtures/accounts/audit/events/files were removed and original trigger flags restored. Independent read-only review found no blockers. `pnpm verify` passed formatting, lint, types, 295 app tests and production build. Existing full pilot baseline remains 1075 DB assertions, 63 browser smoke journeys and nine actual local scripts; those counts are prior F026 evidence, not a claim that all nine were rerun for this test-only delta. No runtime, database or permissions changed. Required PR checks still precede merge.

## Acceptance

- Owner feedback recorded with explicit scope, not inferred from silence.
- Approved defects fixed, relevant regression tests and visual checks pass.
- Independent review where risk requires it, clean CI and automatic PR handling.
- Remaining owner concerns/deferred scope retained; no claim of production readiness.
