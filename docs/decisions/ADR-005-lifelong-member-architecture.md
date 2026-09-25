# ADR-005 — Lifelong Member Architecture

Status: Approved as a strategic architecture principle
Date: 2026-09-26
Decision ID: D-005
Risk: Yellow — long-term product scope and data-model extensibility

## Context

Dexam begins by helping students prepare for design entrance examinations, but the product owner wants the relationship to continue through college, graduation, and professional life when Dexam can provide genuine ongoing value.

Possible future value includes workshops, college-study support, portfolio and career development, professional learning, community, mentorship, opportunities, and other services that have not yet been validated. Some may eventually be paid. These are ideas, not approved features or promises.

If the first data model treats a person as merely a current entrance-exam enrolment, expanding later would require duplicate accounts, destructive migrations, or fragmented history. The foundation should preserve optionality without building speculative systems now.

## Approved strategic principle

Dexam will architect identity and access so a person's account can continue beyond entrance preparation. The enduring entity is the Dexam member/person, while student stage, enrolments, college relationships, alumni status, professional stage, programs, workshops, purchases, and access rights are time-bound relationships around that person.

Long-term monetization must follow demonstrated member value and informed choice. The architecture may support future paid offerings; approval of this principle does not approve a subscription, marketplace, advertisement model, data sale, or any specific monetization mechanism.

## Architecture implications

### Identity outlives enrolment

- The canonical person identifier from D-004 is permanent and independent of a course, exam year, institution, or employer.
- Completing or expiring a course changes access entitlements; it does not delete or replace the person.
- A returning member uses the same canonical identity after college or employment transitions.
- Duplicate prevention and account recovery must consider long gaps between periods of activity.

### Lifecycle is not a single role

- Do not encode one mutable enum such as `student`, `alumni`, or `professional` as the person's entire identity.
- Model time-bound lifecycle relationships with start/end dates, status, source, and audit history.
- A person can occupy overlapping contexts—for example, an alumnus of one Dexam program, a current workshop learner, and a working professional.
- Authorization remains based on current roles, assignments, ownership, and entitlements rather than marketing lifecycle labels.

### Products and access remain separable

- Courses, workshops, future memberships, events, resources, and services attach through a general offering and entitlement boundary rather than hard-coded account types.
- Entitlements record why access exists, when it starts, when it ends, and whether it was granted, purchased, sponsored, or manually approved.
- Payment history and access rights remain separate so refunds, scholarships, complimentary access, and expiry can be handled correctly later.
- No payment or subscription implementation is authorized by this ADR.

### Progressive profile

- Collect only information required for the current service.
- College, graduation, portfolio, employment, specialization, or career-goal information is added only when a corresponding approved feature provides clear value.
- Members control optional profile visibility and communication preferences.
- Do not retain unnecessary information indefinitely merely because future monetization is possible.

### Historical continuity

- Preserve a member's authorized learning history, credentials, submissions, feedback, purchases, and participation according to future retention decisions.
- Product interfaces may present different experiences by lifecycle context without forking the account.
- Academic records and professional/community activity remain appropriately separated for privacy and permissions.

### Extensible boundaries, not speculative tables

- The initial schema builds only the identity, role, enrolment, course, assignment, and entitlement concepts needed for the first milestone.
- Names and foreign-key boundaries must not assume that every offering is an entrance-exam course.
- College, portfolio, career, community, workshop, mentorship, marketplace, and professional-learning tables are created only when their product specifications are approved.

## Product exploration horizons

These are research areas, not roadmap commitments.

### During college

- Foundation-skill refreshers and specialist workshops
- Portfolio documentation and critique
- Software, making, communication, research, and presentation skills
- Mentorship, peer learning, competitions, internships, and opportunity discovery
- College-transition and learning-support resources

### Around graduation

- Portfolio and case-study preparation
- Interview, internship, apprenticeship, and first-job preparation
- Freelance/business foundations and professional conduct
- Mentor or alumni contribution pathways

### Working life

- Advanced workshops and continuing professional learning
- Critique, mentorship, networking, and community
- Career transitions and specialization
- Optional paid resources, events, or memberships justified by recurring value

Each idea requires user research, a value hypothesis, privacy review, cost model, and Decision Gate before implementation.

## Measures before monetization

Future proposals should demonstrate:

- a recurring problem members actively want solved;
- continued voluntary engagement after exam preparation;
- willingness to pay or another sustainable economic mechanism;
- trust, privacy, and communication consent;
- delivery cost and operational capacity;
- evidence that the offering benefits members rather than merely extending retention.

## Consequences

- The initial identity schema separates `person`, authentication identity, role, enrolment, and entitlement.
- Course completion does not deactivate the underlying account by default; exact post-expiry access remains a future decision.
- The application shell and navigation may evolve by lifecycle context, but no college/professional interface is built in V1.
- Future research must include current students, alumni, college students, recent graduates, and working designers.
- Dexam avoids premature complexity while retaining a clean path to a lifelong learning platform.

## Explicitly not decided

- Which post-exam services Dexam will offer
- Whether alumni access is free, paid, sponsored, or mixed
- Subscription pricing or tiers
- Community and messaging behavior
- Portfolio hosting or public profiles
- Job, internship, mentor, or marketplace functionality
- Advertising or partner access
- Data retention after course completion
- Communication frequency and channels
- Whether members can permanently delete their accounts and which regulated records must remain

## Approval

Approved by the product owner on 2026-09-26 as a future-ready architecture direction. All concrete features and monetization choices remain subject to research and separate approval.
