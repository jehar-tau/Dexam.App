# F037 — Assessment and test-series foundation

Status: fictional front-end foundation implemented locally; durable storage, official-paper import, scoring, real uploads, staff authoring, rankings, release and production remain gated.

Owner direction on 2026-10-27: build Dexam's independent UCEED, CEED, NIFT and NID test-series workflow without copying Roughworks' processed database. Source previous-year material from official publications and owner-authorized content. The public Roughworks question-bank count of 1,689 is a coverage benchmark, not an import source or completeness claim.

## First slice

- Student route `/student/tests`, including the existing fictional-preview guard.
- Original Dexam interface for section navigation, countdown, question palette, previous/next movement, answer entry and mark-for-review state.
- Response shapes for MCQ, MSQ, NAT and paper-drawing prompts.
- Device-local preview autosave and explicit submission lock.
- Preview-only Part B JPEG/PNG/PDF selection; no bytes are transmitted or retained.
- Fictional sample questions only. They are not described as PYQs and are not used for scoring claims.

## Required later slices

1. Versioned exam templates and marking rules for each official year/pattern.
2. Source manifest and review queue for official paper/answer-key acquisition, OCR, image extraction, answer reconciliation and attribution.
3. Private database schema, RLS, trusted autosave/final submission operations and server-authoritative time windows.
4. Private Part B upload storage, file validation, upload deadline and human-review workflow.
5. Staff question authoring/import, independent verification, publication and correction history.
6. Deterministic scoring, result release, percentile/rank policy and student-visible audit explanations.
7. Accessibility, reconnect/concurrency, integrity, retention and production capacity acceptance.

## Non-goals

- Scraping an authenticated or processed third-party question database.
- Reusing Roughworks explanations, tags, original mocks, images, branding or private workflow.
- Claiming that public availability alone establishes public-domain status.
- Production activation, paid services, invasive proctoring, webcam capture or behavioral surveillance.

## Acceptance for this slice

- Student preview can start the fictional test and move between all four sections.
- MCQ, MSQ and NAT answers persist in the preview session.
- Palette states distinguish unvisited, visited, answered, review and answered-plus-review.
- Countdown reaches a fail-closed submitted state.
- Part B accepts only a local browser file selection and clearly states that no upload occurs.
- Unit/component tests, formatting, lint, types and build pass before the slice is described as verified.
