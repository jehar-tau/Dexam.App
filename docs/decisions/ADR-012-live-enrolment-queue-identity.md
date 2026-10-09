# ADR-012 — Live Enrolment Queue Identity

Status: Approved — Option B
Date: 2026-10-07
Decision ID: D-012
Risk: Red — student identity and staff-visible personal data

## Decision

The first live Enrolment Operator queue will show and search a student's operational display name alongside the immutable Dexam Member ID.

## Approved model

- `people.display_name` is the person's everyday operational name. It is not evidence of legal identity and must not be labelled as a legal name.
- The first queue searches only display name and Member ID.
- The queue also shows offering, cohort, request source, and approval time.
- Results are oldest-approved-first and initially bounded to 25 records, with a server-enforced maximum of 50.
- A student without a valid display name is not eligible for this queue until trusted staff data is completed.
- Browser clients cannot directly browse other people's records or update display names. The authorization-checked queue function returns only the minimum approved fields.
- Name correction and wider student-profile editing remain trusted-server operations until a dedicated profile workflow is approved.

## Options considered

### A — Privacy-minimal Member-ID-only queue

Use only the existing Member ID and operational enrolment fields. This avoided new personal data but was less usable for staff handling students in person.

### B — Add student display names and search

Add a constrained operational display name and search it alongside Member ID. This creates a small personal-data surface but makes the staff workflow more recognizable and usable.

## Consequences

- The database gains one optional, constrained personal-data field on the canonical person.
- RLS continues to restrict direct person reads; the queue exposes display name only after live employee and `enrollment.operate` checks.
- Tests must cover Sales denial, operator revocation, ineligible students, search bounds, and minimal returned fields.
- Preferred-name, legal-name, phonetic-name, and identity-verification concepts are not implied by this decision.

## Approval

Option B was approved by the product owner on 2026-10-07. This approval covers the operational display-name field and the bounded name/Member-ID queue search. It does not authorize general staff access to student profiles or legal identity documents.
