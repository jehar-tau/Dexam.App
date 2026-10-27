# Documentation Index

Use this map instead of reading the entire documentation tree.

## Read at the start of work

- `CURRENT_STATE.md` — what exists, what is next, and known blockers
- `RELEASE_STATUS.md` — concise implemented-core, remaining launch dependencies and deliberately deferred-module map
- `usage/README.md` — application usage handbook with separate student, teacher, staff and administrator guides; current sign-in/separation limitations
- `PRODUCT.md` — product purpose, users, scope, and current assumptions
- `DECISION_POLICY.md` — what agents may decide and what needs owner approval

## Read when relevant

- `ARCHITECTURE.md` — system boundaries and provisional technical direction
- `DESIGN_SYSTEM.md` — design ownership and implementation rules
- `design/README.md` — Figma token/pattern export pipeline and Storybook catalog
- `SECURITY.md` — mandatory security and privacy baseline
- `PRODUCTION_READINESS.md` — mandatory launch gates, including replacing local email capture with verified real authentication delivery
- `LAUNCH_PLAN.md` — D-042 A sequenced engineering/owner tasks, exit evidence, current launch cost scenarios and unresolved human/workload inputs; planning only
- `RESTORE_REHEARSAL_PLAN.md` — concrete isolated fictional DB/file recovery exercise and failure evidence; local execution approved through D-043 B
- `MAINTENANCE_OPERATIONS_PLAN.md` — current worker/cleanup inventory, failure handling and remaining production operating choices; no scheduler activation
- `AUTH_EMAIL_SETUP_PLAN.md` — owner-confirmed designexam.com, public DNS observations and proposed authentication-sender setup; no live changes
- `STAFF_SECURITY.md` — fictional-stage MFA, session invalidation, independent recovery, and failure/escalation operations
- `QUALITY_GATE.md` — mandatory per-PR gate: test layers, threat review (web, AI/agent, cloning) and Claude review before push
- `TESTING.md` — test layers and definition of done
- `PILOT_READINESS.md` — fictional milestone evidence, acceptance gaps and distinct real-launch gates
- `LOCAL_PILOT_RUNBOOK.md` — repeatable local pilot commands, safety preconditions and exact-fixture failure handling
- `SETUP.md` — local, GitHub, and future environment setup
- `COST_MODEL.md` — free-first budget, scale scenarios, and spending controls
- `ROADMAP.md` — build sequence and milestone boundaries
- `DEFERRED_WORK.md` — canonical register of missing, postponed, and research-only functionality
- `CONTEXT_POLICY.md` — efficient context-loading rules
- `MODEL_POLICY.md` — model/agent responsibilities and review independence

## Work records

- `features/INDEX.md` — feature specifications and statuses
- `decisions/INDEX.md` — product decisions and architecture decision records
- `templates/` — feature, ADR, Decision Gate, and handoff templates

The repository is the source of truth. Update the relevant document when a decision becomes durable.
