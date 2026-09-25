# ADR-001 — Foundation Package

Status: Proposed  
Date: 2026-09-26  
Decision ID: D-001

## Recommendation

1. Use three private repositories over time: `dexam-platform`, `dexam-knowledge`, and `dexam-agent-kit`; keep original large/source assets in a non-Git vault.
2. Use Google Drive as the initial source vault, with normalized agent-readable Markdown in `dexam-knowledge`.
3. Use Codex as the primary engineering agent, Claude Code as an additional implementation/review harness, and add OpenCode only when lower-cost model routing has a concrete use.
4. Define V1 as authentication, roles, basic administration, course/enrolment, coursework, assignment submission, and teacher feedback. Defer CRM, payments, assessments, media, AI, MCP, and product-intelligence features while designing clean future boundaries.

## Why

This keeps the application repository focused, protects binary/source materials, avoids premature tooling complexity, and delivers an end-to-end learning workflow before operational expansion.

## Consequences

- More than one repository must eventually be governed and kept discoverable.
- Google Drive organization and access policy become operational responsibilities.
- The first milestone still requires detailed role and workflow decisions before coding those behaviors.
- Future systems are anticipated through boundaries and instrumentation, not built prematurely.

## Approval required

The owner may approve the package, reject individual items, or ask for alternatives. No substantial product implementation depends on this ADR until approval.
