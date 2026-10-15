# D-042 — Milestone after provisional current-UI approval

Status: Option A approved by owner, 2026-10-15 — launch-readiness planning only

## Question

The owner approved all current UI layouts provisionally and wants engineering to continue rather than pause on each screen. Existing fictional core workflows pass, including the actual staff distribution form. Which workstream should follow?

## Options

- **A — Launch-readiness plan (recommended):** Turn existing email, backup/restore, retention cleanup, uncertain recovery/upload safeguards, support ownership and cost gates into a concrete sequence. ₹0 additional vendor spending for planning. No provider activation, real data, paid service or production deployment; each remains separately gated. Reversible discovery; avoids mistaking a working fictional pilot for a deployable real-student service.
- **B — More existing-flow browser automation:** Expand actual local form coverage for already-approved staff workflows. ₹0 additional vendor spending; no new product feature or launch activation. Strengthens tests but postpones launch policy and operational decisions.
- **C — Deferred-feature discovery:** Select and specify a deferred module such as assessments or payments. ₹0 additional vendor spending for discovery; larger scope and separate permission/provider/cost decisions before implementation. Existing launch gaps remain.

## Approved continuation

F027 merged through PR #62. Prepare F028 and `LAUNCH_PLAN.md`; B/C are not selected. Keep all real-launch gates unchecked. No new screen-by-screen layout approval is requested. Provider choice/activation, operational policy, spending, real data and production remain separately gated.
