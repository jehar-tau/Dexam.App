# ADR-010 — Design System Source of Truth and Hosting

Status: Partially superseded by `ADR-011-shared-design-system-repository.md` (§1 Source of truth format). §2 Component library and §3 Hosting remain in effect.
Date: 2026-10-04
Decision ID: D-010
Risk: Yellow — reversible tooling choice, no recurring cost, no vendor lock-in

## Decision required

Approve the format for importing the product owner's Figma UI patterns as an authoritative source, where approved components live, and what free tool hosts a browsable design system.

## Context

`DESIGN_SYSTEM.md` deferred the token format and component technology to "when the application scaffold is finalized." Design tokens already exist informally as CSS custom properties in `src/styles/tokens.css`. The product owner has produced UI patterns in Figma and wants them to become the enforced source of truth for future UI work, with a way to verify implementation against them without opening Figma.

## Decision

### 1. Source of truth format

- **Tokens** (color, type, spacing, radius, elevation, motion, breakpoints): exported from Figma Variables as **W3C Design Tokens (DTCG) JSON**. The export is committed at `docs/design/tokens/figma-tokens.json` and a build script (`scripts/design/build-tokens.mjs`) generates `src/styles/tokens.css` from it, so the CSS in the repo is always a derived artifact, never hand-edited away from Figma.
- **Patterns/components** (states, composition rules, do/don't): one markdown spec per pattern under `docs/design/components/`, each with an exported Figma PNG for reference. A pattern is not "approved" for reuse until it has a spec here.
- Figma remains the design workspace; the exported JSON/markdown in this repository is the authoritative, diffable record `DESIGN_SYSTEM.md` and `AGENTS.md` already require.

### 2. Component library

Build components incrementally inside this repository at `src/components/`, documented with **Storybook**. No separate publishable package is created now — there is one consuming application, so a package boundary would add versioning and release overhead with no current benefit (`ARCHITECTURE.md` cautions against infrastructure without demonstrated need). Extracting a package remains possible later if a second application needs these components.

### 3. Hosting the browsable design system

- **Storybook**, built as a static site and deployed to **GitHub Pages** via a dedicated GitHub Actions workflow (`deploy-storybook.yml`), triggered on push to `main`. No new vendor account, no recurring cost, reuses the GitHub Actions already in place.
- **Chromatic** is not adopted now. Its free tier would add visual regression testing, but also a third-party account and build-snapshot budget to manage for a component library that does not exist yet. Revisit once there are enough components that regressions are a real risk; adding it later is additive and does not require reversing this decision.

## Alternatives considered

### Chromatic as the primary host now

Rejected for now: free-tier snapshot limits and an external account are not justified before there is a component library to regress-test. GitHub Pages hosting of the same Storybook build is free and already fits the CI in place.

### A separate `@dexam/ui` package from the start

Rejected: no second consumer exists yet. Packaging now would mean maintaining versioning and publishing workflow for no present reader.

### Hand-maintained `tokens.css` as the source of truth, Figma as a visual reference only

Rejected: the product owner explicitly wants Figma patterns to be the enforced truth. Without a generated artifact, token drift between Figma and code would go unnoticed.

## Consequences

### Benefits

- Figma changes have one committed, diffable, reviewable JSON artifact instead of being eyeballed into CSS.
- Storybook gives every future component a documented, visually inspectable state catalog, directly supporting the "reuse approved components" rule in `DESIGN_SYSTEM.md`.
- Zero recurring cost; stays inside the free-first policy in `COST_MODEL.md`.

### Costs and risks

- The Figma → JSON export step is manual until/unless a Figma plugin automates it; a stale export can drift from the live Figma file if exports are forgotten after a design change.
- Storybook adds a devDependency and a second build pipeline to maintain in CI.
- GitHub Pages hosting is public by default; the Storybook site must not include unreleased sensitive product copy or real data, consistent with existing preview-deployment rules.

## Reversibility and migration

Fully reversible. Storybook can be removed without touching application code. Switching the tokens pipeline to a different export format or adding Chromatic on top are additive changes, not rewrites.

## Approval

Approved by the product owner in chat on 2026-10-04: proceed with Figma Variables → DTCG JSON → generated `tokens.css`, an in-repo component library documented with Storybook, and GitHub Pages hosting of the built Storybook site, with Chromatic deferred.
