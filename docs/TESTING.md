# Testing Strategy

Testing is part of feature implementation, not a later cleanup phase.

## Layers

- Static: formatting, linting, strict TypeScript, dependency and secret checks.
- Unit: pure business rules, validation, calculations, and state transitions.
- Integration: database behavior, migrations, RLS policies, storage permissions, and server functions against local Supabase.
- Component: critical interface behavior and accessibility where unit-level rendering adds confidence.
- End-to-end: the smallest set of high-value student, teacher, sales, and admin journeys in a real browser.
- Manual design QA: responsive layout, interaction feel, copy, and visual fidelity on staging.

## Initial tooling recommendation

- Vitest + Testing Library for unit/component tests
- Supabase/PostgreSQL tests for schema and RLS
- Playwright for browser journeys
- GitHub Actions for repeatable CI

## Definition of done

`pnpm build` and `pnpm build:staging` additionally validate generated JavaScript chunks: each must be non-empty and at most 500,000 bytes, and application/React/Supabase/shared-library groups must exist. This is an engineering regression budget, not a network or business SLA. Unit boundary tests exercise the check, while Chromium tests validate actual module initialization. The browser test command builds its own preview-enabled artifact; normal/staging builds retain their existing preview guards.

Preview-enabled browser test output is isolated in ignored `dist-e2e/`, and Playwright explicitly serves that directory. Normal/staging builds continue using `dist/`. Never deploy `dist-e2e/` or reuse it for a normal release; the fictional preview flags are intentionally different. The prior shared output allowed a normal build to replace the running test artifact and cause false preview failures. Still run builds/tests sequentially when possible because TypeScript build metadata remains shared.

A change is not complete until relevant documentation is updated, acceptance criteria pass, migrations work from a clean state, lint/types/tests/build succeed, and the applicable risk review is complete. Tests must demonstrate authorization boundaries, not just successful paths.

## Risk levels

- Green: copy, spacing, small visual corrections — normal verification and review.
- Yellow: user workflows or business logic — independent review plus staging owner check.
- Red: auth, permissions, payments, RLS, personal data, scoring, MCP/API, or production migrations — independent and security review plus staging owner approval.
