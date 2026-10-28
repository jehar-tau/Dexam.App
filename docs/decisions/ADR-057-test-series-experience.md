# D-057 — Test-series experience: separate shell, theme and exam window

Status: Approved by the owner on 2026-10-28, all recommended options. D-055 (bank-management permissions) was approved in the same message: Option A, Admin only, with MFA for import and answer keys.

## Context

The owner rejected the first test-series preview: it was a 4-question demo inside the coaching portal's top navigation. They then reviewed Roughworks while signed in and asked for an experience of that quality. The redesign plan (owner's copy: `TEST_SERIES_REDESIGN_PLAN.md`) splits the rebuild into eight steps, each delivered as a page the owner can try.

## Decisions

1. **Separate app area.** The test series lives at `/tests` with its own shell: a left sidebar (Overview, Analytics, Practice, Papers, Mocks, Bookmarks, Sketches), the profile at the top, and the theme toggle and sign-out at the bottom. On phones, a top bar with an off-canvas menu. It does not use the coaching portal's top navigation. The student portal's "Test series" link opens `/tests/papers`. _(Superseded by D-059 / ADR-059: one left-sidebar student portal for `/student` and `/tests`; Analytics merged into the Overview; Bookmarks and Sketches removed.)_
2. **Theme.** The Dexam design-system light theme is the default, with orange primary actions. Dark is optional and remembered per device. The theme attribute is set on `<html>` while the shell is mounted, because the design-system aliases are declared on the root.
3. **Exam window look.** The timed exam window (step 2) mimics the official computer-based exam (exam-centre login, official instructions and palette legend, declaration, exam screen), not the Dexam brand. Instruction wording comes from the official exam notices.
4. **No third-party assets.** Roughworks is a quality and flow benchmark only: no code, wording, branding, explanations or question images (D-054 decision 4).

## Consequences

- F051 delivers step 1 (shell and Papers page) with fictional preview data. Later steps get their own specs.
- The old F037 runner at `/student/tests` stays reachable until the step 2 exam window replaces it.

## Reversibility

Reversible: routes and styling only. No schema or permission change.
