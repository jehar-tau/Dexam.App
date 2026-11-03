# D-064 — DEXAM Discovery across the academy and app

Accepted 2026-10-31. Authority: the product owner approved the current assessment/academy styling and explicitly requested that exact visual language across the whole DexAM app, plus a durable design system for future work.

## Decision

Use the approved paper, forest green, orange, Figtree/Zilla Slab, and original geometric illustration language. `docs/design/DISCOVERY.md` is the visual contract. `src/styles/discovery.css` is the active semantic token implementation for all app routes and both themes. Existing shared primitives and shells inherit it; discovery cards, entrances, and learning screens receive original SVG artwork. Storybook includes a full specimen and individual reusable brand/art patterns.

This supersedes ADR-011's visual source, without removing the historical vendored bundle or changing the component, accessibility, Storybook, and review requirements. No new runtime dependency or vendor is introduced. The academy keeps the same versioned contract and primitive-token manifest. `pnpm design:tokens` validates active tokens and role contrast instead of overwriting the theme with the dormant Figma generator.

The restyle retains role navigation, access checks, authentication, exam status meanings, printed question images, scoring, timing, entitlements, payment configuration, and private data behavior. Public entrance copy describes learning instead of the former engineering placeholder. This is a local implementation; production activation is not part of this decision.

## Verification

See `../features/F053-discovery-design-system.md` for scope and recorded evidence. The mandatory pre-push gate in `../QUALITY_GATE.md` still applies.
