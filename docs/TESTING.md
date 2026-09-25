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

A change is not complete until relevant documentation is updated, acceptance criteria pass, migrations work from a clean state, lint/types/tests/build succeed, and the applicable risk review is complete. Tests must demonstrate authorization boundaries, not just successful paths.

## Risk levels

- Green: copy, spacing, small visual corrections — normal verification and review.
- Yellow: user workflows or business logic — independent review plus staging owner check.
- Red: auth, permissions, payments, RLS, personal data, scoring, MCP/API, or production migrations — independent and security review plus staging owner approval.
