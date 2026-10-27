## Scope

Feature/issue:

## What changed

## Decisions and assumptions

## Verification

Follow `docs/QUALITY_GATE.md`. Mark each item done, or write N/A with a reason.

- [ ] Format/lint
- [ ] Typecheck
- [ ] Unit/component tests (bug fixes include a failing-first regression test)
- [ ] Property/generative tests for generators, scoring or timing logic
- [ ] Database/RLS tests (`pnpm db:test`) for migrations, grants or policies
- [ ] Integration tests for server functions, imports, uploads or webhooks
- [ ] End-to-end browser journeys (desktop and mobile)
- [ ] Accessibility checks for UI changes
- [ ] Visual regression screenshots for visual changes
- [ ] Contract tests for changed boundary formats
- [ ] Load test for exam-traffic or live-event changes
- [ ] Production build and bundle budget
- [ ] Dependency audit and secret scan
- [ ] Documentation/current state updated

## Claude review before push

- Code review level and result:
- Security review result (Yellow/Red or security-relevant):
- Findings fixed / left with reason:

## Threat review

- Standard web risks (access control, injection, auth, uploads, webhooks, data exposure):
- AI/agent attacks (prompt injection, action authority, exfiltration, AI-assisted cheating, package hallucination):
- Cloning/scraping attacks (bank harvesting, leak tracing, account sharing/bots, site/phishing clones):

## Risk

Green | Yellow | Red

## Screenshots or recordings

## Security, privacy, migration, and rollback notes
