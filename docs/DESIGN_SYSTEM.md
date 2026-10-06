# Design System

The product owner owns product and visual direction. Engineering translates approved design decisions into accessible, reusable primitives and documents implementation constraints.

## Rules

- Establish semantic tokens for color, typography, spacing, radius, elevation, motion, and breakpoints before feature styling proliferates.
- Reuse approved components and interaction patterns.
- Every component supports keyboard use, visible focus, appropriate semantics, readable contrast, loading, empty, error, disabled, and responsive states where relevant.
- Avoid copying the marketing website's implementation blindly. Its content and visual language are references; the platform has different interaction and accessibility demands.
- User-visible changes require owner approval through a design or feature specification.

## Source of truth

The enforced, reviewable truth for implementation is the shared **`dexam-portfolio-design-system`** repository (GitHub, public), used by both this application and the product owner's portfolio site. See `decisions/ADR-011-shared-design-system-repository.md` (supersedes part of `decisions/ADR-010-design-system-tooling.md`).

- It is a reference bundle to read and reimplement from in Dexam's own stack (React/Vite), not an installable dependency — do not `npm install` it or import its `.jsx` files directly.
- Only its tokens and generic UI primitives (buttons, inputs, cards, navigation, overlays, data display, feedback) apply to Dexam. Its portfolio-specific content components and content-voice guidance do not — see that repo's own `README.md` for the exact boundary.
- Patterns/components implemented here: one spec per pattern in `design/components/*.md` (states, composition rules, accessibility, do/don't, and the exact shared-repository source path/commit). A pattern is not approved for reuse until it has both a spec and a Storybook story here.
- Catalog: components live in `src/components/`, documented and visually inspectable in Storybook (`pnpm storybook`), published at the GitHub Pages site built by `.github/workflows/deploy-storybook.yml`.
- Shared tokens are currently vendored verbatim and pinned to a source commit in `src/styles/design-system/README.md`. Updates are a manual, reviewed sync until an automated import is justified.
