# Roadmap

Each phase is refined through feature specifications and Decision Gates before implementation.

1. Development OS: repository, docs, decisions, templates, prerequisites.
2. Foundation: typed web app, design system, routing, local Supabase, CI, staging.
3. Identity: login, Student/Teacher/Sales/Admin roles, tested RLS.
4. Academic foundation: programs, courses, modules, topics, lessons, enrolments, progress.
5. Assignments: definitions, upload, review, feedback, approved resubmission behavior.
6. Notification foundation: durable events, in-app inbox, scheduling, preferences, retries, and audit trail.
7. CRM: leads, ownership, follow-ups, conversion, and internal marketing-operation alerts.
8. Commerce: products, Razorpay, verified orders, entitlements, expiry.
9. Assessments: question bank, response types, autosave, scoring, results.
10. Media: ebooks, private assets, video.
11. Observability and product intelligence: event taxonomy, feedback, issue triage, reports.
12. Learning AI: shadow evaluation, faculty comparison, governed feedback.
13. Student AI/API/MCP: authorization-aware services exposed only after internal services mature.
14. Aptitude product: assessment, results, and approved lead integration.

## Research horizon — lifelong Dexam

In parallel with later product phases, research continuing value during college, graduation, and working life. Do not schedule implementation until evidence identifies a valuable problem and the owner approves a feature and business model. The initial architecture preserves identity and entitlement continuity under D-005 without adding speculative scope to V1.

The proposed first product milestone delivers a usable slice of phases 2–6: authentication, roles, basic admin, course/enrolment, coursework, assignment submission, teacher feedback, and essential in-app notifications. External messaging channels are not implied.
