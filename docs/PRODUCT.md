# Product

## Working definition

Dexam Platform is the authenticated learning, teaching, sales, and administration product for Dexam (Design Exam Academy), serving preparation for design entrance examinations such as NID, UCEED, NIFT, and NATA.

It is separate from the public marketing and lead-generation website in `../../Dexam website/Website-Dexam`. Future integration should occur through explicit APIs and approved data flows, not shared browser storage.

## Intended users

- Students learn, complete coursework, submit assignments, receive feedback, and track progress.
- Teachers review work, provide feedback, and manage approved academic workflows.
- Sales staff manage leads and follow-ups within explicitly approved permissions.
- Administrators manage the platform within auditable, least-privilege access.

## Proposed first working milestone

Authentication, roles, basic administration, course/enrolment foundations, coursework, assignment submission, and teacher feedback.

CRM, payments, assessments, AI evaluation, student AI/MCP, media infrastructure, and product intelligence are later phases. Instrumentation should begin alongside the features it measures.

## Product principles

- Student trust and privacy are non-negotiable.
- Human authority remains explicit, especially for evaluation and consequential actions.
- Interfaces should be understandable, accessible, responsive, and consistent with the approved Dexam design system.
- Product behavior is specified before implementation.
- Significant decisions are recorded in the repository.
- A Dexam identity can continue beyond entrance preparation; course completion changes entitlements rather than fragmenting the person's account.
- Long-term retention and monetization must be earned through continuing member value, consent, and trust.

## Long-term horizon

Dexam may evolve from entrance-exam preparation into a lifelong design-learning relationship spanning college, graduation, and professional life. Potential areas include workshops, portfolio and career development, mentorship, community, opportunity discovery, and continuing professional learning.

These are exploration themes, not approved features. See `decisions/ADR-005-lifelong-member-architecture.md` for the architecture boundary that preserves this option without expanding V1 scope.

## Open product work

Detailed role permissions, course structure, assignment/resubmission rules, progress calculation, feedback states, and administration powers require product specifications and Decision Gates.
