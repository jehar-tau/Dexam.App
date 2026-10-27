# Dexam Platform Agent Guide

Dexam is an education platform for design-entrance preparation. The product owner is a designer and expects the development agent to lead frontend, backend, database, testing, security, deployment, and engineering operations.

## Start here

1. Read `docs/CURRENT_STATE.md`.
2. Use `docs/INDEX.md` to locate authoritative context.
3. Read only the feature specification and directly relevant documents. Do not bulk-read `docs/` or any future knowledge repository.
4. Follow `docs/DECISION_POLICY.md`. Never silently invent product, business, permission, privacy, payment, scoring, AI-authority, or costly architecture decisions.
5. When planning a new slice or deferring requested scope, consult and update `docs/DEFERRED_WORK.md`; it is the canonical register for work intentionally left out.

## Engineering rules

- Treat the repository as a shared workspace: the product owner may also make changes through Cloud Code or other tools, even though Codex is the primary development agent. Before implementing anything, inspect the current branch, working tree, recent commits, and existing implementation to verify whether the requested work already exists. Preserve unfamiliar changes, avoid duplicate implementations, and reconcile overlapping work instead of overwriting it.
- Prefer simple, reversible, well-supported technology.
- Keep the marketing website in `../../Dexam website/Website-Dexam` separate; use it only as a visual/content reference unless a task explicitly integrates it.
- Every meaningful feature needs a specification in `docs/features/`.
- Every durable or hard-to-reverse technical choice needs an ADR in `docs/decisions/`.
- Every database schema change requires a migration.
- Never bypass authorization or Supabase Row Level Security.
- Never commit secrets, `.env` files, production credentials, or student personal data.
- Add tests with implementation. Verify lint, types, unit/integration tests, build, and relevant browser journeys before declaring completion.
- Treat `docs/DESIGN_SYSTEM.md` and the pinned `dexam-portfolio-design-system` source as the strict UI authority. Use existing design tokens and components before creating new patterns; every reusable pattern needs an approved spec and Storybook story.
- Update `docs/CURRENT_STATE.md` when repository state materially changes.
- Add newly deferred functionality to `docs/DEFERRED_WORK.md` with its prerequisites and approval gate; move it to the completion log when implemented or explicitly rejected.
- Do not modify production or incur paid services without explicit approval.

## Collaboration contract

Make low-risk implementation decisions independently. Explain recommendations in plain language. Present material choices as a numbered Decision Gate with options, recommendation, reason, impact, and reversibility. Record the approved answer in the appropriate specification or ADR; chat history is not authoritative.

Whenever requesting a decision or permission, display every proposed option with its cost/impact and recommendation. Never ask the owner to approve an isolated option without showing its alternatives.

## Pre-push quality gate (mandatory)

Standing owner rule D-056 (2026-10-28): every change follows `docs/QUALITY_GATE.md` before anything is pushed:

1. Run every applicable test layer: static, unit, property, component, database/RLS, integration, end-to-end, accessibility, visual, contract, performance, dependency and secret checks.
2. Answer the threat review: standard web risks, AI/agent attacks, cloning/scraping attacks.
3. Review the full diff inside Claude: code review always; security review for Yellow/Red or security-relevant changes. Fix blocking findings.
4. Only then commit and push, with the evidence in the PR.

Never push code that has not passed this gate, and never report a skipped gate as passed.

## GitHub workflow

- After a completed slice is verified and has passed the pre-push quality gate (`docs/QUALITY_GATE.md`), commit it, push the feature branch, check whether that branch already has a pull request, and create a non-draft pull request automatically when one does not exist. Do not ask the product owner to create or submit the pull request.
- Populate the pull-request title and repository template with the implemented scope, approved decisions, verification evidence, risk, and security/privacy/migration notes. Do not ask the product owner to click GitHub's **Create pull request** button.
- Prefer the connected GitHub integration. If it lacks the required write permission, use the product owner's authenticated browser session. Ask the product owner to sign in only when authentication actually blocks the operation.
- Never create duplicate pull requests for the same feature branch. The product owner has given standing authorization to merge a pull request when all required checks pass, its description shows the pre-push quality-gate evidence (`docs/QUALITY_GATE.md`), and there are no unresolved review comments or concerns, and then to continue with the next approved implementation step. Do not merge when checks fail or review concerns remain. Pause only for a decision required by the collaboration contract, a paid service, a production action, sensitive-data risk, or another material expansion beyond approved scope.
