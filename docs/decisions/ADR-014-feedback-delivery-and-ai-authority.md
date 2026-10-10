# ADR-014 — Feedback Delivery and AI Authority

Status: Approved — Option B
Date: 2026-10-10
Decision ID: D-014
Risk: Red — student evaluation, private submissions, teacher audio, and AI authority

## Question

What authority should AI have when Dexam generates assignment-specific feedback for a manually selected batch of student submissions?

## Why this needs your decision

AI feedback directly affects a student's learning experience and may process private student work. The product must decide whether AI is merely an assistant or may communicate autonomously before we design queues, permissions, audit evidence, and the teacher review interface.

## Options

### A — Human feedback only for V1

Teachers provide voice and written feedback; AI is deferred.

- **Impact:** Clear accountability and smallest privacy surface.
- **Cost:** Lowest technical and vendor cost, highest ongoing teacher time.
- **Risk:** Does not deliver the desired bulk-assistance workflow.
- **Reversibility:** High; AI can be added later.

### B — AI creates rubric-grounded drafts; teacher approval is mandatory (recommended)

An authorized teacher manually selects one assignment and a bounded cohort/student set. AI evaluates each submission against that assignment's versioned rubric and produces a draft. A teacher reviews, edits or rejects, and explicitly publishes each result.

- **Impact:** Reduces repetitive preparation while preserving a named human decision-maker and supporting voice feedback.
- **Cost:** Moderate implementation and future model-usage cost; no provider purchase is authorized by this decision.
- **Risk:** AI can still be wrong or inconsistent, so evidence references, failure states, prompt-injection defenses, and human review are required.
- **Reversibility:** High because AI output remains a draft and the provider boundary can be replaced.

### C — AI publishes feedback automatically after bulk trigger

AI evaluates selected submissions and releases feedback without per-student teacher approval.

- **Impact:** Fastest turnaround and lowest teacher effort.
- **Cost:** Similar model cost but more governance, monitoring, dispute, and remediation work.
- **Risk:** Highest educational, privacy, and trust risk; unsuitable before measured shadow evaluation proves quality.
- **Reversibility:** Low once students rely on or are harmed by autonomous feedback.

## Recommendation

Approve Option B as the product boundary. Build the data model and interfaces so rubrics, batch requests, AI drafts, human edits, approval, and publication are separate attributable records. Keep actual AI-provider integration behind a later technical, privacy, and cost gate.

Voice feedback remains a first-class human feedback type, not an AI substitute. Teacher audio is private, requires explicit recording action, and is released only to the relevant student.

## What can continue while pending

- F005 curriculum modelling can proceed after D-013 approval.
- F006 assignment definitions can reserve a versioned rubric relationship.
- No AI provider, bulk evaluation job, or student-visible AI feedback should be implemented until D-014 and the later vendor/cost gate are approved.

## Approval

Option B was approved by the product owner on 2026-10-10. Approval establishes that AI may create assignment-specific drafts only after a manual bounded trigger and that an authorized teacher must review and explicitly publish every student-visible result. It does not approve an AI provider, paid usage, production student-data processing, voice implementation, or autonomous publication.
