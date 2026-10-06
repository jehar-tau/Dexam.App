# Design System Pipeline

See `../decisions/ADR-011-shared-design-system-repository.md` for the current source of truth and `../decisions/ADR-010-design-system-tooling.md` for the component/Storybook/hosting decisions still in effect. See `../DESIGN_SYSTEM.md` for the engineering rules.

## Current source of truth

The design system now lives at the shared, public repository **`dexam-portfolio-design-system`** (also used by the portfolio site), not a Figma export. Its `project/tokens/*.css` files are vendored verbatim in `src/styles/design-system/` and pinned to the source commit documented there. Dexam-specific aliases belong in `src/styles/tokens.css`; never edit the vendored files by hand.

## Superseded: the Figma-DTCG token pipeline

`scripts/design/build-tokens.mjs` and `tokens/figma-tokens.json` below implemented ADR-010's original plan (a future Figma Variables export). That plan is superseded by ADR-011 — there is no Figma export to consume, and this pipeline is currently unused. It is left in place rather than deleted in case a real Figma Variables export is ever added on top of the shared repository; treat it as dormant, not authoritative.

1. In Figma, update the Variables.
2. Export them as W3C Design Tokens (DTCG) JSON and save over `tokens/figma-tokens.json`.
3. Run `pnpm design:tokens` to regenerate `src/styles/tokens.css`.
4. Commit both the JSON export and the generated CSS together.

Values CSS can express but Figma Variables cannot (e.g. `color-scheme`, `clamp()` expressions) live in `src/styles/tokens.manual.css` and are merged in by the same script — edit that file by hand, never `tokens.css` directly.

## Adding an approved pattern

1. Build the component in `src/components/`.
2. Write its spec in `components/` using `../templates/COMPONENT_SPEC_TEMPLATE.md`, naming the exact source path and source commit. Add a reference image when a new Figma frame supplements the shared source.
3. Add a Storybook story next to the component (`*.stories.tsx`) covering its states.
4. A pattern is only "approved for reuse" per `../DESIGN_SYSTEM.md` once both the spec and the story exist.

## Browsing the catalog

```bash
pnpm storybook
```

The built catalog is published to GitHub Pages by `.github/workflows/deploy-storybook.yml` on every push to `main`.
