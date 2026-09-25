# Agent and Model Policy

Choose roles by responsibility rather than brand.

- Planner: read-only; identifies requirements, affected systems, risks, and Decision Gates.
- Implementer: changes one approved scope and adds verification.
- Reviewer: independent from implementation; looks for correctness and regression risks.
- Security reviewer: required for Red-risk changes.
- QA agent: runs automated and browser journeys and reports evidence.

Codex may be the primary engineering agent. Other harnesses/models can implement or independently review once their repository guidance is configured. Do not create an agent swarm by default. Parallel editable work uses separate branches/worktrees, never the same working tree.

Use capable models for architecture, migrations, security, consequential business logic, and ambiguous debugging. Lower-cost models may handle bounded, well-specified, easily verified work. Passing tests never replaces independent judgment for high-risk changes.
