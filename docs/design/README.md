# Design System Pipeline

Read [DEXAM Discovery 1.0](DISCOVERY.md) and [D-064](../decisions/ADR-064-discovery-design-system.md) for the current visual authority. `src/styles/discovery.css` is active. The component/Storybook/hosting decisions remain in effect. See `../DESIGN_SYSTEM.md` for engineering rules.

## Current source of truth

The owner approved the academy/assessment visual language for the whole app on 2026-10-31. Its contract is `DISCOVERY.md`, its primitives are versioned in `discovery.tokens.json`, and Storybook contains light/dark specimens. The earlier portfolio bundle remains verbatim in `src/styles/design-system/` for history; only its spacing is active. Never edit its provenance or use it to override Discovery.

## Superseded: the Figma-DTCG token pipeline

`scripts/design/build-tokens.mjs` and `tokens/figma-tokens.json` below implemented ADR-010's original plan (a future Figma Variables export). That plan is superseded by ADR-011 — there is no Figma export to consume, and this pipeline is currently unused. It is left in place rather than deleted in case a real Figma Variables export is ever added on top of the shared repository; treat it as dormant, not authoritative.

1. In Figma, update the Variables.
2. Export them as W3C Design Tokens (DTCG) JSON and save over `tokens/figma-tokens.json`.
3. Historical only: do not regenerate `src/styles/tokens.css` from the dormant Figma pipeline. `pnpm design:tokens` now checks the Discovery contract and contrast without writing files.
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
