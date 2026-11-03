# Design System

**Current authority: DEXAM Discovery 1.0**, approved by the owner on 2026-10-31 for the entire academy website and DexAM app. Read [the complete visual contract](design/DISCOVERY.md), [tokens](design/discovery.tokens.json), and [D-064](decisions/ADR-064-discovery-design-system.md) before UI work. This direction supersedes the older portfolio theme below. The active theme is `src/styles/discovery.css`.

The product owner owns product and visual direction. Engineering translates approved design decisions into accessible, reusable primitives and documents implementation constraints.

## Rules

- Establish semantic tokens for color, typography, spacing, radius, elevation, motion, and breakpoints before feature styling proliferates.
- Reuse approved components and interaction patterns.
- Every component supports keyboard use, visible focus, appropriate semantics, readable contrast, loading, empty, error, disabled, and responsive states where relevant.
- Avoid copying the marketing website's implementation blindly. Its content and visual language are references; the platform has different interaction and accessibility demands.
- User-visible changes require owner approval through a design or feature specification.

## Historical source (superseded visually by D-064)

ADR-011 previously used the shared **`dexam-portfolio-design-system`** repository. Its vendored files are preserved unchanged for provenance, but its colors, typography, and effects are no longer active. Generic component behavior and accessibility remain useful; Discovery controls visual decisions.

- It is a reference bundle to read and reimplement from in Dexam's own stack (React/Vite), not an installable dependency — do not `npm install` it or import its `.jsx` files directly.
- Only its tokens and generic UI primitives (buttons, inputs, cards, navigation, overlays, data display, feedback) apply to Dexam. Its portfolio-specific content components and content-voice guidance do not — see that repo's own `README.md` for the exact boundary.
- Patterns/components implemented here: one spec per pattern in `design/components/*.md` (states, composition rules, accessibility, do/don't, and the exact shared-repository source path/commit). A pattern is not approved for reuse until it has both a spec and a Storybook story here.
- Catalog: components live in `src/components/`, documented and visually inspectable in Storybook (`pnpm storybook`), published at the GitHub Pages site built by `.github/workflows/deploy-storybook.yml`.
- Historical tokens remain pinned in `src/styles/design-system/README.md`. Only spacing is imported from that bundle. `pnpm design:tokens` now validates Discovery's active tokens and text contrast; it does not run the dormant Figma generator.

## Published catalog

[Dexam component library](https://jehar-tau.github.io/Dexam.App/) is live on the already-approved GitHub Pages host. On 2026-10-14, its existing deployment failure was traced to Pages not being enabled; enabling workflow hosting and retrying deployment run `38455303786` succeeded. The static catalog and `index.json` return HTTP 200 with 29 entries. This publishes approved component examples only, not application credentials, real student data, or a production backend. No new vendor or paid service was added.
