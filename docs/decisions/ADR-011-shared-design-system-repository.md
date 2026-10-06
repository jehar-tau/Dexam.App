# ADR-011 — Shared Design System Repository

Status: Approved
Date: 2026-10-04
Decision ID: D-011
Risk: Yellow — reversible tooling choice, no recurring cost
Supersedes: ADR-010 §1 (Source of truth format) and amends ADR-010 §2's reasoning

## Decision required

Approve replacing the planned Figma-Variables-JSON token pipeline with a concrete, already-produced design system, and approve hosting it in its own repository shared with the product owner's portfolio site rather than inside this repository.

## Context

ADR-010 planned for a future Figma Variables export in W3C Design Tokens (DTCG) JSON format, landing at `docs/design/tokens/figma-tokens.json` in this repository. Before that export arrived, the product owner instead produced a full design system — tokens, 43 components, patterns, and guideline documentation — using Claude Design (claude.ai/design), originally scoped to their personal portfolio site. The product owner has decided to use this same system for Dexam, and wants it maintained as one shared asset rather than duplicated or redone per codebase.

## Decision

- The design system lives in its own repository, `dexam-portfolio-design-system` (GitHub, public), independent of both this repository and the portfolio site's repository. Two consumers already exist (the portfolio site and Dexam), which is exactly the condition ADR-010 §2 said would justify a separate location.
- It is a **reference bundle to read and reimplement from**, not an installable runtime package. It ships HTML/CSS/JS prototypes and component `.jsx` files meant to be recreated pixel-perfectly in each consumer's own stack (plain JS for the portfolio site's no-build setup; React/Vite here), per the bundle's own authoring instructions. Dexam does not `npm install` it or add it as a git submodule by default.
- Only the shared, generic parts apply to Dexam without a separate decision: design tokens and generic UI primitives (buttons, inputs, cards, navigation, overlays, data display, feedback). The bundle's portfolio-specific content components (case study cards, experience cards) and its content-voice guidance (first-person portfolio narration) do not apply to Dexam's multi-role student/teacher/admin product and must not be reused as-is.
- The DTCG-JSON pipeline from ADR-010 (`docs/design/tokens/figma-tokens.json`, `scripts/design/build-tokens.mjs`) is superseded. It produced correct, verified output against the placeholder it shipped with, but there is no longer a Figma Variables export to consume — the real source is the shared repository's `project/tokens/*.css`. Reconciling Dexam's existing token names (`--color-canvas`, `--color-ink`, ...) against the shared system's names (`--bg-page`, `--text-body`, ...) and deciding how Dexam pulls updates from the shared repo (manual sync vs. submodule vs. something else) is follow-up implementation work, tracked in `CURRENT_STATE.md`, not decided by this ADR.
- The Storybook scaffold, its GitHub Pages deployment, and the `docs/design/components/` spec convention from ADR-010 are unaffected and remain the plan for documenting whatever components Dexam ends up implementing from the shared system.

## Alternatives considered

### Vendor a copy of the shared design system into this repository

Rejected: with two consumers now confirmed, a vendored copy would drift from the portfolio site's copy the first time either changes independently. A single shared repository is the only option that keeps both in sync by construction.

### Install the shared repository as a dependency (npm package or git submodule) and consume its components directly

Rejected for now: the bundle is authored as prototypes meant to be reimplemented per target stack, not as a runtime library — its own instructions say so explicitly. Treating it as an installable dependency would fight that intent and couple Dexam's React components to markup never meant to run as-is. Revisit only if the shared repository is later restructured as an actual publishable component library.

## Consequences

### Benefits

- One real, already-built design system replaces a hypothetical future Figma export; no more waiting on a pipeline that had nothing real to consume.
- Visual consistency between the portfolio site and Dexam is achievable without duplicating design work.
- Scope boundary (shared vs. portfolio-specific) is written down now, before any Dexam feature accidentally reuses portfolio-voice content components.

### Costs and risks

- No automated sync between the shared repository and either consumer; staying current is a manual, reviewed process until/unless that's automated.
- Token names differ between Dexam's current `tokens.css` and the shared system's naming; adopting the shared tokens means a rename pass through existing Dexam styles, not a drop-in replacement.
- The placeholder DTCG pipeline built under ADR-010 is now dead code in this repository until it is either repurposed or removed.

## Reversibility and migration

Fully reversible. No Dexam application code depends on the shared repository yet; this ADR only fixes where the design system lives and how it may be consumed. Actually migrating Dexam's tokens and first components to it is separate, future work requiring its own PR(s).

## Approval

Approved by the product owner in chat on 2026-10-04: the Claude Design bundle, generalized and renamed `dexam-portfolio-design-system`, becomes the shared design system for both the portfolio site and Dexam, hosted in its own public GitHub repository.
