# Dexam Platform Agent Guide

Dexam is an education platform for design-entrance preparation. The product owner is a designer and expects the development agent to lead frontend, backend, database, testing, security, deployment, and engineering operations.

## Start here

1. Read `docs/CURRENT_STATE.md`.
2. Use `docs/INDEX.md` to locate authoritative context.
3. Read only the feature specification and directly relevant documents. Do not bulk-read `docs/` or any future knowledge repository.
4. Follow `docs/DECISION_POLICY.md`. Never silently invent product, business, permission, privacy, payment, scoring, AI-authority, or costly architecture decisions.

## Engineering rules

- Prefer simple, reversible, well-supported technology.
- Keep the marketing website in `../../Dexam website/Website-Dexam` separate; use it only as a visual/content reference unless a task explicitly integrates it.
- Every meaningful feature needs a specification in `docs/features/`.
- Every durable or hard-to-reverse technical choice needs an ADR in `docs/decisions/`.
- Every database schema change requires a migration.
- Never bypass authorization or Supabase Row Level Security.
- Never commit secrets, `.env` files, production credentials, or student personal data.
- Add tests with implementation. Verify lint, types, unit/integration tests, build, and relevant browser journeys before declaring completion.
- Use existing design tokens and components before creating new patterns.
- Update `docs/CURRENT_STATE.md` when repository state materially changes.
- Do not modify production or incur paid services without explicit approval.

## Collaboration contract

Make low-risk implementation decisions independently. Explain recommendations in plain language. Present material choices as a numbered Decision Gate with options, recommendation, reason, impact, and reversibility. Record the approved answer in the appropriate specification or ADR; chat history is not authoritative.
