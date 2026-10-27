# D-053 — Assessment source and first implementation slice

Status: Option B approved by the owner on 2026-10-27 through the instruction to proceed independently of Roughworks.

## Decision

- **A — UI-only imitation:** quickest, but creates no reliable content, scoring or security foundation. Rejected.
- **B — Recommended and approved: independent assessment foundation plus provenance-controlled official import:** build original Dexam behavior and source questions from official publications or owner-authorized material. Use third-party products only as coverage/workflow research. Start with a fictional test runner, then add durable schema/import/scoring/upload slices behind separate verification gates.
- **C — Copy a third-party processed database:** not selected. Requires documented authorization and would import unknown provenance, OCR, answer, image and correction risks.

## Approved defaults

- Support UCEED, CEED, NIFT and NID templates; each published version owns its exact section, timing and marking rules.
- Server time becomes authoritative before real attempts; the current preview timer is illustrative only.
- Part A is computer based; Part B is completed on paper and uploaded within a separately controlled window.
- One assigned attempt by default; any reset or further attempt must be explicit and audited.
- No invasive proctoring in the first release.
- Part A results release only under the test's configured result policy; Part B and combined results wait for human evaluation.
- Official-source identity, paper year, page/location, extraction method, answer-key source, verification state and correction history accompany every imported question.
- No real student data, production activation, provider change or paid service is authorized by this decision.

## Reversibility and risk

The preview is isolated and removable. Later database and result-policy choices are durable and require migrations, RLS tests and explicit acceptance. Import automation must quarantine uncertain OCR, missing assets and answer-key conflicts instead of publishing them.
