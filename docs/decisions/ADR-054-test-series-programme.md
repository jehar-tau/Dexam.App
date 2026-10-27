# D-054 — Test-series programme: product home, content rights, release order and exam interface

Status: Approved by the owner on 2026-10-28 (all four recommended options). Extends D-053 B; it does not authorize production, real student data, paid services or public sales.

## Context

The owner wants one UCEED, CEED, NID and NIFT mock-test product with two audiences:

- **The public across India:** sold, with Google sign-in.
- **Dexam coaching students:** topic practice during the course and full mocks before the exam.

Mocks are generated from one common question bank. Questions are mixed across source exams to fit each exam's current pattern, and no student ever sees a question twice. Results include a selection-likelihood band, review of incorrect answers and a progress chart. Drawing-based papers end with a timed upload window.

The content workstation (`Dexam_Mock_Test`, outside this repository) already holds 4,183 imported official-paper questions with provenance, page renders and figure crops. On 2026-10-27, 539 of them were cleared to serve; the rest await crop review, answer keys or transcription.

## Decisions

### 1. Product home

- **A — Selected:** build inside this platform as the continuation of F037. It reuses identity, roles, row-level security, private uploads, teacher review, the design system, CI and tests. Coaching students already have accounts here.
- B: a separate public application with its own database and login. Faster to start, but it creates two student identities and duplicates auth and uploads.
- C: extend the vanilla-JS prototype in `Dexam_Mock_Test`. It has no production-capable database, login, payments or capacity.

### 2. Content rights for paid mocks

Official papers belong to IIT Bombay, NID and NIFT. Some NID material comes from a coaching institute's compilation.

- **A — Selected:** build with the full mixed bank now. Free and coaching use can proceed once the other launch gates pass. **Public paid sales wait for a documented legal view or permission.** Every paper can be regenerated from original Dexam questions without code changes, because each question carries `source` and `licence`.
- B: sell official-content mocks immediately, accepting the risk.
- C: paid mocks use original questions only.

### 3. Release order

- **A — Selected:**
  - **R1 — self-paced test series:** Google sign-in, B.Des/M.Des onboarding, free papers, exam interface, Part B uploads, scoring, results, review, profile and progress, topic practice, Part B evaluation.
  - **R2 — commerce:** Razorpay, products, entitlements, refunds.
  - **R3 — all-India live mock:** registration, waiting room, synchronized Part A, break, Part B and upload, cohort rank.
- B: build everything before any release.
- C: the live event first.

### 4. Exam interface

- **A — Selected:** rebuild the official computer-based exam experience in Dexam's own code, with instruction wording drawn from official exam notices. That covers instruction pages, declaration, palette states, Save & Next, Mark for Review, Clear Response, NAT keypad, section tabs and server timer. No third-party (for example Roughworks) code, text, assets or branding.
- B: reproduce Roughworks' look and flow. Rejected: their terms forbid copying code, content and branding.

## Consequences

- **Feature specs:** the work is split into F038–F050. The map and critical path are in `docs/assessment/TEST_SERIES_PROGRAMME.md`. Each slice still needs its own spec, tests and PR, and every student-visible, scoring, access, pricing or permission choice inside a slice needs its own Decision Gate.
- **Brand colour:** primary actions use the shared design system's earthy orange (`--color-primary`). Whether the exam palette keeps the official status colours is a separate Decision Gate in F042.
- **Commerce:** DW-033 stays deferred until R2. R2 cannot go live for public paid sales until the content-rights gate in decision 2 is satisfied.
- **Content readiness is the critical path:** UCEED and CEED Part A are mostly visual. The workstation will serve reviewed lossless PNG crops instead of waiting for SVG reconstruction. A recreated image must not change orientation, position, proportions or content.

## Reversibility

- The product home is reversible until F038 migrations reach production. After that, moving costs a data migration.
- The content-rights choice is reversible per question through `licence` and publication state.
- The release order can be changed before each release begins.
