# ADR-015 — Academic Content Authoring Authority

Status: Option B approved 2026-10-10

## Question

How should Dexam authorize staff to change curriculum material and assignment definitions, and who may publish those changes to students?

## Why this needs your decision

This creates a new administrative power over the academic experience. A weak boundary could let a teacher or compromised staff account silently change material for every learner. An excessively heavy boundary would force the product owner to ask engineering for routine content changes.

## Options

### A — One global Content Admin permission

One permission allows a staff member to create, edit, and publish every curriculum and assignment.

- **Impact:** Fastest and simplest interface.
- **Cost:** Lowest initial implementation cost.
- **Risk:** A mistaken or compromised account can change and publish all academic content.
- **Reversibility:** Moderate; splitting authority later requires permission and audit migration.

### B — Scoped drafting and separate publishing capabilities (recommended)

Use separate `content.manage_drafts` and `content.publish` capabilities. Draft editors work only within explicitly granted offerings. Publishers review a preview and deliberately publish an immutable version. One trusted person, including the product owner, may hold both capabilities; the separation still prevents accidental publication and permits future delegation.

- **Impact:** You can manage content without engineering while retaining a clear review/publish step.
- **Cost:** Moderate implementation: scoped permissions, preview, publish action, and audit history.
- **Risk:** Low within the approved model; revoking either capability blocks the next protected request.
- **Reversibility:** High; scopes and grants can be tightened without changing curriculum data.

### C — Mandatory two-person publication approval

One editor requests publication and a different authorized person must approve it.

- **Impact:** Strongest protection for every content release.
- **Cost:** Highest operational and implementation cost; awkward while the team is small.
- **Risk:** Low security risk but high workflow friction and blocked releases.
- **Reversibility:** High, but it builds approval machinery before current volume justifies it.

## Recommendation

Approve Option B. It fits the current small team, lets the product owner control content directly, supports future teachers/content staff through offering scopes, and keeps published student material immutable. Publication should record the actor, version, time, and a required release note. A future policy can require two people for selected high-impact releases without replacing this structure.

## Approval

The product owner approved Option B on 2026-10-10. Dexam will separate offering-scoped draft management from deliberate, audited publication. One trusted person may hold both capabilities.
