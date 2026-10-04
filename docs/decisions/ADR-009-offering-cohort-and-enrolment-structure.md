# ADR-009 — Offering, Cohort, and Enrolment Structure

Status: Approved — Option B
Date: 2026-10-04
Decision ID: D-009
Risk: Red — student access and long-lived academic records

## Decision Gate

### Decision

How should Dexam represent what a student joins so that enrolment can safely authorize account activation today without restricting future courses, workshops, or delivery models?

### Option A — Enrol directly into a course

Create one `courses` record and attach each student directly to it. Put batch/year information on the enrolment.

- **Benefit:** Fewest tables and quickest first implementation.
- **Risk:** Course identity, yearly delivery, schedule, and learner grouping become mixed together. Repeating a course or running parallel batches will require awkward duplication or migration.
- **Cost:** Lowest now, but likely rework when multiple batches or non-course offerings appear.
- **Reversibility:** Moderate; historical enrolments would need migration.

### Option B — Reusable offering with an optional cohort (recommended)

Represent the product as an `offering` and its delivery group as an optional `cohort`. Enrolment links the permanent person to one offering and, when relevant, one cohort. A workshop or self-paced offering may have no cohort.

- **Benefit:** Keeps identity, product definition, and delivery group separate; supports repeat batches, self-paced learning, and future offering types without building those features now.
- **Risk:** Adds one small concept that staff will eventually see when selecting a batch.
- **Cost:** No added service cost and only modest schema/testing complexity.
- **Reversibility:** High for labels and UI; the clean data boundary is intended to last.

### Option C — Program, course, intake, cohort, and section hierarchy now

Build the complete academic hierarchy before the first enrolment workflow.

- **Benefit:** Can represent complex institutions immediately.
- **Risk:** Introduces concepts Dexam has not validated, slows the first usable flow, and creates administrative burden.
- **Cost:** Highest implementation and testing effort.
- **Reversibility:** Low once operational data depends on the hierarchy.

## Recommendation

Approve Option B. It is the smallest structure that avoids foreseeable rework. The interface can still use familiar language such as “Course” and “Batch”; the underlying neutral `offering` boundary preserves the lifelong-member direction.

With Option B, the first implementation will include only:

- offerings: stable code, title, type, status, and optional availability dates;
- cohorts: offering, stable code/name, status, and optional start/end dates;
- enrolments: person, offering, optional cohort, state, effective dates, source, and attributable transition actors;
- constrained transition history and the authorization needed for activation-pack issuance.

It will not implement a full academic hierarchy, payments, scheduling, or content.

## Approval

Option B was approved by the product owner on 2026-10-04. Approval authorizes the local offering, optional cohort, enrolment, transition-history, RLS, and automated-test foundation. It does not authorize production data, payments, messaging, or a full academic hierarchy.
