# Test-series programme (D-054)

This file maps the UCEED, CEED, NID and NIFT test series from the question bank to the all-India live mock. Each row becomes a feature spec when its work starts. A row here is a plan, not an approval to build: student-visible, scoring, access, pricing and permission choices inside a slice still need their own Decision Gate.

## Repositories

| Repository                                                 | Responsibility                                                                                                             |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `Dexam_Mock_Test` (content workstation, outside this repo) | PDF import, OCR, answer keys, figure crops, review console, tagging and the versioned bank export.                         |
| `dexam-platform` (this repo)                               | Identity, test series, exam interface, scoring, results, profile, uploads, evaluation, and later commerce and live events. |

Content moves one way only: the workstation exports a versioned bank file and media, and F038 imports it. The platform never reads the workstation database.

## Release 1 — self-paced test series

| ID   | Slice                          | Summary                                                                                                                                                                                                                                                                                |
| ---- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F038 | Question bank                  | Postgres schema for questions, options, assets, server-only answer keys, provenance and topics; private media bucket; idempotent import of the workstation export with quarantine.                                                                                                     |
| F039 | Public sign-in and onboarding  | Google sign-in through Supabase for public candidates (coaching students keep Member ID). B.Des/M.Des, target exams and exam year. Gate: whether a Google identity can be linked to an existing Member ID.                                                                             |
| F040 | Blueprints and paper generator | Year-versioned blueprints (UCEED, CEED, NIFT B.Des/B.F.Tech/M.Des, NID B.Des/M.Des). Fills slots by type, topic, difficulty, time and image dependency from the common pool, using the target exam's marking. A per-candidate exposure ledger guarantees no repeats. Shortfall report. |
| F041 | Entitlements                   | Grants from free onboarding (B.Des: UCEED, NID B.Des, NIFT B.Des; M.Des: CEED, NID M.Des, NIFT M.Des), coaching enrolment and, later, purchase.                                                                                                                                        |
| F042 | Exam interface                 | Official-style instructions and declaration, server-authoritative timer, palette states, Save & Next, Mark for Review, Clear Response, NAT keypad, section tabs, image zoom, idempotent autosave, submit lock, auto-submit. Builds on the F037 runner. Gate: palette status colours.   |
| F043 | Drawing and Part B uploads     | Timed drawing tasks, then a 5–10 minute upload window set per blueprint. Uses the F030 upload reservation. Deadline enforced by the server. Covers drawing-only papers.                                                                                                                |
| F044 | Scoring and results            | Deterministic server scoring: NAT tolerance and alternative answers, the MSQ partial-credit ladder, MCQ negative marking, dropped questions and questions awarded full marks. Results by section and topic, time per question, areas to improve, read-only review of the attempt.      |
| F045 | Selection likelihood           | High/Medium/Low bands from a versioned formula: past qualifying cut-offs where they are officially published (UCEED, CEED); cohort percentile plus published seat and applicant ratios otherwise. Always labelled a Dexam estimate. Gate: formula and wording.                         |
| F046 | Profile and progress           | Attempt history with score and band, a link back to each result and review, and a per-exam progress chart (date by normalised score).                                                                                                                                                  |
| F047 | Topic practice                 | Sets by exam, topic, difficulty and size, timed or untimed, with answer reveal. Gate: whether practised questions count as seen for mocks.                                                                                                                                             |
| F048 | Part B evaluation              | Rubric scoring by teachers, reusing the teacher review queue. The combined result waits for evaluation. Gate: who evaluates public candidates and whether it is paid.                                                                                                                  |

## Release 2 — commerce (F049)

Products (single paper, exam bundle, all-exam pass, event pass), Razorpay orders, authenticated idempotent webhooks, entitlements with expiry, refunds and GST invoices. Resolves DW-033.

Public paid sales are blocked until the D-054 content-rights condition is met. Pricing, refunds and expiry each need a Decision Gate.

## Release 3 — all-India live mock (F050)

An event moves through these states:

1. Draft
2. Published
3. Registration open
4. Registration closed
5. Waiting room
6. Part A live
7. Break
8. Part B live
9. Upload window
10. Evaluation
11. Results

Each event has seats and roll numbers, starts on a server schedule, and gives every participant an identical paper whose questions are then added to each participant's exposure ledger. The break between parts is configurable (15–20 minutes). Rank and percentile are labelled "Dexam cohort rank". Before the first event, autosave and timer traffic must be load-tested on a paid project. Gate: the seat cap.

## Critical path: content readiness (workstation)

1. Serve reviewed lossless PNG crops for visual questions. SVG reconstruction is optional and must not change orientation, position, proportions or content.
2. Work through the recovery queue: crop review, options, transcription.
3. Add answer keys. Official keys first; an independently solved answer is accepted only after a blind second pass reproduces it.
4. Review topic, subtopic, difficulty, estimated time and image dependency for every question that will be served.
5. Export the bank with provenance, licence, review state and version.

Readiness target for R1: each 2026 blueprint can fill at least 10 non-repeating mocks per exam.

## Owner decisions still open

- Linking a Google identity to a Member ID (F039).
- Attempt policy (F040/F042).
- Whether practice exposure counts for mocks (F047).
- Palette status colours (F042).
- Likelihood formula and wording (F045).
- Who evaluates public Part B, and whether it is paid (F048).
- Pricing, refunds and expiry (F049).
- Seat cap (F050).
- Confirmation of each 2026 blueprint (F040), NID especially.
