# Decision Policy

The product owner is a designer who relies on the development agent to lead engineering. This increases the agent's responsibility to explain tradeoffs; it does not permit silent product invention.

## Agents decide independently

- Internal naming and organization within approved boundaries
- Reversible implementation details with no user-visible or business effect
- Appropriate tests, refactoring, helpers, and bug fixes
- Equivalent low-risk code patterns
- Routine dependency configuration within the approved stack and cost envelope

Record meaningful implementation notes in the PR or feature specification.

## Owner approval is required

- Anything students or staff see or experience
- Course, assignment, progress, scoring, feedback, or access rules
- Roles, permissions, administrative powers, privacy, or data sharing
- Leads, communications, WhatsApp/Telegram/email automation
- Payments, pricing, refunds, entitlements, or access duration
- AI authority, automatic actions, or AI feedback exposed to users
- Analytics events involving personal or sensitive data
- Student-facing APIs or MCP capabilities
- Major architecture, paid services, recurring cost, vendor lock-in, or difficult-to-reverse choices
- Production changes and destructive data operations

## Decision Gate format

Use `templates/DECISION_GATE_TEMPLATE.md`. Give a recommendation, not merely a menu. Work may continue around a pending choice when it is safe and does not pre-empt the answer.

## Recording decisions

Assign a stable ID (`D-001`, `D-002`, ...), add it to `decisions/INDEX.md`, and update the relevant feature specification or ADR. Conversation history is never the permanent record.
