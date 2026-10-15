# D-043 — Backup/restore rehearsal scope

Status: Option B approved by owner, 2026-10-15

D-042 approved planning only. `RESTORE_REHEARSAL_PLAN.md` makes the next implementation concrete. The choice is whether to build this local recovery evidence now; it does not choose a production backup provider or recovery policy.

- **A — Continue planning only:** retain the specification and defer execution. ₹0 additional vendor spending; no new recovery evidence.
- **B — Recommended: isolated fictional rehearsal:** implement the documented disposable local DB-and-file recovery harness, failure tests and sanitized report; independent review before merge. ₹0 additional vendor spending, using existing tools. No existing developer database reset, hosted changes, real data, new permissions or paid service. Fixture Auth recreation is explicitly not proof of full production Auth recovery. Reversible local tooling.
- **C — Specify full provider recovery first:** research supported full Auth/project restoration and off-site custody before local implementation. ₹0 additional vendor spending for discovery; broader planning and later provider/cost decisions.

Approved continuation: build and run B's isolated fictional rehearsal, preserving existing development services. Production policy, real data, providers, spending and broader recovery authority remain unapproved. Report uncovered cases explicitly; partial evidence is not full rehearsal acceptance.
