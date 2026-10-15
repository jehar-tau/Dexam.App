# D-041 — Milestone after authorized navigation

Status: Option A approved by owner, 2026-10-15

## Question and options

After F026, choose the next milestone without silently adding modules or activating production.

- **A — Guided fictional pilot review (recommended, selected):** Review existing student, teacher and staff flows with the designer; record usability issues and fix implementation defects within existing approved behaviour. ₹0 additional vendor spending; requires owner feedback. New patterns, business rules or authority still need approval.
- **B — Production-readiness planning:** Turn email, privacy/retention, backup/restore, support ownership and cost gates into an actionable plan. ₹0 discovery; no provider, spending, real data or production activation. Deferred in favour of A.
- **C — Deferred-module discovery:** Choose and specify another module before implementation. ₹0 discovery, larger scope and separate permission/privacy/cost decisions. Deferred in favour of A.

## Boundary

Use only fictional content and existing styles. Preview screens support visual review but do not prove authorization, upload, microphone, email or provider behaviour. Actual account evidence remains in `PILOT_READINESS.md`; local acceptance is not launch approval. Do not pre-approve changes on behalf of the designer or widen Teacher authority. Preserve `DEFERRED_WORK.md` and all production gates.

## Sequence

Start with student assignments and published feedback, then teacher review, coursework/content and admissions operations. Capture the owner's observations in F027. Engineering owns environment setup and PRs; the owner decides user-visible direction.
