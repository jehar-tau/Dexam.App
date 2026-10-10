# ADR-013 — Coursework Hierarchy and Curriculum Versioning

Status: Approved — Option B
Date: 2026-10-10
Decision ID: D-013
Risk: Red — student-visible learning access and long-lived academic records

## Question

How should Dexam structure Drawing and Aptitude coursework so students can browse topics and lessons now while existing cohorts remain protected from silent future content changes?

## Why this needs your decision

This choice determines what students see, how staff organize learning material, and how historical cohorts are preserved. Reworking it after lessons, assignments, and progress records exist would require a difficult data migration.

## Options

### A — Flat lessons directly on an offering

Attach one ordered list of lessons directly to each existing offering.

- **Impact:** Simplest student interface and smallest schema.
- **Cost:** Lowest initial implementation effort and no new service cost.
- **Risk:** Editing an offering can silently change content for existing cohorts; modules, revisions, and later assignment placement become awkward.
- **Reversibility:** Moderate before real content exists, low after assignments and progress reference lessons.

### B — Versioned curriculum with subject areas, topics, and lessons (recommended)

Each offering owns one or more curriculum versions. A version contains ordered subject areas or sections, such as Drawing and Aptitude, then ordered topics with optional lesson content. Draft versions are editable; published versions are immutable. Each cohort, or cohort-free enrolment, is assigned one published version.

- **Impact:** Students get a familiar course outline while Dexam can improve future delivery without rewriting prior cohorts.
- **Cost:** Modest additional database and testing work; no paid service and no extra infrastructure.
- **Risk:** Staff must understand draft versus published versions, and future version reassignment needs an explicit workflow.
- **Reversibility:** High for labels and interface layout; the version boundary is intended to remain stable.

The provided source sheets confirm that topics are a real curriculum level: Drawing contains sequenced topics with descriptions, while Aptitude contains its own topic list. Assignments remain separate definitions that may link to one or more topics; the assignment tracker's “Module” column becomes an assignment group rather than being forced into the curriculum hierarchy.

For the first slice, optional lesson content is text-first and safely rendered.

### C — Full program, course, module, topic, and lesson hierarchy now

Build every academic level from the long-term roadmap before the first coursework screen.

- **Impact:** Can model a complex institution immediately.
- **Cost:** Highest implementation, administration, and testing effort.
- **Risk:** Dexam has not validated the meaning or workflow of every level; the interface may force unused concepts on teachers and students.
- **Reversibility:** Low once content and progress records depend on the hierarchy.

## Recommendation

Approve Option B. It matches the real Drawing/Aptitude material, protects existing learners from silent curriculum changes, and lets assignments link to topics without mixing content with student status. It also stays free-first: PostgreSQL stores the curriculum, and the existing application renders it.

Approval would authorize the local database and student-browsing foundation for:

- curriculum versions attached to existing offerings;
- ordered subject areas, topics, and optional lessons;
- safe text-first lesson content;
- published-version assignment to cohorts or cohort-free enrolments;
- student-own read policies and automated tests;
- a first coursework outline and lesson-reading interface using fictional preview data.

It would not authorize assignment submission, progress calculation, staff authoring UI, private media hosting, production content, notifications, or a full institutional hierarchy.

## What can continue while pending

- No coursework schema or student coursework interface should be implemented until the hierarchy is approved.
- Existing authentication, enrolment, and student workspace behavior can continue unchanged.

## Approval

Option B was approved by the product owner on 2026-10-10. Approval authorizes the local F005 versioned-curriculum schema, student-own read policies, automated tests, and the first topic/lesson browsing interface using fictional preview data. It does not authorize assignments, progress calculation, staff authoring, private media, or production curriculum import.
